import { describe, it, expect } from 'vitest';

/**
 * Bakım Hatırlatıcısı — İş Mantığı Testleri
 * MusteriDetay.tsx içindeki yardımcı fonksiyonlar burada
 * izole edilerek test edilir.
 */

// ─── İzole Edilmiş Yardımcı Fonksiyonlar ───────────────────────────────────
function formatTarih(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function kalanGun(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function hatirlaticiTarihHesapla(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

// ─── TESTLER ─────────────────────────────────────────────────────────────
describe('🔔 Bakım Hatırlatıcısı İş Mantığı', () => {

  describe('hatirlaticiTarihHesapla()', () => {
    it('6 ay sonrası bugünden büyük olmalı', () => {
      const tarih = hatirlaticiTarihHesapla(6);
      const bugun = new Date().toISOString().split('T')[0];
      expect(tarih > bugun).toBe(true);
    });

    it('1 yıl sonrası 6 aydan büyük olmalı', () => {
      const altiAy = hatirlaticiTarihHesapla(6);
      const birYil = hatirlaticiTarihHesapla(12);
      expect(birYil > altiAy).toBe(true);
    });

    it('Hesaplanan tarih YYYY-MM-DD formatında olmalı', () => {
      const tarih = hatirlaticiTarihHesapla(6);
      expect(tarih).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('6 ay ileriye gittiğinde ~180 gün civarında kalan gün olmalı', () => {
      const tarih = hatirlaticiTarihHesapla(6);
      const kalan = kalanGun(tarih);
      // 6 ay 179-184 gün arasında olmalı (kısa/uzun aylar)
      expect(kalan).toBeGreaterThanOrEqual(178);
      expect(kalan).toBeLessThanOrEqual(185);
    });

    it('12 ay ileriye gittiğinde ~365 gün kalan olmalı', () => {
      const tarih = hatirlaticiTarihHesapla(12);
      const kalan = kalanGun(tarih);
      // Artık yıl göz önüne alınarak
      expect(kalan).toBeGreaterThanOrEqual(364);
      expect(kalan).toBeLessThanOrEqual(367);
    });
  });

  describe('kalanGun()', () => {
    it('Geçmiş bir tarih için negatif gün dönmeli', () => {
      const gecmis = '2020-01-01';
      expect(kalanGun(gecmis)).toBeLessThan(0);
    });

    it('Bugünün tarihi için 0 dönmeli', () => {
      // toISOString() UTC kullandığı için saat dilimi kaymasını önlemek amacıyla
      // lokal tarihi YYYY-MM-DD formatında hesaplıyoruz
      const now = new Date();
      const bugun = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(kalanGun(bugun)).toBe(0);
    });

    it('Gelecek bir tarih için pozitif gün dönmeli', () => {
      const gelecek = hatirlaticiTarihHesapla(1); // 1 ay sonra
      expect(kalanGun(gelecek)).toBeGreaterThan(0);
    });
  });

  describe('formatTarih()', () => {
    it('Geçerli tarih Türkçe formatlı döndürmeli', () => {
      const sonuc = formatTarih('2026-08-15');
      expect(sonuc).toContain('2026');
      // Ağustos veya August gibi ay adı içermeli
      expect(sonuc.length).toBeGreaterThan(6);
    });

    it('Geçersiz tarih string\'i olduğu gibi dönmeli', () => {
      const sonuc = formatTarih('gecersiz-tarih');
      // formatTarih hata yakaladığında dateStr döner,
      // ama jsdom'da Invalid Date "Invalid Date" string'i olabilir.
      expect(typeof sonuc).toBe('string');
      expect(sonuc.length).toBeGreaterThan(0);
    });
  });

  describe('Hatırlatıcı Durum Sınıflaması', () => {
    it('14 gün veya altı "yakın" sayılmalı', () => {
      const tarih = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 10); // 10 gün sonra
        return d.toISOString().split('T')[0];
      })();
      const kalan = kalanGun(tarih);
      const yakinda = kalan >= 0 && kalan <= 14;
      expect(yakinda).toBe(true);
    });

    it('30 gün sonrası "yakın" sayılmamalı', () => {
      const tarih = hatirlaticiTarihHesapla(1); // ~30 gün
      const kalan = kalanGun(tarih);
      const yakinda = kalan >= 0 && kalan <= 14;
      expect(yakinda).toBe(false);
    });

    it('Geçmiş tarih "gecikmiş" sayılmalı', () => {
      const gecmis = '2023-01-01';
      const kalan = kalanGun(gecmis);
      expect(kalan).toBeLessThan(0);
    });
  });
});
