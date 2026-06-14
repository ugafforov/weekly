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

/* ─── Helpers ──────────────────────────────────────────────────── */
const classSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

const totalTone = (score: number) =>
  score >= 8 ? "score-high" : score >= 6 ? "score-mid" : score >= 4 ? "score-low" : "score-bad";

const percentOf = (v: string | number | undefined): number | null => {
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

const DISC_SHORT: Record<string, string> = {
  davomat: "D",
  "kech qolmaslik": "K",
  "uyga vazifa": "V",
  "odob-axloq": "O",
};
const discShort = (label: string) => {
  const l = label.toLowerCase();
  for (const [k, v] of Object.entries(DISC_SHORT)) if (l.includes(k)) return v;
  return label[0]?.toUpperCase() ?? "?";
};

const loadWorkbookTools = createClientOnlyFn(() => import("@/lib/rating-workbook.client"));

/* ─── Demo data (preview only) ─────────────────────────────────── */
function makeDemoWorkbook(): RatingWorkbook {
  const mkCol = (key: string, label: string, group: string, role: RatingColumn["role"]): RatingColumn =>
    ({ key, label, group, role, sheetName: "5A" });
  /* Mirrors real Excel structure: subjects under one "Natijalar" group,
     with generic column labels "Natijasi" and "Bal" per subject          */
  const columns: RatingColumn[] = [
    mkCol("ing_lvl","Level (Etap)","Natijalar","other"),
    mkCol("ing_jav","To'g'ri javoblar","Natijalar","other"),
    mkCol("ing_nat","Ingliz tili natijasi","Natijalar","result"),
    mkCol("ing_bal","Ingliz tili bali","Natijalar","other"),
    mkCol("mat_lvl","Level (Etap)","Natijalar","other"),
    mkCol("mat_id","ID","Natijalar","id"),
    mkCol("mat_jav","To'g'ri javoblar","Natijalar","other"),
    mkCol("mat_nat","Matematika natijasi","Natijalar","result"),
    mkCol("mat_bal","Matematika bali","Natijalar","other"),
    mkCol("avg","O'rtacha haftalik imtixon bali","O'RTACHA HAFTALIK IMTIXON BALI","other"),
    mkCol("tar_id","ID","Natijalar","id"),
    mkCol("tar_jav","To'g'ri javoblar","Natijalar","other"),
    mkCol("tar_nat","Tarix natijasi","Natijalar","result"),
    mkCol("tar_bal","Tarix bali","Natijalar","other"),
    mkCol("dav","Davomat","TARTIB INTIZOM BALLARI","discipline"),
    mkCol("kech","Kech qolmaslik","TARTIB INTIZOM BALLARI","discipline"),
    mkCol("vaz","Uyga vazifa","TARTIB INTIZOM BALLARI","discipline"),
    mkCol("odob","Odob-axloq","TARTIB INTIZOM BALLARI","discipline"),
    mkCol("jami","4-Hafta","4-HAFTA","total"),
  ];
  const s = (name: string, total: number, vals: Record<string,string|number>): RatingStudent =>
    ({ rowNumber: 0, name, className: "5A", total, status: "normal", sheetName: "5A", values: vals });
  const students: RatingStudent[] = [
    s("Masalixanov Muhammadzip", 10,  {ing_nat:"67%",ing_bal:"5.5",mat_nat:"60%",mat_bal:"5.5",avg:"5.5",tar_nat:"30%",tar_bal:"1.5",dav:1,kech:1,vaz:1,odob:1,jami:10}),
    s("Kamoliddinov Abdulaziz",  9.25,{ing_nat:"73%",ing_bal:"5",  mat_nat:"60%",mat_bal:"5.5",avg:"5.25",tar_nat:"50%",tar_bal:"2",  dav:1,kech:1,vaz:1,odob:1,jami:9.25}),
    s("Maxmudullayev Xondamir",  8.5, {ing_nat:"73%",ing_bal:"5",  mat_nat:"53%",mat_bal:"5",  avg:"4.5",tar_nat:"50%",tar_bal:"2",  dav:1,kech:1,vaz:1,odob:0,jami:8.5}),
    s("Risqiddinov Sarvarbek",   8.5, {ing_nat:"67%",ing_bal:"3.5",mat_nat:"67%",mat_bal:"4.5",avg:"4",tar_nat:"30%",tar_bal:"1.5",dav:1,kech:1,vaz:1,odob:1,jami:8.5}),
    s("Lukmonjonov Asrorbek",    8.5, {ing_nat:"0%", ing_bal:"0",  mat_nat:"73%",mat_bal:"5",  avg:"2.5",tar_nat:"70%",tar_bal:"3",  dav:1,kech:1,vaz:1,odob:1,jami:8.5}),
    s("Hoshimboyev Muhammadqodir",8, {ing_nat:"87%",ing_bal:"4.5",mat_nat:"67%",mat_bal:"5.5",avg:"5",tar_nat:"0%", tar_bal:"0",  dav:1,kech:1,vaz:1,odob:1,jami:8}),
    s("Ismoilova Madina",        7.25,{ing_nat:"93%",ing_bal:"5",  mat_nat:"80%",mat_bal:"3.5",avg:"4.25",tar_nat:"0%",tar_bal:"0",  dav:1,kech:1,vaz:1,odob:1,jami:7.25}),
    s("Tojiboyev Ubaydullo",     7.25,{ing_nat:"0%", ing_bal:"0",  mat_nat:"40%",mat_bal:"1.5",avg:"0.75",tar_nat:"80%",tar_bal:"3.5",dav:1,kech:1,vaz:1,odob:1,jami:7.25}),
    s("Nematov Nurmuhammad",     6.25,{ing_nat:"67%",ing_bal:"3.5",mat_nat:"13%",mat_bal:"1",  avg:"2.25",tar_nat:"20%",tar_bal:"1",  dav:1,kech:1,vaz:1,odob:1,jami:6.25}),
    s("Rahmatullayeva Madina",   6.25,{ing_nat:"53%",ing_bal:"3",  mat_nat:"33%",mat_bal:"1.5",avg:"3.25",tar_nat:"10%",tar_bal:"1",  dav:1,kech:1,vaz:1,odob:1,jami:6.25}),
    s("Lochinboyeva Bibixonim",  6,   {ing_nat:"0%", ing_bal:"0",  mat_nat:"53%",mat_bal:"3",  avg:"1.5",tar_nat:"30%",tar_bal:"1.5",dav:1,kech:1,vaz:1,odob:1,jami:6}),
    s("Rahimov Muhammadqodir",   5.5, {ing_nat:"13%",ing_bal:"1",  mat_nat:"20%",mat_bal:"1",  avg:"1",tar_nat:"30%",tar_bal:"1.5",dav:1,kech:1,vaz:1,odob:1,jami:5.5}),
    s("Uraimov O'tkirbek",       0,   {ing_nat:"0%", ing_bal:"0",  mat_nat:"0%", mat_bal:"0",  avg:"0",tar_nat:"0%", tar_bal:"0",  dav:0,kech:0,vaz:0,odob:0,jami:0}),
    s("Iminjonova Sarvinoz",     0,   {ing_nat:"0%", ing_bal:"0",  mat_nat:"0%", mat_bal:"0",  avg:"0",tar_nat:"0%", tar_bal:"0",  dav:0,kech:0,vaz:0,odob:0,jami:0}),
  ];
  return { fileName: "5A-06.06.2026.xlsx", date: "06.06.2026", columns, students };
}

/* ─── Main Dashboard ───────────────────────────────────────────── */
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
    workbook?.students.forEach((s) => { counts[s.className] = (counts[s.className] ?? 0) + 1; });
    return counts;
  }, [workbook]);
  const students = useMemo(
    () =>
      (workbook?.students.filter((s) => activeClass === "all" || s.className === activeClass) ?? [])
        .sort((a, b) => b.total - a.total),
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
    setBusy("upload"); setError("");
    try {
      const tools = await loadWorkbookTools();
      if (!tools) return;
      setWorkbook(await tools.parseRatingWorkbook(file));
      setActiveClass("all");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Excel faylini o'qib bo'lmadi.");
    } finally { setBusy(undefined); }
  }

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    await processFile(f); e.target.value = "";
  };

  async function downloadImage() {
    if (!reportRef.current || activeClass === "all") return;
    setBusy("image");
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(reportRef.current, { pixelRatio: 3, cacheBust: true, backgroundColor: "#ffffff" });
      Object.assign(document.createElement("a"), { download: `${activeClass}-${workbook?.date}-reyting.png`, href: url }).click();
    } finally { setBusy(undefined); }
  }

  async function downloadPdf() {
    if (!reportRef.current || activeClass === "all") return;
    setBusy("pdf");
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const image = await toPng(reportRef.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const props = pdf.getImageProperties(image); const w = 277;
      pdf.addImage(image, "PNG", 10, 10, w, Math.min(190, (w * props.height) / props.width), undefined, "FAST");
      pdf.save(`${activeClass}-${workbook?.date}-reyting.pdf`);
    } finally { setBusy(undefined); }
  }

  async function downloadExcel() {
    if (!workbook) return; setBusy("excel");
    try {
      const tools = await loadWorkbookTools(); if (!tools) return;
      const out = tools.createSegmentedWorkbook(workbook, classes);
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })),
        download: `Al-Xorazmiy-${workbook.date}.xlsx`,
      }); a.click(); URL.revokeObjectURL(a.href);
    } finally { setBusy(undefined); }
  }

  if (!workbook) {
    return (
      <UploadScreen
        busy={busy} error={error} isDragging={isDragging}
        onChoose={() => inputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        inputRef={inputRef} onFileChange={upload}
        onDemo={() => { setWorkbook(makeDemoWorkbook()); setActiveClass("5A"); }}
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
            <span className="text-[11px] text-dash-muted/70">{workbook.date} · {workbook.students.length} o'quvchi</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="dash-btn-outline" onClick={downloadExcel} disabled={Boolean(busy)}>
              {busy === "excel" ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button size="sm" variant="outline" className="dash-btn-outline" onClick={() => inputRef.current?.click()}>
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
                <input value={thirdSubject} onChange={(e) => setThirdSubject(e.target.value)}
                  placeholder="Excel bo'yicha" className="w-24 bg-transparent text-xs outline-none placeholder:text-dash-muted/50" />
              </label>
            )}
            <Button size="sm" variant="outline" className="dash-btn-outline"
              onClick={downloadImage} disabled={Boolean(busy) || activeClass === "all"}>
              {busy === "image" ? <LoaderCircle className="animate-spin" /> : <ImageDown />}
              Telegram PNG
            </Button>
            <Button size="sm" variant="outline" className="dash-btn-outline"
              onClick={downloadPdf} disabled={Boolean(busy) || activeClass === "all"}>
              {busy === "pdf" ? <LoaderCircle className="animate-spin" /> : <FileDown />}
              PDF
            </Button>
          </div>
        </div>

        <nav className="no-print mb-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="Sinflar">
          <button className={`class-tab ${activeClass === "all" ? "class-tab-active" : ""}`} onClick={() => setActiveClass("all")}>
            <Users className="size-3.5" />Umumiy
            <span className="class-tab-count">{workbook.students.length}</span>
          </button>
          {classes.map((name) => (
            <button key={name} className={`class-tab ${activeClass === name ? "class-tab-active" : ""}`} onClick={() => setActiveClass(name)}>
              {name}<span className="class-tab-count">{classCounts[name] ?? 0}</span>
            </button>
          ))}
        </nav>

        <Report ref={reportRef} workbook={workbook} activeClass={activeClass}
          students={students} columns={columns} thirdSubject={thirdSubject} />
      </div>
    </main>
  );
}

