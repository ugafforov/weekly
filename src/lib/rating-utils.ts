/* ─── Text helpers ─────────────────────────────────────────────── */
export const text = (value: unknown) => String(value ?? "").trim();
export const norm = (value: unknown) =>
  text(value)
    .toLocaleLowerCase()
    .replace(/[’ʻ`‘]/g, "'")
    .replace(/\s+/g, " ");

/* ─── Header detectors ─────────────────────────────────────────── */
export const isNameHeader = (v: unknown) => /familiya|family|o'?quvchi|student|ism/.test(norm(v));
export const isClassHeader = (v: unknown) => /(^|\s)(sinf|class)($|\s)/.test(norm(v));
export const isNumberHeader = (v: unknown) => /^(№|no|nº|t\/r|t\.r)$/i.test(text(v));

/* ─── Column-role detectors ────────────────────────────────────── */
export const isTeacher = (n: string) => /ustoz/.test(n);
export const isId = (n: string) => /^id$/.test(n);
export const isLevel = (n: string) => /level|etap/.test(n);
export const isCorrect = (n: string) => /javob/.test(n);
export const isResult = (n: string) => /^natijasi$/.test(n);
export const isBal58 = (n: string) => /natija uchun bal/.test(n);
export const isAvg58 = (n: string) => /o'rtacha bal|imtixon o'rtacha/.test(n);
export const isFani = (n: string) => /fani/.test(n);
export const isJami = (n: string) => /jami natija/.test(n);
export const isBal911 = (n: string) => /berilgan bal/.test(n);
export const isDiscipline = (n: string) => /davomat|kech|vazifa|odob|axloq|ahloq/.test(n);
export const isTotal = (n: string) => /\d[- ]?hafta|jami|total|umumiy/i.test(n);
/** Specifically matches a "N-HAFTA" column like "6-HAFTA" — the final weekly score. */
export const isHafta = (n: string) => /\d[- ]?hafta/.test(n);
/* ─── Cell helpers ─────────────────────────────────────────────── */
export const DISC_SHORT: Array<[RegExp, string, string]> = [
  [/davomat/, "D", "Davomat"],
  [/kech/, "K", "Kech qolmaslik"],
  [/vazifa/, "V", "Uyga vazifa"],
  [/odob|axloq|ahloq/, "O", "Odob-axloq"],
];

export const discMeta = (n: string): { short: string; label: string } => {
  for (const [re, short, label] of DISC_SHORT) if (re.test(n)) return { short, label };
  return { short: "?", label: n };
};

/** Most frequent non-empty value (the student's true ID). Ties keep first seen. */
export function modeOf(values: string[]): string {
  const counts: Record<string, number> = {};
  let best = "";
  let bestN = 0;
  for (const v of values) {
    if (!v) continue;
    counts[v] = (counts[v] ?? 0) + 1;
    if (counts[v] > bestN) {
      bestN = counts[v];
      best = v;
    }
  }
  return best;
}

export const toneFromRatio = (ratio: number | null): Tone => {
  if (ratio === null) return "none";
  if (ratio >= 0.6) return "high";
  if (ratio >= 0.34) return "mid";
  if (ratio > 0) return "low";
  return "none";
};

import type { Tone } from "./rating-types";
