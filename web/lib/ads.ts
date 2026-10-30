// Fictional sponsors only. Creatives are rendered from data (gradient + emoji + copy).
export type Ad = {
  campaignId: number;
  category: string;
  brand: string;
  headline: string;
  body: string;
  cta: string;
  ctaUrl: string;
  gradient: string;
  emoji: string;
};

export const ADS: Ad[] = [
  {
    campaignId: 0,
    category: "coding",
    brand: "Kernel Coffee",
    headline: "Fuel for your next merge.",
    body: "Single-origin beans, shipped to your desk. First bag on us.",
    cta: "Get a free bag",
    ctaUrl: "https://example.com/kernel-coffee",
    gradient: "linear-gradient(135deg,#7c2d12 0%,#ea580c 100%)",
    emoji: "☕",
  },
  {
    campaignId: 1,
    category: "study",
    brand: "NoteNest",
    headline: "Turn lecture chaos into notes.",
    body: "Record, summarise and revise in one calm place.",
    cta: "Try NoteNest",
    ctaUrl: "https://example.com/notenest",
    gradient: "linear-gradient(135deg,#1e3a8a 0%,#06b6d4 100%)",
    emoji: "📓",
  },
  {
    campaignId: 2,
    category: "travel",
    brand: "Driftway",
    headline: "Weekend escapes from ₹2,999.",
    body: "Handpicked getaways within a short ride of home.",
    cta: "Find a getaway",
    ctaUrl: "https://example.com/driftway",
    gradient: "linear-gradient(135deg,#065f46 0%,#facc15 100%)",
    emoji: "🧳",
  },
  {
    campaignId: 3,
    category: "finance",
    brand: "Ledgerly",
    headline: "Know where every rupee goes.",
    body: "Automatic expense tracking with zero spreadsheets.",
    cta: "See your spending",
    ctaUrl: "https://example.com/ledgerly",
    gradient: "linear-gradient(135deg,#312e81 0%,#a855f7 100%)",
    emoji: "📊",
  },
];

let rotation = 0;

export function pickAd(category: string): Ad {
  const match = ADS.find((a) => a.category === category);
  if (match) return match;
  return ADS[rotation++ % ADS.length]; // "general" -> rotating pick
}

export const campaignById = (id: number) => ADS.find((a) => a.campaignId === id);
