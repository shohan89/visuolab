"use client";

import { useFilter } from "@/components/motion/Filter";
import { st } from "@/lib/css";

export type Chip = { key: string; label: string; count: number };

/** Topic/discipline chips under a page heading (works, blog). The active chip carries .is-on and aria-pressed. */
export default function FilterChips({ chips, ariaLabel }: { chips: Chip[]; ariaLabel: string }) {
  const { filter, setFilter } = useFilter();
  return (
    <div className="filters reveal" style={st({ "--i": 2 })} role="group" aria-label={ariaLabel}>
      {chips.map((c) => {
        const on = filter === c.key;
        return (
          <button className={on ? "chip is-on" : "chip"} data-filter={c.key} aria-pressed={on} key={c.key} onClick={() => setFilter(c.key)}>
            {c.label} <i>{c.count}</i>
          </button>
        );
      })}
    </div>
  );
}