/* ─── Upload Screen ────────────────────────────────────────────── */
function UploadScreen({
  busy, error, isDragging, onChoose, onDrop, onDragOver, onDragLeave, inputRef, onFileChange, onDemo,
}: {
  busy?: string; error: string; isDragging: boolean;
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
      <div className={`upload-card ${isDragging ? "upload-card-drag" : ""}`}
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} onClick={onChoose}>
        <div className={`upload-icon-wrap ${isDragging ? "upload-icon-drag" : ""}`}>
          {busy === "upload" ? <LoaderCircle className="size-8 animate-spin text-primary" /> : <FileSpreadsheet className="size-8 text-primary" />}
        </div>
        <div className="mt-4 text-center">
          <p className="text-base font-bold text-foreground">{isDragging ? "Fayl qo'yish uchun tashlang" : "Excel fayl yuklang"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Faylni bu yerga sudrab tashlang yoki bosing</p>
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">.xlsx / .xls</p>
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90">
          <Upload className="size-4" />Faylni tanlash<ChevronRight className="size-3.5 opacity-70" />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {["5–8 sinf", "9–11 sinf", "Umumiy reyting", "Telegram PNG", "PDF eksport"].map((f) => (
          <span key={f} className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">{f}</span>
        ))}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDemo(); }}
        className="mt-4 text-xs text-muted-foreground underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity"
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

