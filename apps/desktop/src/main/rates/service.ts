import { parseNbkRates } from './nbk';

const RSS_URL = 'https://nationalbank.kz/rss/rates_all.xml';
const DAY_MS = 86_400_000;

export class NbkRateService {
  constructor(private readonly dependencies: { get<T>(key: string): T | null; set<T>(key: string, value: T): T; fetch?: typeof fetch }) {}

  async refresh(): Promise<Record<string, { rateMicros: number; updatedAt: string; source: 'nbk' }>> {
    if (this.dependencies.get<'auto' | 'manual'>('exchangeRatesMode') === 'manual') throw new Error('Exchange rates are in manual mode');
    const current = this.dependencies.get<Record<string, { rateMicros: number; updatedAt: string; source: string }>>('exchangeRates');
    if (current?.USD?.source === 'nbk' && current.USD.updatedAt && Date.now() - new Date(current.USD.updatedAt).getTime() < DAY_MS) return current as never;
    const response = await (this.dependencies.fetch ?? fetch)(RSS_URL);
    if (!response.ok) throw new Error('NBK rate service unavailable');
    const now = new Date().toISOString();
    const rates = Object.fromEntries(Object.entries(parseNbkRates(await response.text())).map(([currency, rateMicros]) => [currency, { rateMicros, updatedAt: now, source: 'nbk' as const }]));
    return this.dependencies.set('exchangeRates', rates);
  }
}
