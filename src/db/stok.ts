/**
 * stok.ts — Stok Yönetimi Modülü
 *
 * İki temel işlem:
 *  1. increaseStock(itemId, quantity)   → Manuel stok girişi (adede ekler)
 *  2. decreaseStockForBakim(items)      → Bakım kaydında otomatik stok düşümü
 *     - Önce validation yapar, yetersizse hata fırlatır (işlem engellenir)
 *     - Tüm parçalar yeterliyse atomik olarak düşer
 */

import { supabase } from "./supabase";
import { StokKalemi } from "../types";

// ─────────────────────────────────────────────────────────────────
// 1. KOMPOZİT ÜRÜN HARİTALAMASI (MAPPING)
//    Katalog ürünü adı (normalize) → stok tablosundaki bileşen adları
// ─────────────────────────────────────────────────────────────────

export const COMPOSITE_PARTS_MAPPING: Record<string, string[]> = {

  // ── 5'li Set ──────────────────────────────────────────────────
  "5'li set - kapalı":         ["1. filtre kapalı", "2. filtre kapalı", "3. filtre kapalı", "membran", "tatlandırıcı"],
  "5'li set - kapalı (kokonat)": ["1. filtre kapalı kokonatlı", "2. filtre kapalı kokonatlı", "3. filtre kapalı kokonatlı", "membran", "tatlandırıcı"],
  "5'li set - açık":           ["1. filtre açık", "2. filtre açık", "3. filtre açık", "membran", "tatlandırıcı"],

  // ── 4'lü Set ──────────────────────────────────────────────────
  "4'lü set - kapalı":         ["1. filtre kapalı", "2. filtre kapalı", "3. filtre kapalı", "membran"],
  "4'lü set - kapalı (kokonat)": ["1. filtre kapalı kokonatlı", "2. filtre kapalı kokonatlı", "3. filtre kapalı kokonatlı", "membran"],
  "4'lü set - açık":           ["1. filtre açık", "2. filtre açık", "3. filtre açık", "membran"],

  // ── 3'lü Set ──────────────────────────────────────────────────
  "3'lü set - kapalı":         ["1. filtre kapalı", "2. filtre kapalı", "3. filtre kapalı"],
  "3'lü set - kapalı (kokonat)": ["1. filtre kapalı kokonatlı", "2. filtre kapalı kokonatlı", "3. filtre kapalı kokonatlı"],
  "3'lü set - açık":           ["1. filtre açık", "2. filtre açık", "3. filtre açık"],

  // ── Geriye Dönük Uyumluluk (eski bakım kayıtları için) ────────
  "5li takım kapalı":   ["1. filtre kapalı", "2. filtre kapalı", "3. filtre kapalı", "membran", "tatlandırıcı"],
  "5 li takım kapalı":  ["1. filtre kapalı", "2. filtre kapalı", "3. filtre kapalı", "membran", "tatlandırıcı"],
  "5li takım kokonat":  ["1. filtre kapalı kokonatlı", "2. filtre kapalı kokonatlı", "3. filtre kapalı kokonatlı", "membran", "tatlandırıcı"],
  "5 li takım kokonat": ["1. filtre kapalı kokonatlı", "2. filtre kapalı kokonatlı", "3. filtre kapalı kokonatlı", "membran", "tatlandırıcı"],
  "5li takım açık":     ["1. filtre açık", "2. filtre açık", "3. filtre açık", "membran", "tatlandırıcı"],
  "5 li takım açık":    ["1. filtre açık", "2. filtre açık", "3. filtre açık", "membran", "tatlandırıcı"],
  "4lü takım kapalı":   ["1. filtre kapalı", "2. filtre kapalı", "3. filtre kapalı", "membran"],
  "4 lü takım kapalı":  ["1. filtre kapalı", "2. filtre kapalı", "3. filtre kapalı", "membran"],
  "4lüğ takım kapalı":  ["1. filtre kapalı", "2. filtre kapalı", "3. filtre kapalı", "membran"],
  "4lü takım kokonat":  ["1. filtre kapalı kokonatlı", "2. filtre kapalı kokonatlı", "3. filtre kapalı kokonatlı", "membran"],
  "4 lü takım kokonat": ["1. filtre kapalı kokonatlı", "2. filtre kapalı kokonatlı", "3. filtre kapalı kokonatlı", "membran"],
  "4lü takım açık":     ["1. filtre açık", "2. filtre açık", "3. filtre açık", "membran"],
  "4 lü takım açık":    ["1. filtre açık", "2. filtre açık", "3. filtre açık", "membran"],
  "4lüğ takım açık":    ["1. filtre açık", "2. filtre açık", "3. filtre açık", "membran"],
  "3 filtre kapalı":    ["1. filtre kapalı", "2. filtre kapalı", "3. filtre kapalı"],
  "3filtre kapalı":     ["1. filtre kapalı", "2. filtre kapalı", "3. filtre kapalı"],
  "3 filtre kokonat":   ["1. filtre kapalı kokonatlı", "2. filtre kapalı kokonatlı", "3. filtre kapalı kokonatlı"],
  "3filtre kokonat":    ["1. filtre kapalı kokonatlı", "2. filtre kapalı kokonatlı", "3. filtre kapalı kokonatlı"],
  "3 filtre açık":      ["1. filtre açık", "2. filtre açık", "3. filtre açık"],
  "3filtre açık":       ["1. filtre açık", "2. filtre açık", "3. filtre açık"],
};

