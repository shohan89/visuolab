"use client";

import type { ReactNode } from "react";

/** Prev/next buttons for the reviews carousel (#carousel): same smooth scrollBy as the original. */
export default function CarouselNav({ children }: { children: ReactNode }) {
  return (
    <div
      className="carousel-nav"
      onClick={(e) => {
        const btn = (e.target as Element).closest<HTMLElement>("[data-carousel]");
        const track = document.getElementById("carousel");
        if (!btn || !track) return;
        const card = track.querySelector(".review-card");
        const step = card ? card.getBoundingClientRect().width + 16 : 400;
        track.scrollBy({ left: btn.dataset.carousel === "next" ? step : -step, behavior: "smooth" });
      }}
    >
      {children}
    </div>
  );
}
