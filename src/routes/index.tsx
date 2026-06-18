import { createFileRoute } from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import { useMemo, useRef, useState, useEffect, type ChangeEvent, type Ref } from "react";
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
  History,
  Trash2,
  LogIn,
  LogOut,
  CloudUpload,
  Check,
  Filter,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { NormalizedStudent, RatingWorkbook, SubjectResult, Tone } from "@/lib/rating-types";
import logo from "@/assets/al-xorazmiy-logo.png";
import { useAuth } from "@/lib/auth-context";
import { AuthForm } from "@/components/AuthForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  saveReport,
  listReports,
  loadReport,
  deleteReport,
  type ReportMeta,
} from "@/lib/firestore-service";

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

/** Correctness ratio (correct/totalQ, falling back to percent). */
const subjectRatio = (s: SubjectResult): number | null =>
  s.correct !== null ? s.correct / s.totalQuestions : s.percent !== null ? s.percent / 100 : null;

/** A subject is in the "red zone" when the student sat it but scored below 50% correct. */
const isRedZone = (s: SubjectResult): boolean => {
  if (!s.present) return false;
  const ratio = subjectRatio(s);
  return ratio !== null && ratio < 0.5;
};

/** First letter upper, rest lower (uz locale). "INGLIZ TILI" → "Ingliz tili". */
const titleCase = (s: string) =>
  s ? s.charAt(0).toLocaleUpperCase("uz-UZ") + s.slice(1).toLocaleLowerCase("uz-UZ") : s;

/** Priority for red-zone sorting: English, Math, 3-fan, others. */
const subjectOrder = (group: string) => {
  const g = group.toUpperCase();
  if (g.includes("INGLIZ")) return 1;
  if (g.includes("MATEMATIKA") || g.includes("MATEM")) return 2;
  if (g.includes("3-FAN") || g.includes("3-BLOK")) return 3;
  return 4;
};

interface RedRow {
  name: string;
  className: string;
  group: string; // section header (subject, uppercase)
  fan: string; // FAN cell label
  teacher?: string; // USTOZ (5-8)
  blok?: string; // BLOK (9-11)
  correct: number | null;
  natija: string; // "47%" or "18.6%"
}

/** Build red-zone rows for one sheet kind, grouped by subject. */
function buildRedRows(students: NormalizedStudent[], kind: "5-8" | "9-11"): RedRow[] {
  const rows: RedRow[] = [];
  for (const st of students) {
    if (st.kind !== kind) continue;
    for (const sub of st.subjects) {
      if (!isRedZone(sub)) continue;
      if (kind === "5-8") {
        rows.push({
          name: st.name,
          className: st.className,
          group: sub.label,
          fan: titleCase(sub.label),
          teacher: sub.teacher,
          correct: sub.correct,
          natija: sub.resultText,
        });
      } else {
        const fan = sub.subjectName?.trim() || sub.label;
        rows.push({
          name: st.name,
          className: st.className,
          group: fan.toLocaleUpperCase("uz-UZ"),
          fan: titleCase(fan),
          blok: sub.label.toLocaleLowerCase("uz-UZ"),
          correct: sub.correct,
          natija: sub.resultText.endsWith("%") ? sub.resultText : `${sub.resultText}%`,
        });
      }
    }
  }
  // Group by priority, then alphabetically; within a group sort by class then name.
  return rows.sort(
    (a, b) =>
      subjectOrder(a.group) - subjectOrder(b.group) ||
      a.group.localeCompare(b.group, "uz") ||
      classSort(a.className, b.className) ||
      a.name.localeCompare(b.name, "uz"),
  );
}

