import { computeInputs, monitorsOf, powerOf, type PlotItem } from "@/lib/plot";

export function InputList({ items, selectedId }: { items: PlotItem[]; selectedId: number | null }) {
  const rows = computeInputs(items);
  const mons = monitorsOf(items);
  const pow = powerOf(items);
  const di = rows.filter((r) => r.source === "DI").length;

  return (
    <>
      <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3">
        <span className="tag tag-ink">{rows.length} Inputs</span>
        <span className="tag tag-cyan">{di} DI</span>
        <span className="tag tag-yellow">{mons.length} Mixes</span>
        <span className="tag">{pow.length} Power</span>
      </div>
      <div className="scroll">
        {rows.length === 0 ? (
          <p className="m-0 p-4 text-muted">Plop some gear on the stage and the input list fills in.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="ch">Ch</th>
                <th>Source</th>
                <th>Mic/DI</th>
                <th>Stand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ch} className={r.itemId === selectedId ? "hl" : undefined}>
                  <td className="ch">{r.ch}</td>
                  <td>{r.name}</td>
                  <td>{r.source === "DI" ? <span className="tag tag-cyan">DI</span> : r.source}</td>
                  <td className="text-xs text-muted">{r.stand}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h2 className="h2 px-4 pt-4 pb-2">Monitors</h2>
        <ul className="m-0 grid list-none gap-1.5 px-4 pb-4">
          {mons.length ? (
            mons.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="tag tag-yellow">{m.label}</span>
                <span>Wedge</span>
              </li>
            ))
          ) : (
            <li className="text-xs text-muted">No wedges yet.</li>
          )}
        </ul>
        <h2 className="h2 px-4 pb-2">Power</h2>
        <ul className="m-0 grid list-none gap-1.5 px-4 pb-4">
          {pow.length ? (
            pow.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="tag">{m.label}</span>
                <span>Quad box</span>
              </li>
            ))
          ) : (
            <li className="text-xs text-muted">No power drops yet.</li>
          )}
        </ul>
      </div>
    </>
  );
}
