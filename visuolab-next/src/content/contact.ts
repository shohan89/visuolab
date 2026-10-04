/* Choices offered by the contact form. The values are what gets stored; they match contact.html. */
export const NEEDS = ["Brand identity", "Product design", "Web design & build", "Motion & 3D", "Not sure yet"] as const;
export const BUDGETS = ["Under €20k", "€20–50k", "€50–100k", "€100k+", "Not sure yet"] as const;

export type Need = (typeof NEEDS)[number];
export type Budget = (typeof BUDGETS)[number];
