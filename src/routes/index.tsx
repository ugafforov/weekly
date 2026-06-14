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
  Trophy,
  ChevronRight,
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
  /ustoz|o['ʻ''` ]?qituvchi|teacher/i.test(`${c.label} ${c.group}`) || c.role === "teacher";
const displayLabel = (label: string) => {
  const value = label.replace(/\s+/g, " ").trim();
  if (/to['ʻ''` ]?g['ʻ''` ]?ri.*javob/i.test(value)) return "TO'G'RI JAVOBLAR";
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
  const [isDragging, setIsDragging] = useState(false);

  const classes = useMemo(
    () => [...new Set(workbook?.students.map((s) => s.className) ?? [])].sort(classSort),
    [workbook],
  );
  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    workbook?.students.forEach((s) => {
      counts[s.className] = (counts[s.className] ?? 0) + 1;
    });
    return counts;
  }, [workbook]);

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

  async function processFile(file: File) {
    setBusy("upload");
    setError("");
    try {
      const tools = await loadWorkbookTools();
      if (!tools) return;
      const parsed = await tools.parseRatingWorkbook(file);
      setWorkbook(parsed);
      setActiveClass("all");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Excel faylini o'qib bo'lmadi.");
    } finally {
      setBusy(undefined);
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
    event.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
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

  if (!workbook) {
    return (
      <UploadScreen
        busy={busy}
        error={error}
        isDragging={isDragging}
        onChoose={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        inputRef={inputRef}
        onFileChange={upload}
      />
    );
  }

  return (
    <main className="min-h-screen bg-dash-bg">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".xlsx,.xls"
        onChange={upload}
      />

      {/* Top bar */}
      <header className="no-print sticky top-0 z-30 border-b border-dash-border bg-dash-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1840px] items-center gap-3 px-4 lg:px-6">
          <img src={logo} alt="Al-Xorazmiy School" className="h-8 w-auto object-contain" />
          <div className="mx-3 h-5 w-px bg-dash-border" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-semibold text-dash-muted">{workbook.fileName}</span>
            <span className="text-[11px] text-dash-muted/70">{workbook.date} &middot; {workbook.students.length} o'quvchi</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {workbook && (
              <Button size="sm" variant="outline" className="dash-btn-outline" onClick={downloadExcel} disabled={Boolean(busy)}>
                {busy === "excel" ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}
                <span className="hidden sm:inline">Excel</span>
              </Button>
            )}
            <Button size="sm" variant="outline" className="dash-btn-outline" onClick={() => inputRef.current?.click()}>
              {busy === "upload" ? <LoaderCircle className="animate-spin" /> : <Upload />}
              <span className="hidden sm:inline">Faylni almashtirish</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1840px] px-4 pb-8 pt-5 lg:px-6">
        {/* Page title + action row */}
        <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-primary" />
            <h1 className="text-lg font-extrabold tracking-tight">Haftalik reyting</h1>
            <span className="dash-badge">{workbook.date}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeClass !== "all" && (
              <label className="dash-input-label">
                <Pencil className="size-3.5 text-primary" />
                <span className="text-xs font-semibold text-dash-muted">3-fan:</span>
                <input
                  value={thirdSubject}
                  onChange={(e) => setThirdSubject(e.target.value)}
                  placeholder="Excel bo'yicha"
                  className="w-24 bg-transparent text-xs outline-none placeholder:text-dash-muted/50"
                />
              </label>
            )}
            <Button
              size="sm"
              variant="outline"
              className="dash-btn-outline"
              onClick={downloadImage}
              disabled={Boolean(busy) || activeClass === "all"}
            >
              {busy === "image" ? <LoaderCircle className="animate-spin" /> : <ImageDown />}
              Telegram PNG
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="dash-btn-outline"
              onClick={downloadPdf}
              disabled={Boolean(busy) || activeClass === "all"}
            >
              {busy === "pdf" ? <LoaderCircle className="animate-spin" /> : <FileDown />}
              PDF
            </Button>
          </div>
        </div>

        {/* Class tabs */}
        <nav className="no-print mb-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="Sinflar">
          <button
            className={`class-tab ${activeClass === "all" ? "class-tab-active" : ""}`}
            onClick={() => setActiveClass("all")}
          >
            <Users className="size-3.5" />
            Umumiy
            <span className="class-tab-count">{workbook.students.length}</span>
          </button>
          {classes.map((name) => (
            <button
              key={name}
              className={`class-tab ${activeClass === name ? "class-tab-active" : ""}`}
              onClick={() => setActiveClass(name)}
            >
              {name}
              <span className="class-tab-count">{classCounts[name] ?? 0}</span>
            </button>
          ))}
        </nav>

        {/* Report table */}
        <Report
          ref={reportRef}
          workbook={workbook}
          activeClass={activeClass}
          students={students}
          columns={columns}
          thirdSubject={thirdSubject}
        />
      </div>
    </main>
  );
}

function UploadScreen({
  busy,
  error,
  isDragging,
  onChoose,
  onDrop,
  onDragOver,
  onDragLeave,
  inputRef,
  onFileChange,
}: {
  busy?: string;
  error: string;
  isDragging: boolean;
  onChoose: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="upload-bg flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".xlsx,.xls"
        onChange={onFileChange}
      />

      {/* Logo */}
      <img src={logo} alt="Al-Xorazmiy School" className="mb-8 h-16 w-auto object-contain opacity-90" />

      {/* Drop zone card */}
      <div
        className={`upload-card ${isDragging ? "upload-card-drag" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={onChoose}
      >
        <div className={`upload-icon-wrap ${isDragging ? "upload-icon-drag" : ""}`}>
          {busy === "upload" ? (
            <LoaderCircle className="size-8 animate-spin text-primary" />
          ) : (
            <FileSpreadsheet className="size-8 text-primary" />
          )}
        </div>
        <div className="mt-4 text-center">
          <p className="text-base font-bold text-foreground">
            {isDragging ? "Fayl qo'yish uchun tashlang" : "Excel fayl yuklang"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Faylni bu yerga sudrab tashlang yoki bosing
          </p>
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
            .xlsx / .xls
          </p>
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90">
          <Upload className="size-4" />
          Faylni tanlash
          <ChevronRight className="size-3.5 opacity-70" />
        </div>
      </div>

      {/* Feature pills */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {["5–8 sinf", "9–11 sinf", "Umumiy reyting", "Telegram PNG", "PDF eksport"].map((f) => (
          <span key={f} className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            {f}
          </span>
        ))}
      </div>

      {error && (
        <div className="mt-5 flex max-w-sm items-start gap-3 rounded-xl border border-coral-soft/50 bg-coral-soft/60 px-4 py-3">
          <span className="mt-0.5 text-base">⚠️</span>
          <p className="text-sm font-semibold text-coral-foreground">{error}</p>
        </div>
      )}
    </div>
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
          !/intizom|tarbiya|davomat|hafta|jami|umumiy|o['ʻ''` ]?rtacha/i.test(group),
      ),
    [groupMeta],
  );
  const groupSavol = useMemo(() => {
    const result: Record<string, number> = {};
    for (const { group, columns: cols } of groupMeta) {
      const javobCol = cols.find((c) => /to[' ʻ''`]?g[' ʻ''`]?ri.*javob/i.test(c.label));
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
    /o['ʻ''` ]?rtacha|haftalik|imtihon|\d+[- ]?hafta|jami|umumiy/i.test(
      `${group} ${groupColumns[0]?.label}`,
    );

  return (
    <section
      ref={ref}
      className={`print-area overflow-hidden ${isAll ? "dash-table-wrap" : "telegram-report"}`}
    >
      <div className="report-head">
        <img src={logo} alt="Al-Xorazmiy School" />
        <h2>HAFTALIK JAMG'ARILGAN BALLAR</h2>
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
              Ushbu rang o'quvchi o'z <b>ID</b> raqamini xato kiritganini bildiradi.
            </span>
            <span>
              Ushbu rang o'quvchi <b>Imtihonda qatnashmaganini</b> bildiradi
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
                isAll={isAll}
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
  isAll,
}: {
  student: RatingStudent;
  index: number;
  columns: RatingColumn[];
  isAll: boolean;
}) {
  const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;

  return (
    <tr className={index % 2 === 0 ? "row-even" : "row-odd"}>
      <td className="rank">
        {medal && isAll ? (
          <span title={`${index + 1}-o'rin`}>{medal}</span>
        ) : (
          <span className={index < 3 ? "rank-top" : ""}>{index + 1}</span>
        )}
      </td>
      <td className="student-name">{student.name}</td>
      <td className="class-col">
        <span className="class-chip">{student.className}</span>
      </td>
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
        } else if (c.role === "total") cellClass = totalTone(student.total);
        else if (c.role === "result") cellClass = resultTone(value);
        return (
          <td key={c.key} className={cellClass}>
            {value === "" || value === undefined ? <span className="text-dash-muted/40">—</span> : value}
          </td>
        );
      })}
    </tr>
  );
}
