import Link from "@/components/site/ui/Link";
import { useSiteConfig } from "@/components/site/SiteConfigProvider";

/** Logo link. Two images: the light-ground and dark-ground marks are swapped by CSS (.logo-l / .logo-d). The pictures and the name come from the site settings. */
export default function Brand() {
  const site = useSiteConfig();
  return (
    <Link className="brand" href="/" aria-label={`${site.siteName} — home`}>
      <img className="logo-l" src={site.logoUrl} alt={site.siteName} width={335} height={100} />
      <img className="logo-d" src={site.logoDarkUrl} alt="" width={335} height={100} aria-hidden="true" />
    </Link>
  );
}
