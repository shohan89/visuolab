import * as navData from "@/content/nav-data";

/**
 * The header menu, the footer and the home page link to the four original service pages from markup that is built into the
 * website (not read from the database yet). This is that text, searched when someone hides, deletes or renames a service.
 */
const FOOTER_LINKS = "/services/brand-identity /services/product-design /services/web-design-build /services/motion-3d";

export const getServiceSeedNav = (): string => `${JSON.stringify(navData)} ${FOOTER_LINKS}`;

/** The eight original case studies are linked from built-in markup too (home page, About page hero, service pages' fallback links). */
const BUILT_IN_CASE_SLUGS = ["orbit", "marlow", "kite", "verdant", "halcyon", "northwind", "aster", "fold"];
export const builtInLinksToCase = (slug: string): boolean => BUILT_IN_CASE_SLUGS.includes(slug);
