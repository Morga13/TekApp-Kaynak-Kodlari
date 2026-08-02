import { describe, it, expect } from "vitest";
import { formatDateDDMMYYYY, formatDateLong } from "../utils/date";

describe("Tarih Biçimlendirme Testleri (Gün/Ay/Yıl)", () => {
  it("formatDateDDMMYYYY 'YYYY-MM-DD' formatını 'DD.MM.YYYY' yapmalı", () => {
    expect(formatDateDDMMYYYY("2026-08-02")).toBe("02.08.2026");
    expect(formatDateDDMMYYYY("2025-12-31")).toBe("31.12.2025");
  });

  it("formatDateDDMMYYYY 'YYYY/MM/DD' formatını 'DD.MM.YYYY' yapmalı", () => {
    expect(formatDateDDMMYYYY("2026/08/02")).toBe("02.08.2026");
  });

  it("Boş veya geçersiz tarih verildiğinde güvenli bir şekilde geri dönmeli", () => {
    expect(formatDateDDMMYYYY("")).toBe("");
    expect(formatDateDDMMYYYY(null)).toBe("");
    expect(formatDateDDMMYYYY("gecersiz")).toBe("gecersiz");
  });

  it("formatDateLong Türkçe uzun tarih formatını oluşturmalı", () => {
    const formatted = formatDateLong("2026-08-02");
    expect(formatted).toContain("Ağustos");
    expect(formatted).toContain("2026");
  });
});
