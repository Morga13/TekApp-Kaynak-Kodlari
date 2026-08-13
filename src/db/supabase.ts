import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { Musteri, Parca, Bakim, StokKalemi, Tahsilat } from "../types";
import { restoreStockForBakim } from "../db/stok";

// Supabase bağlantı bilgileri - .env dosyasından alınır
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Güvenli başlatma: Boş URL/Key ile createClient çağrısı crash verebilir
export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-key"
);

export const isSupabaseConfigured = () =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// ─────────────────────────────────────────
// MÜŞTERİLER
// ─────────────────────────────────────────

export async function getMusteriler(): Promise<Musteri[]> {
  // Önce last_activity_at'e göre sıralamayı dene
  let { data, error } = await supabase
    .from("musteriler")
    .select("*")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

  // Eğer last_activity_at sütunu henüz veritabanında yoksa, id'ye göre sırala
  if (error) {
    const fallback = await supabase
      .from("musteriler")
      .select("*")
      .order("id", { ascending: false });
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  }
  return (data || []).map(rowToMusteri);
}

export async function saveMusteri(
  musteri: Omit<Musteri, "id"> & { id?: number }
): Promise<Musteri[]> {
  const payload: any = {
    ad: musteri.ad,
    telefon: musteri.telefon,
    adres: musteri.adres,
    not: musteri.not,
    last_activity_at: new Date().toISOString(),
  };

  if (musteri.id) {
    let { error } = await supabase
      .from("musteriler")
      .update(payload)
      .eq("id", musteri.id);
    
    // Eğer last_activity_at sütunu yoksa, onu çıkarıp tekrar dene
    if (error && (error.code === "42703" || error.message?.includes("last_activity_at"))) {
      delete payload.last_activity_at;
      const res = await supabase.from("musteriler").update(payload).eq("id", musteri.id);
      if (res.error) throw res.error;
    } else if (error) {
      throw error;
    }
  } else {
    let { error } = await supabase.from("musteriler").insert(payload);
    
    // Eğer last_activity_at sütunu yoksa, onu çıkarıp tekrar dene
    if (error && (error.code === "42703" || error.message?.includes("last_activity_at"))) {
      delete payload.last_activity_at;
      const res = await supabase.from("musteriler").insert(payload);
      if (res.error) throw res.error;
    } else if (error) {
      throw error;
    }
  }
  return getMusteriler();
}

export async function deleteMusteri(id: number): Promise<Musteri[]> {
  // Müşteri silinmeden önce tüm bakımlarını al ve stokları geri yükle
  try {
    const { data: musteriiBakimlari } = await supabase
      .from("bakimlar")
      .select("id, parcalar")
      .eq("musteri_id", id);

    if (musteriiBakimlari?.length) {
      for (const bakim of musteriiBakimlari) {
        try {
          const parcaList = typeof bakim.parcalar === "string"
            ? JSON.parse(bakim.parcalar)
            : (bakim.parcalar || []);
          if (Array.isArray(parcaList) && parcaList.length > 0) {
            await restoreStockForBakim(parcaList);
          }
        } catch { /* parse hatası olursa atla */ }
      }
    }
  } catch { /* stok geri yükleme başarısız olursa silmeye devam et */ }

  const { error } = await supabase.from("musteriler").delete().eq("id", id);
  if (error) throw error;
  return getMusteriler();
}

// ─────────────────────────────────────────
// PARÇALAR
// ─────────────────────────────────────────

export async function getParcalar(): Promise<Parca[]> {
  const { data, error } = await supabase
    .from("parcalar")
    .select("*")
    .order("id", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToParca);
}

