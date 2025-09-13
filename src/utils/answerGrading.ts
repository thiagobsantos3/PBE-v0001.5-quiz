import { Question } from '../types';

interface GradeOptions {
  fullCreditThreshold?: number; // 0-100
  itemMatchThreshold?: number; // 0-100 per keyphrase
}

const DEFAULT_OPTIONS: Required<GradeOptions> = {
  fullCreditThreshold: 85,
  itemMatchThreshold: 85,
};

// Basic number-to-words for small numbers and common tens
const NUMBER_WORDS: Record<string, string> = {
  '0': 'zero','1': 'one','2': 'two','3': 'three','4': 'four','5': 'five','6': 'six','7': 'seven','8': 'eight','9': 'nine','10': 'ten',
  '11': 'eleven','12': 'twelve','13': 'thirteen','14': 'fourteen','15': 'fifteen','16': 'sixteen','17': 'seventeen','18': 'eighteen','19': 'nineteen',
  '20': 'twenty','30': 'thirty','40': 'forty','50': 'fifty','60': 'sixty','70': 'seventy','80': 'eighty','90': 'ninety'
};

function normalizeText(input: string): string {
  if (!input) return '';
  let s = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[“”«»\u2019\u2018]/g, '"') // normalize quotes
    .toLowerCase();
  // convert digits to words where possible (simple)
  s = s.replace(/\b(\d{1,2})\b/g, (_m, d) => NUMBER_WORDS[d] || d);
  // protect negations by spacing (so we don't collapse them away)
  s = s.replace(/\b(n(?:ot|o|ever))\b/g, ' $1 ');
  // remove punctuation except hyphens/apostrophes inside words
  s = s.replace(/[^a-z0-9'\-\s]/g, ' ');
  // collapse multiple spaces
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function tokenize(input: string): string[] {
  const s = normalizeText(input);
  if (!s) return [];
  // split on whitespace; keep inner hyphens and apostrophes
  const tokens = s.split(/\s+/).filter(Boolean);
  return tokens;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  const dp = new Array(lb + 1).fill(0);
  for (let j = 0; j <= lb; j++) dp[j] = j;
  for (let i = 1; i <= la; i++) {
    let prev = dp[0];
    dp[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const tmp = dp[j];
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[lb];
}

function fuzzyTokenEqual(a: string, b: string): boolean {
  if (a === b) return true;
  const dist = levenshtein(a, b);
  if (a.length <= 4 || b.length <= 4) return dist <= 1;
  return dist <= 2;
}

function fuzzyIntersectionCount(aTokens: string[], bTokens: string[]): number {
  const used = new Array(bTokens.length).fill(false);
  let count = 0;
  for (const t of aTokens) {
    for (let j = 0; j < bTokens.length; j++) {
      if (used[j]) continue;
      if (fuzzyTokenEqual(t, bTokens[j])) {
        used[j] = true;
        count++;
        break;
      }
    }
  }
  return count;
}

// Dice coefficient on token sets with fuzzy matching, scaled 0..100
function tokenSetFuzzyRatio(a: string, b: string): number {
  const at = Array.from(new Set(tokenize(a)));
  const bt = Array.from(new Set(tokenize(b)));
  if (at.length === 0 && bt.length === 0) return 100;
  if (at.length === 0 || bt.length === 0) return 0;
  const inter = fuzzyIntersectionCount(at, bt);
  const score = (2 * inter) / (at.length + bt.length);
  return Math.round(score * 100);
}

// Split expected answer into key phrases by separators and conjunctions
function splitIntoKeyPhrases(answer: string): string[] {
  const s = normalizeText(answer);
  if (!s) return [];
  const parts = s
    .split(/[,;]+|\band\b/g)
    .map(p => p.trim())
    .filter(Boolean);
  // de-dup similar phrases
  const unique: string[] = [];
  for (const p of parts) {
    if (!unique.some(q => tokenSetFuzzyRatio(p, q) >= 95)) unique.push(p);
  }
  return unique.length > 0 ? unique : [s];
}

export interface GradeResult {
  pointsEarned: number;
  isCorrect: boolean;
  matchedItems: number;
  totalItems: number;
  bestMatchAnswer: string;
  debug?: any;
}

export function gradeTypedAnswer(
  typedAnswer: string,
  question: Question,
  options?: GradeOptions
): GradeResult {
  const opts = { ...DEFAULT_OPTIONS, ...(options || {}) };
  const user = normalizeText(typedAnswer);
  const candidates: string[] = [];
  if (question.answer) candidates.push(question.answer);
  const accepted = (question as any).accepted_answers as string[] | undefined;
  if (Array.isArray(accepted)) candidates.push(...accepted);

  let best: GradeResult | null = null;
  for (const cand of candidates) {
    const phrases = splitIntoKeyPhrases(cand);
    let matched = 0;
    const itemScores: number[] = [];
    for (const phrase of phrases) {
      const score = tokenSetFuzzyRatio(user, phrase);
      itemScores.push(score);
      if (score >= opts.itemMatchThreshold) matched++;
    }
    const fraction = phrases.length > 0 ? matched / phrases.length : 0;
    const fullScore = tokenSetFuzzyRatio(user, cand);
    const isFull = fullScore >= opts.fullCreditThreshold && matched === phrases.length;
    const points = isFull ? question.points : Math.round(question.points * fraction);
    const result: GradeResult = {
      pointsEarned: Math.max(0, Math.min(question.points, points)),
      isCorrect: isFull,
      matchedItems: matched,
      totalItems: phrases.length,
      bestMatchAnswer: cand,
      debug: { itemScores, fullScore }
    };
    if (!best || result.pointsEarned > best.pointsEarned) {
      best = result;
    }
  }
  // If there were no candidates, default to zero
  return best || {
    pointsEarned: 0,
    isCorrect: false,
    matchedItems: 0,
    totalItems: 0,
    bestMatchAnswer: '',
  };
}

export const AnswerGradingUtils = {
  normalizeText,
  tokenize,
  tokenSetFuzzyRatio,
  splitIntoKeyPhrases,
  gradeTypedAnswer,
};