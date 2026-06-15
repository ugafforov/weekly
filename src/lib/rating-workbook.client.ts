import * as XLSX from "xlsx-js-style";
import type {
  DisciplineMark,
  NormalizedStudent,
  RatingWorkbook,
  SheetKind,
  StudentStatus,
  SubjectResult,
  SummaryItem,
  Tone,
} from "./rating-types";

/* ─── Text helpers ─────────────────────────────────────────────── */
const text = (value: unknown) => String(value ?? "").trim();
const norm = (value: unknown) =>
  text(value)
    .toLocaleLowerCase()
    .replace(/[’ʻ`‘]/g, "'")
    .replace(/\s+/g, " ");

/* ─── Header detectors ─────────────────────────────────────────── */
const isNameHeader = (v: unknown) => /familiya|family|o'?quvchi|student|ism/.test(norm(v));
const isClassHeader = (v: unknown) => /(^|\s)(sinf|class)($|\s)/.test(norm(v));
const isNumberHeader = (v: unknown) => /^(№|no|nº|t\/r|t\.r)$/i.test(text(v));

/* ─── Column-role detectors (work on normalized header label) ──── */
const isTeacher = (n: string) => /ustoz/.test(n);
const isId = (n: string) => /^id$/.test(n);
const isLevel = (n: string) => /level|etap/.test(n);
const isCorrect = (n: string) => /javob/.test(n);
const isResult = (n: string) => /^natijasi$/.test(n);
const isBal58 = (n: string) => /natija uchun bal/.test(n);
const isAvg58 = (n: string) => /o'rtacha bal|imtixon o'rtacha/.test(n);
const isFani = (n: string) => /fani/.test(n);
const isJami = (n: string) => /jami natija/.test(n);
const isBal911 = (n: string) => /berilgan bal/.test(n);
const isDiscipline = (n: string) => /davomat|kech|vazifa|odob|axloq|ahloq/.test(n);
const isTotal = (n: string) => /\d+\s*-?\s*hafta/.test(n);

/* ─── Cell helpers ─────────────────────────────────────────────── */
type Cell = XLSX.CellObject | undefined;
const cellAt = (sheet: XLSX.WorkSheet, r: number, c: number): Cell =>
  sheet[XLSX.utils.encode_cell({ r, c })];
const rawNum = (cell: Cell): number | null => {
  const n = Number(cell?.v);
  return Number.isFinite(n) && cell?.v !== "" && cell?.v !== undefined ? n : null;
};
const fmt = (cell: Cell): string => {
  if (!cell) return "";
  const w = text(cell.w);
  if (w) return w;
  return cell.v !== undefined && cell.v !== null ? String(cell.v) : "";
};
/** 5-8 result is stored as a fraction (0.87) but formatted as "87%". */
const percentFrom = (cell: Cell): number | null => {
  if (!cell) return null;
  const w = String(cell.w ?? "");
  if (w.includes("%")) {
    const m = w.match(/(-?\d+(?:[.,]\d+)?)/);
    return m ? Math.round(parseFloat(m[1].replace(",", "."))) : null;
  }
  const v = Number(cell.v);
  if (!Number.isFinite(v) || cell.v === "" || cell.v === undefined) return null;
  return Math.round(v <= 1.5 ? v * 100 : v);
};

function colorKind(cell: Cell): StudentStatus | undefined {
  const hex = text(cell?.s?.fill?.fgColor?.rgb).replace(/^FF/, "").toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(hex)) return undefined;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (r > 240 && g > 240 && b > 240) return undefined; // white / no mark
  // Yellow / orange family → wrong ID.
  if (r > 0xc0 && g > 0x80 && b < 0xa0 && r - b > 0x40) return "wrong-id";
  // Grey family → did not attend.
  if (Math.abs(r - g) < 0x18 && Math.abs(g - b) < 0x18 && r >= 0x60 && r <= 0xe0) return "absent";
  return undefined;
}

function mergedValue(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const direct = cellAt(sheet, row, col)?.v;
  if (direct !== undefined && direct !== null && text(direct)) return direct;
  const merge = (sheet["!merges"] ?? []).find(
    (range) => row >= range.s.r && row <= range.e.r && col >= range.s.c && col <= range.e.c,
  );
  return merge ? cellAt(sheet, merge.s.r, merge.s.c)?.v : undefined;
}

const DISC_SHORT: Array<[RegExp, string, string]> = [
  [/davomat/, "D", "Davomat"],
  [/kech/, "K", "Kech qolmaslik"],
  [/vazifa/, "V", "Uyga vazifa"],
  [/odob|axloq|ahloq/, "O", "Odob-axloq"],
];
const discMeta = (n: string): { short: string; label: string } => {
  for (const [re, short, label] of DISC_SHORT) if (re.test(n)) return { short, label };
  return { short: "?", label: n };
};

/** Most frequent non-empty value (the student's true ID). Ties keep first seen. */
function modeOf(values: string[]): string {
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

const toneFromRatio = (ratio: number | null): Tone => {
  if (ratio === null) return "none";
  if (ratio >= 0.6) return "high";
  if (ratio >= 0.34) return "mid";
  if (ratio > 0) return "low";
  return "none";
};

/* ─── Column layout per sheet ──────────────────────────────────── */
interface OrderedCol {
  c: number;
  label: string;
  n: string;
}
interface SubjectDef {
  label: string;
  fromHeader: boolean;
  isThird: boolean;
  levelCol?: number;
  correctCol?: number;
  resultCol: number;
  balCol?: number;
  faniCol?: number; // 9-11 per-student subject name
  idCol?: number; // subject-specific ID the student entered
}
interface SheetLayout {
  kind: SheetKind;
  nameCol: number;
  classCol: number;
  totalCol: number;
  subjects: SubjectDef[];
  avgCol?: number;
  jamiCol?: number;
  balCol?: number;
  discCols: Array<{ c: number; short: string; label: string }>;
  /** Every ID column (across subjects + discipline) — used to find the main ID. */
  idCols: number[];
  visibleCols: number[];
}

function buildLayout(sheet: XLSX.WorkSheet): SheetLayout | null {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const visibleCols = Array.from({ length: range.e.c - range.s.c + 1 }, (_, i) => range.s.c + i).filter(
    (col) => !sheet["!cols"]?.[col]?.hidden,
  );

  // Locate header row: must contain both a name and a class header.
  let headerRow = -1;
  for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 40); row += 1) {
    const values = visibleCols.map((col) => mergedValue(sheet, row, col));
    if (values.some(isNameHeader) && values.some(isClassHeader)) {
      headerRow = row;
      break;
    }
  }
  if (headerRow < 0) return null;

  const nameCol = visibleCols.find((c) => isNameHeader(mergedValue(sheet, headerRow, c)));
  const classCol = visibleCols.find((c) => isClassHeader(mergedValue(sheet, headerRow, c)));
  const numberCol = visibleCols.find((c) => isNumberHeader(mergedValue(sheet, headerRow, c)));
  if (nameCol === undefined || classCol === undefined) return null;

  const dataCols: OrderedCol[] = visibleCols
    .filter((c) => c !== nameCol && c !== classCol && c !== numberCol)
    .map((c) => {
      const label = text(mergedValue(sheet, headerRow, c));
      return { c, label, n: norm(label) };
    });

  const totalIdx = (() => {
    for (let i = dataCols.length - 1; i >= 0; i -= 1) if (isTotal(dataCols[i].n)) return i;
    return dataCols.length - 1;
  })();
  const totalCol = dataCols[totalIdx]?.c ?? classCol;

  const resultIdxs = dataCols.map((d, i) => (isResult(d.n) ? i : -1)).filter((i) => i >= 0);
  const discCols = dataCols
    .filter((d) => isDiscipline(d.n))
    .map((d) => ({ c: d.c, ...discMeta(d.n) }));
  const idCols = dataCols.filter((d) => isId(d.n)).map((d) => d.c);

  const kind: SheetKind = dataCols.some((d) => /blok/.test(d.n)) ? "9-11" : "5-8";

  if (kind === "9-11") {
    const subjects: SubjectDef[] = [];
    let prevEnd = -1;
    resultIdxs.forEach((ri, idx) => {
      let correctCol: number | undefined;
      let faniCol: number | undefined;
      let idCol: number | undefined;
      for (let j = prevEnd + 1; j < ri; j += 1) {
        if (isCorrect(dataCols[j].n)) correctCol = dataCols[j].c;
        if (isFani(dataCols[j].n)) faniCol = dataCols[j].c;
        if (isId(dataCols[j].n)) idCol = dataCols[j].c;
      }
      prevEnd = ri;
      subjects.push({
        label: idx === 0 ? "1-BLOK" : idx === 1 ? "2-BLOK" : "3-FAN",
        fromHeader: false,
        isThird: idx === 2,
        correctCol,
        faniCol,
        idCol,
        resultCol: dataCols[ri].c,
      });
    });
    const jamiCol = dataCols.find((d) => isJami(d.n))?.c;
    const balCol = dataCols.find((d) => isBal911(d.n))?.c;
    return { kind, nameCol, classCol, totalCol, subjects, jamiCol, balCol, discCols, idCols, visibleCols };
  }

  // ── 5-8 layout ──
  const subjects: SubjectDef[] = [];
  let prevBlockEnd = -1;
  resultIdxs.forEach((ri, idx) => {
    const nextRi = resultIdxs[idx + 1] ?? dataCols.length;
    let balCol: number | undefined;
    for (let j = ri + 1; j < nextRi; j += 1) {
      if (isBal58(dataCols[j].n)) {
        balCol = dataCols[j].c;
        break;
      }
    }
    let levelCol: number | undefined;
    let correctCol: number | undefined;
    let idCol: number | undefined;
    let teacherLabel = "";
    for (let j = prevBlockEnd + 1; j < ri; j += 1) {
      if (isLevel(dataCols[j].n)) levelCol = dataCols[j].c;
      if (isCorrect(dataCols[j].n)) correctCol = dataCols[j].c;
      if (isId(dataCols[j].n)) idCol = dataCols[j].c;
      if (isTeacher(dataCols[j].n)) teacherLabel = dataCols[j].label;
    }
    prevBlockEnd = balCol !== undefined ? dataCols.findIndex((d) => d.c === balCol) : ri;
    const name = teacherLabel.replace(/\s*ustoz(i)?\s*$/i, "").trim();
    subjects.push({
      label: name ? name.toLocaleUpperCase("uz-UZ") : idx === 2 ? "3-FAN" : `${idx + 1}-FAN`,
      fromHeader: Boolean(name),
      isThird: idx === 2,
      levelCol,
      correctCol,
      idCol,
      resultCol: dataCols[ri].c,
      balCol,
    });
  });
  const avgCol = dataCols.find((d) => isAvg58(d.n))?.c;
  return { kind, nameCol, classCol, totalCol, subjects, avgCol, discCols, idCols, visibleCols };
}

/* ─── Build one normalized student row ─────────────────────────── */
function buildStudent(
  sheet: XLSX.WorkSheet,
  row: number,
  layout: SheetLayout,
): NormalizedStudent | null {
  const name = text(cellAt(sheet, row, layout.nameCol)?.v);
  const className = text(cellAt(sheet, row, layout.classCol)?.v).replace(/\s/g, "").toUpperCase();
  if (!name || !/^\d{1,2}[A-ZА-Я]?$/.test(className)) return null;

  const rowStatuses = layout.visibleCols.map((c) => colorKind(cellAt(sheet, row, c)));
  const colorStatus: StudentStatus = rowStatuses.includes("absent")
    ? "absent"
    : rowStatuses.includes("wrong-id")
      ? "wrong-id"
      : "normal";

  // Main ID = the value most ID columns agree on. A subject whose ID differs entered it wrong.
  const allIds = layout.idCols.map((c) => fmt(cellAt(sheet, row, c)));
  const studentId = modeOf(allIds);

  const subjects: SubjectResult[] = layout.subjects.map((def) => {
    const resultCell = cellAt(sheet, row, def.resultCol);
    const correct = def.correctCol !== undefined ? rawNum(cellAt(sheet, row, def.correctCol)) : null;
    const id = def.idCol !== undefined ? fmt(cellAt(sheet, row, def.idCol)) : "";
    // ID error is flagged two ways: a manual colour marker on any of the subject's
    // cells (the teacher highlights it before upload), or a detectable ID mismatch.
    const subjectCols = [def.idCol, def.resultCol, def.correctCol, def.balCol, def.levelCol, def.faniCol];
    const colorMark = subjectCols.some(
      (c) => c !== undefined && colorKind(cellAt(sheet, row, c)) === "wrong-id",
    );
    const idError = colorMark || Boolean(id && studentId && id !== studentId);

    if (layout.kind === "5-8") {
      const percent = percentFrom(resultCell);
      const present = !(correct === null && (percent === null || percent === 0));
      const ratio = correct !== null ? correct / 15 : percent !== null ? percent / 100 : null;
      return {
        label: def.label,
        percent,
        resultText: percent !== null ? `${percent}%` : "—",
        correct,
        totalQuestions: 15,
        score: def.balCol !== undefined ? fmt(cellAt(sheet, row, def.balCol)) : "",
        level: def.levelCol !== undefined ? fmt(cellAt(sheet, row, def.levelCol)) : undefined,
        id,
        idError,
        tone: present ? toneFromRatio(ratio) : "none",
        present,
      } satisfies SubjectResult;
    }

    // 9-11 — point based
    const points = rawNum(resultCell);
    const subjectName = def.faniCol !== undefined ? fmt(cellAt(sheet, row, def.faniCol)) : "";
    const present = !(correct === null && (points === null || points === 0));
    const ratio = correct !== null ? correct / 15 : null;
    return {
      label: def.label,
      subjectName: subjectName || undefined,
      percent: null,
      resultText: points !== null ? fmt(resultCell) : "—",
      correct,
      totalQuestions: 15,
      score: "",
      id,
      idError,
      tone: present ? toneFromRatio(ratio) : "none",
      present,
    } satisfies SubjectResult;
  });

  const summary: SummaryItem[] = [];
  let midScore = "0";
  let midLabel = "O'RTACHA BAL";
  if (layout.kind === "5-8") {
    midScore = layout.avgCol !== undefined ? fmt(cellAt(sheet, row, layout.avgCol)) || "0" : "0";
    midLabel = "O'RTACHA BAL";
    summary.push({ label: "O'rtacha bal", value: midScore });
  } else {
    midScore = layout.balCol !== undefined ? fmt(cellAt(sheet, row, layout.balCol)) || "0" : "0";
    midLabel = "BAL";
    if (layout.jamiCol !== undefined)
      summary.push({ label: "Jami natija", value: fmt(cellAt(sheet, row, layout.jamiCol)) || "0" });
    summary.push({ label: "Bal", value: midScore });
  }

  const discipline: DisciplineMark[] = layout.discCols.map((d) => {
    const value = fmt(cellAt(sheet, row, d.c));
    const empty = value === "";
    return { short: d.short, label: d.label, value, ok: Number(value) > 0, empty };
  });
  const disciplineTotal = discipline.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  const totalCell = cellAt(sheet, row, layout.totalCol);
  const total = rawNum(totalCell) ?? 0;
  const examScore = Math.round((total - disciplineTotal) * 100) / 100;

  // Status priority: explicit colour → ID mismatch → no exams sat (absent).
  let finalStatus = colorStatus;
  if (finalStatus === "normal" && subjects.some((s) => s.idError)) {
    finalStatus = "wrong-id";
  }
  if (finalStatus === "normal" && subjects.length > 0 && subjects.every((s) => !s.present)) {
    finalStatus = "absent";
  }

  return {
    rowNumber: row + 1,
    name,
    className,
    studentId,
    kind: layout.kind,
    subjects,
    summary,
    midScore,
    midLabel,
    discipline,
    disciplineTotal,
    examScore,
    total,
    totalText: fmt(totalCell) || "0",
    status: finalStatus,
  };
}

/* ─── Public API ───────────────────────────────────────────────── */
export async function parseRatingWorkbook(file: File): Promise<RatingWorkbook> {
  const bytes = await file.arrayBuffer();
  const book = XLSX.read(bytes, { type: "array", cellStyles: true, cellDates: true });
  if (!book.SheetNames.length) throw new Error("Excel faylida sahifa topilmadi.");

  const students: NormalizedStudent[] = [];
  let date = "";

  for (const sheetName of book.SheetNames) {
    if (/template|shablon/i.test(sheetName)) continue;
    const sheet = book.Sheets[sheetName];
    if (!sheet) continue;
    const layout = buildLayout(sheet);
    if (!layout) continue;

    const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
    // header row is wherever buildLayout found name/class — re-scan to get first data row
    let headerRow = range.s.r;
    for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 40); row += 1) {
      const values = layout.visibleCols.map((c) => mergedValue(sheet, row, c));
      if (values.some(isNameHeader) && values.some(isClassHeader)) {
        headerRow = row;
        break;
      }
    }

    for (let row = headerRow + 1; row <= range.e.r; row += 1) {
      const student = buildStudent(sheet, row, layout);
      if (student) students.push(student);
    }

    // Date from the title block above the header.
    if (!date) {
      for (let row = range.s.r; row < headerRow && !date; row += 1) {
        for (const c of layout.visibleCols) {
          const m = text(mergedValue(sheet, row, c)).match(/(\d{1,2}[./-]\d{1,2}[./-]\d{4})/);
          if (m?.[1]) date = m[1].replace(/[/-]/g, ".");
        }
      }
    }
  }

  if (!students.length) {
    throw new Error("5–8 yoki 9–11 umumiy reyting sahifalarida o'quvchilar topilmadi.");
  }

  return {
    fileName: file.name,
    date: date || new Date().toLocaleDateString("uz-UZ"),
    students,
  };
}

/* ─── Excel re-export (per-class sheets) ───────────────────────── */
export function createSegmentedWorkbook(data: RatingWorkbook, classes: string[]): ArrayBuffer {
  const book = XLSX.utils.book_new();
  for (const className of classes) {
    const classStudents = data.students
      .filter((s) => s.className === className)
      .sort((a, b) => b.total - a.total);
    if (!classStudents.length) continue;
    const sample = classStudents[0];

    const subjectHeaders = sample.subjects.map((s) => s.label);
    const summaryHeaders = sample.summary.map((s) => s.label.toUpperCase());
    const discHeaders = sample.discipline.map((d) => d.short);
    const headers = ["№", "FAMILIYA ISM", ...subjectHeaders, ...summaryHeaders, ...discHeaders, "JAMI"];

    const rows = classStudents.map((student, index) => [
      index + 1,
      student.name,
      ...student.subjects.map((s) =>
        s.subjectName ? `${s.subjectName}: ${s.resultText}` : s.resultText,
      ),
      ...student.summary.map((s) => s.value),
      ...student.discipline.map((d) => d.value),
      student.totalText,
    ]);

    const sheet = XLSX.utils.aoa_to_sheet([
      ["AL-XORAZMIY SCHOOL"],
      ["HAFTALIK JAMG'ARILGAN BALLAR"],
      [`(${data.date}) — ${className} sinf`],
      [],
      headers,
      ...rows,
    ]);
    sheet["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: headers.length - 1 } }));
    sheet["!cols"] = headers.map((_, index) => ({ wch: index === 1 ? 28 : index > 1 ? 14 : 6 }));
    for (let row = 0; row <= rows.length + 4; row += 1) {
      for (let col = 0; col < headers.length; col += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
        if (!cell) continue;
        cell.s = {
          font: { name: "Arial", bold: row <= 4, color: { rgb: row === 4 ? "FFFFFFFF" : "FF17201E" } },
          alignment: {
            horizontal: row <= 4 ? "center" : col === 1 ? "left" : "center",
            vertical: "center",
            wrapText: true,
          },
          fill: row === 4 ? { patternType: "solid", fgColor: { rgb: "FF167C74" } } : undefined,
          border:
            row >= 4
              ? {
                  top: { style: "thin", color: { rgb: "FFD9E0DE" } },
                  bottom: { style: "thin", color: { rgb: "FFD9E0DE" } },
                  left: { style: "thin", color: { rgb: "FFD9E0DE" } },
                  right: { style: "thin", color: { rgb: "FFD9E0DE" } },
                }
              : undefined,
        };
      }
    }
    XLSX.utils.book_append_sheet(book, sheet, className.slice(0, 31));
  }
  return XLSX.write(book, { bookType: "xlsx", type: "array" });
}
