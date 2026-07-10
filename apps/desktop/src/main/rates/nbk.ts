const wanted = new Set(['USD', 'EUR', 'GBP']);

export function parseNbkRates(xml: string): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = item[1];
    const code = body.match(/<title>([A-Z]{3})<\/title>/)?.[1];
    const value = Number(body.match(/<description>([\d.,]+)<\/description>/)?.[1]?.replace(',', '.'));
    const nominal = Number(body.match(/<quant>(\d+)<\/quant>/)?.[1] ?? '1');
    if (code && wanted.has(code) && Number.isFinite(value) && value > 0 && nominal > 0) rates[code] = Math.round((value / nominal) * 1_000_000);
  }
  if (Object.keys(rates).length !== wanted.size) throw new Error('NBK response is missing required currencies');
  return rates;
}
