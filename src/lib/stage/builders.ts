// Gear models: simple shapes in paper and ink with drawn edges, like a cut-out.
// Units are feet; each model sits on y = 0 and faces +z (the audience).
import * as THREE from "three";
import { IN, type BuildSpec } from "../gear.ts";

export const COLORS = {
  ink: 0x141414,
  inkSoft: 0x5d5d58,
  paper: 0xf8f7f3,
  photo: 0xfbfaf5,
  ground: 0xe4e4df,
  g300: 0xc9c9c2,
  dot: 0xb9b9b2,
  cyan: 0x00b4e6,
  magenta: 0xff40a6,
  yellow: 0xffe500,
  pink: 0xf7c8dc,
  mint: 0xc9eddc,
  lilac: 0xdcd2f6,
  butter: 0xfbeeaa,
} as const;
const C = COLORS;

const matCache = new Map<number, THREE.MeshLambertMaterial>();
const lineCache = new Map<number, THREE.LineBasicMaterial>();
export const mat = (c: number) => {
  let m = matCache.get(c);
  if (!m) matCache.set(c, (m = new THREE.MeshLambertMaterial({ color: c })));
  return m;
};
export const lineMat = (c: number) => {
  let m = lineCache.get(c);
  if (!m) lineCache.set(c, (m = new THREE.LineBasicMaterial({ color: c })));
  return m;
};

function part(g: THREE.Group, geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, edges = true) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (edges) {
    const dark = color === C.ink || color === C.inkSoft;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), lineMat(dark ? 0x8a8a84 : C.ink)));
  }
  g.add(m);
  return m;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r: number, h: number, s = 28) => new THREE.CylinderGeometry(r, r, h, s);
function pole(g: THREE.Group, x: number, z: number, top: number, base = 0) {
  part(g, cyl(0.035, top - base, 8), C.inkSoft, x, base + (top - base) / 2, z, false);
  part(g, cyl(0.38, 0.03, 3), C.inkSoft, x, base + 0.02, z, false);
}

// Seen from the drummer's seat, facing the audience (+z), their left is +x.
// A right-handed kit puts the hi-hat and snare on the left and the floor tom
// and ride on the right; a lefty kit is the mirror image. `s` flips every x.
function kit(kick: number, toms: number[], floor: number[], lefty: boolean) {
  const s = lefty ? -1 : 1;
  const g = new THREE.Group();
  const kr = IN(kick) / 2;
  const kg = cyl(kr, IN(16), 32);
  kg.rotateX(Math.PI / 2);
  part(g, kg, C.paper, 0, kr, 0.3);
  const ring = new THREE.Mesh(new THREE.RingGeometry(kr * 0.55, kr * 0.62, 32), mat(C.ink));
  ring.position.set(0, kr, 0.3 + IN(8) + 0.005);
  g.add(ring);
  toms.forEach((t, idx) => {
    const tg = cyl(IN(t) / 2, IN(8));
    tg.rotateX(-0.45);
    const x = s * (toms.length === 1 ? 0.1 : idx === 0 ? 0.55 : -0.5);
    part(g, tg, C.paper, x, kr * 2 + 0.45, 0.1);
  });
  floor.forEach((f) => {
    part(g, cyl(IN(f) / 2, IN(14)), C.paper, -1.55 * s, 1.35, -0.5);
    pole(g, -1.55 * s, -0.5, 0.75);
  });
  part(g, cyl(IN(14) / 2, IN(5.5)), C.paper, 1.15 * s, 2.05, -0.75);
  pole(g, 1.15 * s, -0.75, 1.8);
  part(g, cyl(IN(14) / 2, 0.03), C.butter, 2.0 * s, 3.05, -0.75);
  part(g, cyl(IN(14) / 2, 0.03), C.butter, 2.0 * s, 3.15, -0.75);
  pole(g, 2.0 * s, -0.75, 3.05);
  part(g, cyl(IN(18) / 2, 0.025), C.butter, 1.3 * s, 4.3, 0.55).rotation.x = 0.25;
  pole(g, 1.3 * s, 0.55, 4.25);
  part(g, cyl(IN(20) / 2, 0.025), C.butter, -2.05 * s, 3.7, 0.4).rotation.z = 0.2 * s;
  pole(g, -2.05 * s, 0.4, 3.65);
  part(g, cyl(0.5, 0.18), C.ink, 0, 1.85, -1.9);
  pole(g, 0, -1.9, 1.76);
  return g;
}

