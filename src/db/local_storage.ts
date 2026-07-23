import { Musteri, Parca, Bakim } from "../types";

const IS_BROWSER = typeof window !== "undefined";

const INITIAL_MUSTERILER: Musteri[] = [
  { id: 1, ad: "Ahmet Yılmaz", telefon: "0532 111 2233", adres: "Kadıköy, İstanbul", not: "Hafta sonları müsait, kombi bakımı düzenli yapılıyor." },
  { id: 2, ad: "Mehmet Kaya", telefon: "0544 222 3344", adres: "Çankaya, Ankara", not: "Klima bakımları Haziran ayında yapılır." },
  { id: 3, ad: "Ayşe Demir", telefon: "0555 333 4455", adres: "Karşıyaka, İzmir", not: "Isı pompası kullanıyor, yedek filtre bulundurulsun." }
];

const INITIAL_PARCALAR: Parca[] = [
  { id: 1, ad: "Yağ Filtresi (Standart)", fiyat: 250 },
  { id: 2, ad: "Hava Filtresi (Premium)", fiyat: 350 },
  { id: 3, ad: "Motor Yağı (4 Litre)", fiyat: 1200 },
  { id: 4, ad: "Kombi Esanjör Temizleme Sıvısı", fiyat: 450 },
  { id: 5, ad: "Radyatör Temizleme Kimyasalı", fiyat: 300 },
  { id: 6, ad: "Klima Gazı R410A (100gr)", fiyat: 180 }
];

const INITIAL_BAKIMLAR: Bakim[] = [
  {
    id: 1,
    musteri_id: 1,
    tarih: "2026-05-10",
    parcalar: JSON.stringify([
      { id: 1, ad: "Yağ Filtresi (Standart)", fiyat: 250, adet: 1 },
      { id: 3, ad: "Motor Yağı (4 Litre)", fiyat: 1200, adet: 1 }
    ]),
    toplam: 1450,
    not: "Yıllık periyodik yağ değişimi yapıldı. Sonraki bakım 1 yıl sonra.",
    odendi: 1
  },
  {
    id: 2,
    musteri_id: 2,
    tarih: "2026-06-15",
    parcalar: JSON.stringify([
      { id: 6, ad: "Klima Gazı R410A (100gr)", fiyat: 180, adet: 3 }
    ]),
    toplam: 540,
    not: "Klima gaz kaçağı kontrol edildi, vakum yapıldı, gaz tamamlandı.",
    odendi: 0
  }
];

export function getMusteriler(): Musteri[] {
  if (!IS_BROWSER) return INITIAL_MUSTERILER;
  const data = localStorage.getItem("tekapp_musteriler");
  if (!data) {
    localStorage.setItem("tekapp_musteriler", JSON.stringify(INITIAL_MUSTERILER));
    return INITIAL_MUSTERILER;
  }
  return JSON.parse(data);
}

export function saveMusteri(musteri: Omit<Musteri, "id"> & { id?: number }): Musteri[] {
  const musteriler = getMusteriler();
  if (musteri.id) {
    // Edit
    const index = musteriler.findIndex(m => m.id === musteri.id);
    if (index !== -1) {
      musteriler[index] = musteri as Musteri;
    }
  } else {
    // Add new
    const nextId = musteriler.length > 0 ? Math.max(...musteriler.map(m => m.id)) + 1 : 1;
    musteriler.push({ ...musteri, id: nextId } as Musteri);
  }
  localStorage.setItem("tekapp_musteriler", JSON.stringify(musteriler));
  return musteriler;
}

export function deleteMusteri(id: number): Musteri[] {
  const musteriler = getMusteriler().filter(m => m.id !== id);
  localStorage.setItem("tekapp_musteriler", JSON.stringify(musteriler));
  return musteriler;
}

export function getParcalar(): Parca[] {
  if (!IS_BROWSER) return INITIAL_PARCALAR;
  const data = localStorage.getItem("tekapp_parcalar");
  if (!data) {
    localStorage.setItem("tekapp_parcalar", JSON.stringify(INITIAL_PARCALAR));
    return INITIAL_PARCALAR;
  }
  return JSON.parse(data);
}

export function saveParca(parca: Omit<Parca, "id"> & { id?: number }): Parca[] {
  const parcalar = getParcalar();
  if (parca.id) {
    const index = parcalar.findIndex(p => p.id === parca.id);
    if (index !== -1) {
      parcalar[index] = parca as Parca;
    }
  } else {
    const nextId = parcalar.length > 0 ? Math.max(...parcalar.map(p => p.id)) + 1 : 1;
    parcalar.push({ ...parca, id: nextId } as Parca);
  }
  localStorage.setItem("tekapp_parcalar", JSON.stringify(parcalar));
  return parcalar;
}

export function deleteParca(id: number): Parca[] {
  const parcalar = getParcalar().filter(p => p.id !== id);
  localStorage.setItem("tekapp_parcalar", JSON.stringify(parcalar));
  return parcalar;
}

export function getBakimlar(): Bakim[] {
  if (!IS_BROWSER) return INITIAL_BAKIMLAR;
  const data = localStorage.getItem("tekapp_bakimlar");
  if (!data) {
    localStorage.setItem("tekapp_bakimlar", JSON.stringify(INITIAL_BAKIMLAR));
    return INITIAL_BAKIMLAR;
  }
  return JSON.parse(data);
}

export function saveBakim(bakim: Omit<Bakim, "id">): Bakim[] {
  const bakimlar = getBakimlar();
  const nextId = bakimlar.length > 0 ? Math.max(...bakimlar.map(b => b.id)) + 1 : 1;
  bakimlar.push({ ...bakim, id: nextId });
  localStorage.setItem("tekapp_bakimlar", JSON.stringify(bakimlar));
  return bakimlar;
}

export function deleteBakim(id: number): Bakim[] {
  const bakimlar = getBakimlar().filter(b => b.id !== id);
  localStorage.setItem("tekapp_bakimlar", JSON.stringify(bakimlar));
  return bakimlar;
}

export function updateBakimOdemeDurumu(id: number, odendi: number): Bakim[] {
  const bakimlar = getBakimlar();
  const index = bakimlar.findIndex(b => b.id === id);
  if (index !== -1) {
    bakimlar[index].odendi = odendi;
    localStorage.setItem("tekapp_bakimlar", JSON.stringify(bakimlar));
  }
  return bakimlar;
}

export function importAllData(data: { musteriler: Musteri[]; parcalar: Parca[]; bakimlar: Bakim[] }) {
  if (data.musteriler) localStorage.setItem("tekapp_musteriler", JSON.stringify(data.musteriler));
  if (data.parcalar) localStorage.setItem("tekapp_parcalar", JSON.stringify(data.parcalar));
  if (data.bakimlar) localStorage.setItem("tekapp_bakimlar", JSON.stringify(data.bakimlar));
}
