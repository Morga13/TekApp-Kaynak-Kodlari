import * as XLSX from "xlsx";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Musteri, Parca, Bakim, Tahsilat } from "../types";
import { getMusteriCariOzet } from "./cari";
import { formatDateDDMMYYYY } from "./date";

/**
 * Uygulamanın tüm verilerini (Bekleyen Ödemeler, Müşteri Alacakları, Müşteriler, Bakım Kayıtları, Stok/Parçalar, Tahsilatlar)
 * 6 sekmeli (multi-sheet) bir Excel (.xlsx) dosyası olarak dışa aktarır.
 * 
 * 1. Sayfa (Sheet 1): Uygulamadaki "BEKLEYEN ÖDEMELER" ekranı ile %100 birebir aynı!
 *    - Sadece borcu olan müşteriler (borcu > 0) yer alır.
 *    - En alt satırda "TOPLAM ALACAK" genel borç toplamı hesaplanır.
 */
export async function exportToExcel(
  musteriler: Musteri[] = [],
  bakimlar: Bakim[] = [],
  parcalar: Parca[] = [],
  tahsilatlar: Tahsilat[] = []
): Promise<void> {
  const musteriMap = new Map<number, Musteri>();
  musteriler.forEach((m) => musteriMap.set(m.id, m));

  // ── Sayfa 1: BEKLEYEN ÖDEMELER (Uygulama Ekranı İle %100 Birebir Aynı) ──────
  const borcluMusterilerListesi = musteriler
    .map((m) => {
      const cari = getMusteriCariOzet(m.id, bakimlar, tahsilatlar);
      const mBakimlar = bakimlar.filter((b) => b.musteri_id === m.id);
      const bekleyenBakimlar = mBakimlar.filter((b) => b.odendi === 0);
      const sonTarih = bekleyenBakimlar.length > 0 
        ? [...bekleyenBakimlar].sort((a, b) => b.tarih.localeCompare(a.tarih))[0].tarih 
        : (mBakimlar.length > 0 ? [...mBakimlar].sort((a, b) => b.tarih.localeCompare(a.tarih))[0].tarih : "");

      return {
        musteri: m,
        toplamBorc: cari.kalanBakiye,
        sonTarih
      };
    })
    .filter((item) => item.toplamBorc > 0)
    .sort((a, b) => b.sonTarih.localeCompare(a.sonTarih)); // En yeni tarih en üstte

  const genelToplamAlacak = borcluMusterilerListesi.reduce((sum, item) => sum + item.toplamBorc, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bekleyenOdemelerRows: Record<string, any>[] = borcluMusterilerListesi.map((item, index) => ({
    "Sıra No": index + 1,
    "Müşteri Adı": item.musteri.ad,
    "Telefon": item.musteri.telefon || "-",
    "Adres": item.musteri.adres || "-",
    "Son Borç Tarihi": item.sonTarih ? formatDateDDMMYYYY(item.sonTarih) : "-",
    "Kalan Borç Tutarı (₺)": item.toplamBorc
  }));

  // En alt satıra TOPLAM ALACAK genel toplamı ekle
  if (bekleyenOdemelerRows.length > 0) {
    bekleyenOdemelerRows.push({
      "Sıra No": "",
      "Müşteri Adı": "TOPLAM ALACAK",
      "Telefon": "",
      "Adres": "",
      "Son Borç Tarihi": "",
      "Kalan Borç Tutarı (₺)": genelToplamAlacak
    });
  }

  // ── Sayfa 2: Tüm Müşterilerin Cari Özeti ──────────────────────────────
  const alacaklarData = musteriler.map((m) => {
    const ozet = getMusteriCariOzet(m.id, bakimlar, tahsilatlar);
    return {
      "Müşteri ID": m.id,
      "Müşteri Adı": m.ad,
      "Telefon": m.telefon || "-",
      "Adres": m.adres || "-",
      "Toplam Hizmet/Satış (₺)": ozet.toplamAlacak || 0,
      "Alınan Toplam Ödeme (₺)": ozet.tahsilEdilen || 0,
      "Kalan Borç Bakiyesi (₺)": ozet.kalanBakiye || 0,
      "Bakiye Durumu": ozet.kalanBakiye > 0 ? "🔴 Borçlu" : "🟢 Borcu Yok",
      "Son İşlem Tarihi": m.last_activity_at ? formatDateDDMMYYYY(m.last_activity_at) : "-"
    };
  });

  // ── Sayfa 3: Müşteriler (Tüm Liste) ──────────────────────────────────
  const musterilerData = musteriler.map((m) => ({
    "Müşteri ID": m.id,
    "Ad Soyad": m.ad,
    "Telefon": m.telefon || "-",
    "Adres": m.adres || "-",
    "Açıklama / Not": m.not || "-",
    "Son İşlem Tarihi": m.last_activity_at ? formatDateDDMMYYYY(m.last_activity_at) : "-",
    "Kayıt Tarihi": m.created_at ? formatDateDDMMYYYY(m.created_at) : "-"
  }));

  // ── Sayfa 4: Tüm Bakım & Servis Kayıtları ─────────────────────────────
  const bakimlarData = bakimlar.map((b) => {
    const m = musteriMap.get(b.musteri_id);

    let parcalarMetni = "-";
    try {
      const parsed = typeof b.parcalar === "string" ? JSON.parse(b.parcalar || "[]") : b.parcalar;
      if (Array.isArray(parsed) && parsed.length > 0) {
        parcalarMetni = parsed
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((p: any) => `${p.ad || "Parça"} (x${p.adet || 1})`)
          .join(", ");
      }
    } catch {
      parcalarMetni = "-";
    }

    return {
      "Kayıt ID": b.id,
      "Müşteri Adı": m ? m.ad : `Müşteri #${b.musteri_id}`,
      "Telefon": m ? m.telefon || "-" : "-",
      "İşlem Tarihi": formatDateDDMMYYYY(b.tarih),
      "İşlem Tutarı (₺)": b.toplam || 0,
      "Uygulanan İndirim (₺)": b.indirim || 0,
      "Kullanılan Parçalar / Hizmetler": parcalarMetni,
      "Ödeme Durumu": b.odendi === 1 ? "Ödendi" : "Ödenmedi",
      "Açıklama / Not": b.not || "-"
    };
  });

  // ── Sayfa 5: Stok ve Parçalar ────────────────────────────────
  const parcalarData = parcalar.map((p) => ({
    "Parça ID": p.id,
    "Parça Adı": p.ad,
    "Birim Fiyat (₺)": p.fiyat || 0,
    "Mevcut Stok Adedi": p.stok ?? 0
  }));

  // ── Sayfa 6: Tahsilatlar & Ödemeler ──────────────────────────
  const tahsilatData = tahsilatlar.map((t) => {
    const m = musteriMap.get(t.musteri_id);
    return {
      "Tahsilat ID": t.id,
      "Müşteri Adı": m ? m.ad : `Müşteri #${t.musteri_id}`,
      "Ödeme Tarihi": formatDateDDMMYYYY(t.tarih),
      "Tahsilat Tutarı (₺)": t.tutar || 0,
      "Açıklama": t.aciklama || "Tahsilat"
    };
  });

  // ── Workbook (Çalışma Kitabı) Oluşturma ──────────────────────
  const workbook = XLSX.utils.book_new();

  const sheetBekleyen = XLSX.utils.json_to_sheet(bekleyenOdemelerRows);
  const sheetAlacaklar = XLSX.utils.json_to_sheet(alacaklarData);
  const sheet1 = XLSX.utils.json_to_sheet(musterilerData);
  const sheet2 = XLSX.utils.json_to_sheet(bakimlarData);
  const sheet3 = XLSX.utils.json_to_sheet(parcalarData);
  const sheet4 = XLSX.utils.json_to_sheet(tahsilatData);

  // Sütun Genişliklerini İçeriğe Göre Otomatik Ayarla
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoWidth = (data: Record<string, any>[]) => {
    if (data.length === 0) return [];
    const keys = Object.keys(data[0]);
    return keys.map((key) => {
      const maxLen = Math.max(
        key.length,
        ...data.map((row) => String(row[key] ?? "").length)
      );
      return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
    });
  };

  sheetBekleyen["!cols"] = autoWidth(bekleyenOdemelerRows);
  sheetAlacaklar["!cols"] = autoWidth(alacaklarData);
  sheet1["!cols"] = autoWidth(musterilerData);
  sheet2["!cols"] = autoWidth(bakimlarData);
  sheet3["!cols"] = autoWidth(parcalarData);
  sheet4["!cols"] = autoWidth(tahsilatData);

  // 1. Sekme: Bekleyen Ödemeler (Sadece Borçlular + Toplam Alacak Özet Satırı)
  XLSX.utils.book_append_sheet(workbook, sheetBekleyen, "Bekleyen Ödemeler");
  XLSX.utils.book_append_sheet(workbook, sheetAlacaklar, "Tüm Müşteri Bakiyeleri");
  XLSX.utils.book_append_sheet(workbook, sheet1, "Müşteriler");
  XLSX.utils.book_append_sheet(workbook, sheet2, "Bakım Kayıtları");
  XLSX.utils.book_append_sheet(workbook, sheet3, "Stok ve Parçalar");
  XLSX.utils.book_append_sheet(workbook, sheet4, "Tahsilatlar");

  const today = new Date().toISOString().slice(0, 10);
  const fileName = `TekApp_Bekleyen_Odemeler_${today}.xlsx`;

  // ── MOBİL (ANDROID / IOS) NATIVE İÇİN İNDİRME / PAYLAŞMA ───
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });

      // Dosyayı Cache dizinine yaz
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      // Native Paylaş Diyaloğu — WhatsApp, Drive, E-posta vs.
      await Share.share({
        title: "TekApp Bekleyen Ödemeler Raporu",
        text: `TekApp Excel Raporu \u2014 Toplam Alacak: ₺${genelToplamAlacak.toLocaleString("tr-TR")}`,
        url: savedFile.uri,
        dialogTitle: "Paylaş / Kaydet",
      });
      return;
    } catch (err: any) {
      console.error("Native paylaşma hatası:", err);
      // Son çare: Documents klasörüne kaydet
      try {
        const base64Data = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
        alert(`✅ Excel dosyası Belgeler klasörüne kaydedildi!\n${fileName}`);
      } catch (e2: any) {
        alert("Excel oluşturulamadı: " + (e2?.message || e2));
      }
      return;
    }
  }

  // ── WEB TARAYICI İÇİN İNDİRME ────────────────────────────────
  XLSX.writeFile(workbook, fileName);
}
