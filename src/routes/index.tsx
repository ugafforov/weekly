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
      const originalNode = reportRef.current;
      const clone = originalNode.cloneNode(true) as HTMLDivElement;
      
      const wrapper = document.createElement("div");
      wrapper.style.position = "absolute";
      wrapper.style.top = "-9999px";
      wrapper.style.left = "-9999px";
      wrapper.style.width = "1338px";
      wrapper.style.height = `${originalNode.offsetHeight}px`;
      wrapper.style.overflow = "visible";
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      try {
        const width = 1338;
        const height = originalNode.offsetHeight;
        const url = await toPng(clone, {
          width,
          height,
          pixelRatio: 3,
          cacheBust: true,
          skipFonts: true,
          backgroundColor: "#eef2f7",
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: "none",
            margin: "0",
          }
        });
        Object.assign(document.createElement("a"), {
          download: `${activeClass}-${workbook?.date}-reyting.png`,
          href: url,
        }).click();
      } finally {
        document.body.removeChild(wrapper);
      }
    } finally {
      setBusy(undefined);
    }
  }

  async function downloadPdf() {
    if (!reportRef.current || activeClass === "all") return;
    setBusy("pdf");
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const originalNode = reportRef.current;
      const clone = originalNode.cloneNode(true) as HTMLDivElement;
      
      const wrapper = document.createElement("div");
      wrapper.style.position = "absolute";
      wrapper.style.top = "-9999px";
      wrapper.style.left = "-9999px";
      wrapper.style.width = "1338px";
      wrapper.style.height = `${originalNode.offsetHeight}px`;
      wrapper.style.overflow = "visible";
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      try {
        const width = 1338;
        const height = originalNode.offsetHeight;
        const image = await toPng(clone, {
          width,
          height,
          pixelRatio: 2,
          skipFonts: true,
          backgroundColor: "#eef2f7",
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: "none",
            margin: "0",
          }
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
        document.body.removeChild(wrapper);
      }
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

/* JAMI cell — gradient colour by standing. */
const TOTAL_COLOR: Record<Tone, { bg: string; fg: string; border: string }> = {
  high: { bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)", fg: "#ffffff", border: "#047857" },
  mid: { bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", fg: "#ffffff", border: "#b45309" },
  low: { bg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", fg: "#ffffff", border: "#b91c1c" },
  none: { bg: "linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)", fg: "#ffffff", border: "#475569" },
};

/* Flex base for a grid cell. */
const cellCenter: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
};

/* ─── Subject cell — card-row layout ──────────────────────────── */
function SubjectCell({
  subject,
  is911,
  isThird,
}: {
  subject: SubjectResult;
  is911: boolean;
  isThird?: boolean;
}) {
  const t = TONE[subject.tone];

  /* ID error */
  if (subject.idError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "12px 10px", background: "rgba(254, 243, 199, 0.75)", borderRight: "1px solid rgba(203, 213, 225, 0.55)", height: "100%", boxSizing: "border-box" }}>
        <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "5px", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: "3px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
          ⚠ ID xato kiritilgan
        </span>
      </div>
    );
  }

  /* Absent */
  if (!subject.present) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "12px 10px", background: "rgba(241, 245, 249, 0.7)", borderRight: "1px solid rgba(203, 213, 225, 0.55)", height: "100%", boxSizing: "border-box" }}>
        <span style={{ fontSize: "15px", fontWeight: 700, color: "#94a3b8" }}>—</span>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginTop: "2px" }}>kirmagan</span>
      </div>
    );
  }

  const ratio = is911
    ? subject.correct !== null ? Math.min(1, subject.correct / subject.totalQuestions) : 0
    : subject.percent !== null ? Math.min(1, subject.percent / 100) : 0;
  const barWidth = Math.round(ratio * 100);
  const barColor = subject.tone === "high"
    ? "#22c55e"
    : subject.tone === "mid"
    ? "#f59e0b"
    : subject.tone === "low"
    ? "#ef4444"
    : "#cbd5e1";

  const cellBg = subject.tone === "high"
    ? "rgba(209, 250, 229, 0.85)"
    : subject.tone === "mid"
    ? "rgba(254, 243, 199, 0.85)"
    : subject.tone === "low"
    ? "rgba(254, 226, 226, 0.85)"
    : "transparent";

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "12px 10px", background: cellBg, borderRight: "1px solid rgba(203, 213, 225, 0.55)", height: "100%", boxSizing: "border-box" }}>
      {/* Line 1: left=fraction | center=percent | right=score bal */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "4px" }}>
        {subject.correct !== null ? (
          <span style={{ fontSize: "9.5px", fontWeight: 600, color: "#64748b" }}>{subject.correct} / {subject.totalQuestions}</span>
        ) : (
          <span />
        )}
        <span style={{ fontSize: "18px", fontWeight: 900, color: t.fg }}>{subject.resultText}</span>
        {subject.score ? (
          <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#475569" }}>{subject.score} bal</span>
        ) : (
          <span />
        )}
      </div>

      {/* Line 2: progress bar */}
      <div style={{ width: "100%", height: "5px", borderRadius: "9999px", background: "#eef2f7", overflow: "hidden", marginTop: "7px" }}>
        <div style={{ height: "100%", width: `${barWidth}%`, background: barColor, borderRadius: "9999px" }} />
      </div>

      {/* Line 3: level badge (only for 5-8, not 3-fan) */}
      {/* Line 3: level badge (for 5-8, show empty placeholder on 3rd subject for uniformity) */}
      {!is911 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            alignSelf: "center",
            fontSize: "8px",
            fontWeight: 700,
            color: isThird || !subject.level ? "transparent" : "#475569",
            background: isThird || !subject.level ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.65)",
            border: isThird || !subject.level ? "1px dashed rgba(203, 213, 225, 0.5)" : "1px solid rgba(255, 255, 255, 0.85)",
            borderRadius: "5px",
            padding: "1px 5px",
            marginTop: "6px",
            gap: "3px",
            minHeight: "14px",
            width: isThird || !subject.level ? "40px" : "auto",
            boxSizing: "border-box",
          }}
        >
          {!(isThird || !subject.level) && (
            <span style={{ display: "inline-block", width: "4px", height: "4px", borderRadius: "50%", background: "#0d9488" }} />
          )}
          {isThird || !subject.level ? "\u00A0" : `${subject.level}-etap`}
        </span>
      )}
    </div>
  );
}

