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
import type {
  NormalizedStudent,
  RatingWorkbook,
  SubjectResult,
  Tone,
} from "@/lib/rating-types";
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

/* ─── Helpers ──────────────────────────────────────────────────── */
const classSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Tie-breaker: sum of subject results (percent for 5-8, correct%/15 for 9-11). Higher first. */
const pctSum = (s: NormalizedStudent) =>
  s.subjects.reduce(
    (acc, x) =>
      acc + (x.percent ?? (x.correct !== null ? (x.correct / x.totalQuestions) * 100 : 0)),
    0,
  );

/** Sort by total, then by higher exam percentage when totals tie. */
const rankSort = (a: NormalizedStudent, b: NormalizedStudent) =>
  b.total - a.total || pctSum(b) - pctSum(a);

const TONE: Record<Tone, { bg: string; border: string; fg: string; sub: string; bar: string }> = {
  high: { bg: "#e9f9f0", border: "#b6ebcf", fg: "#047857", sub: "#0f9d6b", bar: "#16a34a" },
  mid: { bg: "#fff5e6", border: "#ffdfb0", fg: "#b45309", sub: "#c97a10", bar: "#f59e0b" },
  low: { bg: "#fdeeee", border: "#f6c9c9", fg: "#c0392b", sub: "#d65a4a", bar: "#ef4444" },
  none: { bg: "#f1f5f9", border: "#e2e8f0", fg: "#94a3b8", sub: "#b4bfcc", bar: "#cbd5e1" },
};

/* Brand palette derived from the Al-Xorazmiy logo (teal/turquoise). */
const BRAND = {
  headerGradient: "linear-gradient(120deg, #0b5d56 0%, #128a7f 55%, #18a89c 100%)",
  headBg: "#0e7269",
  headLine: "rgba(255,255,255,0.22)",
  deep: "#0e7269",
  midCellBg: "#f1f8f7",
};

const loadWorkbookTools = createClientOnlyFn(() => import("@/lib/rating-workbook.client"));

/* ─── Demo data (preview only) ─────────────────────────────────── */
function makeDemoWorkbook(): RatingWorkbook {
  const sub = (
    label: string,
    percent: number,
    correct: number | null,
    score: string,
    present = true,
    level = "2",
  ): SubjectResult => ({
    label,
    percent,
    resultText: present ? `${percent}%` : "—",
    correct,
    totalQuestions: 15,
    score,
    level: present ? level : undefined,
    tone: !present ? "none" : percent >= 60 ? "high" : percent >= 34 ? "mid" : percent > 0 ? "low" : "none",
    present,
  });
  const mk = (
    name: string,
    studentId: string,
    subs: SubjectResult[],
    disc: Array<number | null>,
    status: NormalizedStudent["status"] = "normal",
  ): NormalizedStudent => {
    const discipline = [
      { short: "D", label: "Davomat", v: disc[0] },
      { short: "K", label: "Kech qolmaslik", v: disc[1] },
      { short: "V", label: "Uyga vazifa", v: disc[2] },
      { short: "O", label: "Odob-axloq", v: disc[3] },
    ].map((d) => ({
      short: d.short,
      label: d.label,
      value: d.v === null ? "" : String(d.v),
      ok: (d.v ?? 0) > 0,
      empty: d.v === null,
    }));
    const disciplineTotal = discipline.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const avg = Math.round((((Number(subs[0].score) || 0) + (Number(subs[1].score) || 0)) / 2) * 100) / 100;
    const examScore = Math.round((avg + (Number(subs[2]?.score) || 0)) * 100) / 100;
    const total = Math.round((examScore + disciplineTotal) * 100) / 100;
    return {
      rowNumber: 0,
      name,
      className: "5A",
      studentId,
      kind: "5-8",
      subjects: subs,
      summary: [],
      midScore: String(avg),
      midLabel: "O'RTACHA BAL",
      discipline,
      disciplineTotal,
      examScore,
      total,
      totalText: String(total),
      status,
    };
  };
  const wrongIdSub = (s: SubjectResult, badId: string): SubjectResult => ({ ...s, id: badId, idError: true });
  const students: NormalizedStudent[] = [
    mk("Masalixanov Muhammadziyo", "511", [sub("INGLIZ TILI", 73, 11, "6"), sub("MATEMATIKA", 53, 8, "5"), sub("3-FAN", 30, 3, "1.5")], [1, 1, 1, 1]),
    mk("Hoshimboyev Muhammadqodir", "500", [sub("INGLIZ TILI", 87, 13, "4.5"), sub("MATEMATIKA", 67, 10, "5.5"), sub("3-FAN", 20, 2, "1")], [1, 1, 1, null]),
    mk("Ismoilova Madina", "508", [sub("INGLIZ TILI", 80, 12, "4.5"), sub("MATEMATIKA", 100, 15, "4"), sub("3-FAN", 50, 5, "2")], [1, 1, 1, 1]),
    mk("Tojiboyev Ubaydullo", "506", [sub("INGLIZ TILI", 87, 13, "6.5"), sub("MATEMATIKA", 27, 4, "1.5"), sub("3-FAN", 60, 6, "2.5")], [1, 1, 1, 1]),
    mk("Risqiddinov Sarvarbek", "503", [sub("INGLIZ TILI", 60, 9, "3.5"), wrongIdSub(sub("MATEMATIKA", 73, 11, "5"), "513"), sub("3-FAN", 10, 1, "1")], [1, 1, 1, 1], "wrong-id"),
    mk("Nematov Nurmuhammad", "507", [sub("INGLIZ TILI", 67, 10, "3.5"), sub("MATEMATIKA", 40, 6, "1.5"), sub("3-FAN", 50, 5, "2")], [1, 0, 1, 1]),
    mk("Uraimov O'tkirbek", "502", [sub("INGLIZ TILI", 0, null, "0", false), sub("MATEMATIKA", 0, null, "0", false), sub("3-FAN", 0, null, "0", false)], [0, 0, 0, null], "absent"),
  ];
  return { fileName: "Demo-namuna.xlsx", date: "13.06.2026", students };
}

