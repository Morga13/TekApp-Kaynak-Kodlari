export interface Musteri {
  id: number;
  ad: string;
  telefon: string;
  adres: string;
  not: string;
}

export interface Parca {
  id: number;
  ad: string;
  fiyat: number;
  stok: number;
}

export interface Bakim {
  id: number;
  musteri_id: number;
  tarih: string;
  parcalar: string; // SQLite JSON string of Parca[] or { id: number, ad: string, fiyat: number, adet: number }[]
  toplam: number;
  not: string;
  odendi: number; // 1: Ödendi, 0: Ödenmedi
}

export interface DeğişenParça {
  id: number;
  ad: string;
  fiyat: number;
  adet: number;
}

export interface StokKalemi {
  id: number;
  ad: string;
  miktar: number;
}
