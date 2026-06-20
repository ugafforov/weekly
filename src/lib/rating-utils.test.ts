import { describe, it, expect } from "vitest";
import {
  text,
  norm,
  isNameHeader,
  isClassHeader,
  isTeacher,
  modeOf,
  toneFromRatio,
} from "./rating-utils";

describe("Rating Workbook Helpers", () => {
  it("text() should trim and stringify", () => {
    expect(text("  hello  ")).toBe("hello");
    expect(text(123)).toBe("123");
    expect(text(null)).toBe("");
    expect(text(undefined)).toBe("");
  });

  it("norm() should normalize Uzbek characters and spacing", () => {
    expect(norm("O'quvchi   Ismi")).toBe("o'quvchi ismi");
    expect(norm("Sinf`da")).toBe("sinf'da");
    expect(norm("  G'ALABA  ")).toBe("g'alaba");
  });

  it("isNameHeader() should detect various name headers", () => {
    expect(isNameHeader("Familiya")).toBe(true);
    expect(isNameHeader("O'quvchi ismi")).toBe(true);
    expect(isNameHeader("Student Name")).toBe(true);
    expect(isNameHeader("Sinf")).toBe(false);
  });

  it("isClassHeader() should detect class headers", () => {
    expect(isClassHeader("Sinf")).toBe(true);
    expect(isClassHeader("Class")).toBe(true);
    expect(isClassHeader("Ismi")).toBe(false);
  });

  it("isTeacher() should detect teacher labels", () => {
    expect(isTeacher("Matematika ustoz")).toBe(true);
    expect(isTeacher("English teacher")).toBe(false); // only "ustoz" in Uzbek
  });

  it("modeOf() should return most frequent value", () => {
    expect(modeOf(["A", "B", "A", "C"])).toBe("A");
    expect(modeOf(["A", "B", "B", "A"])).toBe("B"); // B hits count 2 first
    expect(modeOf(["A", "A", "B", "B"])).toBe("A"); // A hits count 2 first
    expect(modeOf(["", "A", ""])).toBe("A");
  });

  it("toneFromRatio() should return correct tone", () => {
    expect(toneFromRatio(0.7)).toBe("high");
    expect(toneFromRatio(0.4)).toBe("mid");
    expect(toneFromRatio(0.1)).toBe("low");
    expect(toneFromRatio(0)).toBe("none");
    expect(toneFromRatio(null)).toBe("none");
  });
});