/* ─── Main Dashboard ───────────────────────────────────────────── */
function RatingDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [workbook, setWorkbook] = useState<RatingWorkbook>();
  const [activeClass, setActiveClass] = useState("all");
  const [thirdSubjects, setThirdSubjects] = useState<Record<string, string>>({});
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
      (workbook?.students.filter((s) => activeClass === "all" || s.className === activeClass) ?? [])
        .slice()
        .sort(rankSort),
    [workbook, activeClass],
  );

  const thirdSubject = thirdSubjects[activeClass] ?? "";

  async function processFile(file: File) {
    setBusy("upload");
    setError("");
    try {
      const tools = await loadWorkbookTools();
      if (!tools) return;
      setWorkbook(await tools.parseRatingWorkbook(file));
      setActiveClass("all");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Excel faylini o'qib bo'lmadi.");
    } finally {
      setBusy(undefined);
    }
  }

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await processFile(f);
    e.target.value = "";
  };

  async function downloadImage() {
    if (!reportRef.current || activeClass === "all") return;
    setBusy("image");
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(reportRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        skipFonts: true,
        backgroundColor: "#eef2f7",
      });
      Object.assign(document.createElement("a"), {
        download: `${activeClass}-${workbook?.date}-reyting.png`,
        href: url,
      }).click();
    } finally {
      setBusy(undefined);
    }
  }

  async function downloadPdf() {
    if (!reportRef.current || activeClass === "all") return;
    setBusy("pdf");
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const image = await toPng(reportRef.current, {
        pixelRatio: 2,
        skipFonts: true,
        backgroundColor: "#eef2f7",
      });
      const props = await new Promise<HTMLImageElement>((res) => {
        const i = new Image();
        i.onload = () => res(i);
        i.src = image;
      });
      // Portrait page; scale the whole report to fit one page (contain).
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const margin = 8;
      const availW = 210 - margin * 2;
      const availH = 297 - margin * 2;
      const ratio = props.width / props.height;
      let w = availW;
      let h = w / ratio;
      if (h > availH) {
        h = availH;
        w = h * ratio;
      }
      const x = (210 - w) / 2;
      pdf.addImage(image, "PNG", x, margin, w, h, undefined, "FAST");
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
      const out = tools.createSegmentedWorkbook(workbook, classes);
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(
          new Blob([out], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        ),
        download: `Al-Xorazmiy-${workbook.date}.xlsx`,
      });
      a.click();
      URL.revokeObjectURL(a.href);
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
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) processFile(f);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        inputRef={inputRef}
        onFileChange={upload}
        onDemo={() => {
          setWorkbook(makeDemoWorkbook());
          setActiveClass("5A");
        }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-dash-bg">
      <input ref={inputRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={upload} />

      <header className="no-print sticky top-0 z-30 border-b border-dash-border bg-dash-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1840px] items-center gap-3 px-4 lg:px-6">
          <img src={logo} alt="Al-Xorazmiy School" className="h-8 w-auto object-contain" />
          <div className="mx-3 h-5 w-px bg-dash-border" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-semibold text-dash-muted">{workbook.fileName}</span>
            <span className="text-[11px] text-dash-muted/70">
              {workbook.date} · {workbook.students.length} o'quvchi
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="dash-btn-outline"
              onClick={downloadExcel}
              disabled={Boolean(busy)}
            >
              {busy === "excel" ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="dash-btn-outline"
              onClick={() => inputRef.current?.click()}
            >
              {busy === "upload" ? <LoaderCircle className="animate-spin" /> : <Upload />}
              <span className="hidden sm:inline">Faylni almashtirish</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1840px] px-4 pb-8 pt-5 lg:px-6">
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
                  onChange={(e) =>
                    setThirdSubjects((prev) => ({ ...prev, [activeClass]: e.target.value }))
                  }
                  placeholder="masalan: Tarix"
                  className="w-28 bg-transparent text-xs outline-none placeholder:text-dash-muted/50"
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

        {activeClass === "all" ? (
          <Leaderboard students={students} />
        ) : (
          <ClassReport
            ref={reportRef}
            date={workbook.date}
            activeClass={activeClass}
            students={students}
            thirdSubject={thirdSubject}
          />
        )}
      </div>
    </main>
  );
}

