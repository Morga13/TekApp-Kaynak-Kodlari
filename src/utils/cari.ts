import { Bakim, Tahsilat, Taksit, CariHareket } from "../types";

const TAHSILATLAR_KEY = "tekapp_tahsilatlar";
const TAKSITLER_KEY = "tekapp_taksitler";

// ─────────────────────────────────────────
// LOCAL STORAGE YÖNETİMİ
// ─────────────────────────────────────────

export function getTahsilatlar(): Tahsilat[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(TAHSILATLAR_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveTahsilat(tahsilat: Omit<Tahsilat, "id"> & { id?: string }): Tahsilat[] {
  const list = getTahsilatlar();
  const newObj: Tahsilat = {
    ...tahsilat,
    id: tahsilat.id || `ths_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  };
  list.push(newObj);
  try {
    localStorage.setItem(TAHSILATLAR_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
  return list;
}

export function deleteTahsilat(id: string): Tahsilat[] {
  const list = getTahsilatlar().filter(t => t.id !== id);
  try {
    localStorage.setItem(TAHSILATLAR_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
  return list;
}

export function getTaksitler(): Taksit[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(TAKSITLER_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveTaksitler(yeniTaksitler: Taksit[]): Taksit[] {
  const mevcut = getTaksitler();
  // Yeni gelen taksitler varsa id eşleşmesiyle güncelle veya ekle
  const map = new Map<string, Taksit>();
  mevcut.forEach(t => map.set(t.id, t));
  yeniTaksitler.forEach(t => map.set(t.id, t));

  const list = Array.from(map.values());
  try {
    localStorage.setItem(TAKSITLER_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
  return list;
}

export function updateTaksitDurumu(taksitId: string, odendi: boolean, odemeTarihi?: string): { taksitler: Taksit[]; tahsilatlar: Tahsilat[] } {
  const taksitler = getTaksitler();
  const index = taksitler.findIndex(t => t.id === taksitId);
  let tahsilatlar = getTahsilatlar();

  if (index !== -1) {
    const target = taksitler[index];
    const eskiOdendi = target.odendi;
    target.odendi = odendi;
    target.odeme_tarihi = odendi ? (odemeTarihi || new Date().toISOString().split("T")[0]) : undefined;
    taksitler[index] = target;

    try {
      localStorage.setItem(TAKSITLER_KEY, JSON.stringify(taksitler));
    } catch { /* ignore */ }

    // Eğer taksit ödendiye çekildiyse ve önceden ödenmediyse, otomatik olarak Tahsilat (- Alacak) ekle
    if (odendi && !eskiOdendi) {
      tahsilatlar = saveTahsilat({
        musteri_id: target.musteri_id,
        bakim_id: target.bakim_id,
        taksit_id: target.id,
        tarih: target.odeme_tarihi || new Date().toISOString().split("T")[0],
        tutar: target.tutar,
        aciklama: `${target.taksit_no}/${target.toplam_taksit}. Taksit Ödemesi`
      });
    } else if (!odendi && eskiOdendi) {
      // Eğer ödeme iptal edildiyse, bu takside ait ilişkili tahsilat kaydını sil
      const iliskiliTahsilat = tahsilatlar.find(th => th.taksit_id === taksitId);
      if (iliskiliTahsilat) {
        tahsilatlar = deleteTahsilat(iliskiliTahsilat.id);
      }
    }
  }

  return { taksitler, tahsilatlar };
}

export function deleteTaksitPlan(bakimId: number): Taksit[] {
  const taksitler = getTaksitler().filter(t => t.bakim_id !== bakimId);
  try {
    localStorage.setItem(TAKSITLER_KEY, JSON.stringify(taksitler));
  } catch { /* ignore */ }
  return taksitler;
}

// ─────────────────────────────────────────
// HESAPLAMA & CARİ EKSTRE FONKSİYONLARI
// ─────────────────────────────────────────

export interface MusteriCariOzet {
  toplamAlacak: number;  // (+) Müşteriye sunulan hizmet/cihaz satışı toplamı
  tahsilEdilen: number;  // (-) Müşteriden alınan toplam ödeme
  kalanBakiye: number;   // Güncel Alacak / Net Borç (toplamAlacak - tahsilEdilen)
}

export function getMusteriCariOzet(
  musteriId: number,
  bakimlar: Bakim[],
  tahsilatlar: Tahsilat[] = getTahsilatlar()
): MusteriCariOzet {
  const mBakimlar = bakimlar.filter(b => b.musteri_id === musteriId);
  const mTahsilatlar = tahsilatlar.filter(t => t.musteri_id === musteriId);

  // Toplam Alacak = Bakım ve Cihaz Satışı tutarlarının toplamı
  const toplamAlacak = mBakimlar.reduce((sum, b) => sum + (b.toplam || 0), 0);

  // Geriye dönük uyumluluk: Eski kayıtlarda b.odendi === 1 olan ve tahsilatlar tablosunda henüz kaydı olmayan eski bakımlar için tahsilat hesapla
  let tahsilEdilen = mTahsilatlar.reduce((sum, t) => sum + (t.tutar || 0), 0);

  // Eski tekil odendi === 1 durumundaki bakımlar için tahsilatları dahil et (çift sayılmaması için kontrol)
  for (const b of mBakimlar) {
    if (b.odendi === 1) {
      const varMi = mTahsilatlar.some(t => t.bakim_id === b.id);
      if (!varMi) {
        tahsilEdilen += (b.toplam || 0);
      }
    }
  }

  const kalanBakiye = Math.max(0, toplamAlacak - tahsilEdilen);

  return {
    toplamAlacak,
    tahsilEdilen,
    kalanBakiye
  };
}

export function getMusteriCariHareketleri(
  musteriId: number,
  bakimlar: Bakim[],
  tahsilatlar: Tahsilat[] = getTahsilatlar()
): CariHareket[] {
  const mBakimlar = bakimlar.filter(b => b.musteri_id === musteriId);
  const mTahsilatlar = tahsilatlar.filter(t => t.musteri_id === musteriId);

  const hareketler: CariHareket[] = [];

  // 1. Borç Hareketleri (Bakım / Hizmet / Cihaz Satışı)
  for (const b of mBakimlar) {
    const isSatisi = b.is_cihaz_satisi || b.not?.toLowerCase().includes("cihaz satışı") || b.not?.toLowerCase().includes("cihaz satisi");
    hareketler.push({
      id: `bakim_${b.id}`,
      musteri_id: b.musteri_id,
      tarih: b.tarih,
      tip: "BORC",
      kategori: isSatisi ? "CIHAZ_SATISI" : "BAKIM",
      tutar: b.toplam || 0,
      baslik: isSatisi ? "📱 Cihaz Satışı" : "🛠️ Hizmet / Bakım",
      aciklama: b.not || (isSatisi ? "Cihaz satışı yapıldı" : "Servis ve bakım hizmeti"),
      ref_id: b.id
    });

    // Eski kayıtların geriye dönük ödeme logunu tarihe ekle (eğer tahsilatlarda yoksa)
    if (b.odendi === 1) {
      const varMi = mTahsilatlar.some(t => t.bakim_id === b.id);
      if (!varMi) {
        hareketler.push({
          id: `eski_odeme_${b.id}`,
          musteri_id: b.musteri_id,
          tarih: b.tarih,
          tip: "ALACAK",
          kategori: "TAHSILAT",
          tutar: b.toplam || 0,
          baslik: "💵 Ödeme Alındı",
          aciklama: "Tam Ödeme Kapatıldı (Eski Kayıt)",
          ref_id: b.id
        });
      }
    }
  }

  // 2. Alacak Hareketleri (Tahsilatlar / Ödemeler)
  for (const t of mTahsilatlar) {
    const isTaksit = Boolean(t.taksit_id || t.aciklama?.includes("Taksit"));
    hareketler.push({
      id: t.id,
      musteri_id: t.musteri_id,
      tarih: t.tarih,
      tip: "ALACAK",
      kategori: isTaksit ? "TAKSIT_ODEMESI" : "TAHSILAT",
      tutar: t.tutar || 0,
      baslik: isTaksit ? "💳 Taksit Ödemesi Alındı" : "💵 Ödeme Alındı",
      aciklama: t.aciklama || "Tahsilat yapıldı",
      ref_id: t.id
    });
  }

  // Tarihe göre yeniden eskiye (veya eskiden yeniye) sırala
  return hareketler.sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
}

// ─────────────────────────────────────────
// TAKSİT PLANI OLUŞTURMA YARDIMCISI
// ─────────────────────────────────────────

export function generateTaksitPlani(
  musteriId: number,
  bakimId: number | undefined,
  toplamTutar: number,
  taksitSayisi: number,
  baslangicVadeTarihi: string // YYYY-MM-DD
): Taksit[] {
  if (taksitSayisi <= 0 || toplamTutar <= 0) return [];

  const taksitler: Taksit[] = [];
  const birimTutar = Math.round(toplamTutar / taksitSayisi);
  let biriken = 0;

  const baseDate = new Date(baslangicVadeTarihi);

  for (let i = 1; i <= taksitSayisi; i++) {
    // Son taksitte yuvarlama farkını düzelt
    const tutar = i === taksitSayisi ? Math.max(0, toplamTutar - biriken) : birimTutar;
    biriken += tutar;

    const vadeDate = new Date(baseDate);
    vadeDate.setMonth(baseDate.getMonth() + (i - 1));
    const vadeStr = vadeDate.toISOString().split("T")[0];

    taksitler.push({
      id: `tks_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
      musteri_id: musteriId,
      bakim_id: bakimId,
      taksit_no: i,
      toplam_taksit: taksitSayisi,
      tutar,
      vade_tarihi: vadeStr,
      odendi: false
    });
  }

  return taksitler;
}
