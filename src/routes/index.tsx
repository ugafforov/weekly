import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ChangeEvent, type Ref } from "react";
import { AlertTriangle, CheckCircle2, FileDown, FileSpreadsheet, ImageDown, LoaderCircle, Pencil, Upload, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RatingColumn, RatingStudent, RatingWorkbook } from "@/lib/rating-types";
import logo from "@/assets/al-xorazmiy-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Al-Xorazmiy haftalik reytingi" }, { name: "description", content: "Al-Xorazmiy School sinflari uchun haftalik reyting hisobotlari." }] }),
  component: RatingDashboard,
});

const classSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const scoreTone = (score: number) => score >= 8 ? "score-high" : score >= 5 ? "score-mid" : "score-low";
const statusText = { normal: "Natija", "wrong-id": "ID xato kiritilgan", absent: "Imtihonda qatnashmagan" } as const;

function RatingDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [workbook, setWorkbook] = useState<RatingWorkbook>();
  const [activeClass, setActiveClass] = useState("all");
  const [thirdSubject, setThirdSubject] = useState("");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const classes = useMemo(() => [...new Set(workbook?.students.map((s) => s.className) ?? [])].sort(classSort), [workbook]);
  const students = useMemo(() => (workbook?.students.filter((s) => activeClass === "all" || s.className === activeClass) ?? []).sort((a, b) => b.total - a.total), [workbook, activeClass]);
  const activeSheet = students[0]?.sheetName;
  const allColumns = useMemo(() => workbook?.columns.filter((c) => c.sheetName === activeSheet) ?? [], [workbook, activeSheet]);
  const columns = useMemo(() => activeClass === "all" ? allColumns : allColumns.filter((c) => c.role !== "teacher" && (c.role !== "other" || /to['‘’]?g['‘’]?ri|javob|savol/i.test(`${c.group} ${c.label}`))), [activeClass, allColumns]);
  const statusCounts = students.reduce<Record<RatingStudent["status"], number>>((a, s) => ({ ...a, [s.status]: a[s.status] + 1 }), { normal: 0, "wrong-id": 0, absent: 0 });

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy("upload"); setError("");
    try { const { parseRatingWorkbook } = await import("@/lib/rating-workbook.client"); const parsed = await parseRatingWorkbook(file); setWorkbook(parsed); setActiveClass("all"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Excel faylini o‘qib bo‘lmadi."); }
    finally { setBusy(undefined); event.target.value = ""; }
  }
  async function downloadImage() {
    if (!reportRef.current || activeClass === "all") return; setBusy("image");
    try { const { toPng } = await import("html-to-image"); const url = await toPng(reportRef.current, { pixelRatio: 3, cacheBust: true, backgroundColor: "#f5f3ee" }); const link = document.createElement("a"); link.download = `${activeClass}-${workbook?.date}-reyting.png`; link.href = url; link.click(); }
    finally { setBusy(undefined); }
  }
  async function downloadPdf() {
    if (!reportRef.current || activeClass === "all") return; setBusy("pdf");
    try { const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]); const image = await toPng(reportRef.current, { pixelRatio: 2, backgroundColor: "#f5f3ee" }); const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }); const props = pdf.getImageProperties(image); const width = 277; pdf.addImage(image, "PNG", 10, 10, width, Math.min(190, width * props.height / props.width), undefined, "FAST"); pdf.save(`${activeClass}-${workbook?.date}-reyting.pdf`); }
    finally { setBusy(undefined); }
  }
  async function downloadExcel() {
    if (!workbook) return; setBusy("excel");
    try { const { createSegmentedWorkbook } = await import("@/lib/rating-workbook.client"); const output = createSegmentedWorkbook(workbook, classes); const url = URL.createObjectURL(new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); const link = document.createElement("a"); link.href = url; link.download = `Al-Xorazmiy-${workbook.date}.xlsx`; link.click(); URL.revokeObjectURL(url); }
    finally { setBusy(undefined); }
  }

  return <main className="min-h-screen px-4 py-5 lg:px-8">
    <header className="no-print mx-auto flex max-w-[1840px] items-center justify-between border-b border-border pb-4">
      <img src={logo} alt="Al-Xorazmiy School" className="h-12 w-auto object-contain sm:h-14" />
      <div className="flex gap-2">{workbook && <Button variant="outline" onClick={downloadExcel} disabled={Boolean(busy)}><FileSpreadsheet /> Excel</Button>}<Button variant="premium" onClick={() => inputRef.current?.click()}>{busy === "upload" ? <LoaderCircle className="animate-spin" /> : <Upload />} {workbook ? "Faylni almashtirish" : "Excel yuklash"}</Button></div>
      <input ref={inputRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={upload} />
    </header>
    {!workbook ? <UploadScreen busy={busy} error={error} onChoose={() => inputRef.current?.click()} /> : <div className="mx-auto max-w-[1840px] py-6">
      <div className="no-print mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="eyebrow">{workbook.fileName}</p><h1 className="mt-1 font-display text-3xl font-extrabold">Haftalik reyting</h1><p className="mt-1 text-sm text-muted-foreground">Umumiy jadvalda barcha ma’lumotlar, sinf ko‘rinishida ota-onalar uchun soddalashtirilgan hisobot.</p></div>
        <div className="flex flex-wrap gap-2">{activeClass !== "all" && <label className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-semibold"><Pencil className="size-4 text-primary" /><span>3-fan:</span><input value={thirdSubject} onChange={(e) => setThirdSubject(e.target.value)} placeholder="Excel bo‘yicha" className="w-28 bg-transparent outline-none placeholder:text-muted-foreground" /></label>}<Button variant="outline" onClick={downloadImage} disabled={Boolean(busy) || activeClass === "all"}><ImageDown /> Telegram PNG</Button><Button variant="outline" onClick={downloadPdf} disabled={Boolean(busy) || activeClass === "all"}><FileDown /> PDF</Button></div>
      </div>
      <nav className="no-print mb-5 flex gap-2 overflow-x-auto border-b border-border pb-3" aria-label="Sinflar"><Button variant={activeClass === "all" ? "premium" : "ghost"} onClick={() => setActiveClass("all")}><Users /> Umumiy reyting</Button>{classes.map((name) => <Button key={name} variant={activeClass === name ? "premium" : "ghost"} onClick={() => setActiveClass(name)}>{name}</Button>)}</nav>
      <Report ref={reportRef} workbook={workbook} activeClass={activeClass} students={students} columns={columns} thirdSubject={thirdSubject} statusCounts={statusCounts} />
    </div>}
  </main>;
}

function UploadScreen({ busy, error, onChoose }: { busy?: string; error: string; onChoose: () => void }) {
  return <section className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-4xl place-items-center py-12 text-center"><div><p className="eyebrow">AL-XORAZMIY SCHOOL</p><h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">Haftalik natijalarni bir zumda tayyorlang.</h1><p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">5–8 va 9–11 sinflar sahifalari avtomatik o‘qiladi, umumiy reyting va har bir sinf uchun Telegram hisoboti yaratiladi.</p><Button size="lg" variant="premium" className="mt-9 h-14 rounded-xl px-8 text-base" onClick={onChoose}>{busy === "upload" ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />} .xlsx faylni tanlash</Button>{error && <p role="alert" className="mx-auto mt-5 max-w-xl rounded-xl bg-coral-soft px-4 py-3 font-semibold text-coral-foreground">{error}</p>}</div></section>;
}

function Report({ ref, workbook, activeClass, students, columns, thirdSubject, statusCounts }: { ref: Ref<HTMLDivElement>; workbook: RatingWorkbook; activeClass: string; students: RatingStudent[]; columns: RatingColumn[]; thirdSubject: string; statusCounts: Record<RatingStudent["status"], number> }) {
  const isAll = activeClass === "all"; const groups = [...new Set(columns.map((c) => c.group))];
  return <section ref={ref} className={`print-area overflow-hidden rounded-2xl border border-border bg-card ${isAll ? "" : "telegram-report"}`}>
    <div className="report-head flex flex-col items-center justify-between gap-4 border-b border-border px-6 py-5 sm:flex-row"><img src={logo} alt="Al-Xorazmiy School logosi" className="h-16 w-auto object-contain" /><div className="text-center sm:text-right"><p className="eyebrow">{isAll ? "BARCHA SINFLAR" : `${activeClass} SINF`}</p><h2 className="font-display text-2xl font-extrabold">HAFTALIK JAMG‘ARILGAN BALLAR</h2><p className="mt-1 font-bold text-primary">{workbook.date}</p></div></div>
    {!isAll && <div className="status-strip grid grid-cols-3 border-b border-border"><Status icon={CheckCircle2} label="Natijasi mavjud" value={statusCounts.normal} tone="text-sage-foreground" /><Status icon={AlertTriangle} label="ID xato" value={statusCounts["wrong-id"]} tone="text-amber-foreground" /><Status icon={XCircle} label="Qatnashmagan" value={statusCounts.absent} tone="text-slate-foreground" /></div>}
    <div className="overflow-x-auto"><table className="rating-table w-full border-collapse text-[11px]"><thead><tr className="group-row"><th rowSpan={2}>№</th><th rowSpan={2} className="name-col">FAMILIYA ISM</th>{isAll && <th rowSpan={2}>SINF</th>}{groups.map((group, index) => <th key={group} colSpan={columns.filter((c) => c.group === group).length}>{!isAll && index === 2 && thirdSubject ? thirdSubject : group}</th>)}</tr><tr className="label-row">{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{students.map((student, index) => <StudentRow key={`${student.sheetName}-${student.rowNumber}`} student={student} index={index} columns={columns} showClass={isAll} />)}</tbody></table></div>
    {!isAll && <div className="legend flex flex-wrap gap-5 border-t border-border px-6 py-3 text-xs font-semibold"><span><i className="dot bg-amber-soft" /> ID xato kiritilgan</span><span><i className="dot bg-slate-soft" /> Imtihonda qatnashmagan</span><span className="ml-auto text-muted-foreground">Reyting yuqoridan pastga saralangan</span></div>}
  </section>;
}

function StudentRow({ student, index, columns, showClass }: { student: RatingStudent; index: number; columns: RatingColumn[]; showClass: boolean }) {
  const rowClass = student.status === "absent" ? "row-absent" : student.status === "wrong-id" ? "row-wrong" : "";
  return <tr className={rowClass}><td className="rank">{index + 1}</td><td className="student-name"><span>{student.name}</span>{student.status !== "normal" && <small>{statusText[student.status]}</small>}</td>{showClass && <td className="font-bold">{student.className}</td>}{columns.map((c) => <td key={c.key} className={c.role === "total" ? scoreTone(student.total) : ""}>{student.status === "absent" && !student.values[c.key] ? "—" : student.values[c.key] || "—"}</td>)}</tr>;
}
function Status({ icon: Icon, label, value, tone }: { icon: typeof CheckCircle2; label: string; value: number; tone: string }) { return <div className="flex items-center justify-center gap-3 border-r border-border px-4 py-3 last:border-r-0"><Icon className={`size-5 ${tone}`} /><div><strong className="text-lg">{value}</strong><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></div></div>; }