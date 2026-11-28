// The 3D stage. Owns the Three.js scene, the camera and all pointer handling.
// React owns the panels; the two talk through the callbacks and methods below.
//
// Editing happens mostly in Plot view (straight down, narrow lens, so it reads
// like a drawn plot). 3D swings the same camera down to look around: drag
// empty space to orbit, or jump to one of four preset angles.
import * as THREE from "three";
import { defOf, type CustomGear, type GearDef } from "../gear.ts";
import { nextLabel, type PlotItem } from "../plot.ts";
import { buildGear, COLORS as C, lineMat, mat } from "./builders.ts";
import { plopSound } from "./sound.ts";

export type ViewMode = "plot" | "3d";
export const ANGLES = ["From the Audience", "From Stage Left", "From Behind the Kit", "From Stage Right"] as const;

export type EngineCallbacks = {
  /** Gear was added, moved, rotated, relabeled or removed. */
  onChange: (items: PlotItem[]) => void;
  onSelect: (id: number | null) => void;
  onAngle: (name: string) => void;
};

type Footprint = { w: number; d: number; h: number; cx: number; cz: number };

type Piece = PlotItem & {
  def: GearDef;
  holder: THREE.Group;
  inner: THREE.Group;
  outline: THREE.LineLoop;
  fill: THREE.Mesh;
  hit: THREE.Mesh;
  rotLine: THREE.Line;
  rotLen: number;
  fp: Footprint;
  base: number;
  lift: number;
  tiltX: number;
  tiltZ: number;
  drop: { t0: number } | null;
  labelEl: HTMLDivElement;
};

const STAGE_H = 2.5;
const SNAP = 0.5;
const ROT_STEP = Math.PI / 12;

function bounce(p: number) {
  const n = 7.5625,
    d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
  return n * (p -= 2.625 / d) * p + 0.984375;
}

