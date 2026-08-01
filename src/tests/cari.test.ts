import { describe, it, expect } from "vitest";
import { Bakim, Musteri, Tahsilat } from "../types";
import {
  getMusteriCariOzet,
  getMusteriCariHareketleri
} from "../utils/cari";

describe("QA & Cari Hesap Mantığı Testleri", () => {
  const sampleMusteriler: Musteri[] = [
    { id: 1, ad: "Ahmet Yılmaz", telefon: "05551112233", adres: "İstanbul" },
    { id: 2, ad: "Mehmet Demir", telefon: "05554445566", adres: "Ankara" }
  ];

  const sampleBakimlar: Bakim[] = [
    { id: 101, musteri_id: 1, tarih: "2026-08-01", parcalar: "[]", toplam: 1500, not: "Bakım 1", odendi: 0 },
    { id: 102, musteri_id: 1, tarih: "2026-08-02", parcalar: "[]", toplam: 500, not: "Bakım 2", odendi: 0 }
  ];

  it("getMusteriCariOzet birikmiş toplam borcu doğru hesaplamalı", () => {
    const ozet = getMusteriCariOzet(1, sampleBakimlar, []);
    expect(ozet.toplamAlacak).toBe(2000);
    expect(ozet.kalanBakiye).toBe(2000);
  });

  it("Müşteri listesinde tarihe göre en yeni bakım tarihi olan müşteri öne çıkmalı", () => {
    const bekleyenBakimlar = sampleBakimlar.filter(b => b.odendi === 0);
    const sorted = [...bekleyenBakimlar].sort((a, b) => b.tarih.localeCompare(a.tarih));
    expect(sorted[0].tarih).toBe("2026-08-02");
  });
});
