/**
 * Static-rate currency converter (dispatch item 20b).
 *
 * Rates are FIXED and configurable until a rate feed is chosen. CAD is the
 * base currency (rate 1). The USD/GBP/EUR values below are PLACEHOLDERS the
 * owner must set (via `CURALINA_FX_RATES_JSON`, e.g.
 * `{"USD":1.37,"GBP":1.75,"EUR":1.47}`); they are not market data.
 * Each rate is "how many CAD one unit of the currency is worth".
 */

export class UnsupportedCurrencyError extends Error {
  readonly code = "unsupported_currency";
  constructor(public readonly currency: string) {
    super(`Unsupported currency "${currency}"`);
    this.name = "UnsupportedCurrencyError";
  }
}

/** PLACEHOLDER rates (CAD per 1 unit) - owner must set real values. */
export const PLACEHOLDER_CAD_PER_UNIT: Readonly<Record<string, number>> = {
  CAD: 1,
  USD: 1.35, // PLACEHOLDER
  GBP: 1.75, // PLACEHOLDER
  EUR: 1.47, // PLACEHOLDER
};

export class CurrencyConverter {
  private readonly rates: Record<string, number>;

  constructor(overrides: Record<string, number> = {}) {
    this.rates = { ...PLACEHOLDER_CAD_PER_UNIT };
    for (const [code, rate] of Object.entries(overrides)) {
      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(`Invalid FX rate for ${code}: ${String(rate)}`);
      }
      this.rates[code.toUpperCase()] = rate;
    }
    this.rates.CAD = 1;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): CurrencyConverter {
    const raw = env.CURALINA_FX_RATES_JSON;
    if (!raw) return new CurrencyConverter();
    return new CurrencyConverter(JSON.parse(raw) as Record<string, number>);
  }

  supports(currency: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.rates, currency.toUpperCase());
  }

  convert(amount: number, from: string, to: string): number {
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    if (!this.supports(f)) throw new UnsupportedCurrencyError(from);
    if (!this.supports(t)) throw new UnsupportedCurrencyError(to);
    return (amount * this.rates[f]) / this.rates[t];
  }
}