function footprintOf(group: THREE.Object3D): Footprint {
  const b = new THREE.Box3().setFromObject(group);
  return {
    w: b.max.x - b.min.x,
    d: b.max.z - b.min.z,
    h: b.max.y,
    cx: (b.max.x + b.min.x) / 2,
    cz: (b.max.z + b.min.z) / 2,
  };
}

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  x.fillStyle = "#f8f7f3";
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = "#b9b9b2";
  x.beginPath();
  x.arc(32, 32, 3, 0, Math.PI * 2);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function audienceTexture(font: string) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#141414";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = `800 150px ${font}`;
  if ("letterSpacing" in x) (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "-6px";
  x.fillText("AUDIENCE", 512, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class StageEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(20, 1, 0.5, 600);
  private sun: THREE.DirectionalLight;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmp = new THREE.Vector3();
  private stageTex = dotTexture();
  private audienceTex: THREE.CanvasTexture;
  private stageGroup: THREE.Group | null = null;
  private guideX: THREE.Line;
  private guideZ: THREE.Line;
  private plotLine = new THREE.LineBasicMaterial({ color: C.inkSoft });
  private selLine = new THREE.LineBasicMaterial({ color: C.magenta });

  private pieces: Piece[] = [];
  private selected: Piece | null = null;
  private nextId = 1;
  private stageW = 16;
  private stageD = 12;

  private mode: ViewMode = "plot";
  private theta3d = 0;
  private phi3d = 0.9;
  private zoom = 1;
  /** Pixels covered on the left by the Add Gear drawer; the view centers in what's left. */
  private insetTarget = 0;
  private inset = 0;
  private target = new THREE.Vector3(0, 0, 1.4);
  private cur = { phi: 0.0001, theta: 0, fov: 20, dist: 60, tx: 0, ty: 0, tz: 1.4 };

  private snap = true;
  private showLabels = true;
  private reduceMotion: boolean;

  private pointers = new Map<number, { x: number; y: number }>();
  private drag: {
    piece: Piece;
    ox: number;
    oz: number;
    lastX: number;
    lastZ: number;
    moved: boolean;
    fromEmpty: boolean;
  } | null = null;
  private rotDrag: { piece: Piece; last: number } | null = null;
  private pan: { start: THREE.Vector3 } | null = null;
  private orbit: { x: number; y: number } | null = null;
  private pinch: { d: number; zoom: number } | null = null;
  private downAt: { x: number; y: number } | null = null;

  private raf = 0;
  private resizeObserver: ResizeObserver;
  private cleanups: (() => void)[] = [];

  constructor(
    private container: HTMLElement,
    private labelsLayer: HTMLElement,
    private rotHandle: HTMLElement,
    private cb: EngineCallbacks,
    displayFont: string,
    /** View links: look, select and spin, but nothing moves. */
    private readOnly = false,
  ) {
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(C.ground);
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.style.display = "block";
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d8d0, 2.4));
    this.sun = new THREE.DirectionalLight(0xffffff, 1.7);
    this.sun.position.set(-10, 24, 14);
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 });
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);

    this.audienceTex = audienceTexture(displayFont);
    this.guideX = this.guideLine();
    this.guideZ = this.guideLine();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.bindPointer();
    this.setMode("plot");
    this.buildStage();
    this.resize();
    const loop = (now: number) => {
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.cleanups.forEach((f) => f());
    this.pieces.forEach((p) => p.labelEl.remove());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /* ---------- Plot data in and out ---------- */

  load(items: PlotItem[], stage: { w: number; d: number }) {
    this.pieces.forEach((p) => {
      this.scene.remove(p.holder);
      p.labelEl.remove();
    });
    this.pieces = [];
    this.selected = null;
    this.stageW = stage.w;
    this.stageD = stage.d;
    this.buildStage();
    items.forEach((it) => defOf(it) && this.makePiece(it.type, it));
    this.pieces.forEach((p) => this.place(p));
    this.nextId = Math.max(0, ...this.pieces.map((p) => p.id)) + 1;
    this.cb.onSelect(null);
  }

  items(): PlotItem[] {
    return this.pieces.map(({ id, type, label, x, z, rot, lefty, custom }) => ({
      id,
      type,
      label,
      x,
      z,
      rot,
      ...(lefty ? { lefty: true } : {}),
      ...(custom ? { custom } : {}),
    }));
  }

  private changed() {
    this.cb.onChange(this.items());
  }

  setStage(w: number, d: number) {
    this.stageW = w;
    this.stageD = d;
    this.buildStage();
  }

  /* ---------- Gear ---------- */

  /** Add a catalog piece, or a custom one when `custom` is given. */
  plop(type: string, custom?: CustomGear) {
    const def = defOf({ type, custom });
    if (!def) return;
    const [x, z] = this.freeSpot(footprintOf(buildGear(def.build)));
    const p = this.makePiece(type, { x, z, rot: 0, label: nextLabel(this.items(), def), custom });
    this.startDrop(p);
    window.setTimeout(() => plopSound(def.riser ? 0.6 : 1), this.reduceMotion ? 0 : 170);
    this.select(p.id);
    this.changed();
  }

  /**
   * Drop several pieces at once (a saved setup), one after another so each
   * gets its plop. `replace` clears the stage first.
   */
  addItems(items: Omit<PlotItem, "id">[], replace: boolean) {
    if (replace) {
      this.pieces.forEach((p) => {
        this.scene.remove(p.holder);
        p.labelEl.remove();
      });
      this.pieces = [];
    }
    this.select(null);
    const now = performance.now();
    const gap = this.reduceMotion ? 0 : Math.min(70, 900 / Math.max(1, items.length));
    // risers first, so gear placed on them lands on top
    const ordered = [...items].sort((a, b) => Number(!!defOf(b)?.riser) - Number(!!defOf(a)?.riser));
    ordered.forEach((it, i) => {
      if (!defOf(it)) return;
      const p = this.makePiece(it.type, { ...it, id: undefined });
      if (!this.reduceMotion) p.drop = { t0: now + i * gap };
      if (i < 10) window.setTimeout(() => plopSound(p.def.riser ? 0.6 : 0.9 + (i % 3) * 0.12), 170 + i * gap);
    });
    this.pieces.forEach((q) => this.place(q));
    this.changed();
  }

  select(id: number | null) {
    this.selected = this.pieces.find((p) => p.id === id) ?? null;
    this.cb.onSelect(this.selected?.id ?? null);
  }

  update(id: number, patch: Partial<Pick<PlotItem, "label" | "rot" | "x" | "z">>) {
    const p = this.pieces.find((q) => q.id === id);
    if (!p) return;
    Object.assign(p, patch);
    this.pieces.forEach((q) => this.place(q));
    this.changed();
  }

  rotateBy(id: number, radians: number) {
    const p = this.pieces.find((q) => q.id === id);
    if (!p) return;
    this.update(id, { rot: p.rot + radians });
    plopSound(1.4);
  }

  /** Arrow keys. In 3D the arrows follow the camera, so "up" is always away from you. */
  nudge(id: number, right: number, away: number, step: number) {
    const p = this.pieces.find((q) => q.id === id);
    if (!p) return;
    const a = this.mode === "3d" ? this.quadrant() * (Math.PI / 2) : 0;
    const dx = right * Math.cos(a) - away * Math.sin(a);
    const dz = -right * Math.sin(a) - away * Math.cos(a);
    this.update(id, { x: p.x + Math.round(dx) * step, z: p.z + Math.round(dz) * step });
  }

  duplicate(id: number) {
    const s = this.pieces.find((q) => q.id === id);
    if (!s) return;
    const p = this.makePiece(s.type, {
      x: Math.min(s.x + 1, this.stageW / 2),
      z: s.z,
      rot: s.rot,
      lefty: s.lefty,
      custom: s.custom,
      label: nextLabel(this.items(), s.def),
    });
    this.startDrop(p);
    window.setTimeout(() => plopSound(), 170);
    this.select(p.id);
    this.changed();
  }

  /** Flip a kit for a left- or right-handed drummer. */
  setLefty(id: number, lefty: boolean) {
    const p = this.pieces.find((q) => q.id === id);
    if (!p || !p.def.handed || !!p.lefty === lefty) return;
    this.rebuild(id, { lefty });
  }

  /** Change a custom piece's name, shape, size or inputs. */
  setCustom(id: number, custom: CustomGear) {
    const p = this.pieces.find((q) => q.id === id);
    if (!p || p.type !== "custom" || !defOf({ type: "custom", custom })) return;
    // a label that was just the old name follows the new one
    const label = p.label === p.custom?.name ? custom.name : p.label;
    this.rebuild(id, { custom, label });
  }

  /** Swap a piece's model in place, keeping its id, spot and place in the list. */
  private rebuild(id: number, patch: Partial<PlotItem>) {
    const idx = this.pieces.findIndex((q) => q.id === id);
    const old = this.pieces[idx];
    if (!old) return;
    const wasSelected = this.selected === old;
    this.scene.remove(old.holder);
    old.labelEl.remove();
    this.pieces.splice(idx, 1);
    const { type, label, x, z, rot, lefty, custom } = old;
    const p = this.makePiece(type, { id, label, x, z, rot, lefty, custom, ...patch });
    // keep its place in the list (input order breaks ties by position)
    this.pieces.pop();
    this.pieces.splice(idx, 0, p);
    if (wasSelected) this.selected = p;
    this.pieces.forEach((q) => this.place(q));
    plopSound(0.7);
    this.changed();
  }

  remove(id: number) {
    const p = this.pieces.find((q) => q.id === id);
    if (!p) return;
    this.scene.remove(p.holder);
    p.labelEl.remove();
    this.pieces = this.pieces.filter((q) => q !== p);
    if (this.selected === p) this.select(null);
    this.pieces.forEach((q) => this.place(q));
    this.changed();
  }

  clear() {
    this.load([], { w: this.stageW, d: this.stageD });
    this.changed();
  }

  /* ---------- View ---------- */

  setMode(m: ViewMode) {
    this.mode = m;
    this.zoom = 1;
    this.sun.castShadow = m === "3d";
    this.defaultTarget();
  }
  turn(dir: 1 | -1) {
    const q = Math.round(this.theta3d / (Math.PI / 2)) + dir;
    this.theta3d = q * (Math.PI / 2);
    this.phi3d = 0.9;
    this.defaultTarget();
    this.reportAngle();
  }
  zoomBy(f: number) {
    this.zoom = Math.max(0.35, Math.min(2.5, this.zoom * f));
  }
  fit() {
    this.zoom = 1;
    this.defaultTarget();
  }
  /** Keep the stage centered in the part of the view a drawer isn't covering. */
  setInsetLeft(px: number) {
    this.insetTarget = Math.max(0, px);
  }
  setSnap(v: boolean) {
    this.snap = v;
  }
  setShowLabels(v: boolean) {
    this.showLabels = v;
  }

  private quadrant() {
    return ((Math.round(this.theta3d / (Math.PI / 2)) % 4) + 4) % 4;
  }
  private reportAngle() {
    const q = this.quadrant();
    const exact = Math.abs(this.theta3d - Math.round(this.theta3d / (Math.PI / 2)) * (Math.PI / 2)) < 0.02;
    this.cb.onAngle(exact ? ANGLES[q] : `Near ${ANGLES[q].replace("From ", "")}`);
  }
  private defaultTarget() {
    if (this.mode === "plot") this.target.set(0, 0, 1.4);
    else this.target.set(0, 0.5, this.quadrant() % 2 ? 0 : 1.2);
  }

  private goal() {
    const w = this.container.clientWidth || 1,
      h = this.container.clientHeight || 1;
    const plot = this.mode === "plot";
    const fov = plot ? 20 : 40;
    const v = THREE.MathUtils.degToRad(fov) / 2;
    const hf = Math.atan(Math.tan(v) * (Math.max(1, w - this.inset) / h));
    const side = !plot && this.quadrant() % 2 === 1;
    const spanH = (side ? this.stageD : this.stageW) + 3;
    const spanV = plot ? this.stageD + 8 : (side ? this.stageW : this.stageD) + 9;
    const dist = Math.max(spanH / 2 / Math.tan(hf), spanV / 2 / Math.tan(v)) * this.zoom;
    return { phi: plot ? 0.0001 : this.phi3d, theta: plot ? 0 : this.theta3d, fov, dist };
  }

  private updateCamera(snap: boolean) {
    const g = this.goal(),
      c = this.cur;
    const k = snap || this.reduceMotion ? 1 : 0.14;
    this.inset += (this.insetTarget - this.inset) * (snap || this.reduceMotion ? 1 : 0.25);
    if (Math.abs(this.insetTarget - this.inset) < 0.5) this.inset = this.insetTarget;
    const dt = Math.atan2(Math.sin(g.theta - c.theta), Math.cos(g.theta - c.theta));
    c.theta += dt * k;
    c.phi += (g.phi - c.phi) * k;
    c.fov += (g.fov - c.fov) * k;
    c.dist += (g.dist - c.dist) * k;
    c.tx += (this.target.x - c.tx) * k;
    c.ty += (this.target.y - c.ty) * k;
    c.tz += (this.target.z - c.tz) * k;
    const sp = Math.sin(c.phi);
    const cam = this.camera;
    cam.position.set(
      c.tx + c.dist * sp * Math.sin(c.theta),
      c.ty + c.dist * Math.cos(c.phi),
      c.tz + c.dist * sp * Math.cos(c.theta),
    );
    // Looking straight down, "up" is ambiguous: keep the audience at the bottom.
    if (c.phi < 0.01) cam.up.set(-Math.sin(c.theta), 0, -Math.cos(c.theta));
    else cam.up.set(0, 1, 0);
    cam.lookAt(c.tx, c.ty, c.tz);
    cam.fov = c.fov;
    const W = this.container.clientWidth,
      H = this.container.clientHeight;
    if (this.inset > 0.5 && W && H) cam.setViewOffset(W, H, -this.inset / 2, 0, W, H);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }

  private resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.updateCamera(true);
  }

  /* ---------- Scene building ---------- */

  private buildStage() {
    if (this.stageGroup) this.scene.remove(this.stageGroup);
    const g = new THREE.Group();
    const W = this.stageW,
      D = this.stageD;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(C.ground));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -STAGE_H;
    ground.receiveShadow = true;
    g.add(ground);

    this.stageTex.repeat.set(W, D);
    const top = new THREE.MeshLambertMaterial({ map: this.stageTex });
    const side = mat(C.ink);
    const deckGeo = new THREE.BoxGeometry(W, STAGE_H, D);
    const deck = new THREE.Mesh(deckGeo, [side, side, top, side, side, side]);
    deck.position.y = -STAGE_H / 2;
    deck.receiveShadow = true;
    deck.add(new THREE.LineSegments(new THREE.EdgesGeometry(deckGeo), lineMat(C.ink)));
    g.add(deck);

    const edge = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.12), mat(C.magenta));
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 0.004, D / 2 - 0.06);
    g.add(edge);

    const tw = Math.min(W * 0.7, 12);
    const txt = new THREE.Mesh(
      new THREE.PlaneGeometry(tw, tw / 4),
      new THREE.MeshBasicMaterial({ map: this.audienceTex, transparent: true }),
    );
    txt.rotation.x = -Math.PI / 2;
    txt.position.set(0, -STAGE_H + 0.01, D / 2 + 1.6 + tw / 8);
    g.add(txt);

    this.stageGroup = g;
    this.scene.add(g);
  }

  private makePiece(type: string, data: Partial<PlotItem>): Piece {
    const def = defOf({ type, custom: data.custom })!;
    const inner = buildGear(def.build, { lefty: !!data.lefty && def.handed });
    const fp = footprintOf(inner);
    const pad = 0.08;
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(fp.cx - fp.w / 2 - pad, 0.02, fp.cz - fp.d / 2 - pad),
        new THREE.Vector3(fp.cx + fp.w / 2 + pad, 0.02, fp.cz - fp.d / 2 - pad),
        new THREE.Vector3(fp.cx + fp.w / 2 + pad, 0.02, fp.cz + fp.d / 2 + pad),
        new THREE.Vector3(fp.cx - fp.w / 2 - pad, 0.02, fp.cz + fp.d / 2 + pad),
      ]),
      this.plotLine,
    );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(fp.w + pad * 2, fp.d + pad * 2),
      new THREE.MeshBasicMaterial({ color: C.magenta, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(fp.cx, 0.015, fp.cz);
    // Grab area: the whole footprint, never smaller than about a foot square.
    const hb = { w: Math.max(fp.w, 1.3), d: Math.max(fp.d, 1.3), h: Math.max(fp.h, 0.8) };
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(hb.w, hb.h, hb.d),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    hit.position.set(fp.cx, hb.h / 2, fp.cz);
    const rotLen = Math.max(fp.d / 2, 0.65) + 0.7;
    const rotLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(fp.cx, 0.03, fp.cz),
        new THREE.Vector3(0, 0.03, rotLen),
      ]),
      this.selLine,
    );
    const holder = new THREE.Group();
    holder.add(inner, outline, fill, hit, rotLine);

    const labelEl = document.createElement("div");
    labelEl.className = "plot-label";
    this.labelsLayer.appendChild(labelEl);

    const p: Piece = {
      id: data.id ?? this.nextId++,
      type,
      label: data.label ?? def.base,
      x: data.x ?? 0,
      z: data.z ?? 0,
      rot: data.rot ?? 0,
      lefty: !!data.lefty && !!def.handed,
      custom: type === "custom" ? data.custom : undefined,
      def,
      holder,
      inner,
      outline,
      fill,
      hit,
      rotLine,
      rotLen,
      fp,
      base: 0,
      lift: 0,
      tiltX: 0,
      tiltZ: 0,
      drop: null,
      labelEl,
    };
    if (data.id && data.id >= this.nextId) this.nextId = data.id + 1;
    hit.userData.piece = p;
    labelEl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.select(p.id);
    });
    this.scene.add(holder);
    this.pieces.push(p);
    this.place(p);
    return p;
  }

  private elevationAt(p: Piece) {
    if (p.def.riser) return 0;
    for (const r of this.pieces) {
      if (!r.def.riser || r === p) continue;
      const dx = p.x - r.x,
        dz = p.z - r.z;
      const c = Math.cos(-r.rot),
        s = Math.sin(-r.rot);
      const lx = dx * c - dz * s,
        lz = dx * s + dz * c;
      if (Math.abs(lx) < r.fp.w / 2 && Math.abs(lz) < r.fp.d / 2) return r.fp.h;
    }
    return 0;
  }

  private place(p: Piece) {
    p.base = this.elevationAt(p);
    p.holder.position.set(p.x, p.base + p.lift, p.z);
    p.holder.rotation.set(p.tiltX, p.rot, p.tiltZ, "YXZ");
  }

  private startDrop(p: Piece) {
    if (!this.reduceMotion) p.drop = { t0: performance.now() };
  }

  private freeSpot(fp: Footprint): [number, number] {
    const r = Math.max(fp.w, fp.d) / 2;
    const cands: [number, number][] = [];
    for (let x = -this.stageW / 2 + 1; x <= this.stageW / 2 - 1; x += 0.5)
      for (let z = -this.stageD / 2 + 1; z <= this.stageD / 2 - 1; z += 0.5) cands.push([x, z]);
    cands.sort((a, b) => a[0] ** 2 + (a[1] - 1) ** 2 - (b[0] ** 2 + (b[1] - 1) ** 2));
    for (const [x, z] of cands) {
      const ok = this.pieces.every(
        (o) => o.def.riser || Math.hypot(o.x - x, o.z - z) > (Math.max(o.fp.w, o.fp.d) / 2 + r) * 0.75,
      );
      if (ok) return [x, z];
    }
    return [0, 1];
  }

  private guideLine() {
    const l = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]),
      new THREE.LineDashedMaterial({ color: C.magenta, dashSize: 0.35, gapSize: 0.2 }),
    );
    l.visible = false;
    this.scene.add(l);
    return l;
  }

  /* ---------- Pointer ---------- */

  private setNdc(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  private floorPoint(e: PointerEvent, y = 0) {
    this.setNdc(e);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.plane.constant = -y;
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.plane, p) ? p : null;
  }
  private hitPiece(e: PointerEvent): Piece | null {
    this.setNdc(e);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(
      this.pieces.map((p) => p.hit),
      false,
    );
    if (!hits.length) return null;
    const pieceOf = (h: THREE.Intersection) => h.object.userData.piece as Piece;
    const solid = hits.filter((h) => !pieceOf(h).def.riser);
    if (!solid.length) return pieceOf(hits[0]);
    // Overlapping grab areas: take the piece whose center is nearest the pointer.
    const at = this.floorPoint(e, 0) ?? hits[0].point;
    let best: Piece | null = null,
      bd = Infinity;
    for (const h of solid) {
      const p = pieceOf(h);
      const d = Math.hypot(p.x - at.x, p.z - at.z) / Math.max(0.6, Math.min(p.fp.w, p.fp.d));
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  private align(p: Piece, x: number, z: number): [number, number] {
    this.guideX.visible = this.guideZ.visible = false;
    const others = this.pieces.filter((o) => o !== p && !o.def.riser);
    const T = 0.3,
      y = p.base + 0.03;
    const nearest = (vals: number[], v: number) =>
      vals.reduce<number | null>(
        (b, c) => (Math.abs(c - v) < T && (b === null || Math.abs(c - v) < Math.abs(b - v)) ? c : b),
        null,
      );
    const bx = nearest([0, ...others.map((o) => o.x)], x);
    const bz = nearest(
      others.map((o) => o.z),
      z,
    );
    const show = (l: THREE.Line, a: THREE.Vector3, b: THREE.Vector3) => {
      l.geometry.setFromPoints([a, b]);
      l.computeLineDistances();
      l.visible = true;
    };
    if (bx !== null) {
      x = bx;
      show(this.guideX, new THREE.Vector3(x, y, -this.stageD / 2), new THREE.Vector3(x, y, this.stageD / 2));
    }
    if (bz !== null) {
      z = bz;
      show(this.guideZ, new THREE.Vector3(-this.stageW / 2, y, z), new THREE.Vector3(this.stageW / 2, y, z));
    }
    return [x, z];
  }

  private beginDrag(p: Piece, e: PointerEvent, fromEmpty = false) {
    const at = this.floorPoint(e, p.base);
    if (!at) return;
    this.drag = { piece: p, ox: p.x - at.x, oz: p.z - at.z, lastX: p.x, lastZ: p.z, moved: false, fromEmpty };
    p.drop = null;
    this.renderer.domElement.style.cursor = "grabbing";
  }
  private moveDrag(e: PointerEvent) {
    const d = this.drag!;
    const p = d.piece;
    const at = this.floorPoint(e, p.base);
    if (!at) return;
    let x = at.x + d.ox,
      z = at.z + d.oz;
    if (this.snap) {
      x = Math.round(x / SNAP) * SNAP;
      z = Math.round(z / SNAP) * SNAP;
    }
    [x, z] = this.align(p, x, z);
    x = Math.max(-this.stageW / 2 - 1, Math.min(this.stageW / 2 + 1, x));
    z = Math.max(-this.stageD / 2 - 1, Math.min(this.stageD / 2 + 1, z));
    const vx = x - d.lastX,
      vz = z - d.lastZ;
    if (vx || vz) d.moved = true;
    p.tiltZ = Math.max(-0.12, Math.min(0.12, -vx * 0.25));
    p.tiltX = Math.max(-0.12, Math.min(0.12, vz * 0.25));
    d.lastX = x;
    d.lastZ = z;
    p.x = x;
    p.z = z;
    p.lift = 0.35;
  }
  private endDrag() {
    const { piece, moved } = this.drag!;
    this.drag = null;
    this.guideX.visible = this.guideZ.visible = false;
    piece.lift = 0;
    this.pieces.forEach((q) => this.place(q));
    this.renderer.domElement.style.cursor = "";
    if (moved) {
      plopSound(0.85);
      this.changed();
    }
  }

  private bindPointer() {
    const canvas = this.renderer.domElement;
    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      el.addEventListener(type, fn, opts);
      this.cleanups.push(() => el.removeEventListener(type, fn, opts));
    };

    on(canvas, "pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        if (this.drag) this.endDrag();
        this.pan = this.orbit = null;
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom };
        return;
      }
      if (this.pointers.size > 2) return;
      this.downAt = { x: e.clientX, y: e.clientY };
      const p = this.hitPiece(e);
      if (p && this.readOnly) {
        this.select(p.id);
        return;
      }
      if (p) {
        this.select(p.id);
        this.beginDrag(p, e);
        return;
      }
      if (this.mode === "3d") {
        this.orbit = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = "grabbing";
        return;
      }
      if (e.pointerType !== "mouse" && this.selected && !this.readOnly) {
        // Touch in Plot: drag on empty stage moves the selected piece, so a finger never hides it.
        this.beginDrag(this.selected, e, true);
        return;
      }
      const at = this.floorPoint(e, 0);
      if (at) this.pan = { start: at };
    });

    on(canvas, "pointermove", (e) => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoom = Math.max(0.35, Math.min(2.5, (this.pinch.zoom * this.pinch.d) / Math.max(1, d)));
        return;
      }
      if (this.drag) return this.moveDrag(e);
      if (this.orbit) {
        this.theta3d -= (e.clientX - this.orbit.x) * 0.008;
        this.phi3d = Math.max(0.2, Math.min(1.4, this.phi3d - (e.clientY - this.orbit.y) * 0.006));
        this.cur.theta = this.theta3d;
        this.cur.phi = this.phi3d;
        this.orbit = { x: e.clientX, y: e.clientY };
        this.reportAngle();
        return;
      }
      if (this.pan) {
        this.updateCamera(true);
        const at = this.floorPoint(e, 0);
        if (at) {
          this.target.x = Math.max(-this.stageW, Math.min(this.stageW, this.target.x + this.pan.start.x - at.x));
          this.target.z = Math.max(-this.stageD, Math.min(this.stageD + 6, this.target.z + this.pan.start.z - at.z));
          this.cur.tx = this.target.x;
          this.cur.tz = this.target.z;
        }
        return;
      }
      if (e.pointerType === "mouse") canvas.style.cursor = this.hitPiece(e) ? (this.readOnly ? "pointer" : "grab") : "";
    });

    const end = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pinch) {
        if (this.pointers.size < 2) this.pinch = null;
        return;
      }
      const tap = !!this.downAt && Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) < 6;
      if (this.drag) {
        const fromEmpty = this.drag.fromEmpty;
        this.endDrag();
        if (fromEmpty && tap) this.select(null);
      } else if (this.pan || this.orbit) {
        this.pan = this.orbit = null;
        canvas.style.cursor = "";
        if (tap) this.select(null);
      }
      this.downAt = null;
    };
    on(canvas, "pointerup", end);
    on(canvas, "pointercancel", end);
    on(
      canvas,
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoomBy(Math.exp(e.deltaY * 0.0015));
      },
      { passive: false },
    );

    // Rotate handle: drag around the piece, snapping to 15° steps.
    const h = this.rotHandle;
    on(h, "pointerdown", (e) => {
      if (!this.selected) return;
      e.preventDefault();
      e.stopPropagation();
      h.setPointerCapture(e.pointerId);
      this.rotDrag = { piece: this.selected, last: this.selected.rot };
    });
    on(h, "pointermove", (e) => {
      if (!this.rotDrag) return;
      const p = this.rotDrag.piece;
      const at = this.floorPoint(e, p.base);
      if (!at) return;
      let r = Math.atan2(at.x - p.x, at.z - p.z);
      if (this.snap) r = Math.round(r / ROT_STEP) * ROT_STEP;
      if (r !== this.rotDrag.last && this.snap) plopSound(2.2);
      this.rotDrag.last = r;
      p.rot = r;
      this.place(p);
    });
    const rotEnd = () => {
      if (!this.rotDrag) return;
      this.rotDrag = null;
      this.pieces.forEach((q) => this.place(q));
      this.changed();
    };
    on(h, "pointerup", rotEnd);
    on(h, "pointercancel", rotEnd);
  }

  /* ---------- Frame ---------- */

  private frame(now: number) {
    this.updateCamera(false);
    const plotish = this.cur.phi < 0.35;
    const W = this.container.clientWidth,
      H = this.container.clientHeight;
    const toScreen = (v: THREE.Vector3) => {
      v.project(this.camera);
      return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H] as const;
    };

    for (const p of this.pieces) {
      if (p.drop && now < p.drop.t0) {
        // queued in a setup drop: not here yet
        p.holder.visible = false;
        p.labelEl.classList.add("dim");
        continue;
      }
      p.holder.visible = true;
      if (p.drop) {
        const t = Math.min(1, (now - p.drop.t0) / 520);
        p.holder.position.set(p.x, p.base + (1 - bounce(t)) * 5, p.z);
        const sq = t > 0.33 && t < 0.55 ? Math.sin(((t - 0.33) / 0.22) * Math.PI) * 0.12 : 0;
        p.inner.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
        p.holder.rotation.set(0, p.rot, 0);
        if (t >= 1) {
          p.drop = null;
          p.inner.scale.set(1, 1, 1);
        }
      } else {
        if (this.drag?.piece !== p) {
          p.tiltX *= 0.82;
          p.tiltZ *= 0.82;
        }
        p.holder.position.x = p.x;
        p.holder.position.z = p.z;
        p.holder.position.y += (p.base + p.lift - p.holder.position.y) * 0.35;
        p.holder.rotation.set(p.tiltX, p.rot, p.tiltZ, "YXZ");
      }

      const isSel = p === this.selected;
      p.outline.visible = isSel || plotish;
      p.outline.material = isSel ? this.selLine : this.plotLine;
      p.fill.visible = isSel;
      p.rotLine.visible = isSel && !p.def.riser && !this.readOnly;

      const el = p.labelEl;
      const show = this.showLabels || isSel;
      el.classList.toggle("dim", !show);
      if (!show) continue;
      if (plotish) {
        const hz = (Math.abs(Math.sin(p.rot)) * p.fp.w) / 2 + (Math.abs(Math.cos(p.rot)) * p.fp.d) / 2;
        this.tmp.set(p.x, p.base, p.z - hz - 0.15);
      } else {
        this.tmp.set(p.x, p.holder.position.y + p.fp.h + 0.25, p.z);
      }
      const [sx, sy] = toScreen(this.tmp);
      el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
      if (el.textContent !== p.label) el.textContent = p.label;
      el.classList.toggle("sel", isSel);
      el.style.zIndex = isSel ? "3" : p.def.riser ? "1" : "2";
    }

    const s = this.selected;
    if (s && !s.def.riser && !s.drop && !this.readOnly) {
      this.tmp.set(s.x + Math.sin(s.rot) * s.rotLen, s.holder.position.y + 0.03, s.z + Math.cos(s.rot) * s.rotLen);
      const [hx, hy] = toScreen(this.tmp);
      this.rotHandle.hidden = false;
      this.rotHandle.style.transform = `translate(${hx}px, ${hy}px) translate(-50%, -50%)`;
    } else {
      this.rotHandle.hidden = true;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
