/**
 * lib/brand.ts
 *
 * RYDNOW brand colours for use in TypeScript (inline styles, SVG, theme-color).
 * Keep these identical to the @theme block in app/globals.css, which drives the Tailwind classes.
 */
export const BRAND = {
  blue: '#1E5EDC', // primary hero blue (brand-600)
  navy: '#0A2342', // deep navy (brand-900)
  gold: '#F9D342', // primary buttons and accents (gold)
  sky: '#3B82F6', // borders, highlights, links (brand-500)
  success: '#10B981', // rider status, confirmations
  white: '#FFFFFF', // headings and main text
  slate: '#CBD5E1', // secondary text and placeholders
} as const;


export type BrandColor = keyof typeof BRAND;


