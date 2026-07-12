import { parseCollectibleCollection, parseCollectibleLanding, parseCollectibleProduct } from '../src/main/collectibles/parser';

const collectionUrl = 'https://creations.mattel.com/collections/monster-high';
const landingUrl = 'https://creations.mattel.com/pages/monster-high';
const headers = { 'user-agent': 'Vetka Desktop Mattel live verifier/1.0' };
const [landingResponse, collectionResponse] = await Promise.all([fetch(landingUrl, { headers }), fetch(collectionUrl, { headers })]);
if (!landingResponse.ok) throw new Error(`Mattel landing returned HTTP ${landingResponse.status}`);
if (!collectionResponse.ok) throw new Error(`Mattel collection returned HTTP ${collectionResponse.status}`);
const urls = [...new Set([
  ...parseCollectibleLanding(await landingResponse.text(), landingUrl),
  ...parseCollectibleCollection(await collectionResponse.text(), collectionUrl),
])];
if (urls.length === 0) throw new Error('Mattel collection returned no doll product links');

const verified: string[] = [];
for (const url of urls.slice(0, 20)) {
  const productResponse = await fetch(url, { headers });
  if (!productResponse.ok) continue;
  const parsed = parseCollectibleProduct(await productResponse.text(), url);
  if (parsed && !('ambiguous' in parsed)) verified.push(`${parsed.mattelSku ?? 'no-sku'} ${parsed.lifecycle} ${parsed.officialName}`);
  if (verified.length >= 3) break;
}
if (verified.length === 0) throw new Error('Mattel product pages returned no verifiable collector dolls');

process.stdout.write(`Discovered ${urls.length} direct Mattel product links\n${verified.join('\n')}\n`);