/* ─── Report (router: all → table, class → premium card) ──────── */
function Report({
  ref, workbook, activeClass, students, columns, thirdSubject,
}: {
  ref: Ref<HTMLDivElement>; workbook: RatingWorkbook; activeClass: string;
  students: RatingStudent[]; columns: RatingColumn[]; thirdSubject: string;
}) {
  const isAll = activeClass === "all";

  const groupMeta = useMemo(
    () => [...new Set(columns.map((c) => c.group))].map((group) => ({
      group, columns: columns.filter((c) => c.group === group),
    })),
    [columns],
  );

  const subjectGroups = useMemo(
    () => groupMeta.filter(({ group, columns: gc }) =>
      gc.length > 1 && !/intizom|tarbiya|davomat|hafta|jami|umumiy|o['ʻ''` ]?rtacha/i.test(group),
    ),
    [groupMeta],
  );

  const isSingleTallHeader = (group: string, gc: RatingColumn[]) =>
    gc.length === 1 &&
    /o['ʻ''` ]?rtacha|haftalik|imtihon|\d+[- ]?hafta|jami|umumiy/i.test(`${group} ${gc[0]?.label}`);

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

  const computeSavol = (cols: RatingColumn[]): number | undefined => {
    const javobCol = cols.find((c) => /to[' ʻ''`]?g[' ʻ''`]?ri.*javob/i.test(c.label));
    const natijaCol = cols.find((c) => c.role === "result" || /natija/i.test(c.label));
    if (!javobCol || !natijaCol) return undefined;
    let max = 0;
    for (const s of students) {
      const j = percentOf(s.values[javobCol.key]);
      const n = percentOf(s.values[natijaCol.key]);
      if (j !== null && n !== null && n > 0) max = Math.max(max, Math.round((j / n) * 100));
    }
    return max > 0 && max <= 50 ? max : undefined;
  };

  const labelForGroup = (group: string) => {
    const idx = subjectGroups.findIndex((item) => item.group === group);
    const display = !isAll && idx === 2 && thirdSubject ? thirdSubject : group;
    return display.toLocaleUpperCase("uz-UZ");
  };

  /* ── Single-class premium card report ── */
  if (!isAll) {
    /* Build subject display columns — handles two Excel structures:
       A) Each subject has its own column group  (INGLIZ TILI, MATEMATIKA, …)
       B) All subjects share one group            (Natijalar / default fallback)   */
    const specialPat = /intizom|tarbiya|davomat|hafta|jami|umumiy|o['ʻ'']?rtacha/i;

    const subjectDisplayCols: SubjectDisplayCol[] = (() => {
      /* Case A — subjects are in separate multi-col groups */
      if (subjectGroups.length >= 2) {
        return subjectGroups.map(({ group, columns: cols }) => {
          const resultCol = cols.find((c) => c.role === "result" || /natija/i.test(c.label));
          const scoreCol  = cols.find((c) => /\bbal\b/i.test(c.label));
          return { group, label: labelForGroup(group), savol: groupSavol[group], allCols: cols, resultCol, scoreCol };
        });
      }

      /* Case B — all subjects are inside one group (e.g. "Natijalar")
         Group ALL columns per subject by finding natijasi cols as pivots  */
      const candidateCols = columns.filter(
        (c) => !specialPat.test(`${c.group} ${c.label}`) && !isTeacherColumn(c),
      );
      const resultColIdxs = candidateCols.reduce<number[]>((acc, c, i) => {
        if (/natija/i.test(c.label) || c.role === "result") acc.push(i);
        return acc;
      }, []);
      if (resultColIdxs.length === 0) return [];

      const subjects: SubjectDisplayCol[] = [];
      let prevEnd = -1;
      for (let si = 0; si < resultColIdxs.length; si++) {
        const ri = resultColIdxs[si];
        const resultCol = candidateCols[ri];
        const nextRI = si + 1 < resultColIdxs.length ? resultColIdxs[si + 1] : candidateCols.length;
        /* Find first "bal" column after result, before the next result col */
        let balIdx = -1;
        for (let j = ri + 1; j < nextRI; j++) {
          if (/\bbal\b/i.test(candidateCols[j].label)) { balIdx = j; break; }
        }
        const end = balIdx >= 0 ? balIdx : ri;
        const allCols = candidateCols.slice(prevEnd + 1, end + 1);
        prevEnd = end;
        const scoreCol = balIdx >= 0 ? candidateCols[balIdx] : undefined;
        const savol = computeSavol(allCols);
        const stripped = resultCol.label.replace(/\s*(natijasi?|foizi?)\s*$/i, "").trim();
        const isGeneric = !stripped || /^natija$/i.test(stripped);
        const label = isGeneric
          ? (si === 2 && thirdSubject ? thirdSubject.toLocaleUpperCase("uz-UZ") : `${si + 1}-FAN`)
          : stripped.toLocaleUpperCase("uz-UZ");
        subjects.push({ group: resultCol.key, label, savol, allCols, resultCol, scoreCol });
      }
      return subjects;
    })();

    // Discipline group
    const discGroup = groupMeta.find(({ group }) => /intizom|tarbiya/i.test(group));
    const discCols = discGroup?.columns ?? [];

    // Average single col (O'rtacha haftalik imtixon bali)
    const avgGroup = groupMeta.find(({ group, columns: gc }) =>
      isSingleTallHeader(group, gc) && /o['ʻ'']?rtacha/i.test(`${group} ${gc[0]?.label}`),
    );

    // Total single col — must NOT be the avgGroup
    const totalGroup = groupMeta.find(({ group, columns: gc }) =>
      isSingleTallHeader(group, gc) &&
      group !== avgGroup?.group &&
      /hafta|jami|umumiy/i.test(`${group} ${gc[0]?.label}`),
    );

    return (
      <ClassReport
        ref={ref} workbook={workbook} activeClass={activeClass}
        students={students} subjectDisplayCols={subjectDisplayCols}
        discCols={discCols} avgGroup={avgGroup} totalGroup={totalGroup}
      />
    );
  }

  /* ── All-classes table view ── */
  return (
    <section ref={ref} className="print-area overflow-hidden dash-table-wrap">
      <div className="report-head">
        <img src={logo} alt="Al-Xorazmiy School" />
        <h2>HAFTALIK JAMG'ARILGAN BALLAR</h2>
        <p>( {workbook.date} )</p>
      </div>
      <div className="overflow-x-auto">
        <table className="rating-table w-full border-collapse">
          <thead>
            <tr className="group-row">
              <th rowSpan={2} className="col-rank">№</th>
              <th rowSpan={2} className="name-col">FAMILIYA ISM</th>
              <th rowSpan={2} className="col-class">SINF</th>
              {groupMeta.map(({ group, columns: gc }) => {
                if (isSingleTallHeader(group, gc)) {
                  return <th key={group} rowSpan={2} className="single-head">{labelForGroup(gc[0]?.label || group)}</th>;
                }
                return (
                  <th key={group} colSpan={gc.length}>
                    <div className="group-title">{labelForGroup(group)}</div>
                  </th>
                );
              })}
            </tr>
            <tr className="label-row">
              {groupMeta.flatMap(({ group, columns: gc }) =>
                isSingleTallHeader(group, gc)
                  ? []
                  : gc.map((c) => <th key={c.key}>{displayLabel(c.label)}</th>),
              )}
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr key={`${student.sheetName}-${student.rowNumber || student.name}-${index}`} className={index % 2 === 0 ? "row-even" : "row-odd"}>
                <td className="rank">
                  {index < 3
                    ? <span className="rank-top">{["🥇","🥈","🥉"][index]}</span>
                    : <span>{index + 1}</span>}
                </td>
                <td className="student-name">{student.name}</td>
                <td className="class-col"><span className="class-chip">{student.className}</span></td>
                {columns.map((c) => {
                  const value = student.values[c.key];
                  const cs = student.cellStatuses?.[c.key];
                  let cellClass = "";
                  if (cs === "absent") cellClass = "cell-absent";
                  else if (cs === "wrong-id" || (student.status === "wrong-id" && c.role === "result")) cellClass = "cell-wrong";
                  else if (c.role === "total") cellClass = totalTone(student.total);
                  else if (c.role === "result") cellClass = resultTone(value);
                  return (
                    <td key={c.key} className={cellClass}>
                      {value === "" || value === undefined ? <span className="text-dash-muted/40">—</span> : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ─── Premium Class Report (Telegram / PDF export) ─────────────── */
type SubjectDisplayCol = {
  group: string;
  label: string;
  savol?: number;
  allCols: RatingColumn[];   /* ALL sub-columns for this subject (Level, ID, Javoblar, Natijasi, Bal) */
  resultCol?: RatingColumn;  /* natijasi column — used for color coding */
  scoreCol?: RatingColumn;   /* bal column */
};

function ClassReport({
  ref, workbook, activeClass, students, subjectDisplayCols, discCols, avgGroup, totalGroup,
}: {
  ref: Ref<HTMLDivElement>;
  workbook: RatingWorkbook;
  activeClass: string;
  students: RatingStudent[];
  subjectDisplayCols: SubjectDisplayCol[];
  discCols: RatingColumn[];
  avgGroup?: { group: string; columns: RatingColumn[] };
  totalGroup?: { group: string; columns: RatingColumn[] };
}) {
  const avgCol  = avgGroup?.columns[0];
  const totalCol = totalGroup?.columns[0];
  const hasDisc  = discCols.length > 0;
  const hasAvg   = Boolean(avgCol);
  const hasTotal = Boolean(totalCol);

  return (
    <section ref={ref} className="cr-report print-area">

      {/* ── Header ── */}
      <div className="cr-head">
        <img src={logo} alt="Al-Xorazmiy School" className="cr-logo" />
        <div className="cr-head-text">
          <p className="cr-school-name">AL-XORAZMIY SCHOOL</p>
          <h2 className="cr-title">HAFTALIK JAMG'ARILGAN BALLAR</h2>
          <p className="cr-meta">{workbook.date} &nbsp;·&nbsp; <strong>{activeClass} sinf</strong></p>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="cr-legend-bar">
        <div className="cr-leg-item">
          <span className="cr-leg-box cr-leg-wrong" />
          <span>O'quvchi ID raqamini <strong>xato</strong> kiritgan</span>
        </div>
        <div className="cr-leg-item">
          <span className="cr-leg-box cr-leg-absent" />
          <span>O'quvchi imtihonda <strong>qatnashmagan</strong></span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="rating-table cr-table w-full border-collapse">
          <thead>
            {/* Row 1 — group headers */}
            <tr className="group-row">
              <th rowSpan={2} className="col-rank">№</th>
              <th rowSpan={2} className="name-col">FAMILIYA ISM</th>
              {subjectDisplayCols.map((s) => (
                <th key={s.group} colSpan={s.allCols.length}>
                  <div className="group-title">{s.label}</div>
                  {s.savol && <div className="group-sub">({s.savol} TA SAVOL)</div>}
                </th>
              ))}
              {hasAvg && (
                <th rowSpan={2} className="single-head">
                  O'RTACHA<br />HAFTALIK<br />IMTIXON BALI
                </th>
              )}
              {hasDisc && (
                <th colSpan={discCols.length}>
                  <div className="group-title">TARTIB INTIZOM BALLARI</div>
                </th>
              )}
              {hasTotal && (
                <th rowSpan={2} className="single-head">
                  {(totalCol?.label ?? "JAMI").toLocaleUpperCase("uz-UZ")}
                </th>
              )}
            </tr>
            {/* Row 2 — sub-column labels (rotated) */}
            <tr className="label-row">
              {subjectDisplayCols.flatMap((s) =>
                s.allCols.map((c) => (
                  <th key={c.key}><span className="label-rot">{displayLabel(c.label)}</span></th>
                ))
              )}
              {hasDisc && discCols.map((c) => (
                <th key={c.key}><span className="label-rot">{displayLabel(c.label)}</span></th>
              ))}
            </tr>
          </thead>

          <tbody>
            {students.map((student, index) => {
              /* Standard competition rank: ties share the same rank (1,1,3,3,3,6…) */
              const rank = 1 + students.filter((s) => s.total > student.total).length;
              const rankCls = rank === 1 ? "rank-top cr-rank-gold" : rank === 2 ? "rank-top cr-rank-silver" : rank === 3 ? "rank-top cr-rank-bronze" : "";

              return (
                <tr
                  key={`${student.sheetName}-${student.name}-${index}`}
                  className={index % 2 === 0 ? "row-even" : "row-odd"}
                >
                  {/* Rank */}
                  <td className="rank">
                    {rankCls
                      ? <span className={rankCls}>{rank}</span>
                      : <span>{rank}</span>}
                  </td>

                  {/* Name */}
                  <td className="student-name">{student.name}</td>

                  {/* Subject sub-columns — every column in each subject group */}
                  {subjectDisplayCols.flatMap((s) =>
                    s.allCols.map((c) => {
                      const value = student.values[c.key];
                      const cs    = student.cellStatuses?.[c.key];
                      let cellClass = "";
                      if (cs === "absent") cellClass = "cell-absent";
                      else if (cs === "wrong-id" || (student.status === "wrong-id" && c.key === s.resultCol?.key)) cellClass = "cell-wrong";
                      else if (c.key === s.resultCol?.key) cellClass = resultTone(value);
                      return (
                        <td key={c.key} className={cellClass}>
                          {value === "" || value === undefined
                            ? <span className="text-dash-muted/40">—</span>
                            : value}
                        </td>
                      );
                    })
                  )}

                  {/* O'rtacha haftalik imtixon bali */}
                  {hasAvg && avgCol && (
                    <td>{student.values[avgCol.key] ?? "—"}</td>
                  )}

                  {/* Tartib-intizom columns */}
                  {hasDisc && discCols.map((c) => {
                    const v = student.values[c.key];
                    return (
                      <td key={c.key}>
                        {v === "" || v === undefined ? <span className="text-dash-muted/40">—</span> : v}
                      </td>
                    );
                  })}

                  {/* Jami (4-hafta) */}
                  {hasTotal && totalCol && (
                    <td className={totalTone(student.total)}>
                      {student.values[totalCol.key] ?? student.total}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div className="cr-footer">
        <span>Al-Xorazmiy School · Haftalik reyting hisoboti</span>
        <span>{workbook.date}</span>
      </div>
    </section>
  );
}
