import { permanentRedirect } from "next/navigation";

/**
 * The original site has no services overview page: "Services" in the nav only opens the mega menu.
 * The route exists (it is part of the URL structure) and sends visitors to the Services section of the home page.
 */
export default function ServicesIndex() {
  permanentRedirect("/#services");
}