function riser(w: number, d: number, h: number) {
  const g = new THREE.Group();
  part(g, box(w, h, d), C.photo, 0, h / 2, 0);
  part(g, box(w, h * 0.92, 0.02), C.ink, 0, h * 0.46, d / 2 + 0.011, false);
  return g;
}

function combo(w: number, h: number, d: number, grill: number) {
  const g = new THREE.Group();
  part(g, box(w, h, d), C.ink, 0, h / 2 + 0.04, 0);
  part(g, box(w - 0.22, h * 0.6, 0.02), grill, 0, h * 0.37 + 0.04, d / 2 + 0.012, false);
  part(g, box(w - 0.22, 0.16, 0.02), C.paper, 0, h - 0.14, d / 2 + 0.012, false);
  return g;
}

function stack(cw: number, ch: number, cd: number, hw: number, hh: number, hd: number) {
  const g = new THREE.Group();
  part(g, box(cw, ch, cd), C.ink, 0, ch / 2 + 0.06, 0);
  part(g, box(cw - 0.2, ch - 0.25, 0.02), C.inkSoft, 0, ch / 2 + 0.06, cd / 2 + 0.012, false);
  part(g, box(hw, hh, hd), C.ink, 0, ch + 0.06 + hh / 2, -0.04);
  part(g, box(hw - 0.15, hh * 0.45, 0.02), C.paper, 0, ch + 0.06 + hh / 2, -0.04 + hd / 2 + 0.012, false);
  return g;
}

function board(w: number, d: number) {
  const g = new THREE.Group();
  part(g, box(w, 0.14, d), C.g300, 0, 0.07, 0);
  const cols = [C.pink, C.mint, C.lilac, C.butter, C.photo];
  const pw = 0.24,
    gap = 0.06;
  const rows = d > 0.85 ? 2 : 1;
  const n = Math.max(1, Math.floor((w - 0.1) / (pw + gap)));
  let k = 0;
  for (let r = 0; r < rows; r++) {
    const zz = rows === 1 ? 0 : r === 0 ? -d / 4 : d / 4;
    for (let c = 0; c < n; c++) {
      const xx = -((n - 1) * (pw + gap)) / 2 + c * (pw + gap);
      part(g, box(pw, 0.12, Math.min(0.36, d * (rows === 1 ? 0.8 : 0.42))), cols[k++ % cols.length], xx, 0.2, zz);
    }
  }
  return g;
}

function keys(w: number, d: number, stand: "x" | "legs") {
  const g = new THREE.Group();
  const y = 2.95;
  if (stand === "x") {
    for (const s of [-1, 1]) {
      for (const zz of [-0.18, 0.18]) {
        part(g, box(0.07, 3.6, 0.07), C.inkSoft, s * w * 0.18, 1.4, zz, false).rotation.z = 0.62;
        part(g, box(0.07, 3.6, 0.07), C.inkSoft, s * w * 0.18, 1.4, zz, false).rotation.z = -0.62;
      }
    }
  } else {
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      part(g, cyl(0.06, y - 0.15, 8), C.inkSoft, sx * (w / 2 - 0.25), (y - 0.15) / 2, sz * (d / 2 - 0.25), false);
    }
  }
  part(g, box(w, 0.32, d), C.ink, 0, y, 0);
  // the keys face the player, upstage (-z)
  part(g, box(w - 0.3, 0.05, d * 0.42), C.paper, 0, y + 0.18, -d / 2 + d * 0.24);
  return g;
}

