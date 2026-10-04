/* The five client reviews used by the reviews carousel (same list on Home, Works and every service page). */
export type ReviewSeed = { avatar: string; company: string; dot?: string; quote: string; name: string; role: string; city: string };

export const reviews: ReviewSeed[] = [
  { avatar: "/assets/people/maya.webp", company: "Orbit", quote: "They tailor their solutions to our specific needs and goals.", name: "Maya Rao", role: "Head of Product, Orbit", city: "New York, NY" },
  { avatar: "/assets/people/harriet.webp", company: "Marlow & Co.", dot: "#ffb86b", quote: "They organized their work and internal management was outstanding.", name: "Harriet Marlow", role: "Managing Director, Marlow & Co.", city: "London, UK" },
  { avatar: "/assets/people/ingrid.webp", company: "Kite", dot: "#8a4dff", quote: "Working with them was a great experience. It's the site our investors forward.", name: "Ingrid Halvorsen", role: "Co-founder, Kite", city: "Berlin, DE" },
  { avatar: "/assets/people/aiko.webp", company: "Verdant", dot: "#1fa88a", quote: "Meticulous attention to detail and creative problem-solving from the first workshop.", name: "Aiko Sato", role: "Founder, Verdant", city: "Tokyo, JP" },
  { avatar: "/assets/people/rosa.webp", company: "Northwind", dot: "#0b0b0e", quote: "The rare agency that cares as much about the handoff as the pitch.", name: "Rosa Almeida", role: "VP Marketing, Northwind", city: "Lisbon, PT" },
];
