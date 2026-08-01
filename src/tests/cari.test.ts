import { describe, it, expect } from "vitest";
import { Bakim, Tahsilat } from "../types";
import {
  getMusteriCariOzet,
  getMusteriCariHareketleri,
  generateTaksitPlani
} from "../utils/cari";

describe("Cari Hesap, Kısmi Ödeme ve Taksit Sistemi Testleri", () => {
  it("Cari Özet metriklerini (Toplam Alacak, Tahsil Edilen, Kalan Bakiye) doğru hesaplamalı", () => {
    const bakimlar: Bakim[] = [
      {
        id: 1,
        musteri_id: 10,
        tarih: "2026-08-01",
        parcalar: "[]",
        toplam: 1000,
        not: "Servis Bakımı",
        odendi: 0
      },
      {
        id: 2,
        musteri_id: 10,
        tarih: "2026-08-10",
        parcalar: "[]",
        toplam: 2000,
        not: "Cihaz Satışı",
        odendi: 0
      }
    ];

    const tahsilatlar: Tahsilat[] = [
      {
        id: "ths_1",
        musteri_id: 10,
        tarih: "2026-08-02",
        tutar: 1200,
        aciklama: "Kısmi Nakit Ödeme"
      }
    ];

    const ozet = getMusteriCariOzet(10, bakimlar, tahsilatlar);
    expect(ozet.toplamAlacak).toBe(3000);  // 1000 + 2000 = 3000 TL
    expect(ozet.tahsilEdilen).toBe(1200);  // 1200 TL
    expect(ozet.kalanBakiye).toBe(1800);   // 3000 - 1200 = 1800 TL Kalan Bakiye
  });

  it("Cari Hareketleri (Ekstre Timeline) kronolojik sıralamalı", () => {
    const bakimlar: Bakim[] = [
      {
        id: 1,
        musteri_id: 10,
        tarih: "2026-08-01",
        parcalar: "[]",
        toplam: 1000,
        not: "Hizmet Verildi",
        odendi: 0
      },
      {
        id: 2,
        musteri_id: 10,
        tarih: "2026-08-10",
        parcalar: "[]",
        toplam: 2000,
        not: "Cihaz Satışı",
        odendi: 0
      }
    ];

    const tahsilatlar: Tahsilat[] = [
      {
        id: "ths_1",
        musteri_id: 10,
        tarih: "2026-08-02",
        tutar: 1200,
        aciklama: "Ödeme Alındı"
      }
    ];

    const hareketler = getMusteriCariHareketleri(10, bakimlar, tahsilatlar);
    expect(hareketler).toHaveLength(3);
    // En yeni tarih en üstte
    expect(hareketler[0].tarih).toBe("2026-08-10");
    expect(hareketler[0].tip).toBe("BORC");
    expect(hareketler[1].tarih).toBe("2026-08-02");
    expect(hareketler[1].tip).toBe("ALACAK");
    expect(hareketler[2].tarih).toBe("2026-08-01");
    expect(hareketler[2].tip).toBe("BORC");
  });

  it("generateTaksitPlani aylık taksit tarihlerini ve tutarlarını doğru üretmeli", () => {
    const taksitler = generateTaksitPlani(5, 100, 6000, 6, "2026-08-15");
    expect(taksitler).toHaveLength(6);
    expect(taksitler[0].tutar).toBe(1000);
    expect(taksitler[0].vade_tarihi).toBe("2026-08-15");
    expect(taksitler[1].vade_tarihi).toBe("2026-09-15");
    expect(taksitler[5].vade_tarihi).toBe("2027-01-15");
    expect(taksitler[5].odendi).toBe(false);
  });
});