const TONE: Record<Tone, { bg: string; border: string; fg: string; sub: string; bar: string }> = {
  high: { bg: "#e9f9f0", border: "#b6ebcf", fg: "#047857", sub: "#0f9d6b", bar: "#16a34a" },
  mid: { bg: "#fff5e6", border: "#ffdfb0", fg: "#b45309", sub: "#c97a10", bar: "#f59e0b" },
  low: { bg: "#fdeeee", border: "#f6c9c9", fg: "#c0392b", sub: "#d65a4a", bar: "#ef4444" },
  none: { bg: "#f1f5f9", border: "#e2e8f0", fg: "#94a3b8", sub: "#b4bfcc", bar: "#cbd5e1" },
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
    teacher: /ingliz/i.test(label)
      ? "Raximova Nigora"
      : /matem/i.test(label)
        ? "Yodgorov Axmadjon"
        : "Salohiddionov Otabek",
    percent,
    resultText: present ? `${percent}%` : "—",
    correct,
    totalQuestions: /3-fan/i.test(label) ? 10 : 15,
    score,
    level: present ? level : undefined,
    tone: !present
      ? "none"
      : percent >= 60
        ? "high"
        : percent >= 34
          ? "mid"
          : percent > 0
            ? "low"
            : "none",
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
    const avg =
      Math.round((((Number(subs[0].score) || 0) + (Number(subs[1].score) || 0)) / 2) * 100) / 100;
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
  const students: NormalizedStudent[] = [
    mk(
      "Hoshimboyev Muhammadqodir",
      "500",
      [
        sub("INGLIZ TILI", 87, 13, "4.5", true, "2"),
        sub("MATEMATIKA", 67, 10, "5.5", true, "4"),
        sub("3-FAN", 20, 2, "1"),
      ],
      [1, 1, 1, null],
    ),
    mk(
      "Maxmudullayev Xondamir",
      "501",
      [
        sub("INGLIZ TILI", 40, 6, "1.5", true, "2"),
        sub("MATEMATIKA", 53, 8, "5", true, "4"),
        sub("3-FAN", 50, 5, "2"),
      ],
      [0, 1, 1, null],
    ),
    mk(
      "Uraimov O'tkirbek",
      "502",
      [
        sub("INGLIZ TILI", 0, null, "0", false),
        sub("MATEMATIKA", 0, null, "0", false),
        sub("3-FAN", 0, null, "0", false),
      ],
      [0, 0, 0, null],
      "absent",
    ),
    mk(
      "Risqiddinov Sarvarbek",
      "503",
      [
        sub("INGLIZ TILI", 60, 9, "3.5", true, "2"),
        sub("MATEMATIKA", 73, 11, "5", true, "3"),
        sub("3-FAN", 10, 1, "1"),
      ],
      [1, 1, 1, null],
    ),
    mk(
      "Rahimov Muhammadqodir",
      "504",
      [
        sub("INGLIZ TILI", 27, 4, "1.5", true, "1"),
        sub("MATEMATIKA", 40, 6, "1.5", true, "2"),
        sub("3-FAN", 30, 3, "1.5"),
      ],
      [1, 1, 1, null],
    ),
    mk(
      "Lochinboyeva Bibixonim",
      "505",
      [
        sub("INGLIZ TILI", 7, 1, "1", true, "1"),
        sub("MATEMATIKA", 33, 5, "1.5", true, "2"),
        sub("3-FAN", 0, null, "0", false),
      ],
      [1, 1, 1, null],
    ),
    mk(
      "Tojiboyev Ubaydullo",
      "506",
      [
        sub("INGLIZ TILI", 87, 13, "6.5", true, "4"),
        sub("MATEMATIKA", 27, 4, "1.5", true, "5"),
        sub("3-FAN", 60, 6, "2.5"),
      ],
      [1, 1, 1, null],
    ),
    mk(
      "Nematov Nurmuhammad",
      "507",
      [
        sub("INGLIZ TILI", 67, 10, "3.5", true, "2"),
        sub("MATEMATIKA", 40, 6, "1.5", true, "3"),
        sub("3-FAN", 50, 5, "2"),
      ],
      [1, 0, 1, null],
    ),
    mk(
      "Ismoilova Madina",
      "508",
      [
        sub("INGLIZ TILI", 80, 12, "4.5", true, "2"),
        sub("MATEMATIKA", 100, 15, "4", true, "1"),
        sub("3-FAN", 50, 5, "2"),
      ],
      [1, 1, 1, null],
    ),
    mk(
      "Rahmatullayeva Madina",
      "509",
      [
        sub("INGLIZ TILI", 0, null, "0", false),
        sub("MATEMATIKA", 0, null, "0", false),
        sub("3-FAN", 0, null, "0", false),
      ],
      [0, 1, 1, null],
      "absent",
    ),
    mk(
      "Kamoliddinov Abdulaziz",
      "510",
      [
        sub("INGLIZ TILI", 73, 11, "5", true, "3"),
        sub("MATEMATIKA", 47, 7, "1.5", true, "5"),
        sub("3-FAN", 40, 4, "1.5"),
      ],
      [1, 1, 1, null],
    ),
    mk(
      "Masalixanov Muhammadziyo",
      "511",
      [
        sub("INGLIZ TILI", 73, 11, "6", true, "4"),
        sub("MATEMATIKA", 53, 8, "5", true, "4"),
        sub("3-FAN", 30, 3, "1.5"),
      ],
      [1, 1, 1, null],
    ),
    mk(
      "Lukmonjonov Asrorbek",
      "512",
      [
        sub("INGLIZ TILI", 20, 3, "1", true, "5"),
        sub("MATEMATIKA", 53, 8, "4", true, "3"),
        sub("3-FAN", 50, 5, "2"),
      ],
      [1, 1, 1, null],
    ),
    mk(
      "Iminjonova Sarvinoz",
      "513",
      [
        sub("INGLIZ TILI", 0, null, "0", false),
        sub("MATEMATIKA", 0, null, "0", false),
        sub("3-FAN", 0, null, "0", false),
      ],
      [0, 0, 0, null],
      "absent",
    ),
  ];
  return { fileName: "5A-13.06.2026.xlsx", date: "13.06.2026", students };
}

