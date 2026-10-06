/*
 * Site settings: what the admin can change, how it is checked, and the values the website starts with.
 *
 * Everything here is PUBLIC-SAFE. Settings live in D1 and are read by public pages, so they must never hold a secret.
 * API keys and tokens are Cloudflare secrets (wrangler secret put …); the settings only say which ones exist. Every text field is
 * also checked against the shapes of well-known secret keys, so a key pasted into the wrong box is refused.
 *
 * Pure module (zod only, no framework): shared by the admin forms, the public readers and the verification script.
 */
import { z } from "zod";
import { EMAIL_PROVIDER_IDS } from "../integrations/email/types.ts";

/* ---- guards --------------------------------------------------------------------------------------------------- */

/** Shapes of keys that must never be stored as public settings (Resend, Stripe, AWS, GitHub, Cloudflare/Bearer-looking tokens, PEM keys). */
const SECRET_SHAPES = [/\bre_[A-Za-z0-9_]{16,}/, /\b[sr]k_(live|test)_[A-Za-z0-9]{10,}/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{30,}/, /\bxox[abprs]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bBearer\s+[A-Za-z0-9._-]{20,}/i, /\bapi[_-]?key\s*[:=]\s*\S{12,}/i];
export const looksLikeSecret = (v: string): boolean => SECRET_SHAPES.some((re) => re.test(v));

const noSecret = (v: string) => !looksLikeSecret(v);
const plainOk = (v: string) => !/[<>]/.test(v);
const SECRET_MSG = "This looks like a secret key. Do not store keys here: set them as Cloudflare secrets (see Integrations).";

/** Text for a public setting: trimmed, bounded, no angle brackets, and not a secret. */
const text = (label: string, max: number, min = 0) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long (max ${max} characters)`).refine(plainOk, `${label} cannot contain < or >`).refine(noSecret, SECRET_MSG);

/** Several lines (address, opening hours): at most `lines` lines of `max` characters in total. */
const lines = (label: string, max: number, maxLines: number) =>
  z
    .string()
    .max(max + 40, `${label} is too long`)
    .transform((v) => v.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean).join("\n"))
    .refine((v) => v.length <= max, `${label} is too long (max ${max} characters)`)
    .refine((v) => v === "" || v.split("\n").length <= maxLines, `${label}: at most ${maxLines} lines`)
    .refine(plainOk, `${label} cannot contain < or >`)
    .refine(noSecret, SECRET_MSG);

const email = (label: string) => z.string().trim().toLowerCase().min(3, `${label} is required`).max(120).regex(/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/, `${label} must be a valid e-mail address`);

/** A media library file chosen with the picker, or "" for none. */
const mediaId = z.string().trim().max(100).refine((v) => v === "" || /^media_[a-z0-9-]{2,80}$/.test(v), "Choose a file from the media library");

/** https address, optionally limited to some host names (a LinkedIn field must hold a linkedin.com address). */
const profileUrl = (label: string, hosts?: string[]) =>
  z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https:\/\/[^\s<>"']+$/.test(v), `${label} must be a full address starting with https://`)
    .refine((v) => {
      if (v === "" || !hosts) return true;
      try {
        const h = new URL(v).hostname.toLowerCase();
        return hosts.some((d) => h === d || h.endsWith(`.${d}`));
      } catch {
        return false;
      }
    }, `${label} must be an address on ${hosts?.join(" or ")}`)
    .refine(noSecret, SECRET_MSG);

/* ---- sections ------------------------------------------------------------------------------------------------- */

export const generalSchema = z.object({
  siteName: text("Site name", 60, 1),
  description: text("Site description", 300),
  logo: mediaId,
  logoDark: mediaId,
  favicon: mediaId,
});

export const contactSchema = z.object({
  email: email("Email"),
  phone: z.string().trim().max(30).refine((v) => v === "" || /^\+?[0-9 ()./-]{5,30}$/.test(v), "Phone number can use digits, spaces and + ( ) - . / only"),
  address: lines("Address", 300, 5),
  hours: lines("Business hours", 300, 7),
});

