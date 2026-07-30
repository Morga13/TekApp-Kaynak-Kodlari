import { describe, it, expect } from 'vitest';

/**
 * Türkçe Arama & Filtreleme Testleri
 * Uygulamadaki toLocaleLowerCase("tr-TR") mantığını
 * izole ederek test eder.
 */

// ─── Arama Fonksiyonu — MusteriListesi ve StokYonetimi'nde kullanılan mantık ───
function turkceAra(liste: string[], kelime: string): string[] {
  const q = kelime.toLocaleLowerCase('tr-TR');
  return liste.filter(item =>
    item.toLocaleLowerCase('tr-TR').includes(q)
  );
}

// ─── Bakım Toplamı Hesaplama ─────────────────────────────────────────────────
interface BakimParcasi {
  fiyat: number;
  adet: number;
}

function bakimToplamHesapla(parcalar: BakimParcasi[]): number {
  return parcalar.reduce((toplam, p) => toplam + p.fiyat * p.adet, 0);
}

// ─── JSON Yedek Doğrulama — Ayarlar.tsx mantığı ─────────────────────────────
function yedekDogrula(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const data = raw as Record<string, unknown>;
  return (
    Array.isArray(data.musteriler) &&
    Array.isArray(data.parcalar) &&
    Array.isArray(data.bakimlar)
  );
}

// ─── TESTLER ─────────────────────────────────────────────────────────────────
describe('🔍 Türkçe Karakter Arama', () => {
  const isimler = ['İstanbul', 'Şanlıurfa', 'Çanakkale', 'Ğıldır', 'Ürgüp', 'izmir'];

  it('"istanbul" yazınca büyük İ ile başlayan "İstanbul" bulunmalı', () => {
    expect(turkceAra(isimler, 'istanbul')).toContain('İstanbul');
  });

  it('"şanlı" yazınca "Şanlıurfa" bulunmalı', () => {
    expect(turkceAra(isimler, 'şanlı')).toContain('Şanlıurfa');
  });

  it('"çanak" yazınca "Çanakkale" bulunmalı', () => {
    expect(turkceAra(isimler, 'çanak')).toContain('Çanakkale');
  });

  it('"ü" ile arama "Ürgüp" bulmalı', () => {
    expect(turkceAra(isimler, 'ü')).toContain('Ürgüp');
  });

  it('Boş arama string\'i tüm listeyi döndürmeli', () => {
    expect(turkceAra(isimler, '').length).toBe(isimler.length);
  });

  it('Eşleşmeyen arama boş dizi döndürmeli', () => {
    expect(turkceAra(isimler, 'xyzxyz').length).toBe(0);
  });

  it('Küçük harf "izmir" büyük "İzmir" yazılmış kayıtları da bulmalı', () => {
    const liste = ['İzmir Depo', 'Ankara'];
    expect(turkceAra(liste, 'izmir')).toContain('İzmir Depo');
  });
});

describe('💰 Bakım Toplamı Hesaplama', () => {
  it('Tek parça: fiyat × adet doğru olmalı', () => {
    const parcalar = [{ fiyat: 200, adet: 3 }];
    expect(bakimToplamHesapla(parcalar)).toBe(600);
  });

  it('Birden fazla parçanın toplamı doğru olmalı', () => {
    const parcalar = [
      { fiyat: 250, adet: 1 },
      { fiyat: 1200, adet: 2 },
      { fiyat: 180, adet: 3 },
    ];
    // 250 + 2400 + 540 = 3190
    expect(bakimToplamHesapla(parcalar)).toBe(3190);
  });

  it('Parça listesi boşsa toplam 0 olmalı', () => {
    expect(bakimToplamHesapla([])).toBe(0);
  });

  it('Adet 0 olan parça toplama katkı sağlamamalı', () => {
    const parcalar = [{ fiyat: 500, adet: 0 }];
    expect(bakimToplamHesapla(parcalar)).toBe(0);
  });

  it('Kesirli fiyatlar doğru toplanmalı', () => {
    const parcalar = [{ fiyat: 99.99, adet: 2 }];
    expect(bakimToplamHesapla(parcalar)).toBeCloseTo(199.98, 1);
  });
});

describe('📦 JSON Yedek Doğrulama (Ayarlar)', () => {
  it('Geçerli yedek formatı doğrulanmalı', () => {
    const yedek = { musteriler: [], parcalar: [], bakimlar: [] };
    expect(yedekDogrula(yedek)).toBe(true);
  });

  it('musteriler alanı eksikse geçersiz sayılmalı', () => {
    const bozuk = { parcalar: [], bakimlar: [] };
    expect(yedekDogrula(bozuk)).toBe(false);
  });

  it('Alanlar dizi değil nesne ise geçersiz sayılmalı', () => {
    const bozuk = { musteriler: {}, parcalar: [], bakimlar: [] };
    expect(yedekDogrula(bozuk)).toBe(false);
  });

  it('null input geçersiz sayılmalı', () => {
    expect(yedekDogrula(null)).toBe(false);
  });

  it('String input geçersiz sayılmalı', () => {
    expect(yedekDogrula('{"musteriler":[]}')).toBe(false);
  });

  it('Dizi içinde veri olsa da format geçerli sayılmalı', () => {
    const yedek = {
      musteriler: [{ id: 1, ad: 'Test', telefon: '', adres: '', not: '' }],
      parcalar: [{ id: 1, ad: 'Filtre', fiyat: 100, stok: 5 }],
      bakimlar: [],
    };
    expect(yedekDogrula(yedek)).toBe(true);
  });
});
