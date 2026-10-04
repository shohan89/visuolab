import Link from "next/link";

/** Logo link. Two images: the light-ground and dark-ground marks are swapped by CSS (.logo-l / .logo-d). */
export default function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Visuolab — home">
      <img className="logo-l" src="/assets/logo.png" alt="Visuolab" width={335} height={100} />
      <img className="logo-d" src="/assets/logo-dark.png" alt="" width={335} height={100} aria-hidden="true" />
    </Link>
  );
}
