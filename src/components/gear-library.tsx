import { GEAR, LIBRARY_ORDER } from "@/lib/gear";

const byCategory = LIBRARY_ORDER.map((cat) => ({
  cat,
  gear: Object.values(GEAR).filter((g) => g.cat === cat),
}));

export function GearLibrary({ onPlop }: { onPlop: (id: string) => void }) {
  return (
    <div className="scroll">
      {byCategory.map(({ cat, gear }) => (
        <section key={cat}>
          <div className="caption px-4 pt-3 pb-1 first:pt-4">{cat}</div>
          <ul className="m-0 list-none px-2 pb-2">
            {gear.map((g) => (
              <li key={g.id}>
                <button type="button" className="lib-item" onClick={() => onPlop(g.id)} aria-label={`Plop ${g.name}`}>
                  <span>
                    <span className="block font-medium">{g.name}</span>
                    <span className="block text-xs leading-4 text-muted">{g.note}</span>
                  </span>
                  <span className="plop" aria-hidden="true">
                    +
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