export const socialSchema = z.object({
  instagram: profileUrl("Instagram", ["instagram.com"]),
  facebook: profileUrl("Facebook", ["facebook.com", "fb.com"]),
  linkedin: profileUrl("LinkedIn", ["linkedin.com"]),
  x: profileUrl("X", ["x.com", "twitter.com"]),
  youtube: profileUrl("YouTube", ["youtube.com", "youtu.be"]),
  others: z.array(z.object({ label: text("Profile name", 30, 1), url: profileUrl("Profile address").refine((v) => v !== "", "Profile address is required") })).max(8, "At most 8 other profiles"),
});

const path = z.string().trim().max(100).regex(/^\/[A-Za-z0-9\-._~/*$]*$/, "Each path starts with / and has no spaces, for example /private");
/** Search metadata of one fixed page (home, About, Works, Blog, Contact). Empty text falls back to the default shown in the admin. */
export const SEO_PAGES = ["home", "about", "works", "blog", "contact"] as const;
export type SeoPageKey = (typeof SEO_PAGES)[number];
const pageSeo = (label: string) => z.object({ title: text(`${label}: title`, 70, 1), description: text(`${label}: description`, 200, 20), noindex: z.boolean() });

export const seoSchema = z.object({
  defaultTitle: text("Default title", 70, 1),
  defaultDescription: text("Default description", 200),
  ogImage: mediaId,
  indexing: z.boolean(),
  disallow: z.array(path).max(20, "At most 20 paths"),
  sitemap: z.boolean(),
  pages: z.object({ home: pageSeo("Home page"), about: pageSeo("About page"), works: pageSeo("Works page"), blog: pageSeo("Blog page"), contact: pageSeo("Contact page") }),
});

export const analyticsSchema = z.object({
  enabled: z.boolean(),
  ga4: z.string().trim().refine((v) => v === "" || /^G-[A-Z0-9]{6,12}$/.test(v), "Google Analytics ID looks like G-XXXXXXXXXX"),
  gtm: z.string().trim().refine((v) => v === "" || /^GTM-[A-Z0-9]{4,10}$/.test(v), "Google Tag Manager ID looks like GTM-XXXXXXX"),
  metaPixel: z.string().trim().refine((v) => v === "" || /^\d{8,20}$/.test(v), "Meta Pixel ID is a number of 8 to 20 digits"),
  // one switch per service, set from Integrations (`enabled` above stays the master switch); true unless an admin turned that one off
  ga4On: z.boolean().default(true),
  gtmOn: z.boolean().default(true),
  pixelOn: z.boolean().default(true),
});

/** The email provider and where enquiries go. The API key itself is the Worker secret RESEND_API_KEY and is not part of this. */
export const emailSchema = z.object({
  provider: z.enum(EMAIL_PROVIDER_IDS),
  from: z.string().trim().max(200).refine((v) => /^([^<>@\r\n]{1,80}\s)?<?[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}>?$/.test(v), "From must be an address like hello@example.com or Name <hello@example.com>").refine(noSecret, SECRET_MSG),
  to: z.array(email("Notification address")).min(1, "Add at least one address to notify").max(5, "At most 5 addresses"),
  enabled: z.boolean(),
});

/** Bot protection (Cloudflare Turnstile). The site key is public by design; the secret is the Worker secret TURNSTILE_SECRET. */
export const turnstileSchema = z.object({
  enabled: z.boolean(),
  siteKey: z.string().trim().refine((v) => v === "" || /^[0-9A-Za-z_-]{10,80}$/.test(v), "Site key looks like 0x4AAAAAAA… (letters, digits, - and _)"),
});

export type General = z.infer<typeof generalSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type Social = z.infer<typeof socialSchema>;
export type Seo = z.infer<typeof seoSchema>;
export type Analytics = z.infer<typeof analyticsSchema>;
export type EmailSettings = z.infer<typeof emailSchema>;
export type TurnstileSettings = z.infer<typeof turnstileSchema>;

/* ---- what the website starts with (the values it had before settings existed) ---------------------------------- */

export const DEFAULTS = {
  general: { siteName: "Visuolab", description: "Visuolab is a design agency that unites brand, website and product into one story.", logo: "media_logo", logoDark: "media_logo-dark", favicon: "" } satisfies General,
  contact: { email: "hello@visuolab.studio", phone: "", address: "", hours: "" } satisfies Contact,
  social: { instagram: "", facebook: "", linkedin: "", x: "", youtube: "", others: [] } satisfies Social,
  seo: {
    defaultTitle: "Visuolab — Digital product design agency", defaultDescription: "Visuolab is a design agency that unites brand, website and product into one story.", ogImage: "", indexing: true, disallow: ["/admin"], sitemap: true,
    pages: {
      home: { title: "Visuolab — Digital product design agency", description: "Visuolab is a design agency that unites brand, website and product into one story.", noindex: false },
      about: { title: "About — Visuolab", description: "Visuolab is an independent design agency. What started as two designers in 2017 now ships brands, products and websites for teams on four continents.", noindex: false },
      works: { title: "Works — Visuolab", description: "Selected brand, product, web and packaging work by Visuolab — case studies with the results behind them.", noindex: false },
      blog: { title: "Blog — Visuolab", description: "Notes on brand, product, web and motion design from the Visuolab studio — what we ship, what we learn and what we would do differently.", noindex: false },
      contact: { title: "Contact — Visuolab", description: "Tell us about your project. A real person answers within one working day — no forms into the void, no sales sequence.", noindex: false },
    },
  } satisfies Seo,
  analytics: { enabled: false, ga4: "", gtm: "", metaPixel: "", ga4On: true, gtmOn: true, pixelOn: true } satisfies Analytics,
} as const;

export const SETTINGS_KEYS = { general: "settings.general", contact: "settings.contact", social: "settings.social", seo: "settings.seo", analytics: "settings.analytics" } as const;
export type SectionName = keyof typeof SETTINGS_KEYS;
export const SECTION_TITLES: Record<SectionName, string> = { general: "Site settings: General", contact: "Site settings: Contact", social: "Site settings: Social profiles", seo: "Site settings: SEO", analytics: "Site settings: Analytics" };

const SCHEMAS = { general: generalSchema, contact: contactSchema, social: socialSchema, seo: seoSchema, analytics: analyticsSchema } as const;

/**
 * A stored document merged over the defaults. Anything missing or no longer valid falls back to the default for that field, so a
 * bad or old row can never break a public page.
 */
export function resolveSection<K extends SectionName>(name: K, stored: unknown): (typeof DEFAULTS)[K] {
  const base = DEFAULTS[name] as Record<string, unknown>;
  const raw: Record<string, unknown> = stored && typeof stored === "object" ? { ...base, ...(stored as Record<string, unknown>) } : { ...base };
  if (name === "seo") {
    // a stored document may have only some pages, or only some fields of a page: fill the rest from the defaults, page by page
    const dp = (DEFAULTS.seo.pages as unknown) as Record<string, Record<string, unknown>>;
    const sp = (raw.pages && typeof raw.pages === "object" ? raw.pages : {}) as Record<string, Record<string, unknown>>;
    raw.pages = Object.fromEntries(Object.keys(dp).map((k) => [k, { ...dp[k], ...(sp[k] && typeof sp[k] === "object" ? sp[k] : {}) }]));
  }
  const parsed = SCHEMAS[name].safeParse(raw);
  if (parsed.success) return parsed.data as (typeof DEFAULTS)[K];
  // keep the fields that are fine, default the rest
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(raw)) {
    const field = (SCHEMAS[name] as unknown as z.ZodObject<z.ZodRawShape>).shape[k];
    const one = field ? z.safeParse(field, v) : undefined;
    if (one?.success) out[k] = one.data;
  }
  return out as (typeof DEFAULTS)[K];
}

/* ---- analytics snippets --------------------------------------------------------------------------------------- */

/**
 * Analytics load only on a real https site: never on localhost or a preview over http, so test visits never count.
 * The three IDs are checked against fixed patterns before they are placed in a script, so nothing else can reach it.
 */
export function analyticsActive(siteUrl: string, a: Analytics): boolean {
  if (!a.enabled || !((a.ga4 && a.ga4On !== false) || (a.gtm && a.gtmOn !== false) || (a.metaPixel && a.pixelOn !== false))) return false;
  return isPublicHttps(siteUrl);
}

/** A real https address: not http, not localhost. */
export function isPublicHttps(siteUrl: string): boolean {
  try {
    const u = new URL(siteUrl);
    return u.protocol === "https:" && !/^(localhost|127\.|\[::1\])/.test(u.hostname);
  } catch {
    return false;
  }
}

export const gtagSnippet = (id: string) => `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');`;
export const gtmSnippet = (id: string) => `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer','${id}');`;
export const pixelSnippet = (id: string) => `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`;
