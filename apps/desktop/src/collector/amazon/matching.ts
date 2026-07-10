export type DollIdentity = {
  name: string;
  characterName?: string | null;
  lineName?: string | null;
  generation?: string | null;
  mattelSku?: string | null;
  upcEan?: string | null;
};

export type AmazonIdentityCandidate = {
  title: string;
  modelNumber?: string | null;
  upcEan?: string | null;
  manuallyConfirmed?: boolean;
};

export type MatchDecision = {
  status: 'verified' | 'needs_review' | 'rejected';
  score: number;
  reason: string;
};

export type CatalogOfferRules = {
  mattelSku: string;
  requiredTerms: readonly string[];
  rejectTerms: readonly string[];
};

const negativeAccessoryPattern = /\b(accessor(?:y|ies)|replacement|shoes?|boots?|clothes?|outfits?|stand|case|bag|wig|furniture|vehicle)\b/i;
const normalized = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
const exact = (left: string | null | undefined, right: string | null | undefined) => Boolean(normalized(left) && normalized(left) === normalized(right));
const contains = (text: string, value: string | null | undefined) => Boolean(normalized(value) && text.includes(normalized(value)));

function overlap(left: string, right: string): number {
  const ignored = new Set(['the', 'and', 'with', 'doll', 'puppe', 'muñeca', 'bambola']);
  const words = [...new Set(normalized(left).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2 && !ignored.has(word)))];
  if (words.length === 0) return 0;
  const candidate = normalized(right);
  return words.filter((word) => candidate.includes(word)).length / words.length;
}

export function matchAmazonProduct(doll: DollIdentity, candidate: AmazonIdentityCandidate): MatchDecision {
  const candidateText = `${candidate.title} ${candidate.modelNumber ?? ''}`;
  if (negativeAccessoryPattern.test(candidateText)) return { status: 'rejected', score: 0, reason: 'non_doll' };
  if (exact(candidate.modelNumber, doll.mattelSku)) return { status: 'verified', score: 100, reason: 'mattel_sku' };
  if (exact(candidate.upcEan, doll.upcEan)) return { status: 'verified', score: 100, reason: 'upc_ean' };
  if (candidate.manuallyConfirmed) return { status: 'verified', score: 100, reason: 'manual' };

  const title = normalized(candidate.title);
  const brandScore = /monster high|mattel/i.test(title) ? 20 : 0;
  const characterScore = contains(title, doll.characterName) ? 20 : 0;
  const lineScore = contains(title, doll.lineName) ? 15 : 0;
  const generationScore = contains(title, doll.generation) ? 10 : 0;
  const titleScore = Math.round(overlap(doll.name, candidate.title) * 35);
  const score = brandScore + characterScore + lineScore + generationScore + titleScore;
  return score >= 85
    ? { status: 'needs_review', score, reason: 'title_similarity' }
    : { status: 'rejected', score, reason: 'insufficient_identity' };
}

export function matchCatalogOffer(
  rules: CatalogOfferRules,
  candidate: { title: string | null; evidenceText: string; condition: 'New' | null },
): MatchDecision {
  const evidence = normalized(candidate.evidenceText);
  const title = normalized(candidate.title);
  if (!evidence.includes(normalized(rules.mattelSku))) return { status: 'rejected', score: 0, reason: 'mattel_sku_missing' };
  if (candidate.condition !== 'New') return { status: 'rejected', score: 0, reason: 'condition_not_new' };
  if (rules.rejectTerms.some((term) => title.includes(normalized(term)) || evidence.includes(normalized(term)))) {
    return { status: 'rejected', score: 0, reason: 'reject_term' };
  }
  if (!rules.requiredTerms.some((term) => title.includes(normalized(term)))) {
    return { status: 'rejected', score: 0, reason: 'required_term_missing' };
  }
  return { status: 'verified', score: 100, reason: 'catalog_rules' };
}
