/**
 * Currency utility with locale and country support.
 * Extensible to multiple countries in the future.
 */

export type SupportedCountry = 'IN'; // 'IN' = India, add 'US', 'GB', 'AU' etc. later

type CurrencyConfig = {
  symbol: string;
  code: string;
  locale: string;
};

const currencyConfig: Record<SupportedCountry, CurrencyConfig> = {
  IN: {
    symbol: '₹',
    code: 'INR',
    locale: 'en-IN',
  },
  // Future countries can be added here
  // US: {
  //   symbol: '$',
  //   code: 'USD',
  //   locale: 'en-US',
  // },
  // GB: {
  //   symbol: '£',
  //   code: 'GBP',
  //   locale: 'en-GB',
  // },
};

/** Default to India for now */
const DEFAULT_COUNTRY: SupportedCountry = 'IN';

export function getCurrencySymbol(country: SupportedCountry = DEFAULT_COUNTRY): string {
  return currencyConfig[country]?.symbol ?? '₹';
}

export function getCurrencyCode(country: SupportedCountry = DEFAULT_COUNTRY): string {
  return currencyConfig[country]?.code ?? 'INR';
}

export function getLocale(country: SupportedCountry = DEFAULT_COUNTRY): string {
  return currencyConfig[country]?.locale ?? 'en-IN';
}

/**
 * Format amount with currency symbol
 * @param amount The amount in base currency units
 * @param country Country code (default: IN for India)
 * @returns Formatted string like "₹1,000" or "₹5,500.50"
 */
export function formatCurrency(
  amount: number | string,
  country: SupportedCountry = DEFAULT_COUNTRY,
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (Number.isNaN(numAmount)) {
    return `${getCurrencySymbol(country)}0`;
  }

  const symbol = getCurrencySymbol(country);
  const locale = getLocale(country);

  try {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numAmount);

    return `${symbol}${formatted}`;
  } catch {
    // Fallback if Intl fails
    return `${symbol}${numAmount.toFixed(2)}`;
  }
}

/**
 * Get currency symbol for display
 * @param country Country code (default: IN for India)
 * @returns Currency symbol like "₹"
 */
export function getCurrencyDisplay(country: SupportedCountry = DEFAULT_COUNTRY): string {
  return getCurrencySymbol(country);
}

/**
 * Strip all formatting to get a raw numeric string for editing.
 * "₹1,00,000.50" → "100000.50"
 */
export function stripCurrencyFormatting(value: string): string {
  return value
    .replace(/[^0-9.]/g, '')      // remove symbol, commas, spaces
    .replace(/(\..*)\./g, '$1');  // allow only one decimal point
}

/**
 * Parse a raw input string to a number safely.
 * Returns null if empty or invalid.
 */
export function parseRawCurrencyInput(raw: string): number | null {
  const stripped = raw.replace(/[^0-9.]/g, '');
  if (!stripped) return null;
  const parsed = parseFloat(stripped);
  return Number.isNaN(parsed) ? null : parsed;
}