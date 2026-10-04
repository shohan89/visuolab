"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/* Shared filter state for a chip row and the grid it filters, which live in different sections of the page
   (works index; the blog index later). The provider adds no DOM. */
type FilterState = { filter: string; setFilter: (f: string) => void; touched: boolean };
const Ctx = createContext<FilterState>({ filter: "all", setFilter: () => {}, touched: false });

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState("all");
  const [touched, setTouched] = useState(false);
  return (
    <Ctx.Provider value={{ filter, touched, setFilter: (f) => { setFilterState(f); setTouched(true); } }}>
      {children}
    </Ctx.Provider>
  );
}

export const useFilter = () => useContext(Ctx);

/** A card answers to a filter when the filter is "all" or one of its keys matches. */
export const matchesFilter = (filter: string, keys: string[]) => filter === "all" || keys.includes(filter);
