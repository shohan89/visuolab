/* "Trusted by" marquee names. `cls` is the text-style variant used by the CSS (.caps / .serif / .mono). */
export type LogoSeed = { text: string; cls?: "caps" | "serif" | "mono"; dot?: boolean };

export const trustedBy: LogoSeed[] = [
  { text: "NORTHWIND", cls: "caps" },
  { text: "halcyon", dot: true },
  { text: "Marlow & Co.", cls: "serif" },
  { text: "orbit_", cls: "mono" },
  { text: "ASTER LABS", cls: "caps" },
  { text: "Kite" },
  { text: "Verdant", cls: "serif" },
  { text: "fold.", dot: true },
  { text: "quill", cls: "mono" },
  { text: "TESSEL", cls: "caps" },
];
