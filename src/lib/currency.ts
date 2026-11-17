export type Currency = "USD" | "PHP" | "THB";

export interface CurrencyConfig {
  code: Currency;
  symbol: string;
  label: string;
  rate: number; // multiplier against USD
  name: string;
}

export const CURRENCIES: Record<Currency, CurrencyConfig> = {
  USD: {
    code: "USD",
    symbol: "$",
    label: "USD ($)",
    rate: 1.0,
    name: "US Dollar",
  },
  PHP: {
    code: "PHP",
    symbol: "₱",
    label: "PHP (₱)",
    rate: 58.0,
    name: "Philippine Peso",
  },
  THB: {
    code: "THB",
    symbol: "฿",
    label: "THB (฿)",
    rate: 35.0,
    name: "Thai Baht",
  },
};

const STORAGE_KEY = "gadget_selected_currency";

export function getSavedCurrency(): Currency {
  if (typeof window === "undefined") return "USD";
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Currency;
    if (saved && CURRENCIES[saved]) return saved;
  } catch {}
  return "USD";
}

export function saveCurrency(c: Currency): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, c);
    window.dispatchEvent(new CustomEvent("currency_changed", { detail: c }));
  } catch {}
}

export function convertAmount(amountInUSD: number, currency: Currency): number {
  const cfg = CURRENCIES[currency] || CURRENCIES.USD;
  return amountInUSD * cfg.rate;
}

export function formatPrice(amountInUSD: number, currency: Currency): string {
  const cfg = CURRENCIES[currency] || CURRENCIES.USD;
  const converted = amountInUSD * cfg.rate;

  // For USD show 2 decimals; for PHP and THB format cleanly with no decimals if whole, or 2 decimals
  const fractionDigits = currency === "USD" ? 2 : converted % 1 === 0 ? 0 : 2;

  return `${cfg.symbol}${converted.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  })}`;
}
