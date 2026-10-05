/** What the media API returns for a file: public address and metadata only, never a storage key or credential. */
export type PublicMedia = {
  id: string; title: string; url: string; alt: string; caption: string; width: number | null; height: number | null; bytes: number | null;
  mime: string; kind: string; storage: "static" | "r2"; createdAt: string; originalName: string | null;
};

export const formatBytes = (n: number | null): string => (n == null ? "—" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** The same limits the server enforces, only to answer sooner; the server checks again. */
export const CLIENT_LIMIT = 10 * 1024 * 1024;
export const CLIENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
