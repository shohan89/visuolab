"use client";

import { useState } from "react";
import { st } from "@/lib/css";

export type FaqItem = { id: string; q: string; a: string };

/** FAQ accordion: one open at a time, clicking the open one closes it. First item starts open, as in the HTML. */
export default function Faq({ items, index }: { items: FaqItem[]; index: number }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="qa-list reveal" style={st({ "--i": index })}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div className={isOpen ? "qa open" : "qa"} key={item.id}>
            <button className="qa-q" aria-expanded={isOpen} aria-controls={item.id} onClick={() => setOpen(isOpen ? null : i)}>
              <span>{item.q}</span>
              <i aria-hidden="true"></i>
            </button>
            <div className="qa-a" id={item.id}>
              <div>
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