// ─────────────────────────────────────────────────────────────────
// 2. STOK UYARI EŞİKLERİ
// ─────────────────────────────────────────────────────────────────

/** Filtre, membran, set veya takım içeriyorsa yüksek eşik grubuna girer */
export function isHighThresholdPart(ad: string): boolean {
  const n = ad.toLowerCase().trim();
  return n.includes("filtre") || n.includes("membran") || n.includes("set") || n.includes("takım") || n.includes("takim");
}

/** Stok durumuna göre renk tonu döner */
export function getStokDurumu(ad: string, miktar: number): "normal" | "turuncu" | "kirmizi" {
  if (isHighThresholdPart(ad)) {
    if (miktar < 20) return "kirmizi";
    if (miktar < 30) return "turuncu";
  } else {
    if (miktar < 10) return "kirmizi";
    if (miktar < 15) return "turuncu";
  }
  return "normal";
}

// ─────────────────────────────────────────────────────────────────
// YARDIMCI: normalize
// ─────────────────────────────────────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

// ─────────────────────────────────────────────────────────────────
// YARDIMCI: stok tablosundan tüm satırları çek
// ─────────────────────────────────────────────────────────────────
async function fetchAllStok(): Promise<StokKalemi[]> {
  const { data, error } = await supabase
    .from("stok")
    .select("*")
    .order("id", { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((r: any) => ({
    id: Number(r.id),
    ad: String(r.ad),
    miktar: Number(r.miktar ?? 0),
  }));
}

// ─────────────────────────────────────────────────────────────────
// 3. increaseStock(itemId, quantity)
//    Manuel stok girişi — mevcut miktara quantity kadar ekler
// ─────────────────────────────────────────────────────────────────
export async function increaseStock(
  itemId: number,
  quantity: number
): Promise<StokKalemi[]> {
  if (quantity <= 0) throw new Error("Miktar 0'dan büyük olmalıdır.");

  // Mevcut miktarı çek
  const { data, error: fetchErr } = await supabase
    .from("stok")
    .select("miktar")
    .eq("id", itemId)
    .single();
  if (fetchErr || !data) throw fetchErr || new Error("Kalem bulunamadı.");

  const yeniMiktar = Number(data.miktar) + quantity;
  const { error: updateErr } = await supabase
    .from("stok")
    .update({ miktar: yeniMiktar })
    .eq("id", itemId);
  if (updateErr) throw updateErr;

  return fetchAllStok();
}

// ─────────────────────────────────────────────────────────────────
// 4. decreaseStockForBakim(bakimParcalar)
//    Bakım kaydındaki her parça için stoktan düşer.
//    ÖNCE validation yapar — yetersiz stok varsa hata FIRLAT
//    (işlem tamamen engellenir, hiçbir stok düşmez).
// ─────────────────────────────────────────────────────────────────

interface BakimParcaItem {
  id: number;
  ad: string;
  fiyat: number;
  adet: number;
}

/**
 * Stok yetersizlik hatası.
 * `hatalar` alanı, kullanıcıya gösterilecek mesajları içerir.
 */
export class StokYetersizError extends Error {
  hatalar: string[];
  constructor(hatalar: string[]) {
    super("Stok yetersiz");
    this.hatalar = hatalar;
  }
}

export async function decreaseStockForBakim(
  bakimParcalar: BakimParcaItem[]
): Promise<void> {
  // Mevcut stok durumunu çek
  const mevcutStok = await fetchAllStok();
  const stokMap = new Map<string, { id: number; miktar: number }>();
  mevcutStok.forEach((k) => stokMap.set(normalize(k.ad), { id: k.id, miktar: k.miktar }));

  // Toplam düşüm haritası: normalizeAd → düşülecek miktar
  const dusumHarita = new Map<string, number>();

  for (const item of bakimParcalar) {
    const normalAd = normalize(item.ad);
    const adet = item.adet || 1;
    const bilesenler = COMPOSITE_PARTS_MAPPING[normalAd];

    if (bilesenler) {
      // Takım ürünü → bileşenleri kaydet
      bilesenler.forEach((b) => {
        const nb = normalize(b);
        dusumHarita.set(nb, (dusumHarita.get(nb) || 0) + adet);
      });
    } else {
      // Tekli ürün → stokta varsa kaydet
      if (stokMap.has(normalAd)) {
        dusumHarita.set(normalAd, (dusumHarita.get(normalAd) || 0) + adet);
      }
      // Stokta tanımlanmayan parçayı atla (sadece katalog fiyatlaması için kullanılır)
    }
  }

  // ── VALIDATION: Tüm düşümleri kontrol et ──
  const hatalar: string[] = [];
  dusumHarita.forEach((gerekli, normalAd) => {
    const stokInfo = stokMap.get(normalAd);
    if (!stokInfo) {
      hatalar.push(`"${normalAd}" stok tablosunda bulunamadı.`);
      return;
    }
    if (stokInfo.miktar < gerekli) {
      hatalar.push(
        `⚠️ Yetersiz stok: "${normalAd}" — Mevcut: ${stokInfo.miktar} adet, Gereken: ${gerekli} adet`
      );
    }
  });

  // Hata varsa → hata fırlat (hiçbir stok düşmez)
  if (hatalar.length > 0) {
    throw new StokYetersizError(hatalar);
  }

  // ── DÜŞÜM: Tüm parçalar yeterliyse atomik olarak güncelle ──
  const guncellemePromises: Promise<void>[] = [];
  dusumHarita.forEach((gerekli, normalAd) => {
    const stokInfo = stokMap.get(normalAd);
    if (!stokInfo) return;
    const yeniMiktar = Math.max(0, stokInfo.miktar - gerekli);
    guncellemePromises.push(
      Promise.resolve(
        supabase
          .from("stok")
          .update({ miktar: yeniMiktar })
          .eq("id", stokInfo.id)
          .then(({ error }) => { if (error) throw error; })
      )
    );
  });

  await Promise.all(guncellemePromises);
}

// ─────────────────────────────────────────────────────────────────
// 5. restoreStockForBakim(bakimParcalar)
//    Bakım kaydı silindiğinde stoku geri yükler.
//    decreaseStockForBakim'in tam tersi — miktarları artırır.
//    Composite mapping'i de dikkate alır (takım → bileşenler).
// ─────────────────────────────────────────────────────────────────

interface BakimParcaItemForRestore {
  ad: string;
  adet: number;
  fiyat?: number;
  id?: number;
}

export async function restoreStockForBakim(
  bakimParcalar: BakimParcaItemForRestore[]
): Promise<void> {
  if (!bakimParcalar || bakimParcalar.length === 0) return;

  const mevcutStok = await fetchAllStok();
  const stokMap = new Map<string, { id: number; miktar: number }>();
  mevcutStok.forEach((k) => stokMap.set(normalize(k.ad), { id: k.id, miktar: k.miktar }));

  // Toplam geri yükleme haritası: normalizeAd → geri yüklenecek miktar
  const geriYuklemeHarita = new Map<string, number>();

  for (const item of bakimParcalar) {
    const normalAd = normalize(item.ad);
    const adet = item.adet || 1;
    const bilesenler = COMPOSITE_PARTS_MAPPING[normalAd];

    if (bilesenler) {
      // Takım ürünü → bileşenlerini geri yükle
      bilesenler.forEach((b) => {
        const nb = normalize(b);
        geriYuklemeHarita.set(nb, (geriYuklemeHarita.get(nb) || 0) + adet);
      });
    } else {
      // Tekli ürün → stokta varsa geri yükle
      if (stokMap.has(normalAd)) {
        geriYuklemeHarita.set(normalAd, (geriYuklemeHarita.get(normalAd) || 0) + adet);
      }
    }
  }

  // Tüm geri yüklemeleri paralel yap
  const promises: Promise<void>[] = [];
  geriYuklemeHarita.forEach((geri, normalAd) => {
    const stokInfo = stokMap.get(normalAd);
    if (!stokInfo) return;
    const yeniMiktar = stokInfo.miktar + geri;
    promises.push(
      Promise.resolve(
        supabase
          .from("stok")
          .update({ miktar: yeniMiktar })
          .eq("id", stokInfo.id)
          .then(({ error }) => { if (error) throw error; })
      )
    );
  });

  await Promise.all(promises);
}

// ─────────────────────────────────────────────────────────────────
// 6. decreaseStokByNameDirect (supabase.ts tarafından kullanılan yardımcı)
//    Tek bir kalem için ada göre direkt düşüm yapar.
// ─────────────────────────────────────────────────────────────────
export async function decreaseStokByNameDirect(
  ad: string,
  miktar: number
): Promise<void> {
  const mevcutStok = await fetchAllStok();
  const row = mevcutStok.find((k) => normalize(k.ad) === normalize(ad));
  if (!row) return; // Stokta tanımlı değilse atla
  const yeniMiktar = Math.max(0, row.miktar - miktar);
  await supabase.from("stok").update({ miktar: yeniMiktar }).eq("id", row.id);
}

// ─────────────────────────────────────────────────────────────────
// 6. calculateEffectiveStock(katalogAd, stokKalemleri)
//    Katalog parçasının adını ve mevcut stok listesini alır.
//    - Eğer parça takımsa, bileşenlerin MİNİMUM stok miktarını döndürür.
//    - Tekil ürünse, stok tablosundaki miktarını döndürür.
// ─────────────────────────────────────────────────────────────────
export function calculateEffectiveStock(
  katalogAd: string,
  stokKalemleri: StokKalemi[]
): number {
  const normalAd = normalize(katalogAd);
  const bilesenler = COMPOSITE_PARTS_MAPPING[normalAd];

  if (bilesenler) {
    // Takım ürünü: tüm bileşenlerin stoklarını bul, en düşüğünü al
    let minStok = Infinity;
    for (const bilesen of bilesenler) {
      const normalBilesen = normalize(bilesen);
      const stokKalem = stokKalemleri.find((k) => normalize(k.ad) === normalBilesen);
      const mevcut = stokKalem ? stokKalem.miktar : 0;
      if (mevcut < minStok) minStok = mevcut;
    }
    return minStok === Infinity ? 0 : minStok;
  } else {
    // Tekil ürün: doğrudan ismine göre stok tablosunda ara
    const stokKalem = stokKalemleri.find((k) => normalize(k.ad) === normalAd);
    return stokKalem ? stokKalem.miktar : 0;
  }
}