/* ─── Discipline color helper ─────────────────────────────────── */
interface DiscColorInfo {
  bg: string;
  border: string;
  fg: string;
  isDashed?: boolean;
}

function getDiscColor(value: string, empty: boolean): DiscColorInfo {
  if (empty) {
    return { bg: "rgba(241, 245, 249, 0.5)", border: "rgba(203, 213, 225, 0.5)", fg: "rgba(148, 163, 184, 0.8)", isDashed: true };
  }
  const val = Number(value);
  if (Number.isNaN(val)) {
    return { bg: "rgba(241, 245, 249, 0.6)", border: "rgba(226, 232, 240, 0.7)", fg: "#475569" };
  }
  if (val >= 1) {
    return { bg: "rgba(209, 250, 229, 0.85)", border: "rgba(167, 243, 208, 0.85)", fg: "#065f46" };
  } else if (val > 0 && val < 1) {
    return { bg: "rgba(254, 243, 199, 0.85)", border: "rgba(253, 230, 138, 0.85)", fg: "#92400e" };
  } else {
    return { bg: "rgba(254, 226, 226, 0.85)", border: "rgba(254, 202, 202, 0.85)", fg: "#991b1b" };
  }
}

/* ─── Discipline Cell ─────────────────────────────────────────── */
function DisciplineCell({
  discipline,
}: {
  discipline: NormalizedStudent["discipline"];
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: "7px",
        padding: "10px 8px",
        borderRight: "1px solid rgba(203, 213, 225, 0.55)",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {discipline.map((d) => {
        const colors = getDiscColor(d.value, d.empty);
        return (
          <span
            key={d.short}
            title={`${d.label}: ${d.value}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              fontSize: "11px",
              fontWeight: 800,
              background: d.empty ? "rgba(241, 245, 249, 0.5)" : colors.bg,
              border: `1px solid ${d.empty ? "rgba(221, 229, 238, 0.6)" : colors.border}`,
              color: d.empty ? "rgba(203, 213, 225, 0.8)" : colors.fg,
              boxShadow: d.empty ? "none" : "inset 0 1px 2px rgba(255, 255, 255, 0.45), 0 2px 4px rgba(0, 0, 0, 0.02)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
          >
            {d.empty ? "" : d.value}
          </span>
        );
      })}
    </div>
  );
}

/* ─── Card-row Class Report (Telegram / PDF export) ─────────────── */
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
  const activeTotals = useMemo(() => {
    return students
      .filter((s) => s.status !== "absent" && s.total > 0)
      .map((s) => s.total);
  }, [students]);

  const maxTotal = useMemo(() => (activeTotals.length > 0 ? Math.max(...activeTotals) : 1), [activeTotals]);
  const minTotal = useMemo(() => (activeTotals.length > 0 ? Math.min(...activeTotals) : 0), [activeTotals]);

  const totalTone = (total: number): Tone => {
    if (total <= 0) return "none";
    if (maxTotal === minTotal) return "high";
    const percent = (total - minTotal) / (maxTotal - minTotal);
    return percent >= 0.66 ? "high" : percent >= 0.33 ? "mid" : "low";
  };

  const kind = students[0]?.kind ?? "5-8";
  const is911 = kind === "9-11";
  const midLabel = students[0]?.midLabel ?? "O'RTACHA BAL";
  const midAfter = is911 ? 3 : 2;

  const subjectLabels = (students[0]?.subjects ?? []).map((sub) =>
    thirdSubject && /3-fan/i.test(sub.label) ? thirdSubject.toLocaleUpperCase("uz-UZ") : sub.label,
  );

  const hasAbsent = students.some((s) => s.status === "absent");
  const hasWrongId = students.some((s) => s.status === "wrong-id" || s.subjects.some((x) => x.idError));

  /* Build ordered header labels (subjects + mid inserted). */
  const headerMains: string[] = [];
  subjectLabels.forEach((l, i) => {
    headerMains.push(l);
    if (i === midAfter - 1) headerMains.push(midLabel);
  });

  /* Column widths: №  Name  Sub1  Sub2  Mid  Sub3/3-fan  INTIZOM  JAMI */
  const GRID_COLS = is911
    ? "46px 440px 160px 160px 160px 100px 130px 80px"
    : "46px 440px 160px 160px 100px 160px 130px 80px";

  /* ── Inline style constants ── */
  const hdrCell: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: 900,
    color: "#ffffff",
    letterSpacing: "0.04em",
    padding: "16px 8px",
    textAlign: "center",
    borderRight: "1px solid rgba(255, 255, 255, 0.12)",
    boxSizing: "border-box",
  };

  return (
    <div
      ref={ref}
      style={{
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
        background: "linear-gradient(160deg, #eef2f7 0%, #e4ecf4 100%)",
        padding: "24px 30px",
        width: "1338px",
        boxSizing: "border-box",
        margin: "0 auto",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background blobs for glassmorphic depth */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          left: "80px",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20, 184, 166, 0.15) 0%, rgba(20, 184, 166, 0) 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-50px",
          right: "100px",
          width: "450px",
          height: "450px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0) 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "400px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(244, 63, 94, 0.08) 0%, rgba(244, 63, 94, 0) 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          background: "rgba(255, 255, 255, 0.72)",
          backdropFilter: "blur(18px) saturate(130%)",
          WebkitBackdropFilter: "blur(18px) saturate(130%)",
          borderRadius: "22px",
          boxShadow: "0 24px 60px rgba(15, 42, 60, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.45)",
          overflow: "hidden",
          width: "1278px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ── Top brand header ── */}
        <div style={{ display: "flex", alignItems: "center", padding: "22px 28px", background: BRAND.headerGradient, color: "#ffffff", borderRadius: "22px 22px 0 0", boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.12)", flexWrap: "nowrap" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "64px", width: "64px", borderRadius: "16px", background: "#ffffff", boxShadow: "0 4px 14px rgba(0,0,0,0.16)", border: "1.5px solid rgba(255, 255, 255, 0.25)", flexShrink: 0, marginRight: "24px" }}>
            <img src={logo} alt="Al-Xorazmiy" style={{ height: "54px", width: "54px", objectFit: "contain" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, marginRight: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", flexShrink: 0 }}>
              <span style={{ fontSize: "11px", fontWeight: 900, letterSpacing: "0.18em", color: "#fcd34d", whiteSpace: "nowrap", flexShrink: 0, marginRight: "6px" }}>AL-XORAZMIY SCHOOL</span>
              <span style={{ height: "4px", width: "4px", borderRadius: "50%", background: "rgba(255,255,255,0.4)", flexShrink: 0, marginRight: "6px" }} />
              <span style={{ fontSize: "9.5px", fontWeight: 700, color: "rgba(255, 255, 255, 0.65)", letterSpacing: "0.08em", whiteSpace: "nowrap", flexShrink: 0 }}>HAFTALIK REYTING TIZIMI</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: "3.5px", flexWrap: "nowrap" }}>
              <div style={{ fontSize: "24px", fontWeight: 900, lineHeight: 1.15, letterSpacing: "-0.01em", textShadow: "0 1px 3px rgba(0,0,0,0.12)", whiteSpace: "nowrap", flexShrink: 0, marginRight: "12px" }}>
                HAFTALIK JAMG'ARILGAN BALLAR
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", background: "rgba(255, 255, 255, 0.12)", border: "1px solid rgba(255, 255, 255, 0.18)", borderRadius: "6px", padding: "3.5px 10px", whiteSpace: "nowrap", flexShrink: 0 }}>
                <span style={{ display: "inline-block", fontSize: "11px", opacity: 0.9, flexShrink: 0, marginRight: "6px" }}>📅</span>
                <span style={{ fontSize: "11px", fontWeight: 750, color: "#ffffff", letterSpacing: "0.02em", whiteSpace: "nowrap", flexShrink: 0 }}>{date} HISOBOTI</span>
              </div>
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              padding: "12px 22px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.08) 100%)",
              border: "1.5px solid rgba(255, 255, 255, 0.35)",
              boxShadow: "0 8px 32px 0 rgba(11, 93, 86, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              minWidth: "82px",
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: "30px", fontWeight: 950, lineHeight: 1, color: "#ffffff", textShadow: "0 2px 4px rgba(0,0,0,0.15)" }}>{activeClass}</div>
            <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.15em", color: "rgba(255,255,255,0.9)", marginTop: "3px" }}>SINF</div>
          </div>
        </div>

        {/* ── Legend ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "28px", flexWrap: "wrap", padding: "16px 28px", borderBottom: "1px solid rgba(226, 232, 240, 0.7)", fontSize: "12.5px", color: "#334155", fontWeight: 600, background: "rgba(250, 250, 250, 0.45)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: "44px", height: "22px", borderRadius: "6px", background: "rgba(254, 243, 199, 0.75)", border: "1.5px solid #fde68a", display: "inline-block", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }} />
            <span>O'quvchi ID raqamini <strong style={{ color: "#b45309", fontWeight: 800 }}>xato</strong> kiritgan</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: "44px", height: "22px", borderRadius: "6px", background: "rgba(241, 245, 249, 0.7)", border: "1.5px solid #cbd5e1", display: "inline-block", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }} />
            <span>O'quvchi imtihonda <strong style={{ color: "#475569", fontWeight: 800 }}>qatnashmagan</strong></span>
          </span>
        </div>

        {/* ── Table area ── */}
        <div style={{ padding: "0 0 16px" }}>

          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, columnGap: "0px", borderBottom: "1px solid #0b5d56", background: "#0c5c54", padding: "0" }}>
            <div style={{ ...hdrCell, justifyContent: "center" }}>№</div>
            <div style={{ ...hdrCell, justifyContent: "flex-start", paddingLeft: "20px" }}>O'QUVCHI</div>
            {headerMains.map((l, idx) => (
              <div key={`h${idx}`} style={hdrCell}>{l}</div>
            ))}
            {/* INTIZOM header: title + D K V O circles */}
            <div style={{ ...hdrCell, flexDirection: "column", gap: "6px", padding: "10px 4px", lineHeight: 1.15 }}>
              <span style={{ fontSize: "14px", fontWeight: 900 }}>INTIZOM</span>
              <div style={{ display: "flex", flexDirection: "row", gap: "7px", justifyContent: "center", alignItems: "center" }}>
                {["D", "K", "V", "O"].map((letter) => (
                  <span
                    key={letter}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#ffffff",
                      background: "rgba(255, 255, 255, 0.2)",
                      border: "1px solid rgba(255, 255, 255, 0.35)",
                      boxShadow: "inset 0 1px 2px rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ ...hdrCell, borderRight: "none" }}>JAMI</div>
          </div>

          {/* Table body — unified table rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
            {students.map((s, i) => {
              const rank = 1 + students.filter((o) => o.total > s.total || (o.total === s.total && pctSum(o) > pctSum(s))).length;
              const tied = s.total > 0 && students.filter((o) => o.total === s.total && pctSum(o) === pctSum(s)).length > 1;
              const absent = s.status === "absent";
              const wrongId = s.status === "wrong-id" || s.subjects.some((x) => x.idError);
              const tc = TOTAL_COLOR[totalTone(s.total)];

              /* Rank badge colors */
              const medal = absent ? null : rank === 1 ? "#fbbf24" : rank === 2 ? "#94a3b8" : rank === 3 ? "#fb923c" : null;
              const showMedal = !absent && rank <= 3;
              const rankBg = showMedal
                ? `${medal}18`
                : (tied && !absent)
                ? "#eef2ff"
                : "transparent";
              const rankBorder = showMedal
                ? medal
                : (tied && !absent)
                ? "#a5b4fc"
                : "#d1d5db";
              const rankFg = showMedal
                ? (rank === 1 ? "#a16207" : rank === 2 ? "#475569" : "#c2410c")
                : (tied && !absent)
                ? "#4f46e5"
                : "#64748b";

              /* Row card border — slight left accent for top 3 */
              const cardBorder = absent
                ? "1px solid #e2e8f0"
                : wrongId
                ? "1px solid #fde68a"
                : rank === 1
        ? "1px solid #fde68a"
                : rank === 2
                ? "1px solid #d1d5db"
                : rank === 3
                ? "1px solid #fed7aa"
                : "1px solid #e2e8f0";

              return (
                <div
                  key={`row-${i}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: GRID_COLS,
                    alignItems: "stretch",
                    borderBottom: i === students.length - 1 ? "none" : "2px solid rgba(203, 213, 225, 0.55)",
                    background: absent
                      ? "rgba(241, 245, 249, 0.6)"
                      : i % 2 === 0
                      ? "rgba(255, 255, 255, 0.72)"
                      : "rgba(248, 250, 252, 0.55)",
                    height: "80px",
                  }}
                >
                  {/* ── Rank ── */}
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "8px 4px", borderRight: "1px solid rgba(203, 213, 225, 0.55)" }}>
                    {showMedal ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          fontSize: "13.5px",
                          fontWeight: 900,
                          background: rankBg,
                          border: `2px solid ${rankBorder}`,
                          color: rankFg,
                        }}
                      >
                        {rank}
                      </span>
                    ) : (
                      <span style={{ fontSize: "15px", fontWeight: 800, color: "#94a3b8" }}>{rank}</span>
                    )}
                  </div>

                  {/* ── Name + ID ── */}
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "8px 20px", gap: "4px", borderRight: "1px solid rgba(203, 213, 225, 0.55)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "nowrap" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: 700, color: absent ? "#94a3b8" : "#1e293b", whiteSpace: "nowrap" }}>{s.name}</span>
                      {s.studentId && (
                        <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", background: "#f1f5f9", border: "1px solid rgba(203, 213, 225, 0.8)", borderRadius: "5px", padding: "1.5px 6px", whiteSpace: "nowrap" }}>
                          ID {s.studentId}
                        </span>
                      )}
                    </div>
                    {absent && (
                      <span style={{ fontSize: "9px", fontWeight: 800, color: "#ef4444", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "5px", padding: "1.5px 7px", alignSelf: "flex-start" }}>KELMAGAN</span>
                    )}
                  </div>

                  {/* ── Subjects + mid inserted ── */}
                  {(() => {
                    const cells: React.ReactNode[] = [];
                    s.subjects.forEach((subj, si) => {
                      cells.push(<SubjectCell key={`${i}-s${si}`} subject={subj} is911={is911} isThird={si === 2} />);
                      if (si === midAfter - 1) {
                        /* O'rtacha bal */
                        cells.push(
                          <div key={`${i}-mid`} style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "12px 8px", borderRight: "1px solid rgba(203, 213, 225, 0.55)" }}>
                            <span style={{ fontSize: "18px", fontWeight: 800, color: absent ? "#94a3b8" : "#334155" }}>{s.midScore}</span>
                          </div>,
                        );
                      }
                    });
                    return cells;
                  })()}

                  {/* ── Discipline ── */}
                  <DisciplineCell discipline={s.discipline} />

                  {/* ── JAMI (solid column) ── */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: tc.bg,
                      height: "100%",
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "19px",
                        fontWeight: 900,
                        color: "#ffffff",
                      }}
                    >
                      {s.totalText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "16px 28px 16px", borderTop: "1px solid rgba(226, 232, 240, 0.7)", background: "rgba(251, 253, 254, 0.6)", borderRadius: "0 0 22px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "#475569", fontWeight: 600 }}>
            {/* Left side: Intizom legend mapping */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
              <span style={{ fontWeight: 800, color: "#1e293b", fontSize: "11px", letterSpacing: "0.02em" }}>INTIZOM:</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "18px", height: "18px", borderRadius: "50%", background: "rgba(14, 114, 105, 0.08)", border: "1px solid rgba(14, 114, 105, 0.25)", fontSize: "10px", fontWeight: 800, color: "#0e7269" }}>D</span>
                <span style={{ fontSize: "11px", color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>Davomat</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "18px", height: "18px", borderRadius: "50%", background: "rgba(14, 114, 105, 0.08)", border: "1px solid rgba(14, 114, 105, 0.25)", fontSize: "10px", fontWeight: 800, color: "#0e7269" }}>K</span>
                <span style={{ fontSize: "11px", color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>Kech qolmaslik</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "18px", height: "18px", borderRadius: "50%", background: "rgba(14, 114, 105, 0.08)", border: "1px solid rgba(14, 114, 105, 0.25)", fontSize: "10px", fontWeight: 800, color: "#0e7269" }}>V</span>
                <span style={{ fontSize: "11px", color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>Uyga vazifa</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "18px", height: "18px", borderRadius: "50%", background: "rgba(14, 114, 105, 0.08)", border: "1px solid rgba(14, 114, 105, 0.25)", fontSize: "10px", fontWeight: 800, color: "#0e7269" }}>O</span>
                <span style={{ fontSize: "11px", color: "#475569", fontWeight: 600, whiteSpace: "nowrap" }}>Odob-axloq</span>
              </span>
            </div>

            {/* Right side: JAMI formula badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "rgba(14, 114, 105, 0.06)",
                border: "1px solid rgba(14, 114, 105, 0.16)",
                borderRadius: "8px",
                padding: "5px 12px",
                fontSize: "10px",
                color: "#0e7269",
                fontWeight: 700,
                letterSpacing: "0.02em",
                boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.5)",
                whiteSpace: "nowrap",
              }}
            >
              {is911
                ? "JAMI ball = Imtihon + Intizom"
                : "JAMI ball = (Ingliz + Matematika) / 2 + 3-fan + Intizom"}
            </div>
          </div>
          <div style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: 600, marginTop: "10px", textAlign: "right" }}>
            Al-Xorazmiy School · {activeClass} sinf · {date}
          </div>
        </div>
      </div>
    </div>
  );
}
