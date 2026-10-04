/** Heading id, built exactly like the original article script did (lower-case, punctuation dropped, spaces to hyphens, 48 chars). */
export function headingId(text: string, index: number): string {
  return (
    text.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 48) || `section-${index + 1}`
  );
}