function micStand() {
  const g = new THREE.Group();
  pole(g, 0, 0, 4.0);
  part(g, box(0.05, 0.05, 1.7), C.inkSoft, 0, 4.25, -0.7, false).rotation.x = -0.32;
  part(g, cyl(0.07, 0.5, 12), C.ink, 0, 4.48, -1.48, false).rotation.x = Math.PI / 2 - 0.3;
  part(g, new THREE.SphereGeometry(0.11, 14, 10), C.g300, 0, 4.55, -1.74, false);
  return g;
}

function wedge() {
  const s = new THREE.Shape();
  const hd = IN(16) / 2;
  s.moveTo(hd, 0);
  s.lineTo(-hd, 0);
  s.lineTo(-hd, IN(14));
  s.lineTo(hd, IN(5));
  s.lineTo(hd, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: IN(22), bevelEnabled: false });
  geo.translate(0, 0, -IN(11));
  geo.rotateY(Math.PI / 2);
  const g = new THREE.Group();
  part(g, geo, C.ink);
  return g;
}

function smallBox(w: number, h: number, d: number, color: number) {
  const g = new THREE.Group();
  part(g, box(w, h, d), color, 0, h / 2, 0);
  return g;
}

// A table or stand with something on top: synth, laptop, hand percussion, or nothing.
function table(w: number, d: number, h: number, top: "none" | "synth" | "laptop" | "percussion") {
  const g = new THREE.Group();
  const slab = 0.08;
  part(g, box(w, slab, d), C.photo, 0, h - slab / 2, 0);
  const inset = Math.min(0.15, w / 6, d / 6);
  const legs =
    w < 1.6 && d < 1.6
      ? [[0, 0]]
      : [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ];
  for (const [sx, sz] of legs) {
    const lx = sx * (w / 2 - inset),
      lz = sz * (d / 2 - inset);
    if (legs.length === 1) pole(g, 0, 0, h - slab);
    else part(g, cyl(0.035, h - slab, 8), C.inkSoft, lx, (h - slab) / 2, lz, false);
  }
  const y = h;
  if (top === "synth") {
    const sw = Math.min(w - 0.2, 3.2),
      sd = Math.min(d - 0.2, 1.1);
    part(g, box(sw, 0.25, sd), C.ink, 0, y + 0.125, 0);
    part(g, box(sw - 0.25, 0.04, sd * 0.42), C.paper, 0, y + 0.27, -sd / 2 + sd * 0.24);
  } else if (top === "laptop") {
    part(g, box(1.1, 0.05, 0.8), C.inkSoft, 0, y + 0.025, 0.05);
    // screen faces the player, upstage (-z)
    part(g, box(1.1, 0.75, 0.04), C.ink, 0, y + 0.4, 0.45).rotation.x = 0.25;
  } else if (top === "percussion") {
    const n = Math.max(1, Math.min(4, Math.floor(w / 0.8)));
    for (let k = 0; k < n; k++) {
      const x = -((n - 1) * 0.75) / 2 + k * 0.75;
      part(g, cyl(0.3 - (k % 2) * 0.06, 0.4), k % 2 ? C.butter : C.paper, x, y + 0.2, 0);
    }
  }
  return g;
}

export function buildGear(spec: BuildSpec, opts: { lefty?: boolean } = {}): THREE.Group {
  switch (spec.kind) {
    case "kit":
      return kit(spec.kick, spec.toms, spec.floor, !!opts.lefty);
    case "riser":
      return riser(spec.w, spec.d, spec.h);
    case "combo":
      return combo(spec.w, spec.h, spec.d, spec.grill === "dark" ? C.inkSoft : C.g300);
    case "stack":
      return stack(spec.cw, spec.ch, spec.cd, spec.hw, spec.hh, spec.hd);
    case "board":
      return board(spec.w, spec.d);
    case "keys":
      return keys(spec.w, spec.d, spec.stand);
    case "mic":
      return micStand();
    case "wedge":
      return wedge();
    case "box":
      return smallBox(
        spec.w,
        spec.h,
        spec.d,
        { cyan: C.cyan, yellow: C.yellow, paper: C.photo, ink: C.ink }[spec.color],
      );
    case "table":
      return table(spec.w, spec.d, spec.h, spec.top);
  }
}
