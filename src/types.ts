export interface Musteri {
  id: number;
  ad: string;
  telefon: string;
  adres: string;
  not: string;
  last_activity_at?: string; // ISO timestamp - en son işlem zamanı (müşteri listesi sıralama için)
}

export interface Parca {
  id: number;
  ad: string;
  fiyat: number;
  stok: number;
}

export interface Tahsilat {
  id: string;
  musteri_id: number;
  tarih: string;
  tutar: number;
  aciklama: string;
  taksit_id?: string;
  bakim_id?: number;
}

export interface Taksit {
  id: string;
  musteri_id: number;
  bakim_id?: number;
  taksit_no: number;
  toplam_taksit: number;
  tutar: number;
  vade_tarihi: string;
  odendi: boolean;
  odeme_tarihi?: string;
}

export interface CariHareket {
  id: string;
  musteri_id: number;
  tarih: string;
  tip: "BORC" | "ALACAK"; // BORC (+): Satış/Hizmet | ALACAK (-): Ödeme
  kategori: "BAKIM" | "CIHAZ_SATISI" | "TAHSILAT" | "TAKSIT_ODEMESI";
  tutar: number;
  baslik: string;
  aciklama: string;
  ref_id?: number | string;
}

export interface Bakim {
  id: number;
  musteri_id: number;
  tarih: string;
  parcalar: string; // SQLite JSON string of Parca[] or { id: number, ad: string, fiyat: number, adet: number }[]
  toplam: number;
  not: string;
  odendi: number; // 1: Ödendi, 0: Ödenmedi
  is_cihaz_satisi?: boolean; // Cihaz Satışı olarak işaretlenmiş mi?
  indirim?: number; // İndirim tutarı (TL) - sonradan düzenlenebilir
}

export interface DegisenParca {
  id: number;
  ad: string;
  fiyat: number;
  adet: number;
}

// Geriye dönük uyumluluk aliası
export type DeğişenParça = DegisenParca;

export interface StokKalemi {
  id: number;
  ad: string;
  miktar: number;
}
