/*
 * Structured data (schema.org JSON-LD): Organization, WebSite, BreadcrumbList, Service, Article / BlogPosting, collection pages.
 * Pure builders that return plain objects; nodes refer to each other by @id (the organization published the website, the service
 * was provided by the organization, …). Only facts that exist in the site's data are included: nothing is invented and empty
 * values are left out. Invisible to visitors (script tags).
 */
import { absoluteUrl, plain } from "./metadata.ts";

type Obj = Record<string, unknown>;

/** Serialise for a <script type="application/ld+json">: "<" is escaped so the text can never close the tag, whatever an editor typed. */
export function jsonLdScript(nodes: Obj | Obj[]): string {
  const doc = Array.isArray(nodes) ? { "@context": "https://schema.org", "@graph": nodes } : { "@context": "https://schema.org", ...nodes };
  // "<" and the two Unicode line separators are written as escapes, so the text can never close the tag or break the script
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  const BS = String.fromCharCode(92); // a backslash, built from its code so no tool or editor can turn the escape into the character itself
  return JSON.stringify(doc).replace(/</g, `${BS}u003c`).split(LS).join(`${BS}u2028`).split(PS).join(`${BS}u2029`);
}

export const ids = (siteUrl: string) => ({ org: `${siteUrl}/#organization`, web: `${siteUrl}/#website` });

/** Drops keys whose value is empty (undefined, null, "", []), so a node never carries blanks. */
const clean = (o: Obj): Obj => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)));

export type OrgInput = {
  general: { siteName: string; description: string; logoUrl: string };
  contact: { email: string; phone: string; address: string; hours: string };
  social: { instagram: string; facebook: string; linkedin: string; x: string; youtube: string; others: { url: string }[] };
};

export function organizationNode(siteUrl: string, c: OrgInput): Obj {
  const sameAs = [c.social.instagram, c.social.facebook, c.social.linkedin, c.social.x, c.social.youtube, ...c.social.others.map((o) => o.url)].filter(Boolean);
  return clean({
    "@type": "Organization",
    "@id": ids(siteUrl).org,
    name: c.general.siteName,
    url: siteUrl,
    description: c.general.description,
    logo: c.general.logoUrl ? { "@type": "ImageObject", url: absoluteUrl(siteUrl, c.general.logoUrl) } : undefined,
    email: c.contact.email,
    telephone: c.contact.phone,
    address: c.contact.address ? { "@type": "PostalAddress", streetAddress: c.contact.address.replace(/\n/g, ", ") } : undefined,
    openingHours: c.contact.hours ? c.contact.hours.split("\n") : undefined,
    sameAs,
  });
}

export function websiteNode(siteUrl: string, c: { general: { siteName: string; description: string } }): Obj {
  return clean({ "@type": "WebSite", "@id": ids(siteUrl).web, url: siteUrl, name: c.general.siteName, description: c.general.description, inLanguage: "en-GB", publisher: { "@id": ids(siteUrl).org } });
}

export type Crumb = { name: string; path: string };

/** Home / … / this page. Positions start at 1; every item is an absolute address. */
export function breadcrumbNode(siteUrl: string, siteName: string, trail: Crumb[], pagePath: string): Obj {
  const all: Crumb[] = [{ name: siteName, path: "/" }, ...trail];
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(siteUrl, pagePath)}#breadcrumb`,
    itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: plain(c.name), item: absoluteUrl(siteUrl, c.path === "/" ? "" : c.path) || siteUrl })),
  };
}

export type ServiceInput = { name: string; slug: string; description: string; image?: string; offers: string[] };

/** A service the studio provides, with what is included as an offer catalog. */
export function serviceNode(siteUrl: string, s: ServiceInput): Obj {
  const url = `${siteUrl}/services/${s.slug}`;
  return clean({
    "@type": "Service",
    "@id": `${url}#service`,
    name: plain(s.name),
    description: plain(s.description),
    url,
    serviceType: plain(s.name),
    image: s.image ? absoluteUrl(siteUrl, s.image) : undefined,
    provider: { "@id": ids(siteUrl).org },
    mainEntityOfPage: url,
    hasOfferCatalog: s.offers.length
      ? { "@type": "OfferCatalog", name: `${plain(s.name)}: what is included`, itemListElement: s.offers.map((o) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: plain(o) } })) }
      : undefined,
  });
}

export type ArticleInput = {
  type: "Article" | "BlogPosting";
  path: string;
  headline: string;
  description: string;
  image?: string;
  published?: string;
  modified?: string;
  authorName?: string;
  section?: string;
  keywords?: string[];
  /** The address search engines should treat as the original, when it is not this page */
  canonical?: string;
  /** What an article is about, e.g. the client of a case study */
  about?: string;
};

export function articleNode(siteUrl: string, a: ArticleInput): Obj {
  const url = absoluteUrl(siteUrl, a.path);
  return clean({
    "@type": a.type,
    "@id": `${url}#article`,
    headline: plain(a.headline).slice(0, 110),
    description: plain(a.description),
    image: a.image ? absoluteUrl(siteUrl, a.image) : undefined,
    datePublished: a.published,
    dateModified: a.modified,
    articleSection: a.section,
    keywords: a.keywords?.length ? a.keywords.join(", ") : undefined,
    inLanguage: "en-GB",
    author: a.authorName ? { "@type": "Person", name: a.authorName } : { "@id": ids(siteUrl).org },
    publisher: { "@id": ids(siteUrl).org },
    isPartOf: { "@id": ids(siteUrl).web },
    mainEntityOfPage: a.canonical ?? url,
    about: a.about ? { "@type": "Organization", name: a.about } : undefined,
  });
}

/** An index page (Works, Blog) with the items it lists. */
export function collectionNode(siteUrl: string, c: { path: string; name: string; description: string; items: Crumb[] }): Obj {
  const url = absoluteUrl(siteUrl, c.path);
  return clean({
    "@type": "CollectionPage",
    "@id": `${url}#page`,
    url,
    name: plain(c.name),
    description: plain(c.description),
    isPartOf: { "@id": ids(siteUrl).web },
    mainEntity: c.items.length ? { "@type": "ItemList", itemListElement: c.items.map((it, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(siteUrl, it.path), name: plain(it.name) })) } : undefined,
  });
}

/** A plain page of a given schema.org type (AboutPage, ContactPage). */
export function pageNode(siteUrl: string, p: { type: "AboutPage" | "ContactPage" | "WebPage"; path: string; name: string; description: string }): Obj {
  const url = absoluteUrl(siteUrl, p.path);
  return { "@type": p.type, "@id": `${url}#page`, url, name: plain(p.name), description: plain(p.description), isPartOf: { "@id": ids(siteUrl).web }, about: { "@id": ids(siteUrl).org } };
}
