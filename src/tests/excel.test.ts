import { describe, it, expect, vi } from "vitest";
import { exportToExcel } from "../utils/excel";
import { Musteri, Bakim, Parca } from "../types";
import * as XLSX from "xlsx";

// Mock XLSX.writeFile
vi.mock("xlsx", async () => {
  const actual = await vi.importActual<typeof import("xlsx")>("xlsx");
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

describe("Excel Export Utility Tests", () => {
  const sampleMusteriler: Musteri[] = [
    { id: 1, ad: "Ahmet Yılmaz", telefon: "05551112233", adres: "İstanbul", not: "Kadıköy" }
  ];

  const sampleBakimlar: Bakim[] = [
    {
      id: 101,
      musteri_id: 1,
      tarih: "2026-08-01",
      parcalar: JSON.stringify([{ id: 1, ad: "Filtre", adet: 2 }]),
      toplam: 1500,
      indirim: 200,
      not: "Yıllık bakım",
      odendi: 1
    }
  ];

  const sampleParcalar: Parca[] = [
    { id: 1, ad: "Filtre", fiyat: 250, stok: 10 }
  ];

  it("exportToExcel, XLSX.writeFile fonksiyonunu TekApp_Backup_YYYY-MM-DD.xlsx ismiyle çağırmalıdır", () => {
    exportToExcel(sampleMusteriler, sampleBakimlar, sampleParcalar);
    expect(XLSX.writeFile).toHaveBeenCalled();

    const mockCall = vi.mocked(XLSX.writeFile).mock.calls[0];
    const fileName = mockCall[1];
    expect(fileName).toMatch(/^TekApp_Backup_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
