import { createFileRoute } from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import { useMemo, useRef, useState, type ChangeEvent, type Ref } from "react";
import {
  FileDown,
  FileSpreadsheet,
  ImageDown,
  LoaderCircle,
  Pencil,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RatingColumn, RatingStudent, RatingWorkbook } from "@/lib/rating-types";
import logo from "@/assets/al-xorazmiy-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Al-Xorazmiy haftalik reytingi" },
      {
        name: "description",
        content: "Al-Xorazmiy School sinflari uchun haftalik reyting hisobotlari.",
      },
    ],
  }),
  component: RatingDashboard,
});

const classSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const totalTone = (score: number) =>
  score >= 8 ? "score-high" : score >= 6 ? "score-mid" : score >= 4 ? "score-low" : "score-bad";
const percentOf = (v: string | number | undefined) => {
  if (v === undefined || v === null || v === "") return null;
  const match = String(v).match(/(-?\d+(?:[.,]\d+)?)/);
  return match ? parseFloat(match[1].replace(",", ".")) : null;
};
const resultTone = (v: string | number | undefined) => {
  const p = percentOf(v);
  if (p === null) return "";
  if (p >= 50) return "score-high";
  if (p >= 40) return "score-mid";
  if (p >= 25) return "score-low";
  return "score-bad";
};
const isTeacherColumn = (c: RatingColumn) =>
  /ustoz|o['ʻ‘’` ]?qituvchi|teacher/i.test(`${c.label} ${c.group}`) || c.role === "teacher";
const displayLabel = (label: string) => {
  const value = label.replace(/\s+/g, " ").trim();
  if (/to['ʻ‘’` ]?g['ʻ‘’` ]?ri.*javob/i.test(value)) return "TO‘G‘RI JAVOBLAR";
  if (/natija.*bal|bal/i.test(value)) return "BAL";
  if (/natija|foiz/i.test(value)) return "NATIJASI";
  if (/level|etap/i.test(value)) return "LEVEL (ETAP)";
  if (/davomat/i.test(value)) return "DAVOMAT";
  if (/kech/i.test(value)) return "KECH QOLMASLIK";
  if (/vazifa/i.test(value)) return "UYGA VAZIFA";
  if (/odob|axloq|ahloq/i.test(value)) return "ODOB-AXLOQ";
  return value.toLocaleUpperCase("uz-UZ");
};
const loadWorkbookTools = createClientOnlyFn(() => import("@/lib/rating-workbook.client"));

function RatingDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [workbook, setWorkbook] = useState<RatingWorkbook>();
  const [activeClass, setActiveClass] = useState("all");
  const [thirdSubject, setThirdSubject] = useState("");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const classes = useMemo(
    () => [...new Set(workbook?.students.map((s) => s.className) ?? [])].sort(classSort),
    [workbook],
  );
  const students = useMemo(
    () =>
      (
        workbook?.students.filter((s) => activeClass === "all" || s.className === activeClass) ?? []
      ).sort((a, b) => b.total - a.total),
    [workbook, activeClass],
  );
  const activeSheet = students[0]?.sheetName;
  const allColumns = useMemo(
    () => workbook?.columns.filter((c) => c.sheetName === activeSheet) ?? [],
    [workbook, activeSheet],
  );
  const columns = useMemo(
    () => (activeClass === "all" ? allColumns : allColumns.filter((c) => !isTeacherColumn(c))),
    [activeClass, allColumns],
  );

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy("upload");
    setError("");
    try {
      const tools = await loadWorkbookTools();
      if (!tools) return;
      const parsed = await tools.parseRatingWorkbook(file);
      setWorkbook(parsed);
      setActiveClass("all");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Excel faylini o‘qib bo‘lmadi.");
    } finally {
      setBusy(undefined);
      event.target.value = "";
    }
  }

  async function downloadImage() {
    if (!reportRef.current || activeClass === "all") return;
    setBusy("image");
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(reportRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `${activeClass}-${workbook?.date}-reyting.png`;
      link.href = url;
      link.click();
    } finally {
      setBusy(undefined);
    }
  }

  async function downloadPdf() {
    if (!reportRef.current || activeClass === "all") return;
    setBusy("pdf");
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const image = await toPng(reportRef.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const props = pdf.getImageProperties(image);
      const width = 277;
      pdf.addImage(
        image,
        "PNG",
        10,
        10,
        width,
        Math.min(190, (width * props.height) / props.width),
        undefined,
        "FAST",
      );
      pdf.save(`${activeClass}-${workbook?.date}-reyting.pdf`);
    } finally {
      setBusy(undefined);
    }
  }

  async function downloadExcel() {
    if (!workbook) return;
    setBusy("excel");
    try {
      const tools = await loadWorkbookTools();
      if (!tools) return;
      const output = tools.createSegmentedWorkbook(workbook, classes);
      const url = URL.createObjectURL(
        new Blob([output], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `Al-Xorazmiy-${workbook.date}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 lg:px-8">
      <header className="no-print mx-auto flex max-w-[1840px] items-center justify-between border-b border-border pb-4">
        <img src={logo} alt="Al-Xorazmiy School" className="h-12 w-auto object-contain sm:h-14" />
        <div className="flex gap-2">
          {workbook && (
            <Button variant="outline" onClick={downloadExcel} disabled={Boolean(busy)}>
              <FileSpreadsheet /> Excel
            </Button>
          )}
          <Button variant="premium" onClick={() => inputRef.current?.click()}>
            {busy === "upload" ? <LoaderCircle className="animate-spin" /> : <Upload />}
            {workbook ? "Faylni almashtirish" : "Excel yuklash"}
          </Button>
        </div>
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept=".xlsx,.xls"
          onChange={upload}
        />
      </header>
      {!workbook ? (
        <UploadScreen busy={busy} error={error} onChoose={() => inputRef.current?.click()} />
      ) : (
        <div className="mx-auto max-w-[1840px] py-6">
          <div className="no-print mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">{workbook.fileName}</p>
              <h1 className="mt-1 font-display text-3xl font-extrabold">Haftalik reyting</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Umumiy jadvalda barcha ma’lumotlar, sinf ko‘rinishida ota-onalar uchun
                soddalashtirilgan hisobot.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeClass !== "all" && (
                <label className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-semibold">
                  <Pencil className="size-4 text-primary" />
                  <span>3-fan:</span>
                  <input
                    value={thirdSubject}
                    onChange={(e) => setThirdSubject(e.target.value)}
                    placeholder="Excel bo‘yicha"
                    className="w-28 bg-transparent outline-none placeholder:text-muted-foreground"
                  />
                </label>
              )}
              <Button
                variant="outline"
                onClick={downloadImage}
                disabled={Boolean(busy) || activeClass === "all"}
              >
                <ImageDown /> Telegram PNG
              </Button>
              <Button
                variant="outline"
                onClick={downloadPdf}
                disabled={Boolean(busy) || activeClass === "all"}
              >
                <FileDown /> PDF
              </Button>
            </div>
          </div>
          <nav
            className="no-print mb-5 flex gap-2 overflow-x-auto border-b border-border pb-3"
            aria-label="Sinflar"
          >
            <Button
              variant={activeClass === "all" ? "premium" : "ghost"}
              onClick={() => setActiveClass("all")}
            >
              <Users /> Umumiy reyting
            </Button>
            {classes.map((name) => (
              <Button
                key={name}
                variant={activeClass === name ? "premium" : "ghost"}
                onClick={() => setActiveClass(name)}
              >
                {name}
              </Button>
            ))}
          </nav>
          <Report
            ref={reportRef}
            workbook={workbook}
            activeClass={activeClass}
            students={students}
            columns={columns}
            thirdSubject={thirdSubject}
          />
        </div>
      )}
    </main>
  );
}

function UploadScreen({
  busy,
  error,
  onChoose,
}: {
  busy?: string;
  error: string;
  onChoose: () => void;
}) {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-4xl place-items-center py-12 text-center">
      <div>
        <p className="eyebrow">AL-XORAZMIY SCHOOL</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
          Haftalik natijalarni bir zumda tayyorlang.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          5–8 va 9–11 sinflar sahifalari avtomatik o‘qiladi, umumiy reyting va har bir sinf
          uchun Telegram hisoboti yaratiladi.
        </p>
        <Button
          size="lg"
          variant="premium"
          className="mt-9 h-14 rounded-xl px-8 text-base"
          onClick={onChoose}
        >
          {busy === "upload" ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}
          .xlsx faylni tanlash
        </Button>
        {error && (
          <p
            role="alert"
            className="mx-auto mt-5 max-w-xl rounded-xl bg-coral-soft px-4 py-3 font-semibold text-coral-foreground"
          >
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function Report({
  ref,
  workbook,
  activeClass,
  students,
  columns,
  thirdSubject,
}: {
  ref: Ref<HTMLDivElement>;
  workbook: RatingWorkbook;
  activeClass: string;
  students: RatingStudent[];
  columns: RatingColumn[];
  thirdSubject: string;
}) {
  const isAll = activeClass === "all";
  const groupMeta = useMemo(
    () =>
      [...new Set(columns.map((c) => c.group))].map((group) => ({
        group,
        columns: columns.filter((c) => c.group === group),
      })),
    [columns],
  );
  const subjectGroups = useMemo(
    () =>
      groupMeta.filter(
        ({ group, columns: groupColumns }) =>
          groupColumns.length > 1 &&
          !/intizom|tarbiya|davomat|hafta|jami|umumiy|o['ʻ‘’` ]?rtacha/i.test(group),
      ),
    [groupMeta],
  );
  const groupSavol = useMemo(() => {
    const result: Record<string, number> = {};
    for (const { group, columns: cols } of groupMeta) {
      const javobCol = cols.find((c) => /to[' ʻ‘’`]?g[' ʻ‘’`]?ri.*javob/i.test(c.label));
      const natijaCol = cols.find((c) => c.role === "result" || /natija/i.test(c.label));
      if (!javobCol || !natijaCol) continue;
      let max = 0;
      for (const s of students) {
        const j = percentOf(s.values[javobCol.key]);
        const n = percentOf(s.values[natijaCol.key]);
        if (j !== null && n !== null && n > 0) max = Math.max(max, Math.round((j / n) * 100));
      }
      if (max > 0 && max <= 50) result[group] = max;
    }
    return result;
  }, [groupMeta, students]);

  const labelForGroup = (group: string) => {
    const subjectIndex = subjectGroups.findIndex((item) => item.group === group);
    const display = !isAll && subjectIndex === 2 && thirdSubject ? thirdSubject : group;
    return display.toLocaleUpperCase("uz-UZ");
  };
  const isSingleTallHeader = (group: string, groupColumns: RatingColumn[]) =>
    groupColumns.length === 1 &&
    /o['ʻ‘’` ]?rtacha|haftalik|imtihon|\d+[- ]?hafta|jami|umumiy/i.test(
      `${group} ${groupColumns[0]?.label}`,
    );

  return (
    <section
      ref={ref}
      className={`print-area overflow-hidden bg-card report-shadow ${isAll ? "rounded-2xl border border-border" : "telegram-report"}`}
    >
      <div className="report-head">
        <img src={logo} alt="Al-Xorazmiy School" />
        <h2>HAFTALIK JAMG‘ARILGAN BALLAR</h2>
        <p>( {workbook.date} )</p>
      </div>
      {!isAll && (
        <div className="legend">
          <div className="legend-boxes">
            <i className="dot dot-wrong" />
            <i className="dot dot-absent" />
          </div>
          <div className="legend-text">
            <span>
              Ushbu rang o‘quvchi o‘z <b>ID</b> raqamini xato kiritganini bildiradi.
            </span>
            <span>
              Ushbu rang o‘quvchi <b>Imtihonda qatnashmaganini</b> bildiradi
            </span>
          </div>
        </div>
      )}
      <div className={isAll ? "overflow-x-auto" : ""}>
        <table className="rating-table w-full border-collapse">
          <thead>
            <tr className="group-row">
              <th rowSpan={2} className="col-rank">
                №
              </th>
              <th rowSpan={2} className="name-col">
                FAMILIYA ISM
              </th>
              <th rowSpan={2} className="col-class">
                SINF
              </th>
              {groupMeta.map(({ group, columns: groupColumns }) => {
                const savol = !isAll ? groupSavol[group] : undefined;
                if (isSingleTallHeader(group, groupColumns)) {
                  return (
                    <th key={group} rowSpan={2} className="single-head">
                      {labelForGroup(groupColumns[0]?.label || group)}
                    </th>
                  );
                }
                return (
                  <th key={group} colSpan={groupColumns.length}>
                    <div className="group-title">{labelForGroup(group)}</div>
                    {savol && <div className="group-sub">({savol} TA SAVOL)</div>}
                  </th>
                );
              })}
            </tr>
            <tr className="label-row">
              {groupMeta.flatMap(({ group, columns: groupColumns }) =>
                isSingleTallHeader(group, groupColumns)
                  ? []
                  : groupColumns.map((c) => (
                      <th key={c.key}>
                        <span className={isAll ? "" : "label-rot"}>{displayLabel(c.label)}</span>
                      </th>
                    )),
              )}
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <StudentRow
                key={`${student.sheetName}-${student.rowNumber}`}
                student={student}
                index={index}
                columns={columns}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StudentRow({
  student,
  index,
  columns,
}: {
  student: RatingStudent;
  index: number;
  columns: RatingColumn[];
}) {
  return (
    <tr>
      <td className="rank">{index + 1}</td>
      <td className="student-name">{student.name}</td>
      <td className="class-col">{student.className}</td>
      {columns.map((c) => {
        const value = student.values[c.key];
        const cellStatus = student.cellStatuses?.[c.key];
        let cellClass = "";
        if (cellStatus === "absent") cellClass = "cell-absent";
        else if (
          cellStatus === "wrong-id" ||
          (student.status === "wrong-id" && c.role === "result")
        ) {
          cellClass = "cell-wrong";
        }
        else if (c.role === "total") cellClass = totalTone(student.total);
        else if (c.role === "result") cellClass = resultTone(value);
        return (
          <td key={c.key} className={cellClass}>
            {value === "" || value === undefined ? "" : value}
          </td>
        );
      })}
    </tr>
  );
}
