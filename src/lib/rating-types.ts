export type StudentStatus = "normal" | "wrong-id" | "absent";

export type Tone = "high" | "mid" | "low" | "none";

export type SheetKind = "5-8" | "9-11";

/** One subject result for a single student (English / Math / 3rd, or 1-blok / 2-blok / 3rd). */
export interface SubjectResult {
  /** Fixed column label shown in the header: "INGLIZ TILI", "1-BLOK", "3-FAN"… */
  label: string;
  /** Per-student subject name (only for 9-11 blocks, e.g. "Matematika"). */
  subjectName?: string;
  /** Teacher (ustoz) responsible for this subject — 5-8 sheets. */
  teacher?: string;
  /** 0–100 for 5-8 (percent-based); null for 9-11 (point-based). */
  percent: number | null;
  /** Main value to display: "87%" or "34.1". */
  resultText: string;
  /** Number of correct answers (TO'G'RI JAVOBLAR SONI). */
  correct: number | null;
  /** Total questions per block (default 15). */
  totalQuestions: number;
  /** NATIJA UCHUN BAL. */
  score: string;
  /** LEVEL (ETAP) — 5-8 only. */
  level?: string;
  /** ID the student entered for this subject. */
  id?: string;
  /** True when this subject's ID differs from the student's main ID. */
  idError?: boolean;
  tone: Tone;
  /** False when the student clearly did not sit this exam. */
  present: boolean;
}

export interface DisciplineMark {
  short: string;
  label: string;
  value: string;
  ok: boolean;
  empty: boolean;
}

export interface SummaryItem {
  label: string;
  value: string;
}

export interface NormalizedStudent {
  rowNumber: number;
  name: string;
  className: string;
  /** The student's main (correct) exam ID. */
  studentId: string;
  kind: SheetKind;
  subjects: SubjectResult[];
  /** O'rtacha bal (5-8) and/or JAMI NATIJA + BAL (9-11). */
  summary: SummaryItem[];
  /** Mid column shown between subjects: 5-8 → "O'RTACHA BAL", 9-11 → "BAL". */
  midScore: string;
  midLabel: string;
  discipline: DisciplineMark[];
  /** Sum of discipline points (empty cells count as 0). */
  disciplineTotal: number;
  /** Exam contribution to JAMI = total − disciplineTotal. */
  examScore: number;
  total: number;
  totalText: string;
  status: StudentStatus;
}

export interface RatingWorkbook {
  fileName: string;
  date: string;
  students: NormalizedStudent[];
  week?: string;
}
