import * as XLSX from "xlsx-js-style";

export type StudentStatus = "normal" | "wrong-id" | "absent";

export interface RatingColumn {
  key: string;
  label: string;
  group: string;
}

export interface RatingStudent {
  rowNumber: number;
  name: string;
  className: string;
  total: number;
  status: StudentStatus;
  values: Record<string, string | number>;
}

export interface RatingWorkbook {
  fileName: string;
  date: string;
  columns: RatingColumn[];
  students: RatingStudent[];
}

const text = (value: unknown) => String(value ?? "").trim();
const normalized = (value: unknown) => text(value).toLocaleLowerCase().replace(/[’ʻ`‘]/g, "'");
const isNameHeader = (value: unknown) => /familiya|family|o[' ]?quvchi|student|ism/.test(normalized(value));
const isClassHeader = (value: unknown) => /(^|\s)(sinf|class)($|\s)/.test(normalized(value));
const isNumberHeader = (value: unknown) => /^(№|no|nº|t\/r)$/i.test(text(value));
const isTotalHeader = (value: unknown) => /5[- ]?hafta|weekly total|jami ball|umumiy/.test(normalized(value));

function colorKind(cell: XLSX.CellObject | undefined): StudentStatus | undefined {
  const rgb = text(cell?.s?.fill?.fgColor?.rgb).replace(/^FF/, "").toUpperCase();
  if (!rgb) return undefined;
  if (/^(FFC000|FFD966|FFE699|FFF2CC|FFFF00)/.test(rgb)) return "wrong-id";
  if (/^(7F7F7F|808080|A5A5A5|B7B7B7|D9D9D9)/.test(rgb)) return "absent";
  return undefined;
}

function mergedValue(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const direct = sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v;
  if (direct !== undefined && direct !== null && text(direct)) return direct;
  const merge = (sheet["!merges"] ?? []).find(
    (range) => row >= range.s.r && row <= range.e.r && col >= range.s.c && col <= range.e.c,
  );
  return merge ? sheet[XLSX.utils.encode_cell(merge.s)]?.v : undefined;
}

export async function parseRatingWorkbook(file: File): Promise<RatingWorkbook> {
  const bytes = await file.arrayBuffer();
  const book = XLSX.read(bytes, { type: "array", cellStyles: true, cellDates: true });
  const activeIndex = Math.max(0, Number(book.Workbook?.Views?.[0]?.activeTab ?? 0));
  const sheetName = book.SheetNames[activeIndex] ?? book.SheetNames[0];
  if (!sheetName) throw new Error("The workbook does not contain a sheet.");
  const sheet = book.Sheets[sheetName];
  if (!sheet) throw new Error("The active sheet could not be read.");
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const visibleCols = Array.from({ length: range.e.c - range.s.c + 1 }, (_, i) => range.s.c + i).filter(
    (col) => !sheet["!cols"]?.[col]?.hidden,
  );

  let headerRow = -1;
  for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 35); row += 1) {
    const values = visibleCols.map((col) => mergedValue(sheet, row, col));
    if (values.some(isNameHeader) && values.some(isClassHeader)) {
      headerRow = row;
      break;
    }
  }
  if (headerRow < 0) throw new Error("Could not locate the student name and class headers on the active sheet.");

  const nameCol = visibleCols.find((col) => isNameHeader(mergedValue(sheet, headerRow, col)));
  const classCol = visibleCols.find((col) => isClassHeader(mergedValue(sheet, headerRow, col)));
  const numberCol = visibleCols.find((col) => isNumberHeader(mergedValue(sheet, headerRow, col)));
  const totalCol = [...visibleCols].reverse().find((col) => isTotalHeader(mergedValue(sheet, headerRow, col)));
  if (nameCol === undefined || classCol === undefined || totalCol === undefined) {
    throw new Error("Required columns (name, class, and 5-Hafta) were not found among visible columns.");
  }

  const dataCols = visibleCols.filter((col) => col !== numberCol && col !== nameCol && col !== classCol);
  const columns = dataCols.map((col) => {
    const label = text(mergedValue(sheet, headerRow, col)) || `Column ${XLSX.utils.encode_col(col)}`;
    let group = "Natijalar";
    for (let row = Math.max(range.s.r, headerRow - 4); row < headerRow; row += 1) {
      const candidate = text(mergedValue(sheet, row, col));
      if (candidate && !/haftalik|ballar|13\.|20\d{2}/i.test(candidate)) group = candidate;
    }
    return { key: XLSX.utils.encode_col(col), label, group };
  });

  const students: RatingStudent[] = [];
  for (let row = headerRow + 1; row <= range.e.r; row += 1) {
    const name = text(sheet[XLSX.utils.encode_cell({ r: row, c: nameCol })]?.v);
    const className = text(sheet[XLSX.utils.encode_cell({ r: row, c: classCol })]?.v).toUpperCase();
    if (!name || !className || !/\d/.test(className)) continue;
    const rawTotal = sheet[XLSX.utils.encode_cell({ r: row, c: totalCol })]?.v;
    const total = Number(rawTotal);
    const rowStatuses = visibleCols.map((col) => colorKind(sheet[XLSX.utils.encode_cell({ r: row, c: col })]));
    const status: StudentStatus = rowStatuses.includes("absent")
      ? "absent"
      : rowStatuses.includes("wrong-id")
        ? "wrong-id"
        : "normal";
    const values = Object.fromEntries(
      dataCols.map((col) => {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
        return [XLSX.utils.encode_col(col), cell?.w ?? cell?.v ?? ""];
      }),
    );
    students.push({ rowNumber: row + 1, name, className, total: Number.isFinite(total) ? total : 0, status, values });
  }
  if (!students.length) throw new Error("No student rows were found on the active sheet.");

  let date = "";
  for (let row = range.s.r; row < headerRow && !date; row += 1) {
    for (const col of visibleCols) {
      const match = text(mergedValue(sheet, row, col)).match(/(?:\(?\s*)?(\d{1,2}[./-]\d{1,2}[./-]\d{4})(?:\s*\))?/);
      if (match?.[1]) date = match[1].replace(/[/-]/g, ".");
    }
  }
  return { fileName: file.name, date: date || new Date().toLocaleDateString("uz-UZ"), columns, students };
}

export function createSegmentedWorkbook(data: RatingWorkbook, classes: string[]): ArrayBuffer {
  const book = XLSX.utils.book_new();
  for (const className of classes) {
    const rows = data.students
      .filter((student) => student.className === className)
      .sort((a, b) => b.total - a.total)
      .map((student, index) => [index + 1, student.name, student.className, ...data.columns.map((col) => student.values[col.key])]);
    const headers = ["№", "FAMILIYA ISM", "SINF", ...data.columns.map((col) => col.label)];
    const sheet = XLSX.utils.aoa_to_sheet([
      ["AL-XORAZMIY SCHOOL"],
      ["HAFTALIK JAMG'ARILGAN BALLAR"],
      [`(${data.date})`],
      [],
      headers,
      ...rows,
    ]);
    sheet["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: headers.length - 1 } }));
    sheet["!cols"] = headers.map((_, index) => ({ wch: index === 1 ? 30 : index > 2 ? 15 : 8 }));
    for (let row = 0; row <= rows.length + 4; row += 1) {
      for (let col = 0; col < headers.length; col += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
        if (!cell) continue;
        cell.s = {
          font: { name: "Arial", bold: row <= 4, color: { rgb: row === 4 ? "FFFFFFFF" : "FF17201E" } },
          alignment: { horizontal: row <= 4 ? "center" : col === 1 ? "left" : "center", vertical: "center", wrapText: true },
          fill: row === 4 ? { patternType: "solid", fgColor: { rgb: "FF167C74" } } : undefined,
          border: row >= 4 ? { top: { style: "thin", color: { rgb: "FFD9E0DE" } }, bottom: { style: "thin", color: { rgb: "FFD9E0DE" } }, left: { style: "thin", color: { rgb: "FFD9E0DE" } }, right: { style: "thin", color: { rgb: "FFD9E0DE" } } } : undefined,
        };
      }
    }
    XLSX.utils.book_append_sheet(book, sheet, className.slice(0, 31));
  }
  return XLSX.write(book, { bookType: "xlsx", type: "array" });
}