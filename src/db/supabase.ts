import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { Musteri, Parca, Bakim, StokKalemi } from "../types";

// Supabase bağlantı bilgileri - .env dosyasından alınır
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const isSupabaseConfigured = () =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// ─────────────────────────────────────────
// MÜŞTERİLER
// ─────────────────────────────────────────

export async function getMusteriler(): Promise<Musteri[]> {
  const { data, error } = await supabase
    .from("musteriler")
    .select("*")
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
      })
      .eq("id", musteri.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("musteriler").insert({
      ad: musteri.ad,
      telefon: musteri.telefon,
      adres: musteri.adres,
      not: musteri.not,
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
  const { error } = await supabase.from("bakimlar").insert({
    musteri_id: bakim.musteri_id,
    tarih: bakim.tarih,
    parcalar: JSON.parse(bakim.parcalar),
    toplam: bakim.toplam,
    not: bakim.not,
    odendi: bakim.odendi,
  });
  if (error) throw error;
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
  if (data.musteriler?.length) {
    await supabase.from("musteriler").delete().neq("id", 0);
    await supabase.from("musteriler").insert(
      data.musteriler.map((m) => ({
        ad: m.ad,
        telefon: m.telefon,
        adres: m.adres,
        not: m.not,
      }))
    );
  }
  if (data.parcalar?.length) {
    await supabase.from("parcalar").delete().neq("id", 0);
    await supabase
      .from("parcalar")
      .insert(data.parcalar.map((p) => ({ ad: p.ad, fiyat: p.fiyat, stok: p.stok || 0 })));
  }
  if (data.bakimlar?.length) {
    await supabase.from("bakimlar").delete().neq("id", 0);
    await supabase.from("bakimlar").insert(
      data.bakimlar.map((b) => ({
        musteri_id: b.musteri_id,
        tarih: b.tarih,
        parcalar: JSON.parse(b.parcalar),
        toplam: b.toplam,
        not: b.not,
        odendi: b.odendi,
      }))
    );
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