/* ─── Main Dashboard ───────────────────────────────────────────── */
function RatingDashboard() {
  const { user, signOut } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [workbook, setWorkbook] = useState<RatingWorkbook>();
  const [activeClass, setActiveClass] = useState("all");
  const [thirdSubjects, setThirdSubjects] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [savedReports, setSavedReports] = useState<ReportMeta[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  /* Load saved reports list when user logs in */
  useEffect(() => {
    if (!user) {
      setSavedReports([]);
      return;
    }
    listReports(user.uid)
      .then(setSavedReports)
      .catch(() => {
        /* Firestore API hali yoqilmagan bo'lishi mumkin */
      });
  }, [user]);

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

  const redZoneCount = useMemo(
    () =>
      (workbook?.students ?? []).reduce((acc, s) => acc + s.subjects.filter(isRedZone).length, 0),
    [workbook],
  );

  async function processFile(file: File) {
    setBusy("upload");
    setError("");
    setSaveState("idle");
    try {
      const tools = await loadWorkbookTools();
      if (!tools) return;
      const parsed = await tools.parseRatingWorkbook(file);
      setWorkbook(parsed);
      setActiveClass("all");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Excel faylini o'qib bo'lmadi.");
    } finally {
      setBusy(undefined);
    }
  }

  async function saveToCloud() {
    if (!workbook || !user) return;
    setBusy("save");
    setSaveState("idle");
    setError("");
    try {
      await saveReport(user.uid, workbook);
      const list = await listReports(user.uid);
      setSavedReports(list);
      setSaveState("saved");
    } catch {
      setError("Bazaga saqlab bo'lmadi. Internetni tekshiring va qayta urining.");
      setSaveState("idle");
    } finally {
      setBusy(undefined);
    }
  }

  async function openSavedReport(dateIso: string) {
    if (!user) return;
    setBusy("load");
    try {
      const wb = await loadReport(user.uid, dateIso);
      if (wb) {
        setWorkbook(wb);
        setActiveClass("all");
        setShowHistory(false);
      }
    } finally {
      setBusy(undefined);
    }
  }

  async function removeSavedReport(dateIso: string) {
    if (!user) return;
    await deleteReport(user.uid, dateIso).catch(() => {});
    setSavedReports((prev) => prev.filter((r) => r.id !== dateIso));
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
          filter: (node) => !(node instanceof HTMLElement && node.classList.contains("no-print")),
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: "none",
            margin: "0",
          },
        });
        const prefix = activeClass === "red" ? "Qizil-Hudud" : activeClass;
        Object.assign(document.createElement("a"), {
          download: `${prefix}-${workbook?.date}.png`,
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
          pixelRatio: 3,
          cacheBust: true,
          skipFonts: true,
          backgroundColor: "#eef2f7",
          filter: (node) => !(node instanceof HTMLElement && node.classList.contains("no-print")),
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: "none",
            margin: "0",
          },
        });
        const props = await new Promise<HTMLImageElement>((res) => {
          const i = new Image();
          i.onload = () => res(i);
          i.src = image;
        });
        // Pick the orientation that lets the report fill the page (best quality), then contain-fit.
        const ratio = props.width / props.height;
        const orientation = ratio >= 1 ? "landscape" : "portrait";
        const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
        const pageW = orientation === "landscape" ? 297 : 210;
        const pageH = orientation === "landscape" ? 210 : 297;
        const margin = 8;
        const availW = pageW - margin * 2;
        const availH = pageH - margin * 2;
        let w = availW;
        let h = w / ratio;
        if (h > availH) {
          h = availH;
          w = h * ratio;
        }
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;
        pdf.addImage(image, "PNG", x, y, w, h, undefined, "SLOW");
        const prefix = activeClass === "red" ? "Qizil-Hudud" : activeClass;
        pdf.save(`${prefix}-${workbook?.date}.pdf`);
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
      <ErrorBoundary onReset={() => setError("")}>
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
          user={user}
          savedReports={savedReports}
          onOpenReport={openSavedReport}
          onDeleteReport={removeSavedReport}
          onSignOut={signOut}
          busyLoad={busy === "load"}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary onReset={() => setWorkbook(undefined)}>
      <main className="min-h-screen bg-dash-bg">
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept=".xlsx,.xls"
          onChange={upload}
        />

        <header className="no-print sticky top-0 z-30 border-b border-dash-border bg-dash-surface/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[1840px] items-center gap-3 px-4 lg:px-6">
            <img src={logo} alt="Al-Xorazmiy School" className="h-8 w-auto object-contain" />
            <div className="mx-3 h-5 w-px bg-dash-border" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-semibold text-dash-muted">
                {workbook.fileName}
              </span>
              <span className="text-[11px] text-dash-muted/70">
                {workbook.date} · {workbook.students.length} o'quvchi
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {user ? (
                <Button
                  size="sm"
                  className={
                    saveState === "saved" ? "bg-emerald-600 text-white hover:bg-emerald-600" : ""
                  }
                  onClick={saveToCloud}
                  disabled={Boolean(busy)}
                >
                  {busy === "save" ? (
                    <LoaderCircle className="animate-spin" />
                  ) : saveState === "saved" ? (
                    <Check />
                  ) : (
                    <CloudUpload />
                  )}
                  <span className="hidden sm:inline">
                    {saveState === "saved" ? "Saqlandi" : "Bazaga saqlash"}
                  </span>
                </Button>
              ) : null}
              {user && savedReports.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="dash-btn-outline"
                  onClick={() => setShowHistory((v) => !v)}
                >
                  <History />
                  <span className="hidden sm:inline">Tarix</span>
                </Button>
              )}
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
              {user ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-dash-muted"
                  onClick={signOut}
                  title="Chiqish"
                >
                  <LogOut className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        {/* History dropdown panel */}
        {showHistory && user && savedReports.length > 0 && (
          <div className="no-print border-b border-dash-border bg-dash-surface/95 backdrop-blur-md">
            <div className="mx-auto max-w-[1840px] px-4 py-3 lg:px-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-dash-muted">
                Saqlangan hisobotlar
              </p>
              <div className="flex flex-wrap gap-2">
                {savedReports.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-lg border border-dash-border bg-card px-3 py-1.5 text-sm shadow-sm"
                  >
                    <button
                      className="font-semibold text-primary hover:underline"
                      onClick={() => openSavedReport(r.id)}
                      disabled={busy === "load"}
                    >
                      {r.date}
                    </button>
                    <span className="text-xs text-dash-muted">{r.studentCount} o'q</span>
                    <button
                      className="ml-1 text-dash-muted/60 hover:text-destructive"
                      onClick={() => removeSavedReport(r.id)}
                      title="O'chirish"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-[1840px] px-4 pb-8 pt-5 lg:px-6">
          <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-primary" />
              <h1 className="text-lg font-extrabold tracking-tight">Haftalik reyting</h1>
              <span className="dash-badge">{workbook.date}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeClass !== "all" && activeClass !== "red" && (
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
            <button
              className={`class-tab ${activeClass === "red" ? "class-tab-active" : ""}`}
              onClick={() => setActiveClass("red")}
              style={activeClass === "red" ? undefined : { color: "#b91c1c" }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  background: "#dc2626",
                  display: "inline-block",
                }}
              />
              Qizil hudud
              <span className="class-tab-count">{redZoneCount}</span>
            </button>
          </nav>

          {activeClass === "all" ? (
            <Leaderboard students={students} />
          ) : activeClass === "red" ? (
            <RedZoneReport ref={reportRef} date={workbook.date} students={workbook.students} />
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
    </ErrorBoundary>
  );
}

/* ─── Red-zone report (below-50% students, grouped by subject) ──── */
function RedZoneReport({
  ref,
  date,
  students,
}: {
  ref: Ref<HTMLDivElement>;
  date: string;
  students: NormalizedStudent[];
}) {
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);

  const { allClasses, allSubjects, allTeachers } = useMemo(() => {
    const classes = new Set<string>();
    const subjects = new Set<string>();
    const teachers = new Set<string>();
    for (const st of students) {
      for (const sub of st.subjects) {
        if (isRedZone(sub)) {
          classes.add(st.className);
          subjects.add(titleCase(sub.subjectName?.trim() || sub.label));
          if (sub.teacher) {
            teachers.add(sub.teacher.trim());
          }
        }
      }
    }
    return {
      allClasses: Array.from(classes).sort(classSort),
      allSubjects: Array.from(subjects).sort(
        (a, b) => subjectOrder(a) - subjectOrder(b) || a.localeCompare(b, "uz"),
      ),
      allTeachers: Array.from(teachers).sort((a, b) => a.localeCompare(b, "uz")),
    };
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students
      .filter((st) => {
        const classMatch = selectedClasses.length === 0 || selectedClasses.includes(st.className);
        if (!classMatch) return false;

        const hasSelectedSubject = st.subjects.some((sub) => {
          if (!isRedZone(sub)) return false;
          const subName = titleCase(sub.subjectName?.trim() || sub.label);
          const teacherMatch = selectedTeachers.length === 0 || (sub.teacher && selectedTeachers.includes(sub.teacher.trim()));
          return (selectedSubjects.length === 0 || selectedSubjects.includes(subName)) && teacherMatch;
        });

        return hasSelectedSubject;
      })
      .map((st) => ({
        ...st,
        subjects: st.subjects.filter((sub) => {
          if (!isRedZone(sub)) return false;
          const subName = titleCase(sub.subjectName?.trim() || sub.label);
          const teacherMatch = selectedTeachers.length === 0 || (sub.teacher && selectedTeachers.includes(sub.teacher.trim()));
          return (selectedSubjects.length === 0 || selectedSubjects.includes(subName)) && teacherMatch;
        }),
      }));
  }, [students, selectedClasses, selectedSubjects, selectedTeachers]);

  const rows58 = useMemo(() => buildRedRows(filteredStudents, "5-8"), [filteredStudents]);
  const rows911 = useMemo(() => buildRedRows(filteredStudents, "9-11"), [filteredStudents]);

  const empty = rows58.length === 0 && rows911.length === 0;

  const toggleClass = (c: string) => {
    setSelectedClasses((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };
  const toggleSubject = (s: string) => {
    setSelectedSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };
  const toggleTeacher = (t: string) => {
    setSelectedTeachers((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  return (
    <div
      ref={ref}
      style={{
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        background: "#ffffff",
        padding: "0",
        width: "880px",
        boxSizing: "border-box",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "26px",
        borderRadius: "10px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(15,23,42,0.12)",
      }}
    >
      <div className="no-print flex flex-wrap items-center gap-3 border-b bg-dash-surface/50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
          <Filter className="size-4" />
          Filtrlar:
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              Sinflar
              {selectedClasses.length > 0 && (
                <Badge variant="secondary" className="px-1 py-0">
                  {selectedClasses.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Sinflarni tanlang</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allClasses.map((c) => (
              <DropdownMenuCheckboxItem
                key={c}
                checked={selectedClasses.includes(c)}
                onCheckedChange={() => toggleClass(c)}
                onSelect={(e) => e.preventDefault()}
              >
                {c}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              Fanlar
              {selectedSubjects.length > 0 && (
                <Badge variant="secondary" className="px-1 py-0">
                  {selectedSubjects.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Fanlarni tanlang</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allSubjects.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={selectedSubjects.includes(s)}
                onCheckedChange={() => toggleSubject(s)}
                onSelect={(e) => e.preventDefault()}
              >
                {titleCase(s)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              Ustozlar
              {selectedTeachers.length > 0 && (
                <Badge variant="secondary" className="px-1 py-0">
                  {selectedTeachers.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Ustozlarni tanlang</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allTeachers.map((t) => (
              <DropdownMenuCheckboxItem
                key={t}
                checked={selectedTeachers.includes(t)}
                onCheckedChange={() => toggleTeacher(t)}
                onSelect={(e) => e.preventDefault()}
              >
                {t}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {(selectedClasses.length > 0 || selectedSubjects.length > 0 || selectedTeachers.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSelectedClasses([]);
              setSelectedSubjects([]);
              setSelectedTeachers([]);
            }}
          >
            Tozalash
          </Button>
        )}
      </div>

      {empty ? (
        <div
          style={{
            padding: "48px",
            textAlign: "center",
            color: "#64748b",
            fontSize: "15px",
            fontWeight: 600,
          }}
        >
          {selectedClasses.length > 0 || selectedSubjects.length > 0 || selectedTeachers.length > 0
            ? "Tanlangan filtrlar bo'yicha ma'lumot topilmadi."
            : "Qizil hududga tushgan o'quvchilar yo'q. 🎉"}
        </div>
      ) : (
        <>
          {rows58.length > 0 && (
            <RedZoneTable
              title={`${date} — QIZIL HUDUDGA TUSHGAN O'QUVCHILAR (5–8-SINFLAR)`}
              rows={rows58}
              kind="5-8"
            />
          )}
          {rows911.length > 0 && (
            <RedZoneTable
              title={`${date} — QIZIL HUDUDGA TUSHGAN O'QUVCHILAR (9–11-SINFLAR)`}
              rows={rows911}
              kind="9-11"
            />
          )}
        </>
      )}
    </div>
  );
}

function RedZoneTable({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: RedRow[];
  kind: "5-8" | "9-11";
}) {
  const is58 = kind === "5-8";
  const GRID = is58
    ? "52px 1fr 64px 150px 210px 132px 86px"
    : "52px 1fr 64px 176px 104px 132px 86px";
  const headers = is58
    ? ["T/R", "FAMILIYA ISM", "SINF", "FAN", "USTOZ", "TO'G'RI JAVOB", "NATIJA"]
    : ["T/R", "FAMILIYA ISM", "SINF", "FAN", "BLOK", "TO'G'RI JAVOB", "NATIJA"];

  const cell: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    fontSize: "12.5px",
    color: "#1e293b",
    borderRight: "1px solid #e2e8f0",
    boxSizing: "border-box",
    minWidth: 0,
  };
  const hCell: React.CSSProperties = {
    ...cell,
    color: "#e2e8f0",
    fontWeight: 800,
    fontSize: "11px",
    letterSpacing: "0.04em",
    borderRight: "1px solid rgba(255,255,255,0.12)",
    textTransform: "uppercase",
  };

  // Render rows with group headers interleaved; T/R continuous.
  const out: React.ReactNode[] = [];
  let lastGroup = "";
  let tr = 0;
  rows.forEach((r, i) => {
    if (r.group !== lastGroup) {
      lastGroup = r.group;
      out.push(
        <div
          key={`g-${r.group}-${i}`}
          style={{
            gridColumn: "1 / -1",
            background: "#334155",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: "12px",
            letterSpacing: "0.06em",
            padding: "8px 14px",
            borderTop: "1px solid #1e293b",
          }}
        >
          {r.group}
        </div>,
      );
    }
    tr += 1;
    const zebra = tr % 2 === 0 ? "#f8fafc" : "#ffffff";
    const fifth = is58 ? (r.teacher ?? "—") : (r.blok ?? "—");
    out.push(
      <div
        key={`tr-${i}`}
        style={{
          ...cell,
          justifyContent: "center",
          background: zebra,
          color: "#64748b",
          fontWeight: 700,
        }}
      >
        {tr}
      </div>,
      <div key={`nm-${i}`} style={{ ...cell, background: zebra, fontWeight: 600 }}>
        {r.name}
      </div>,
      <div
        key={`cl-${i}`}
        style={{ ...cell, justifyContent: "center", background: zebra, fontWeight: 700 }}
      >
        {r.className}
      </div>,
      <div key={`fn-${i}`} style={{ ...cell, background: zebra }}>
        {r.fan}
      </div>,
      <div key={`f5-${i}`} style={{ ...cell, background: zebra, color: "#475569" }}>
        {fifth}
      </div>,
      <div
        key={`co-${i}`}
        style={{ ...cell, justifyContent: "center", background: zebra, fontWeight: 700 }}
      >
        {r.correct ?? "—"}
      </div>,
      <div
        key={`nt-${i}`}
        style={{
          ...cell,
          justifyContent: "center",
          background: zebra,
          fontWeight: 800,
          color: "#b91c1c",
          borderRight: "none",
        }}
      >
        {r.natija}
      </div>,
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Title bar */}
      <div
        style={{
          background: "#1e293b",
          color: "#ffffff",
          fontWeight: 800,
          fontSize: "14px",
          letterSpacing: "0.02em",
          padding: "12px 16px",
        }}
      >
        {title}
      </div>
      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: GRID, background: "#475569" }}>
        {headers.map((h, i) => (
          <div
            key={h}
            style={{
              ...hCell,
              borderRight: i === headers.length - 1 ? "none" : hCell.borderRight,
              justifyContent: i === 0 || i === 2 || i >= 5 ? "center" : "flex-start",
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {/* Body */}
      <div
        style={{ display: "grid", gridTemplateColumns: GRID, borderBottom: "1px solid #e2e8f0" }}
      >
        {out}
      </div>
    </div>
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
  user,
  savedReports,
  onOpenReport,
  onDeleteReport,
  onSignOut,
  busyLoad,
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
  user: import("firebase/auth").User | null;
  savedReports: ReportMeta[];
  onOpenReport: (dateIso: string) => void;
  onDeleteReport: (dateIso: string) => void;
  onSignOut: () => void;
  busyLoad: boolean;
}) {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="upload-bg flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".xlsx,.xls"
        onChange={onFileChange}
      />

      {/* Top-right: auth status */}
      <div className="fixed right-4 top-4 z-20 flex items-center gap-2">
        {user ? (
          <>
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1 rounded-lg border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              Chiqish
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowAuth((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur-sm hover:bg-card"
          >
            <LogIn className="size-3.5" />
            Kirish
          </button>
        )}
      </div>

      <img
        src={logo}
        alt="Al-Xorazmiy School"
        className="mb-8 h-16 w-auto object-contain opacity-90"
      />

      {/* Auth form (toggle) */}
      {!user && showAuth && (
        <div className="mb-6 w-full max-w-sm">
          <AuthForm />
        </div>
      )}

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

      {/* Saved reports history */}
      {user && savedReports.length > 0 && (
        <div className="mt-8 w-full max-w-sm">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <History className="size-3.5" />
            Saqlangan hisobotlar
          </p>
          <div className="flex flex-col gap-2">
            {savedReports.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card/80 px-4 py-2.5 shadow-sm backdrop-blur-sm"
              >
                <button
                  className="flex flex-col items-start gap-0.5 text-left"
                  onClick={() => onOpenReport(r.id)}
                  disabled={busyLoad}
                >
                  <span className="text-sm font-bold text-primary hover:underline">{r.date}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.studentCount} o'quvchi · {r.fileName}
                  </span>
                </button>
                <button
                  className="ml-3 text-muted-foreground/50 hover:text-destructive"
                  onClick={() => onDeleteReport(r.id)}
                  title="O'chirish"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                background:
                  i === 0 ? "#fef3c7" : i === 1 ? "#f1f5f9" : i === 2 ? "#ffedd5" : "#f8fafc",
                color: i === 0 ? "#b45309" : i === 1 ? "#475569" : i === 2 ? "#c2410c" : "#64748b",
                border: `1.5px solid ${i === 0 ? "#fbbf24" : i === 1 ? "#cbd5e1" : i === 2 ? "#fdba74" : "#e2e8f0"}`,
              }}
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {s.name}
              {s.studentId ? (
                <span className="ml-1.5 text-[11px] font-normal text-dash-muted">
                  #{s.studentId}
                </span>
              ) : null}
            </span>
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
              {s.className}
            </span>
            <span className="w-10 text-right text-sm font-extrabold text-foreground">
              {s.totalText}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* JAMI cell — gradient colour by standing. */
const TOTAL_COLOR: Record<Tone, { bg: string; fg: string; border: string }> = {
  high: {
    bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    fg: "#ffffff",
    border: "#047857",
  },
  mid: {
    bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    fg: "#ffffff",
    border: "#b45309",
  },
  low: {
    bg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    fg: "#ffffff",
    border: "#b91c1c",
  },
  none: {
    bg: "linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)",
    fg: "#ffffff",
    border: "#475569",
  },
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "7px 10px",
          background:
            "linear-gradient(180deg, rgba(254, 245, 207, 0.9) 0%, rgba(253, 234, 170, 0.62) 100%)",
          borderRight: "1px solid rgba(203, 213, 225, 0.45)",
          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.6)",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            fontSize: "9.5px",
            fontWeight: 700,
            color: "#b45309",
            background: "rgba(255, 251, 235, 0.85)",
            border: "1px solid #fde68a",
            borderRadius: "5px",
            padding: "4px 8px",
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          ⚠ ID xato kiritilgan
        </span>
      </div>
    );
  }

  /* Absent */
  if (!subject.present) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "7px 10px",
          background:
            "linear-gradient(180deg, rgba(248, 250, 252, 0.85) 0%, rgba(238, 242, 247, 0.55) 100%)",
          borderRight: "1px solid rgba(203, 213, 225, 0.45)",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        <span style={{ fontSize: "15px", fontWeight: 700, color: "#94a3b8" }}>—</span>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: "rgba(148, 163, 184, 0.85)",
            marginTop: "1px",
          }}
        >
          kirmagan
        </span>
      </div>
    );
  }

  const ratio = is911
    ? subject.correct !== null
      ? Math.min(1, subject.correct / subject.totalQuestions)
      : 0
    : subject.percent !== null
      ? Math.min(1, subject.percent / 100)
      : 0;
  const barWidth = Math.round(ratio * 100);
  const barColor =
    subject.tone === "high"
      ? "#22c55e"
      : subject.tone === "mid"
        ? "#f59e0b"
        : subject.tone === "low"
          ? "#ef4444"
          : "#cbd5e1";

  /* Per-subject bal. 5-8 carries it in `score`; 9-11 derives it as result / 10. */
  const balText = subject.score
    ? subject.score
    : is911 && subject.resultText && subject.resultText !== "\u2014"
      ? (() => {
          const n = parseFloat(subject.resultText.replace(",", "."));
          return Number.isFinite(n) ? String(Math.round((n / 10) * 100) / 100) : "";
        })()
      : "";

  /* Glass cell tints \u2014 light sheen on top fading into the tone colour. */
  const cellBg =
    subject.tone === "high"
      ? "linear-gradient(180deg, rgba(222, 252, 236, 0.92) 0%, rgba(205, 247, 225, 0.62) 100%)"
      : subject.tone === "mid"
        ? "linear-gradient(180deg, rgba(255, 247, 224, 0.92) 0%, rgba(253, 238, 190, 0.62) 100%)"
        : subject.tone === "low"
          ? "linear-gradient(180deg, rgba(255, 233, 233, 0.92) 0%, rgba(253, 219, 219, 0.62) 100%)"
          : "transparent";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "7px 10px",
        background: cellBg,
        borderRight: "1px solid rgba(203, 213, 225, 0.45)",
        boxShadow: subject.tone === "none" ? "none" : "inset 0 1px 0 rgba(255, 255, 255, 0.6)",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Line 1: left=fraction (secondary) | center=percent (primary) | right=score bal (secondary) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          gap: "4px",
        }}
      >
        {subject.correct !== null ? (
          <span style={{ fontSize: "9px", fontWeight: 600, color: "rgba(100, 116, 139, 0.7)" }}>
            {subject.correct} / {subject.totalQuestions}
          </span>
        ) : (
          <span />
        )}
        <span style={{ fontSize: "18px", fontWeight: 900, color: t.fg, letterSpacing: "-0.01em" }}>
          {subject.resultText}
        </span>
        {balText ? (
          <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(71, 85, 105, 0.78)" }}>
            {balText} bal
          </span>
        ) : (
          <span />
        )}
      </div>

      {/* Line 2: progress bar \u2014 glassy track + glossy fill */}
      <div
        style={{
          width: "100%",
          height: "4px",
          borderRadius: "9999px",
          background: "rgba(15, 23, 42, 0.07)",
          overflow: "hidden",
          marginTop: "5px",
          boxShadow: "inset 0 1px 1px rgba(15, 23, 42, 0.07)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${barWidth}%`,
            background: `linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 55%), ${barColor}`,
            borderRadius: "9999px",
          }}
        />
      </div>

      {/* Line 3: level badge (5-8 only; empty placeholder on 3rd subject for uniformity) \u2014 secondary, dim */}
      {!is911 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            alignSelf: "center",
            fontSize: "8px",
            fontWeight: 700,
            color: isThird || !subject.level ? "transparent" : "rgba(71, 85, 105, 0.78)",
            background:
              isThird || !subject.level ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.55)",
            border:
              isThird || !subject.level
                ? "1px dashed rgba(203, 213, 225, 0.45)"
                : "1px solid rgba(255, 255, 255, 0.8)",
            boxShadow:
              isThird || !subject.level ? "none" : "inset 0 1px 0 rgba(255, 255, 255, 0.7)",
            borderRadius: "5px",
            padding: "1px 5px",
            marginTop: "4px",
            gap: "3px",
            minHeight: "13px",
            width: isThird || !subject.level ? "40px" : "auto",
            boxSizing: "border-box",
          }}
        >
          {!(isThird || !subject.level) && (
            <span
              style={{
                display: "inline-block",
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                background: "#0d9488",
              }}
            />
          )}
          {isThird || !subject.level ? "\u00A0" : `${subject.level}-etap`}
        </span>
      )}

      {/* Line 3 (9-11): the student's actual subject name for this block \u2014 secondary, dim */}
      {is911 && (
        <span
          style={{
            display: "inline-block",
            alignSelf: "center",
            maxWidth: "100%",
            fontSize: "8px",
            fontWeight: 700,
            letterSpacing: "0.01em",
            textAlign: "center",
            color: subject.subjectName ? "rgba(71, 85, 105, 0.8)" : "transparent",
            background: subject.subjectName
              ? "rgba(255, 255, 255, 0.55)"
              : "rgba(255, 255, 255, 0.2)",
            border: subject.subjectName
              ? "1px solid rgba(255, 255, 255, 0.8)"
              : "1px dashed rgba(203, 213, 225, 0.45)",
            boxShadow: subject.subjectName ? "inset 0 1px 0 rgba(255, 255, 255, 0.7)" : "none",
            borderRadius: "5px",
            padding: "0.5px 6px",
            marginTop: "5px",
            minHeight: "12px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxSizing: "border-box",
          }}
        >
          {subject.subjectName || "\u00A0"}
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
    return {
      bg: "rgba(241, 245, 249, 0.5)",
      border: "rgba(203, 213, 225, 0.5)",
      fg: "rgba(148, 163, 184, 0.8)",
      isDashed: true,
    };
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
function DisciplineCell({ discipline }: { discipline: NormalizedStudent["discipline"] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: "7px",
        padding: "6px 8px",
        borderRight: "1px solid rgba(203, 213, 225, 0.45)",
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
              background: d.empty
                ? "rgba(241, 245, 249, 0.45)"
                : `linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0) 60%), ${colors.bg}`,
              border: `1px solid ${d.empty ? "rgba(221, 229, 238, 0.6)" : colors.border}`,
              color: d.empty ? "rgba(203, 213, 225, 0.8)" : colors.fg,
              boxShadow: d.empty
                ? "none"
                : "inset 0 1px 1px rgba(255, 255, 255, 0.6), 0 1px 3px rgba(0, 0, 0, 0.04)",
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
    return students.filter((s) => s.status !== "absent" && s.total > 0).map((s) => s.total);
  }, [students]);

  const maxTotal = useMemo(
    () => (activeTotals.length > 0 ? Math.max(...activeTotals) : 1),
    [activeTotals],
  );
  const minTotal = useMemo(
    () => (activeTotals.length > 0 ? Math.min(...activeTotals) : 0),
    [activeTotals],
  );

  /* Score place by distinct JAMI (dense ranking): equal totals share a place,
     so tied students get the same medal. The visible № column stays sequential. */
  const scorePlaces = useMemo(() => {
    const distinct = [...new Set(activeTotals)].sort((a, b) => b - a);
    return new Map(distinct.map((total, idx) => [total, idx + 1]));
  }, [activeTotals]);

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
  const hasWrongId = students.some(
    (s) => s.status === "wrong-id" || s.subjects.some((x) => x.idError),
  );

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
    fontSize: "13.5px",
    fontWeight: 900,
    color: "#ffffff",
    letterSpacing: "0.05em",
    padding: "12px 8px",
    textAlign: "center",
    borderRight: "1px solid rgba(255, 255, 255, 0.12)",
    boxSizing: "border-box",
  };

  return (
    <div
      ref={ref}
      style={{
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
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
          background:
            "radial-gradient(circle, rgba(20, 184, 166, 0.13) 0%, rgba(20, 184, 166, 0) 70%)",
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
          background:
            "radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0) 70%)",
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
          background:
            "radial-gradient(circle, rgba(244, 63, 94, 0.07) 0%, rgba(244, 63, 94, 0) 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          background: "rgba(255, 255, 255, 0.94)",
          borderRadius: "22px",
          boxShadow: "0 24px 60px rgba(15, 42, 60, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
          border: "1px solid rgba(255, 255, 255, 0.6)",
          overflow: "hidden",
          width: "1278px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ── Top brand header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "30px 36px",
            background: "linear-gradient(135deg, #0a544e 0%, #0e7269 100%)",
            color: "#ffffff",
            borderRadius: "22px 22px 0 0",
            flexWrap: "nowrap",
          }}
        >
          {/* Left cluster: logo · divider · titles */}
          <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "56px",
                width: "56px",
                borderRadius: "14px",
                background: "#ffffff",
                boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
                flexShrink: 0,
              }}
            >
              <img
                src={logo}
                alt="Al-Xorazmiy"
                style={{ height: "44px", width: "44px", objectFit: "contain" }}
              />
            </div>
            <div
              style={{
                width: "1px",
                height: "48px",
                background: "rgba(255,255,255,0.16)",
                margin: "0 24px",
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                <span
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 700,
                    letterSpacing: "0.26em",
                    color: "#f6d98a",
                  }}
                >
                  AL-XORAZMIY SCHOOL
                </span>
                <span
                  style={{
                    width: "3px",
                    height: "3px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.3)",
                    margin: "0 10px",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "9.5px",
                    fontWeight: 600,
                    letterSpacing: "0.13em",
                    color: "rgba(255, 255, 255, 0.55)",
                  }}
                >
                  HAFTALIK REYTING TIZIMI
                </span>
              </div>
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  lineHeight: 1.12,
                  letterSpacing: "0.005em",
                  marginTop: "8px",
                  whiteSpace: "nowrap",
                }}
              >
                HAFTALIK JAMG'ARILGAN BALLAR
              </div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  color: "rgba(255, 255, 255, 0.6)",
                  marginTop: "9px",
                  whiteSpace: "nowrap",
                }}
              >
                {date}
              </div>
            </div>
          </div>
          {/* Right: class — minimal, boxless */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              flexShrink: 0,
              paddingLeft: "28px",
            }}
          >
            <span
              style={{
                fontSize: "46px",
                fontWeight: 800,
                lineHeight: 0.92,
                letterSpacing: "-0.015em",
                color: "#ffffff",
              }}
            >
              {activeClass}
            </span>
            <span
              style={{
                display: "block",
                width: "100%",
                height: "2px",
                borderRadius: "2px",
                background: "#f6d98a",
                opacity: 0.85,
                margin: "8px 0 6px",
              }}
            />
            <span
              style={{
                fontSize: "9.5px",
                fontWeight: 700,
                letterSpacing: "0.34em",
                color: "rgba(255, 255, 255, 0.6)",
              }}
            >
              SINF
            </span>
          </div>
        </div>

        {/* ── Legend ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "28px",
            flexWrap: "wrap",
            padding: "16px 28px",
            borderBottom: "1px solid rgba(226, 232, 240, 0.7)",
            fontSize: "12.5px",
            color: "#334155",
            fontWeight: 600,
            background: "rgba(250, 250, 250, 0.45)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "44px",
                height: "22px",
                borderRadius: "6px",
                background: "rgba(254, 243, 199, 0.75)",
                border: "1.5px solid #fde68a",
                display: "inline-block",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}
            />
            <span>
              O'quvchi ID raqamini{" "}
              <strong style={{ color: "#b45309", fontWeight: 800 }}>xato</strong> kiritgan
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "44px",
                height: "22px",
                borderRadius: "6px",
                background: "rgba(241, 245, 249, 0.7)",
                border: "1.5px solid #cbd5e1",
                display: "inline-block",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}
            />
            <span>
              O'quvchi imtihonda{" "}
              <strong style={{ color: "#475569", fontWeight: 800 }}>qatnashmagan</strong>
            </span>
          </span>
        </div>

        {/* ── Table area ── */}
        <div style={{ padding: "0 0 16px" }}>
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID_COLS,
              columnGap: "0px",
              borderBottom: "1px solid #0b5d56",
              background: "#0c5c54",
              padding: "0",
            }}
          >
            <div style={{ ...hdrCell, justifyContent: "center" }}>№</div>
            <div style={{ ...hdrCell, justifyContent: "flex-start", paddingLeft: "20px" }}>
              O'QUVCHI
            </div>
            {headerMains.map((l, idx) => {
              const blokBal = is911 ? ((["3.1", "2.1", "1.1", ""] as const)[idx] ?? "") : "";
              return (
                <div key={`h${idx}`} style={{ ...hdrCell, flexDirection: "column", gap: "4px" }}>
                  <span>{l}</span>
                  {blokBal && (
                    <span
                      style={{
                        fontSize: "9.5px",
                        fontWeight: 700,
                        color: "#f6d98a",
                        letterSpacing: "0.04em",
                        opacity: 0.9,
                      }}
                    >
                      {blokBal} bal
                    </span>
                  )}
                </div>
              );
            })}
            {/* INTIZOM header: title + D K V O circles */}
            <div
              style={{
                ...hdrCell,
                flexDirection: "column",
                gap: "6px",
                padding: "10px 4px",
                lineHeight: 1.15,
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: 900 }}>INTIZOM</span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "7px",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
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
              /* № column stays a plain sequence; it is never reordered or skipped. */
              const seq = i + 1;
              const absent = s.status === "absent";
              const wrongId = s.status === "wrong-id" || s.subjects.some((x) => x.idError);
              const tc = TOTAL_COLOR[totalTone(s.total)];

              /* Medal by JAMI place — equal totals share a place, so tied students
                 look identical (same colour) and nobody feels ranked lower. */
              const place = absent ? Infinity : (scorePlaces.get(s.total) ?? Infinity);
              const showBadge = place <= 3;
              const medal =
                place === 1 ? "#fbbf24" : place === 2 ? "#94a3b8" : place === 3 ? "#fb923c" : null;
              const rankBg = medal ? `${medal}18` : "transparent";
              const rankBorder = medal ?? "#d1d5db";
              const rankFg =
                place === 1
                  ? "#a16207"
                  : place === 2
                    ? "#475569"
                    : place === 3
                      ? "#c2410c"
                      : "#64748b";

              /* Row card border — slight accent for top 3 places */
              const cardBorder = absent
                ? "1px solid #e2e8f0"
                : wrongId
                  ? "1px solid #fde68a"
                  : place === 1
                    ? "1px solid #fde68a"
                    : place === 2
                      ? "1px solid #d1d5db"
                      : place === 3
                        ? "1px solid #fed7aa"
                        : "1px solid #e2e8f0";

              return (
                <div
                  key={`row-${i}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: GRID_COLS,
                    alignItems: "stretch",
                    borderBottom:
                      i === students.length - 1 ? "none" : "1px solid rgba(203, 213, 225, 0.5)",
                    background: absent
                      ? "rgba(241, 245, 249, 0.55)"
                      : i % 2 === 0
                        ? "rgba(255, 255, 255, 0.74)"
                        : "rgba(248, 250, 252, 0.5)",
                    height: is911 ? "70px" : "64px",
                  }}
                >
                  {/* ── Rank ── */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      padding: "6px 4px",
                      borderRight: "1px solid rgba(203, 213, 225, 0.45)",
                    }}
                  >
                    {showBadge ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "29px",
                          height: "29px",
                          borderRadius: "50%",
                          fontSize: "13px",
                          fontWeight: 900,
                          background: `linear-gradient(180deg, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0) 60%), ${rankBg}`,
                          border: `1.5px solid ${rankBorder}`,
                          color: rankFg,
                          boxShadow:
                            "inset 0 1px 1px rgba(255, 255, 255, 0.7), 0 1px 3px rgba(0, 0, 0, 0.05)",
                        }}
                      >
                        {seq}
                      </span>
                    ) : (
                      <span style={{ fontSize: "14px", fontWeight: 800, color: "#94a3b8" }}>
                        {seq}
                      </span>
                    )}
                  </div>

                  {/* ── Name + ID ── */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      padding: "6px 18px",
                      gap: "3px",
                      borderRight: "1px solid rgba(203, 213, 225, 0.45)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "nowrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13.5px",
                          fontWeight: 700,
                          color: absent ? "#94a3b8" : "#1e293b",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.name}
                      </span>
                      {s.studentId && (
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            color: "rgba(100, 116, 139, 0.85)",
                            background: "rgba(255, 255, 255, 0.5)",
                            border: "1px solid rgba(203, 213, 225, 0.6)",
                            borderRadius: "5px",
                            padding: "1.5px 6px",
                            whiteSpace: "nowrap",
                            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.7)",
                          }}
                        >
                          ID {s.studentId}
                        </span>
                      )}
                    </div>
                    {absent && (
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 800,
                          color: "#ef4444",
                          background: "rgba(254, 242, 242, 0.85)",
                          border: "1px solid #fecaca",
                          borderRadius: "5px",
                          padding: "1.5px 7px",
                          alignSelf: "flex-start",
                          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.6)",
                        }}
                      >
                        KELMAGAN
                      </span>
                    )}
                  </div>

                  {/* ── Subjects + mid inserted ── */}
                  {(() => {
                    const cells: React.ReactNode[] = [];
                    s.subjects.forEach((subj, si) => {
                      cells.push(
                        <SubjectCell
                          key={`${i}-s${si}`}
                          subject={subj}
                          is911={is911}
                          isThird={si === 2}
                        />,
                      );
                      if (si === midAfter - 1) {
                        /* O'rtacha bal */
                        cells.push(
                          <div
                            key={`${i}-mid`}
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              padding: "6px 8px",
                              borderRight: "1px solid rgba(203, 213, 225, 0.45)",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "18px",
                                fontWeight: 800,
                                color: absent ? "#94a3b8" : "#334155",
                              }}
                            >
                              {s.midScore}
                            </span>
                          </div>,
                        );
                      }
                    });
                    return cells;
                  })()}

                  {/* ── Discipline ── */}
                  <DisciplineCell discipline={s.discipline} />

                  {/* ── JAMI (solid column) — glossy glass ── */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 45%), ${tc.bg}`,
                      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.28)",
                      height: "100%",
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "19px",
                        fontWeight: 900,
                        color: "#ffffff",
                        textShadow: "0 1px 2px rgba(0, 0, 0, 0.12)",
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
        <div
          style={{
            padding: "16px 28px 16px",
            borderTop: "1px solid rgba(226, 232, 240, 0.7)",
            background: "rgba(251, 253, 254, 0.6)",
            borderRadius: "0 0 22px 22px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "10px",
              color: "#475569",
              fontWeight: 600,
            }}
          >
            {/* Left side: Intizom legend mapping */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                flexWrap: "nowrap",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  color: "#1e293b",
                  fontSize: "11px",
                  letterSpacing: "0.02em",
                }}
              >
                INTIZOM:
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "rgba(14, 114, 105, 0.08)",
                    border: "1px solid rgba(14, 114, 105, 0.25)",
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#0e7269",
                  }}
                >
                  D
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#475569",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Davomat
                </span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "rgba(14, 114, 105, 0.08)",
                    border: "1px solid rgba(14, 114, 105, 0.25)",
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#0e7269",
                  }}
                >
                  K
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#475569",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Kech qolmaslik
                </span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "rgba(14, 114, 105, 0.08)",
                    border: "1px solid rgba(14, 114, 105, 0.25)",
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#0e7269",
                  }}
                >
                  V
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#475569",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Uyga vazifa
                </span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "rgba(14, 114, 105, 0.08)",
                    border: "1px solid rgba(14, 114, 105, 0.25)",
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#0e7269",
                  }}
                >
                  O
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#475569",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Odob-axloq
                </span>
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
                ? "Fan bali = natija / 10 · JAMI ball = Imtihon + Intizom"
                : "JAMI ball = (Ingliz + Matematika) / 2 + 3-fan + Intizom"}
            </div>
          </div>
          <div
            style={{
              fontSize: "9.5px",
              color: "#94a3b8",
              fontWeight: 600,
              marginTop: "10px",
              textAlign: "right",
            }}
          >
            Al-Xorazmiy School · {activeClass} sinf · {date}
          </div>
        </div>
      </div>
    </div>
  );
}