/* ─── Upload Screen ────────────────────────────────────────────── */
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
  onDemo,
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
  onDemo: () => void;
}) {
  return (
    <div className="upload-bg flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <input ref={inputRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={onFileChange} />
      <img src={logo} alt="Al-Xorazmiy School" className="mb-8 h-16 w-auto object-contain opacity-90" />
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
          <p className="mt-1 text-sm text-muted-foreground">Faylni bu yerga sudrab tashlang yoki bosing</p>
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
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {["5–8 sinf", "9–11 sinf", "Umumiy reyting", "Telegram PNG", "PDF eksport"].map((f) => (
          <span
            key={f}
            className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm"
          >
            {f}
          </span>
        ))}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDemo();
        }}
        className="mt-4 text-xs text-muted-foreground underline underline-offset-2 opacity-60 transition-opacity hover:opacity-100"
      >
        Demo ko'rish →
      </button>
      {error && (
        <div className="mt-5 flex max-w-sm items-start gap-3 rounded-xl border border-coral-soft/50 bg-coral-soft/60 px-4 py-3">
          <span className="mt-0.5 text-base">⚠️</span>
          <p className="text-sm font-semibold text-coral-foreground">{error}</p>
        </div>
      )}
    </div>
  );
}

/* ─── All-classes leaderboard (overview, not exported) ─────────── */
function Leaderboard({ students }: { students: NormalizedStudent[] }) {
  return (
    <div className="dash-table-wrap p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Trophy className="size-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Umumiy reyting — barcha sinflar</h2>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {students.map((s, i) => (
          <div
            key={`${s.className}-${s.name}-${i}`}
            className="flex items-center gap-3 rounded-xl border border-dash-border bg-white/70 px-3 py-2"
          >
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold"
              style={{
                background: i === 0 ? "#fef3c7" : i === 1 ? "#f1f5f9" : i === 2 ? "#ffedd5" : "#f8fafc",
                color: i === 0 ? "#b45309" : i === 1 ? "#475569" : i === 2 ? "#c2410c" : "#64748b",
                border: `1.5px solid ${i === 0 ? "#fbbf24" : i === 1 ? "#cbd5e1" : i === 2 ? "#fdba74" : "#e2e8f0"}`,
              }}
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {s.name}
              {s.studentId ? <span className="ml-1.5 text-[11px] font-normal text-dash-muted">#{s.studentId}</span> : null}
            </span>
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
              {s.className}
            </span>
            <span className="w-10 text-right text-sm font-extrabold text-foreground">{s.totalText}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* JAMI cell — solid colour by standing. */
const TOTAL_COLOR: Record<Tone, { bg: string; fg: string; border: string }> = {
  high: { bg: "#13a05e", fg: "#ffffff", border: "#0f8a50" },
  mid: { bg: "#e0890f", fg: "#ffffff", border: "#c4760a" },
  low: { bg: "#df524a", fg: "#ffffff", border: "#c5443d" },
  none: { bg: "#cbd5e1", fg: "#475569", border: "#b4c0cf" },
};

const GRID_LINE = "#d8e1ea";
const HEAD_BG = BRAND.headBg;

/* Flex base for a grid cell. */
const cellCenter: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
};

/* ─── Subject cell (grid div) ──────────────────────────────────── */
function SubjectCell({ subject, is911 }: { subject: SubjectResult; is911: boolean }) {
  const t = TONE[subject.tone];

  // ID error → minimal: only the notice, no result / bal / level / ID number.
  if (subject.idError) {
    return (
      <div style={{ ...cellCenter, background: "#fff7ed", padding: "6px", boxShadow: "inset 0 0 0 2px #f59e0b" }}>
        <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#b45309", lineHeight: 1.25, textAlign: "center" }}>
          ⚠ ID xato
          <br />
          kiritilgan
        </div>
      </div>
    );
  }

  const present = subject.present;
  const fg = present ? t.fg : "#94a3b8";
  const ratio = is911
    ? subject.correct !== null
      ? Math.min(1, subject.correct / subject.totalQuestions)
      : 0
    : subject.percent !== null
      ? Math.min(1, subject.percent / 100)
      : 0;
  const barWidth = Math.round(ratio * 100);

  return (
    <div style={{ ...cellCenter, background: present ? t.bg : "#f8fafc", padding: "6px 8px" }}>
      {/* Top: etap badge (5-8) or subject name · correct (9-11) */}
      {is911 ? (
        <div style={{ fontSize: "9.5px", fontWeight: 700, color: present ? "#334155" : "#94a3b8", lineHeight: 1.1, marginBottom: "2px", textAlign: "center" }}>
          {present
            ? `${subject.subjectName ?? "—"}${subject.correct !== null ? ` · ${subject.correct}/${subject.totalQuestions}` : ""}`
            : "—"}
        </div>
      ) : present && subject.level ? (
        <div style={{ marginBottom: "3px" }}>
          <span style={{ display: "inline-block", fontSize: "8.5px", fontWeight: 800, color: BRAND.deep, background: "#e3f1ef", border: "1px solid #c5e3df", borderRadius: "6px", padding: "1px 6px", letterSpacing: "0.02em" }}>
            {subject.level}-etap
          </span>
        </div>
      ) : null}

      {/* Main result + correct/total (5-8) */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "5px" }}>
        <span style={{ fontSize: "17px", fontWeight: 800, color: fg, lineHeight: 1.05 }}>
          {present ? subject.resultText : "—"}
        </span>
        {!is911 && present && subject.correct !== null ? (
          <span style={{ fontSize: "9.5px", fontWeight: 700, color: t.sub }}>
            {subject.correct}/{subject.totalQuestions}
          </span>
        ) : null}
      </div>

      {/* Progress bar */}
      {present ? (
        <div style={{ width: "100%", height: "5px", borderRadius: "9999px", background: "#e9eef3", overflow: "hidden", marginTop: "4px" }}>
          <div style={{ height: "100%", width: `${barWidth}%`, background: t.bar, borderRadius: "9999px" }} />
        </div>
      ) : null}

      {/* Bottom: bal (5-8) / kirmagan */}
      {!is911 ? (
        <div style={{ fontSize: "9.5px", fontWeight: 600, color: present ? t.sub : "#94a3b8", marginTop: "3px", lineHeight: 1 }}>
          {present ? `bal ${subject.score || "—"}` : "kirmagan"}
        </div>
      ) : !present ? (
        <div style={{ fontSize: "9px", fontWeight: 600, color: "#94a3b8", marginTop: "2px" }}>kirmagan</div>
      ) : null}
    </div>
  );
}

/* ─── Discipline badge cell (grid div, shows the point earned) ──── */
function DiscCell({ d, bg }: { d: NormalizedStudent["discipline"][number]; bg: string }) {
  const fg = d.ok ? "#047857" : "#c0392b";
  const circleBg = d.ok ? "#e9f9f0" : "#fdeeee";
  const border = d.ok ? "#b6ebcf" : "#f6c9c9";
  return (
    <div style={{ ...cellCenter, background: bg, padding: "6px 3px" }}>
      {d.empty ? (
        <span style={{ display: "inline-block", width: "20px", height: "20px", borderRadius: "50%", border: "1.5px dashed #d6dee8", background: "#f8fafc" }} />
      ) : (
        <span
          title={`${d.label}: ${d.value}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            fontSize: "11px",
            fontWeight: 800,
            background: circleBg,
            border: `1.5px solid ${border}`,
            color: fg,
          }}
        >
          {d.value}
        </span>
      )}
    </div>
  );
}

/* ─── Premium Class Report — table (Telegram / PDF export) ──────── */
function ClassReport({
  ref,
  date,
  activeClass,
  students,
  thirdSubject,
}: {
  ref: Ref<HTMLDivElement>;
  date: string;
  activeClass: string;
  students: NormalizedStudent[];
  thirdSubject: string;
}) {
  const maxTotal = useMemo(() => Math.max(1, ...students.map((s) => s.total)), [students]);
  const totalTone = (total: number): Tone =>
    total / maxTotal >= 0.66 ? "high" : total / maxTotal >= 0.4 ? "mid" : total > 0 ? "low" : "none";

  const kind = students[0]?.kind ?? "5-8";
  const is911 = kind === "9-11";
  const discList = students[0]?.discipline ?? [];
  const midLabel = students[0]?.midLabel ?? "O'RTACHA BAL";
  // 5-8: O'rtacha bal sits after the first two subjects; 9-11: BAL after all blocks.
  const midAfter = is911 ? 3 : 2;

  const subjectLabels = (students[0]?.subjects ?? []).map((sub) =>
    thirdSubject && /3-fan/i.test(sub.label) ? thirdSubject.toLocaleUpperCase("uz-UZ") : sub.label,
  );

  const hasAbsent = students.some((s) => s.status === "absent");
  const hasWrongId = students.some((s) => s.status === "wrong-id" || s.subjects.some((x) => x.idError));

  // Ordered header labels for the 4 "main" columns (subjects + mid inserted).
  const headerMains: string[] = [];
  subjectLabels.forEach((l, i) => {
    headerMains.push(l);
    if (i === midAfter - 1) headerMains.push(midLabel);
  });

  const mainCount = subjectLabels.length + 1; // 3 subjects + mid
  const discN = discList.length;
  const firstDiscCol = 3 + mainCount; // grid column where INTIZOM starts
  const jamiCol = firstDiscCol + discN;
  const GRID_COLS = `40px 236px ${"128px ".repeat(mainCount)}${"32px ".repeat(discN)}64px`;

  const hCell: React.CSSProperties = {
    ...cellCenter,
    background: HEAD_BG,
    color: "#ffffff",
    fontSize: "10.5px",
    fontWeight: 800,
    letterSpacing: "0.02em",
    textAlign: "center",
    padding: "8px 4px",
    lineHeight: 1.12,
  };

  return (
    <div
      ref={ref}
      style={{
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
        background: "linear-gradient(160deg, #eef2f7 0%, #e6edf5 100%)",
        padding: "24px",
        display: "inline-block",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 10px 40px rgba(15, 42, 60, 0.10)",
          border: "1px solid #e6edf3",
        }}
      >
        {/* Header band */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "18px 24px", background: BRAND.headerGradient, color: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "62px", width: "62px", borderRadius: "14px", background: "#ffffff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
            <img src={logo} alt="Al-Xorazmiy" style={{ height: "54px", width: "54px", objectFit: "contain" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.18em", opacity: 0.85 }}>AL-XORAZMIY SCHOOL</div>
            <div style={{ fontSize: "21px", fontWeight: 800, lineHeight: 1.15, margin: "2px 0" }}>HAFTALIK JAMG'ARILGAN BALLAR</div>
            <div style={{ fontSize: "12.5px", opacity: 0.9, fontWeight: 500 }}>{date}</div>
          </div>
          <div style={{ textAlign: "center", padding: "9px 17px", borderRadius: "13px", background: "rgba(255,255,255,0.18)" }}>
            <div style={{ fontSize: "25px", fontWeight: 900, lineHeight: 1 }}>{activeClass}</div>
            <div style={{ fontSize: "9.5px", fontWeight: 600, letterSpacing: "0.1em", opacity: 0.9, marginTop: "2px" }}>SINF</div>
          </div>
        </div>

        {/* Legend */}
        {hasAbsent || hasWrongId ? (
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", padding: "9px 24px", borderBottom: "1px solid #eef2f7", fontSize: "11px", color: "#475569", fontWeight: 600 }}>
            {hasWrongId ? (
              <span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span style={{ width: "18px", height: "11px", borderRadius: "3px", background: "#fff7ed", border: "2px solid #f59e0b", display: "inline-block" }} />
                Fan tagida <strong style={{ color: "#b45309" }}>ID XATO</strong> — o'sha fanga ID raqamini noto'g'ri kiritgan
              </span>
            ) : null}
            {hasAbsent ? (
              <span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span style={{ width: "18px", height: "11px", borderRadius: "3px", background: "#eef2f7", border: "1px solid #cbd5e1", display: "inline-block" }} />
                <strong style={{ color: "#475569" }}>KELMAGAN</strong> — imtihonda qatnashmagan
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Table — CSS grid (reliable for html-to-image export) */}
        <div style={{ padding: "12px 14px 6px" }}>
          <div style={{ width: "990px", margin: "0 auto", border: `1px solid ${GRID_LINE}` }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, gap: "1px", background: BRAND.headLine }}>
              <div style={{ ...hCell, gridColumn: "1", gridRow: "1 / 3" }}>№</div>
              <div style={{ ...hCell, gridColumn: "2", gridRow: "1 / 3", alignItems: "flex-start", paddingLeft: "12px" }}>O'QUVCHI</div>
              {headerMains.map((l, idx) => (
                <div key={`h${idx}`} style={{ ...hCell, gridColumn: String(3 + idx), gridRow: "1 / 3" }}>
                  {l}
                </div>
              ))}
              <div style={{ ...hCell, gridColumn: `${firstDiscCol} / ${jamiCol}`, gridRow: "1" }}>INTIZOM</div>
              {discList.map((d, idx) => (
                <div key={d.short} title={d.label} style={{ ...hCell, gridColumn: String(firstDiscCol + idx), gridRow: "2", padding: "4px 2px", fontSize: "11px" }}>
                  {d.short}
                </div>
              ))}
              <div style={{ ...hCell, gridColumn: String(jamiCol), gridRow: "1 / 3" }}>JAMI</div>
            </div>

            {/* Body */}
            <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, gap: "1px", background: GRID_LINE, borderTop: `1px solid ${GRID_LINE}` }}>
              {students.flatMap((s, i) => {
                const rank = 1 + students.filter((o) => o.total > s.total).length;
                const tied = s.total > 0 && students.filter((o) => o.total === s.total).length > 1;
                const absent = s.status === "absent";
                const wrongId = s.status === "wrong-id" || s.subjects.some((x) => x.idError);
                const medal = absent ? null : rank === 1 ? "#fbbf24" : rank === 2 ? "#cbd5e1" : rank === 3 ? "#fb923c" : null;
                const tc = TOTAL_COLOR[totalTone(s.total)];
                const rowBg = absent ? "#f6f8fb" : wrongId ? "#fffdf7" : i % 2 === 1 ? "#fafcfe" : "#ffffff";

                const rankBg = tied ? "#eef2ff" : medal ? `${medal}22` : "#f1f5f9";
                const rankBorder = tied ? "#c7d2fe" : (medal ?? "#e2e8f0");
                const rankFg = tied ? "#4f46e5" : medal ? "#7c4a02" : "#64748b";

                const cells: React.ReactNode[] = [];
                // Rank
                cells.push(
                  <div key={`${i}-rank`} style={{ ...cellCenter, background: rowBg, padding: "6px 2px" }}>
                    <span
                      title={tied ? "Ball teng" : undefined}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "27px",
                        height: "27px",
                        borderRadius: "50%",
                        fontSize: "12.5px",
                        fontWeight: 900,
                        background: rankBg,
                        border: `2px solid ${rankBorder}`,
                        color: rankFg,
                      }}
                    >
                      {rank}
                    </span>
                  </div>,
                );
                // Name + ID + status
                cells.push(
                  <div key={`${i}-name`} style={{ ...cellCenter, alignItems: "flex-start", justifyContent: "center", background: rowBg, padding: "7px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: 700, color: absent ? "#64748b" : "#0f2a3c" }}>{s.name}</span>
                      {s.studentId ? (
                        <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#5b6b7c", background: "#eef2f7", border: "1px solid #dde5ee", borderRadius: "5px", padding: "1px 5px", fontFamily: "'DM Mono', ui-monospace, monospace" }}>
                          ID {s.studentId}
                        </span>
                      ) : null}
                      {absent ? (
                        <span style={{ fontSize: "9px", fontWeight: 800, color: "#475569", background: "#e2e8f0", borderRadius: "5px", padding: "1px 6px" }}>KELMAGAN</span>
                      ) : null}
                    </div>
                  </div>,
                );
                // Subjects + mid column in order
                s.subjects.forEach((subj, si) => {
                  cells.push(<SubjectCell key={`${i}-s${si}`} subject={subj} is911={is911} />);
                  if (si === midAfter - 1) {
                    cells.push(
                      <div key={`${i}-mid`} style={{ ...cellCenter, background: BRAND.midCellBg, padding: "6px" }}>
                        <span style={{ fontSize: "15px", fontWeight: 800, color: absent ? "#94a3b8" : BRAND.deep }}>{s.midScore}</span>
                      </div>,
                    );
                  }
                });
                // Discipline
                s.discipline.forEach((d) => cells.push(<DiscCell key={`${i}-d${d.short}`} d={d} bg={rowBg} />));
                // JAMI
                cells.push(
                  <div key={`${i}-jami`} style={{ ...cellCenter, background: tc.bg, padding: "5px" }}>
                    <span style={{ fontSize: "17px", fontWeight: 900, color: tc.fg }}>{s.totalText}</span>
                  </div>,
                );
                return cells;
              })}
            </div>
          </div>
        </div>

        {/* Footer / parent guide */}
        <div style={{ padding: "12px 22px 16px", borderTop: "1px solid #eef2f7", background: "#fbfdfe" }}>
          <div style={{ fontSize: "11px", color: "#334155", fontWeight: 700, marginBottom: "5px" }}>
            {is911
              ? "JAMI ball = imtihon bali + intizom ballari (D + K + V + O)"
              : "JAMI ball = (Ingliz va Matematika o'rtacha bali) + 3-fan bali + intizom ballari (D + K + V + O)"}
          </div>
          <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", fontSize: "10px", color: "#64748b", fontWeight: 600 }}>
            <span>
              <strong style={{ color: "#047857" }}>D</strong> davomat · <strong style={{ color: "#047857" }}>K</strong> kech qolmaslik ·{" "}
              <strong style={{ color: "#047857" }}>V</strong> uyga vazifa · <strong style={{ color: "#047857" }}>O</strong> odob-axloq
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#5be299", display: "inline-block" }} />
              yaxshi
              <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#ffce80", display: "inline-block", marginLeft: "8px" }} />
              o'rta
              <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#ff9a9a", display: "inline-block", marginLeft: "8px" }} />
              past
            </span>
          </div>
          <div style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: 600, marginTop: "8px", textAlign: "right" }}>
            Al-Xorazmiy School · {activeClass} sinf · {date}
          </div>
        </div>
      </div>
    </div>
  );
}
