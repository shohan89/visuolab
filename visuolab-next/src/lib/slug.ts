/** Heading id, built exactly like the original article script did (lower-case, punctuation dropped, spaces to hyphens, 48 chars). */
export function headingId(text: string, index: number): string {
  return (
    text.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 48) || `section-${index + 1}`
  );
}

/** "Brand Identity & Naming!" -> "brand-identity-and-naming". Accents are folded, everything else outside a-z 0-9 becomes one hyphen; at most 60 characters. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
