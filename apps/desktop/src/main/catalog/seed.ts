import type { CatalogSeedEntry } from './repository';

const rejectTerms = ['used', 'pre-owned', 'lot', 'replacement', 'outfit', 'accessory only'];
const official = 'Mattel official product URL';

function entry(
  mattelSku: string, name: string, characterName: string, lineName: string, productType: string,
  monitorStatus: 'active' | 'monitor_only', requiredTerms: string[], sourceUrl: string | null, evidence = official,
): CatalogSeedEntry {
  return { mattelSku, name, characterName, lineName, productType, monitorStatus, requiredTerms, rejectTerms,
    searchQuery: `Monster High ${mattelSku}`, sourceUrl, sourceCheckedAt: '2026-07-10', evidence };
}

export const monsterHighSkuCatalog: readonly CatalogSeedEntry[] = [
  entry('JDR63', 'Skelita Calaveras Dia de Muertos 2025', 'Skelita Calaveras', 'Dia de Muertos 2025', 'collector_limited', 'monitor_only', ['Skelita Calaveras', 'Dia de Muertos'], null, 'Supplied registry; official source pending'),
  entry('HYV99', 'Elvira, Mistress of the Dark', 'Elvira', 'Skullector', 'collector_limited', 'monitor_only', ['Elvira'], null, 'Supplied registry; official source pending'),
  entry('JDR67', 'Corpse Bride Emily', 'Emily', 'Skullector x Corpse Bride', 'collector_limited', 'monitor_only', ['Corpse Bride', 'Emily'], null, 'Supplied registry; official source pending'),
  entry('HNF99', 'The Nightmare Before Christmas 2-pack', 'Jack Skellington & Sally', 'Skullector x Disney', 'collector_limited', 'monitor_only', ['Nightmare Before Christmas', 'Jack', 'Sally'], null, 'Supplied registry; official source pending'),
  entry('HGC29', 'Draculaura Boo-riginal Creeproduction', 'Draculaura', 'Boo-riginal Creeproduction', 'reissue_collector', 'active', ['Draculaura', 'Creeproduction'], 'https://shop.mattel.com/collections/monster-high-creeproductions-dolls', 'Supplied registry; official line collection'),
  entry('HHK55', 'Lagoona Blue', 'Lagoona Blue', 'Core', 'regular', 'monitor_only', ['Lagoona Blue'], 'https://shop.mattel.com/collections/monster-high', 'Supplied registry; current availability to reconfirm'),
  entry('HXJ03', "Wednesday Rave'N Dance", 'Wednesday Addams', 'Monster High x Wednesday', 'partner_collector', 'monitor_only', ['Wednesday', "Rave'N Dance"], 'https://shop.mattel.com/collections/monster-high', 'Supplied registry'),
  entry('JDR71', 'Bianca Barclay', 'Bianca Barclay', 'Monster High x Wednesday', 'partner_collector', 'monitor_only', ['Bianca Barclay', 'Wednesday'], 'https://shop.mattel.com/collections/monster-high', 'Supplied registry'),
  entry('HXH76', 'Catty Noir', 'Catty Noir', 'Core', 'regular', 'active', ['Catty Noir'], 'https://shop.mattel.com/collections/monster-high', 'Supplied registry; official line collection'),
  entry('HXH80', 'Clawdeen Wolf Monster Fest', 'Clawdeen Wolf', 'Monster Fest', 'regular', 'monitor_only', ['Clawdeen Wolf', 'Monster Fest'], 'https://shop.mattel.com/collections/monster-high', 'Supplied registry'),
  entry('HYV64', 'Buried Secrets Cozy Creepover', 'Surprise assortment', 'Buried Secrets', 'regular', 'active', ['Buried Secrets', 'Cozy Creepover'], 'https://shop.mattel.com/collections/monster-high', 'Supplied registry'),
  entry('JHK58', 'Venus McFlytrap Boo-riginal Creeproduction', 'Venus McFlytrap', 'Boo-riginal Creeproduction', 'reissue_collector', 'active', ['Venus McFlytrap', 'Creeproduction'], 'https://shop.mattel.com/products/monster-high-boo-riginal-creeproduction-venus-mcflytrap-doll-jhk58'),
  entry('JHK59', 'Robecca Steam Boo-riginal Creeproduction', 'Robecca Steam', 'Boo-riginal Creeproduction', 'reissue_collector', 'active', ['Robecca Steam', 'Creeproduction'], 'https://shop.mattel.com/products/monster-high-boo-riginal-creeproduction-robecca-steam-doll-jhk59'),
  entry('JHK57', 'Rochelle Goyle Boo-riginal Creeproduction', 'Rochelle Goyle', 'Boo-riginal Creeproduction', 'reissue_collector', 'active', ['Rochelle Goyle', 'Creeproduction'], 'https://shop.mattel.com/products/monster-high-boo-riginal-creeproduction-rochelle-goyle-doll-jhk57-en-ca'),
  entry('HYV90', 'Operetta Boo-riginal Creeproduction', 'Operetta', 'Boo-riginal Creeproduction', 'reissue_collector', 'active', ['Operetta', 'Creeproduction'], 'https://shop.mattel.com/products/monster-high-boo-riginal-creeproduction-operetta-doll-hyv90-en-ca'),
  entry('HYV88', 'Meowlody and Purrsephone Boo-riginal Creeproduction', 'Meowlody & Purrsephone', 'Boo-riginal Creeproduction', 'reissue_collector', 'active', ['Meowlody', 'Purrsephone', 'Creeproduction'], 'https://shop.mattel.com/products/monster-high-boo-riginal-creeproduction-meowlody-and-purrsephone-dolls-hyv88-en-ca'),
  entry('JMB92', 'Willow Thorne', 'Willow Thorne', 'Moonspell Magic', 'regular', 'active', ['Willow Thorne', 'Moonspell Magic'], 'https://shop.mattel.com/products/monster-high-moonspell-magic-willow-thorne-doll-jmb92-en-ca'),
  entry('JNM26', 'Carina Song', 'Carina Song', 'Moonspell Magic', 'regular', 'active', ['Carina Song', 'Moonspell Magic'], 'https://shop.mattel.com/products/monster-high-moonspell-magic-carina-song-doll-jnm26-en-ca'),
  entry('JMB89', 'Claire de Luna', 'Claire de Luna', 'Moonspell Magic', 'regular', 'active', ['Claire de Luna', 'Moonspell Magic'], 'https://shop.mattel.com/products/monster-high-moonspell-magic-claire-de-luna-doll-jmb89-en-ca'),
  entry('JMB91', 'Rae Lumina', 'Rae Lumina', 'Moonspell Magic', 'regular', 'active', ['Rae Lumina', 'Moonspell Magic'], 'https://shop.mattel.com/products/monster-high-moonspell-magic-rae-lumina-doll-jmb91-en-ca'),
  entry('JMB90', 'Layla Stone', 'Layla Stone', 'Moonspell Magic', 'regular', 'active', ['Layla Stone', 'Moonspell Magic'], 'https://shop.mattel.com/products/monster-high-moonspell-magic-layla-stone-doll-jmb90-en-ca'),
];
