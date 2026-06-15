import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { RatingWorkbook } from "./rating-types";

export interface ReportMeta {
  id: string;
  fileName: string;
  date: string;
  dateIso: string;
  uploadedAt: Date | null;
  studentCount: number;
}

/** "13.06.2026" → "2026-06-13" */
function toIso(displayDate: string): string {
  const [d, m, y] = displayDate.split(".");
  if (d && m && y) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return displayDate;
}

function reportsCol(uid: string) {
  return collection(db, "users", uid, "reports");
}

export async function saveReport(uid: string, workbook: RatingWorkbook): Promise<void> {
  const dateIso = toIso(workbook.date);
  const ref = doc(reportsCol(uid), dateIso);
  await setDoc(ref, {
    fileName: workbook.fileName,
    date: workbook.date,
    dateIso,
    uploadedAt: serverTimestamp(),
    studentCount: workbook.students.length,
    workbook: JSON.stringify(workbook),
  });
}

export async function listReports(uid: string): Promise<ReportMeta[]> {
  const q = query(reportsCol(uid), orderBy("dateIso", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      fileName: data.fileName ?? "",
      date: data.date ?? d.id,
      dateIso: data.dateIso ?? d.id,
      uploadedAt: data.uploadedAt?.toDate?.() ?? null,
      studentCount: data.studentCount ?? 0,
    };
  });
}

export async function loadReport(uid: string, dateIso: string): Promise<RatingWorkbook | null> {
  const q = query(reportsCol(uid), orderBy("dateIso", "desc"));
  const snap = await getDocs(q);
  const found = snap.docs.find((d) => d.id === dateIso);
  if (!found) return null;
  const raw = found.data().workbook;
  if (!raw) return null;
  return JSON.parse(raw) as RatingWorkbook;
}

export async function deleteReport(uid: string, dateIso: string): Promise<void> {
  await deleteDoc(doc(reportsCol(uid), dateIso));
}
