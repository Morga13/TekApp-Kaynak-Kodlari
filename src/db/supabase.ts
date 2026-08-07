import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { Musteri, Parca, Bakim, StokKalemi } from "../types";

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
  // Önce last_activity_at'e göre sırala (en son işlem en üstte)
  // Eski kayıtlarda last_activity_at null olabilir — onlar id'ye göre geri düşer
  const { data, error } = await supabase
    .from("musteriler")
    .select("*")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToMusteri);
}

export async function saveMusteri(
  musteri: Omit<Musteri, "id"> & { id?: number }
): Promise<Musteri[]> {
  if (musteri.id) {
    const { error } = await supabase
      .from("musteriler")
      .update({
        ad: musteri.ad,
        telefon: musteri.telefon,
        adres: musteri.adres,
        not: musteri.not,
        last_activity_at: new Date().toISOString(), // Düzenleme de aktivite sayılır
      })
      .eq("id", musteri.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("musteriler").insert({
      ad: musteri.ad,
      telefon: musteri.telefon,
      adres: musteri.adres,
      not: musteri.not,
      last_activity_at: new Date().toISOString(), // Yeni müşteri: kayıt zamanı
    });
    if (error) throw error;
  }
  return getMusteriler();
}

export async function deleteMusteri(id: number): Promise<Musteri[]> {
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
  // Güvenli JSON parse: parcalar zaten obje ise tekrar parse etme
  let parcalarData: unknown;
  try {
    parcalarData = typeof bakim.parcalar === "string"
      ? JSON.parse(bakim.parcalar)
      : bakim.parcalar;
  } catch {
    parcalarData = [];
  }

  const { error } = await supabase.from("bakimlar").insert({
    musteri_id: bakim.musteri_id,
    tarih: bakim.tarih,
    parcalar: parcalarData,
    toplam: bakim.toplam,
    not: bakim.not,
    odendi: bakim.odendi,
    indirim: bakim.indirim ?? 0,
  });
  if (error) throw error;

  // Müşterinin last_activity_at'ini güncelle (dinamik sıralama için)
  await supabase
    .from("musteriler")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", bakim.musteri_id);

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
  const { data: existing, error: fetchErr } = await supabase
    .from("bakimlar")
    .select("musteri_id")
    .eq("id", id)
    .single();
  if (fetchErr) throw fetchErr;

  const { error } = await supabase
    .from("bakimlar")
    .update(updates)
    .eq("id", id);
  if (error) throw error;

  // Müşterinin last_activity_at'ini güncelle
  if (existing?.musteri_id) {
    await supabase
      .from("musteriler")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", existing.musteri_id);
  }

  return getBakimlar();
}

export async function deleteBakim(id: number): Promise<Bakim[]> {
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
