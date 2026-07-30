import { describe, it, expect, beforeEach } from 'vitest';
import {
  getMusteriler,
  saveMusteri,
  deleteMusteri,
  getParcalar,
  saveParca,
  getBakimlar,
  saveBakim,
  deleteBakim,
  updateBakimOdemeDurumu,
  importAllData,
} from '../db/local_storage';

describe('🗄️ LocalStorage Veritabanı (local_storage.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ─── MÜŞTERİ CRUD ───────────────────────────────────────────
  describe('getMusteriler()', () => {
    it('İlk çağrıda demo müşteriler yüklenmeli', () => {
      const musteriler = getMusteriler();
      expect(musteriler.length).toBeGreaterThan(0);
    });

    it('Her müşteri id, ad, telefon, adres alanlarını içermeli', () => {
      const musteriler = getMusteriler();
      for (const m of musteriler) {
        expect(m).toHaveProperty('id');
        expect(m).toHaveProperty('ad');
        expect(m).toHaveProperty('telefon');
        expect(m).toHaveProperty('adres');
      }
    });
  });

  describe('saveMusteri() — Ekleme', () => {
    it('Yeni müşteri eklenince liste büyümeli', () => {
      const onceki = getMusteriler().length;
      saveMusteri({ ad: 'Test Kişi', telefon: '05551234567', adres: 'İstanbul', not: '' });
      expect(getMusteriler().length).toBe(onceki + 1);
    });

    it('Yeni müştericinin adı kaydedilmeli', () => {
      saveMusteri({ ad: 'Ayşe Hanım', telefon: '05001112233', adres: 'Ankara', not: '' });
      const musteriler = getMusteriler();
      expect(musteriler.some(m => m.ad === 'Ayşe Hanım')).toBe(true);
    });

    it('Benzersiz artan ID atamalı', () => {
      saveMusteri({ ad: 'A', telefon: '', adres: '', not: '' });
      saveMusteri({ ad: 'B', telefon: '', adres: '', not: '' });
      const ids = getMusteriler().map(m => m.id);
      const uniqIds = new Set(ids);
      expect(uniqIds.size).toBe(ids.length);
    });
  });

  describe('saveMusteri() — Güncelleme', () => {
    it('Var olan müşteri güncellenince aynı ID korunmalı', () => {
      const musteriler = getMusteriler();
      const ilk = musteriler[0];
      saveMusteri({ ...ilk, ad: 'Güncellenmiş Ad' });
      const guncellenmis = getMusteriler().find(m => m.id === ilk.id);
      expect(guncellenmis?.ad).toBe('Güncellenmiş Ad');
    });

    it('Güncelleme müşteri sayısını değiştirmemeli', () => {
      const onceki = getMusteriler().length;
      const ilk = getMusteriler()[0];
      saveMusteri({ ...ilk, telefon: '999' });
      expect(getMusteriler().length).toBe(onceki);
    });
  });

  describe('deleteMusteri()', () => {
    it('Silinen müşteri listede olmamalı', () => {
      const ilk = getMusteriler()[0];
      deleteMusteri(ilk.id);
      expect(getMusteriler().some(m => m.id === ilk.id)).toBe(false);
    });

    it('Olmayan ID silinince liste değişmemeli', () => {
      const onceki = getMusteriler().length;
      deleteMusteri(99999);
      expect(getMusteriler().length).toBe(onceki);
    });
  });

  // ─── PARÇA CRUD ─────────────────────────────────────────────
  describe('getParcalar()', () => {
    it('İlk çağrıda demo parçalar yüklenmeli', () => {
      expect(getParcalar().length).toBeGreaterThan(0);
    });

    it('Her parçanın stok alanı 0 veya üzeri olmalı', () => {
      for (const p of getParcalar()) {
        expect(p.stok).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('saveParca() — Ekleme', () => {
    it('Yeni parça eklenince liste büyümeli', () => {
      const onceki = getParcalar().length;
      saveParca({ ad: 'Test Filtre', fiyat: 500, stok: 10 });
      expect(getParcalar().length).toBe(onceki + 1);
    });
  });

  // ─── BAKIM CRUD ─────────────────────────────────────────────
  describe('saveBakim() & getBakimlar()', () => {
    it('Yeni bakım kaydı eklenince listede görünmeli', () => {
      const onceki = getBakimlar().length;
      saveBakim({
        musteri_id: 1,
        tarih: '2026-08-01',
        parcalar: JSON.stringify([{ id: 1, ad: 'Filtre', fiyat: 200, adet: 1 }]),
        toplam: 200,
        not: 'Test bakım',
        odendi: 0,
      });
      expect(getBakimlar().length).toBe(onceki + 1);
    });
  });

  describe('deleteBakim()', () => {
    it('Silinen bakım kaydı listede olmamalı', () => {
      saveBakim({
        musteri_id: 1,
        tarih: '2026-08-01',
        parcalar: '[]',
        toplam: 0,
        not: '',
        odendi: 0,
      });
      const son = getBakimlar().at(-1)!;
      deleteBakim(son.id);
      expect(getBakimlar().some(b => b.id === son.id)).toBe(false);
    });
  });

  describe('updateBakimOdemeDurumu()', () => {
    it('Ödeme durumu 0\'dan 1\'e güncellenmeli', () => {
      saveBakim({ musteri_id: 1, tarih: '2026-08-01', parcalar: '[]', toplam: 100, not: '', odendi: 0 });
      const bakim = getBakimlar().at(-1)!;
      updateBakimOdemeDurumu(bakim.id, 1);
      const guncellenmis = getBakimlar().find(b => b.id === bakim.id);
      expect(guncellenmis?.odendi).toBe(1);
    });

    it('Ödeme durumu 1\'den 0\'a geri alınabilmeli', () => {
      saveBakim({ musteri_id: 1, tarih: '2026-08-01', parcalar: '[]', toplam: 100, not: '', odendi: 1 });
      const bakim = getBakimlar().at(-1)!;
      updateBakimOdemeDurumu(bakim.id, 0);
      expect(getBakimlar().find(b => b.id === bakim.id)?.odendi).toBe(0);
    });
  });

  // ─── YEDEK AKTARIMI ─────────────────────────────────────────
  describe('importAllData()', () => {
    it('Yedek veriler doğru şekilde yüklenmeli', () => {
      importAllData({
        musteriler: [{ id: 99, ad: 'Import Test', telefon: '999', adres: 'Test', not: '' }],
        parcalar: [],
        bakimlar: [],
      });
      expect(getMusteriler().some(m => m.id === 99)).toBe(true);
    });

    it('Yedek yüklenince eski veriler temizlenmeli', () => {
      // Önce bir şey ekle
      saveMusteri({ ad: 'Eski Kayıt', telefon: '', adres: '', not: '' });
      // Sonra yedek yükle
      importAllData({
        musteriler: [{ id: 77, ad: 'Yeni Kayıt', telefon: '', adres: '', not: '' }],
        parcalar: [],
        bakimlar: [],
      });
      const musteriler = getMusteriler();
      expect(musteriler.some(m => m.id === 77)).toBe(true);
      // Eski kayıt import sonrası silinmiş olmalı
      expect(musteriler.some(m => m.ad === 'Eski Kayıt')).toBe(false);
    });
  });
});
