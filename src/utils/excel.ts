import * as XLSX from "xlsx";
import { Musteri, Parca, Bakim } from "../types";
import { getTahsilatlar } from "./cari";
import { formatDateDDMMYYYY } from "./date";

/**
 * Uygulamanın tüm verilerini (Müşteriler, Bakım Kayıtları, Stok/Parçalar, Tahsilatlar)
 * çok sekmeli (multi-sheet) bir Excel (.xlsx) dosyası olarak dışa aktarır.
 */
export function exportToExcel(
  musteriler: Musteri[] = [],
  bakimlar: Bakim[] = [],
  parcalar: Parca[] = []
) {
  // Müşteri Haritası (Hızlı Müşteri Adı Erişimi İçin)
  const musteriMap = new Map<number, Musteri>();
  musteriler.forEach((m) => musteriMap.set(m.id, m));

  // ── Sayfa 1: Müşteriler ──────────────────────────────────────
  const musterilerData = musteriler.map((m) => ({
    "Müşteri ID": m.id,
    "Ad Soyad": m.ad,
    "Telefon": m.telefon || "-",
    "Adres": m.adres || "-",
    "Açıklama / Not": m.not || "-",
    "Son İşlem Tarihi": m.last_activity_at ? formatDateDDMMYYYY(m.last_activity_at) : "-",
    "Kayıt Tarihi": m.created_at ? formatDateDDMMYYYY(m.created_at) : "-"
  }));

  // ── Sayfa 2: Bakım Kayıtları ─────────────────────────────────
  const bakimlarData = bakimlar.map((b) => {
    const m = musteriMap.get(b.musteri_id);

    // Kullanılan parçaları insan tarafından okunabilir listeye çevir
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

  // ── Sayfa 3: Stok ve Parçalar ────────────────────────────────
  const parcalarData = parcalar.map((p) => ({
    "Parça ID": p.id,
    "Parça Adı": p.ad,
    "Birim Fiyat (₺)": p.fiyat || 0,
    "Mevcut Stok Adedi": p.stok ?? 0
  }));

  // ── Sayfa 4: Tahsilatlar & Ödemeler ──────────────────────────
  const tahsilatlar = getTahsilatlar();
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

  sheet1["!cols"] = autoWidth(musterilerData);
  sheet2["!cols"] = autoWidth(bakimlarData);
  sheet3["!cols"] = autoWidth(parcalarData);
  sheet4["!cols"] = autoWidth(tahsilatData);

  XLSX.utils.book_append_sheet(workbook, sheet1, "Müşteriler");
  XLSX.utils.book_append_sheet(workbook, sheet2, "Bakım Kayıtları");
  XLSX.utils.book_append_sheet(workbook, sheet3, "Stok ve Parçalar");
  XLSX.utils.book_append_sheet(workbook, sheet4, "Tahsilatlar");

  // ── Excel Dosyasını İndir ────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `TekApp_Backup_${today}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}
