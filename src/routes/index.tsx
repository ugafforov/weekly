import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Download,
  FileDown,
  FileSpreadsheet,
  GraduationCap,
  ImageDown,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RatingWorkbook, RatingStudent } from "@/lib/rating-workbook.client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Al-Xorazmiy Weekly Rating Dashboard" },
      {
        name: "description",
        content:
          "Upload Excel results and create sorted, classroom-specific weekly rating reports.",
      },
      { property: "og:title", content: "Al-Xorazmiy Weekly Rating Dashboard" },
      {
        property: "og:description",
        content: "Beautiful weekly student reports, ready for Excel, PNG, and PDF export.",
      },
    ],
  }),
  component: RatingDashboard,
});

const percentScore = (value: string | number) =>
  Number(String(value).match(/-?\d+(?:\.\d+)?/)?.[0]);
function valueTone(value: string | number, label: string) {
  if (!/%|foiz|natija/i.test(`${value} ${label}`)) return "";
  const score = percentScore(value);
  if (!Number.isFinite(score)) return "";
  return score >= 70
    ? "bg-sage text-sage-foreground"
    : score >= 40
      ? "bg-amber-soft text-amber-foreground"
      : "bg-coral-soft text-coral-foreground";
}

function RatingDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [workbook, setWorkbook] = useState<RatingWorkbook>();
  const [activeClass, setActiveClass] = useState("");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const classes = useMemo(
    () =>
      [...new Set(workbook?.students.map((s) => s.className) ?? [])].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    [workbook],
  );
  const students = useMemo(
    () =>
      (workbook?.students.filter((s) => s.className === activeClass) ?? []).sort(
        (a, b) => b.total - a.total,
      ),
    [workbook, activeClass],
  );
  const average = students.length
    ? students.reduce((sum, s) => sum + s.total, 0) / students.length
    : 0;

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy("upload");
    setError("");
    try {
      const { parseRatingWorkbook } = await import("@/lib/rating-workbook.client");
      const parsed = await parseRatingWorkbook(file);
      const nextClasses = [...new Set(parsed.students.map((s) => s.className))].sort();
      setWorkbook(parsed);
      setActiveClass(nextClasses[0] ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The workbook could not be processed.");
    } finally {
      setBusy(undefined);
      event.target.value = "";
    }
  }

  async function downloadImage() {
    if (!reportRef.current) return;
    setBusy("image");
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(reportRef.current, {
        pixelRatio: 2.5,
        cacheBust: true,
        backgroundColor: "#f7f8f7",
      });
      const link = document.createElement("a");
      link.download = `al-xorazmiy-${activeClass}-${workbook?.date}.png`;
      link.href = url;
      link.click();
    } finally {
      setBusy(undefined);
    }
  }

  async function downloadExcel() {
    if (!workbook) return;
    setBusy("excel");
    try {
      const { createSegmentedWorkbook } = await import("@/lib/rating-workbook.client");
      const output = createSegmentedWorkbook(workbook, classes);
      const url = URL.createObjectURL(
        new Blob([output], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `Al-Xorazmiy-${workbook.date}-ratings.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(undefined);
    }
  }

  async function downloadPdf() {
    if (!reportRef.current) return;
    setBusy("pdf");
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const image = await toPng(reportRef.current, { pixelRatio: 2, backgroundColor: "#f7f8f7" });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const props = pdf.getImageProperties(image);
      const width = 277;
      const height = Math.min(190, (width * props.height) / props.width);
      pdf.addImage(image, "PNG", 10, 10, width, height, undefined, "FAST");
      pdf.save(`Al-Xorazmiy-${activeClass}-${workbook?.date}.pdf`);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-9 lg:py-7">
      <header className="glass-panel no-print mx-auto flex max-w-[1800px] items-center justify-between rounded-[1.4rem] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap />
          </div>
          <div>
            <p className="font-display text-sm font-extrabold tracking-tight sm:text-base">
              AL-XORAZMIY
            </p>
            <p className="text-[10px] font-semibold tracking-[0.25em] text-muted-foreground">
              SCHOOL
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground sm:flex">
          <ShieldCheck className="size-3.5" /> Local, private processing
        </div>
        <Button variant="glass" onClick={() => inputRef.current?.click()}>
          <Upload /> {workbook ? "Replace Excel" : "Upload Excel"}
        </Button>
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept=".xlsx,.xls"
          onChange={upload}
        />
      </header>

      {!workbook ? (
        <section className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl place-items-center py-12">
          <div className="w-full text-center">
            <div className="mx-auto mb-7 grid size-20 place-items-center rounded-[1.7rem] bg-primary text-primary-foreground shadow-xl">
              <Sparkles className="size-8" />
            </div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">
              Weekly intelligence workspace
            </p>
            <h1 className="mx-auto max-w-3xl font-display text-4xl font-extrabold tracking-[-0.045em] sm:text-6xl">
              Turn weekly results into a report worth sharing.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Upload the active Excel workbook. The dashboard reads visible columns, groups every
              class, ranks students, and prepares polished exports.
            </p>
            <button
              onClick={() => inputRef.current?.click()}
              className="glass-panel group mx-auto mt-10 flex w-full max-w-2xl cursor-pointer flex-col items-center rounded-[2rem] border-dashed px-8 py-12 transition hover:-translate-y-1 hover:border-primary/30"
            >
              {busy === "upload" ? (
                <LoaderCircle className="mb-4 size-8 animate-spin text-primary" />
              ) : (
                <FileSpreadsheet className="mb-4 size-8 text-primary" />
              )}
              <span className="font-display text-lg font-bold">Choose your weekly .xlsx file</span>
              <span className="mt-2 text-sm text-muted-foreground">
                Hidden columns are ignored automatically
              </span>
            </button>
            {error && (
              <p
                role="alert"
                className="mx-auto mt-5 max-w-2xl rounded-xl bg-coral-soft px-4 py-3 text-sm font-semibold text-coral-foreground"
              >
                {error}
              </p>
            )}
            <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
              {[
                [Users, "Class segmentation", "Separate, sorted views for every Sinf."],
                [ShieldCheck, "Smart status rules", "Wrong ID and absence colors are retained."],
                [Download, "Three export formats", "Share PNG, Excel, or print-ready PDF."],
              ].map(([Icon, title, copy]) => {
                const FeatureIcon = Icon as typeof Users;
                return (
                  <div key={String(title)} className="glass-panel rounded-2xl p-5">
                    <FeatureIcon className="mb-6 size-5 text-primary" />
                    <h2 className="font-display font-bold">{String(title)}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{String(copy)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <div className="mx-auto max-w-[1800px] py-6">
          <div className="no-print mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                {workbook.fileName}
              </p>
              <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
                Weekly Rating Dashboard
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="glass" onClick={downloadImage} disabled={Boolean(busy)}>
                {busy === "image" ? <LoaderCircle className="animate-spin" /> : <ImageDown />}{" "}
                Download Image
              </Button>
              <Button variant="glass" onClick={downloadPdf} disabled={Boolean(busy)}>
                {busy === "pdf" ? <LoaderCircle className="animate-spin" /> : <FileDown />} Export
                PDF
              </Button>
              <Button variant="premium" onClick={downloadExcel} disabled={Boolean(busy)}>
                {busy === "excel" ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}{" "}
                Export Excel
              </Button>
            </div>
          </div>
          <nav
            className="glass-panel no-print mb-5 flex gap-1 overflow-x-auto rounded-2xl p-1.5"
            aria-label="Classes"
          >
            {classes.map((name) => (
              <button
                key={name}
                onClick={() => setActiveClass(name)}
                className={`min-w-16 cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold transition ${activeClass === name ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
              >
                {name}
              </button>
            ))}
          </nav>
          <section
            ref={reportRef}
            className="print-area report-shadow overflow-hidden rounded-[1.6rem] border border-glass-border bg-card"
          >
            <div className="flex flex-col gap-6 border-b border-border bg-glass px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="flex items-center gap-4">
                <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <GraduationCap className="size-7" />
                </div>
                <div>
                  <p className="font-display text-xl font-extrabold tracking-tight">
                    AL-XORAZMIY <span className="font-medium text-primary">SCHOOL</span>
                  </p>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.17em] text-muted-foreground">
                    Excellence through knowledge
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <h2 className="font-display text-lg font-extrabold tracking-tight sm:text-xl">
                  HAFTALIK JAMG'ARILGAN BALLAR
                </h2>
                <p className="mt-1 font-semibold text-primary">
                  {activeClass} · {workbook.date}
                </p>
              </div>
            </div>
            <div className="grid border-b border-border sm:grid-cols-3">
              <Stat
                label="Students"
                value={String(students.length)}
                detail={`${activeClass} classroom`}
              />
              <Stat label="Class average" value={average.toFixed(2)} detail="Weekly score" />
              <Stat
                label="Top score"
                value={String(students[0]?.total ?? 0)}
                detail={students[0]?.name ?? "—"}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-xs">
                <thead>
                  <tr className="bg-secondary text-secondary-foreground">
                    <th className="sticky left-0 z-20 w-12 bg-secondary px-3 py-4 text-center">
                      №
                    </th>
                    <th className="sticky left-12 z-20 min-w-56 bg-secondary px-4 py-4 text-left">
                      FAMILIYA ISM
                    </th>
                    {workbook.columns.map((c) => (
                      <th
                        key={c.key}
                        className="max-w-32 border-l border-border px-3 py-3 text-center"
                      >
                        <span className="block text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          {c.group}
                        </span>
                        <span className="mt-1 block font-bold">{c.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <StudentRow
                      key={`${s.rowNumber}-${s.name}`}
                      student={s}
                      index={i}
                      columns={workbook.columns}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border bg-glass px-5 py-4 text-xs font-medium text-muted-foreground sm:px-8">
              <span className="font-bold text-foreground">Legend</span>
              <Legend color="bg-amber-soft" text="Wrong ID" />
              <Legend color="bg-slate-soft" text="Absent / exam not taken" />
              <Legend color="bg-sage" text="Strong performance" />
              <span className="ml-auto">Sorted highest to lowest</span>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-b border-border px-6 py-5 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <strong className="font-display text-2xl font-extrabold">{value}</strong>
        <span className="max-w-44 truncate text-xs text-muted-foreground">{detail}</span>
      </div>
    </div>
  );
}
function StudentRow({
  student,
  index,
  columns,
}: {
  student: RatingStudent;
  index: number;
  columns: RatingWorkbook["columns"];
}) {
  const rowTone =
    student.status === "absent"
      ? "bg-slate-soft text-slate-foreground"
      : student.status === "wrong-id"
        ? "bg-amber-soft text-amber-foreground"
        : "bg-card text-card-foreground";
  const totalTone =
    student.total >= 8
      ? "bg-sage text-sage-foreground"
      : student.total >= 5
        ? "bg-amber-soft text-amber-foreground"
        : "bg-coral-soft text-coral-foreground";
  return (
    <tr className={`${rowTone} border-t border-border`}>
      <td className={`sticky left-0 z-10 px-3 py-3 text-center font-bold ${rowTone}`}>
        {index + 1}
      </td>
      <td className={`sticky left-12 z-10 px-4 py-3 font-semibold ${rowTone}`}>{student.name}</td>
      {columns.map((c) => (
        <td
          key={c.key}
          className={`border-l border-border px-3 py-3 text-center font-semibold ${/5[- ]?hafta|weekly total|jami/i.test(c.label) ? totalTone : valueTone(student.values[c.key] ?? "", c.label)}`}
        >
          {student.values[c.key] ?? "—"}
        </td>
      ))}
    </tr>
  );
}
function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <i className={`size-3 rounded-full ${color}`} />
      {text}
    </span>
  );
}