export async function saveParca(
  parca: Omit<Parca, "id"> & { id?: number }
): Promise<Parca[]> {
  if (parca.id) {
    const { error } = await supabase
      .from("parcalar")
      .update({ ad: parca.ad, fiyat: parca.fiyat, stok: parca.stok || 0 })
      .eq("id", parca.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("parcalar")
      .insert({ ad: parca.ad, fiyat: parca.fiyat, stok: parca.stok || 0 });
    if (error) throw error;
  }
  return getParcalar();
}

export async function deleteParca(id: number): Promise<Parca[]> {
  const { error } = await supabase.from("parcalar").delete().eq("id", id);
  if (error) throw error;
  return getParcalar();
}

/**
 * Stok tablosundaki TÜM kalemleri parcalar tablosuna senkronize eder.
 * - Ada göre eşleşme (case-insensitive)
 * - parcalar'da olmayan stok kalemi → INSERT (fiyat=0)
 * - parcalar'da zaten olanlar → dokunulmaz (fiyat korunur)
 * Uygulama açılışında otomatik çağrılır.
 */
export async function syncStokToParcalar(): Promise<void> {
  try {
    // 1. Stok tablosundan tüm kalemleri al
    const { data: stokRows, error: stokErr } = await supabase
      .from("stok")
      .select("id, ad, miktar")
      .order("id", { ascending: true });
    if (stokErr || !stokRows?.length) return;

    // 2. Mevcut parcalar tablosunu al (ada göre set oluştur)
    const { data: parcaRows, error: parcaErr } = await supabase
      .from("parcalar")
      .select("ad");
    if (parcaErr) return;

    const mevcutAdlar = new Set(
      (parcaRows || []).map((p: { ad: string }) => p.ad.toLowerCase().trim())
    );

    // 3. Stokta olup parcalarda olmayanları toplu INSERT et
    const eklenecekler = stokRows
      .filter((s: { ad: string }) => !mevcutAdlar.has(s.ad.toLowerCase().trim()))
      .map((s: { ad: string }) => ({
        ad: s.ad,
        fiyat: 0,  // Fiyat belirsiz — kullanıcı ParcaKatalogunda düzenler
        stok: 0,
      }));

    if (eklenecekler.length === 0) return;

    await supabase.from("parcalar").insert(eklenecekler);
  } catch {
    // Sessizce başarısız ol — kritik değil
  }
}

// ─────────────────────────────────────────
// BAKIMLAR
// ─────────────────────────────────────────

export async function getBakimlar(): Promise<Bakim[]> {
  const { data, error } = await supabase
    .from("bakimlar")
    .select("*")
    .order("id", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToBakim);
}

export async function saveBakim(bakim: Omit<Bakim, "id">): Promise<Bakim[]> {
  let parcalarData: unknown;
  try {
    parcalarData = typeof bakim.parcalar === "string"
      ? JSON.parse(bakim.parcalar)
      : bakim.parcalar;
  } catch {
    parcalarData = [];
  }

  const insertPayload: any = {
    musteri_id: bakim.musteri_id,
    tarih: bakim.tarih,
    parcalar: parcalarData,
    toplam: bakim.toplam,
    not: bakim.not,
    odendi: bakim.odendi,
    indirim: bakim.indirim ?? 0,
  };

  let { error } = await supabase.from("bakimlar").insert(insertPayload);
  
  // Eğer indirim sütunu yoksa, indirim'i silip tekrar dene
  if (error && (error.code === "42703" || error.message?.includes("indirim"))) {
    delete insertPayload.indirim;
    const res = await supabase.from("bakimlar").insert(insertPayload);
    if (res.error) throw res.error;
  } else if (error) {
    throw error;
  }

  // Müşterinin last_activity_at'ini güncelle (hata verirse yok say)
  try {
    await supabase
      .from("musteriler")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", bakim.musteri_id);
  } catch { /* ignore if column missing */ }

  return getBakimlar();
}

/**
 * Mevcut bir bakım kaydının toplam tutarını ve/veya indirimini günceller.
 * Müşterinin last_activity_at'ini de günceller.
 */
export async function updateBakim(
  id: number,
  updates: { toplam?: number; indirim?: number; not?: string; odendi?: number }
): Promise<Bakim[]> {
  // Önce mevcut bakım kaydını al (musteri_id için)
  let musteriId: number | null = null;
  try {
    const { data: existing } = await supabase
      .from("bakimlar")
      .select("musteri_id")
      .eq("id", id)
      .single();
    if (existing) musteriId = existing.musteri_id;
  } catch { /* ignore */ }

  const updateData: any = { ...updates };
  let { error } = await supabase
    .from("bakimlar")
    .update(updateData)
    .eq("id", id);

  // Eğer indirim sütunu yoksa, indirim'i çıkarıp tekrar dene
  if (error && (error.code === "42703" || error.message?.includes("indirim"))) {
    delete updateData.indirim;
    const res = await supabase.from("bakimlar").update(updateData).eq("id", id);
    if (res.error) throw res.error;
  } else if (error) {
    throw error;
  }

  // Müşterinin last_activity_at'ini güncelle (hata verirse yok say)
  if (musteriId) {
    try {
      await supabase
        .from("musteriler")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", musteriId);
    } catch { /* ignore */ }
  }

  return getBakimlar();
}


export async function deleteBakim(id: number): Promise<Bakim[]> {
  // Silmeden ònce bakımın parçalarını çekip stoku geri yükle
  try {
    const { data: bakim } = await supabase
      .from("bakimlar")
      .select("parcalar")
      .eq("id", id)
      .single();

    if (bakim) {
      const parcaList = typeof bakim.parcalar === "string"
        ? JSON.parse(bakim.parcalar)
        : (bakim.parcalar || []);
      if (Array.isArray(parcaList) && parcaList.length > 0) {
        await restoreStockForBakim(parcaList);
      }
    }
  } catch { /* stok geri yükleme başarısız olursa silmeye devam et */ }

  const { error } = await supabase.from("bakimlar").delete().eq("id", id);
  if (error) throw error;
  return getBakimlar();
}

export async function updateBakimOdemeDurumu(
  id: number,
  odendi: number
): Promise<Bakim[]> {
  const { error } = await supabase
    .from("bakimlar")
    .update({ odendi })
    .eq("id", id);
  if (error) throw error;
  return getBakimlar();
}

export async function importAllData(data: {
  musteriler: Musteri[];
  parcalar: Parca[];
  bakimlar: Bakim[];
}) {
  // Müşteriler
  if (data.musteriler?.length) {
    const { error: delErr } = await supabase.from("musteriler").delete().neq("id", 0);
    if (delErr) throw new Error("Müşteri verileri silinirken hata: " + delErr.message);
    const { error: insErr } = await supabase.from("musteriler").insert(
      data.musteriler.map((m) => ({
        ad: m.ad,
        telefon: m.telefon || "",
        adres: m.adres || "",
        not: m.not || "",
      }))
    );
    if (insErr) throw new Error("Müşteri verileri eklenirken hata: " + insErr.message);
  }
  // Parçalar
  if (data.parcalar?.length) {
    const { error: delErr } = await supabase.from("parcalar").delete().neq("id", 0);
    if (delErr) throw new Error("Parça verileri silinirken hata: " + delErr.message);
    const { error: insErr } = await supabase
      .from("parcalar")
      .insert(data.parcalar.map((p) => ({ ad: p.ad, fiyat: p.fiyat, stok: p.stok || 0 })));
    if (insErr) throw new Error("Parça verileri eklenirken hata: " + insErr.message);
  }
  // Bakımlar
  if (data.bakimlar?.length) {
    const { error: delErr } = await supabase.from("bakimlar").delete().neq("id", 0);
    if (delErr) throw new Error("Bakım verileri silinirken hata: " + delErr.message);
    const { error: insErr } = await supabase.from("bakimlar").insert(
      data.bakimlar.map((b) => {
        let parcalarData: unknown;
        try {
          parcalarData = typeof b.parcalar === "string" ? JSON.parse(b.parcalar) : b.parcalar;
        } catch {
          parcalarData = [];
        }
        return {
          musteri_id: b.musteri_id,
          tarih: b.tarih,
          parcalar: parcalarData,
          toplam: b.toplam,
          not: b.not || "",
          odendi: b.odendi || 0,
        };
      })
    );
    if (insErr) throw new Error("Bakım verileri eklenirken hata: " + insErr.message);
  }
}

// ─────────────────────────────────────────
// TAHSİLATLAR (Supabase - Tüm Cihazlarda Senkronize)
// ─────────────────────────────────────────

/**
 * Supabase'den tüm tahsilat kayıtlarını çeker.
 * localStorage fallback: Supabase erişilemezse localStorage'dan okur.
 */
export async function getTahsilatlar(): Promise<Tahsilat[]> {
  try {
    const { data, error } = await supabase
      .from("tahsilatlar")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToTahsilat);
  } catch (err) {
    // Supabase erişilemezse localStorage'dan oku (offline fallback)
    console.warn("Supabase tahsilatlar yüklenemedi, localStorage fallback:", err);
    try {
      const raw = localStorage.getItem("tekapp_tahsilatlar");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

/**
 * Yeni bir tahsilat kaydını Supabase'e kaydeder.
 * Başarısız olursa localStorage'a yazar (offline fallback).
 */
export async function saveTahsilatToSupabase(
  tahsilat: Omit<Tahsilat, "id"> & { id?: string }
): Promise<Tahsilat[]> {
  const payload = {
    id: tahsilat.id || undefined, // let DB generate if undefined
    musteri_id: tahsilat.musteri_id,
    bakim_id: tahsilat.bakim_id || null,
    taksit_id: tahsilat.taksit_id || null,
    tarih: tahsilat.tarih,
    tutar: tahsilat.tutar,
    aciklama: tahsilat.aciklama || "Tahsilat",
  };

  const { error } = await supabase.from("tahsilatlar").insert(payload);
  if (error) throw error;
  return getTahsilatlar();
}

/**
 * Bir tahsilat kaydını Supabase'den siler.
 */
export async function deleteTahsilatFromSupabase(id: string): Promise<Tahsilat[]> {
  const { error } = await supabase.from("tahsilatlar").delete().eq("id", id);
  if (error) throw error;
  return getTahsilatlar();
}

// ─────────────────────────────────────────
// GERÇEK ZAMANLI SENKRONIZASYON
// Bir cihazda değişiklik → tüm cihazlarda anında yansır
// ─────────────────────────────────────────

export function subscribeToChanges(onUpdate: () => void): RealtimeChannel {
  const channel = supabase
    .channel("tekapp-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "musteriler" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "parcalar" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bakimlar" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      // TAHSİLATLAR: iOS'ta ödeme yapıldığında Android'e anında yansır
      { event: "*", schema: "public", table: "tahsilatlar" },
      () => onUpdate()
    )
    .subscribe();
  return channel;
}

export function unsubscribe(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}

// ─────────────────────────────────────────
// YARDIMCI FONKSİYONLAR
// ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMusteri(row: any): Musteri {
  return {
    id: row.id,
    ad: row.ad,
    telefon: row.telefon || "",
    adres: row.adres || "",
    not: row.not || "",
    last_activity_at: row.last_activity_at || undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToParca(row: any): Parca {
  return {
    id: row.id,
    ad: row.ad,
    fiyat: Number(row.fiyat),
    stok: Number(row.stok || 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBakim(row: any): Bakim {
  return {
    id: row.id,
    musteri_id: row.musteri_id,
    tarih: row.tarih,
    parcalar: typeof row.parcalar === "string"
      ? row.parcalar
      : JSON.stringify(row.parcalar || []),
    toplam: Number(row.toplam),
    not: row.not || "",
    odendi: row.odendi || 0,
    indirim: row.indirim != null ? Number(row.indirim) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTahsilat(row: any): Tahsilat {
  return {
    id: row.id,
    musteri_id: row.musteri_id,
    bakim_id: row.bakim_id || undefined,
    taksit_id: row.taksit_id || undefined,
    tarih: row.tarih,
    tutar: Number(row.tutar),
    aciklama: row.aciklama || "Tahsilat",
  };
}

// ─────────────────────────────────────────
// STOK
// ─────────────────────────────────────────

export async function getStok(): Promise<StokKalemi[]> {
  const { data, error } = await supabase
    .from("stok")
    .select("*")
    .order("id", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToStok);
}

export async function updateStokMiktar(
  id: number,
  miktar: number
): Promise<StokKalemi[]> {
  const { error } = await supabase
    .from("stok")
    .update({ miktar: Math.max(0, miktar) })
    .eq("id", id);
  if (error) throw error;
  return getStok();
}

export async function addStokKalemi(
  ad: string,
  miktar: number
): Promise<StokKalemi[]> {
  const { error } = await supabase
    .from("stok")
    .insert({ ad: ad.trim(), miktar: Math.max(0, miktar) });
  if (error) throw error;
  return getStok();
}

export async function deleteStokKalemi(id: number): Promise<StokKalemi[]> {
  const { error } = await supabase.from("stok").delete().eq("id", id);
  if (error) throw error;
  return getStok();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToStok(row: any): StokKalemi {
  return {
    id: row.id,
    ad: row.ad,
    miktar: Number(row.miktar ?? 0),
  };
}
