// ✅ Put ALL these here instead — NOT in config.ts
export const ONLINE_PAYMENT_METHODS = ['momo', 'card'] as const;
export const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  momo: "Mobile Money",
  card: "Card",
  wallet: "Wallet",
};
export const PAYMENT_LABEL = PAYMENT_METHOD_LABELS;
export const PAYMENT_METHOD_ALIASES = {
  "mobile_money": "momo", "mobile-money": "momo", "mtn": "momo",
  "visa": "card", "debit": "card", "credit_card": "card",
  "cash": "cash", "wallet": "wallet",
} as const;

export const QUOTE_FALLBACK_TTL_SECONDS = 180;
export const SERVICE_HINTS = { /* ... */ };
export const SERVICE_LABELS = { /* ... */ };
export const SURGE_REASON_LABELS = { /* ... */ };
