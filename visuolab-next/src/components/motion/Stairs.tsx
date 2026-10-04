"use client";

import { useEffect, useState } from "react";
import { st } from "@/lib/css";

export type StairStep = { title: string; duration: string; text: string; deliverables?: { title: string; detail: string }[] };

/**
 * Process steps: a stepped run where the "+" opens that phase's note (hover shows it too, via CSS).
 * One note open at a time; Escape or a click outside the step bars closes it. Same behavior as js/main.js.
 * Case studies also list each phase's deliverables inside the note.
 */
export default function Stairs({ idPrefix, steps }: { idPrefix: string; steps: StairStep[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (!(e.target as Element).closest(".stair-bar")) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <ol className="stairs" style={st({ "--n": steps.length })}>
      {steps.map((s, i) => {
        const id = `${idPrefix}-${i + 1}`;
        return (
          <li className="stair reveal" style={st({ "--i": i, "--lvl": i })} key={id}>
            <span className="stair-no">{`Step #${i + 1}`}</span>
            <h3 className="stair-title">{s.title}</h3>
            <div className="stair-bar">
              <button
                className="stair-btn"
                type="button"
                aria-expanded={open === i}
                aria-controls={id}
                aria-label={`${s.title} — details`}
                onClick={() => setOpen(open === i ? null : i)}
              >
                <svg viewBox="0 0 14 14" aria-hidden="true"><path className="v" d="M7 2.8v8.4" /><path d="M2.8 7h8.4" /></svg>
              </button>
              <div className="stair-tip" id={id}>
                <span className="dur">{s.duration}</span>
                <p>{s.text}</p>
                {s.deliverables && s.deliverables.length > 0 && (
                  <ul className="stair-deliv">
                    {s.deliverables.map((d) => (
                      <li key={d.title}><b>{d.title}</b><span>{d.detail}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
