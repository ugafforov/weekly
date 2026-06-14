export type StudentStatus = "normal" | "wrong-id" | "absent";

export type ColumnRole =
  | "id"
  | "teacher"
  | "subject"
  | "result"
  | "discipline"
  | "total"
  | "other";

export interface RatingColumn {
  key: string;
  label: string;
  group: string;
  sheetName: string;
  role: ColumnRole;
}

export interface RatingStudent {
  rowNumber: number;
  name: string;
  className: string;
  total: number;
  status: StudentStatus;
  sheetName: string;
  values: Record<string, string | number>;
  cellStatuses?: Record<string, StudentStatus>;
}

export interface RatingWorkbook {
  fileName: string;
  date: string;
  columns: RatingColumn[];
  students: RatingStudent[];
}