import { describe, it, expect } from 'vitest';
import {
  COMPOSITE_PARTS_MAPPING,
  isHighThresholdPart,
  getStokDurumu,
} from '../db/stok';

describe('📦 COMPOSITE_PARTS_MAPPING — Set ve Takım Eşlemeleri', () => {
  // ── 5'li Setler ──────────────────────────────────────────────────
  it("5'li Set - Kapalı tüm 5 filtreyi içermeli", () => {
    const parts = COMPOSITE_PARTS_MAPPING["5'li set - kapalı"];
    expect(parts).toBeDefined();
    expect(parts).toEqual([
      "1. filtre kapalı",
      "2. filtre kapalı",
      "3. filtre kapalı",
      "membran",
      "tatlandırıcı",
    ]);
  });

  it("5'li Set - Kapalı (Kokonat) kokonatlı filtreleri ve membran/tatlandırıcı içermeli", () => {
    const parts = COMPOSITE_PARTS_MAPPING["5'li set - kapalı (kokonat)"];
    expect(parts).toBeDefined();
    expect(parts).toEqual([
      "1. filtre kapalı kokonatlı",
      "2. filtre kapalı kokonatlı",
      "3. filtre kapalı kokonatlı",
      "membran",
      "tatlandırıcı",
    ]);
  });

  it("5'li Set - Açık açık filtreleri ve membran/tatlandırıcı içermeli", () => {
    const parts = COMPOSITE_PARTS_MAPPING["5'li set - açık"];
    expect(parts).toBeDefined();
    expect(parts).toEqual([
      "1. filtre açık",
      "2. filtre açık",
      "3. filtre açık",
      "membran",
      "tatlandırıcı",
    ]);
  });

  // ── 4'lü Setler ──────────────────────────────────────────────────
  it("4'lü Set - Kapalı 3 ön filtre ve membran içermeli (tatlandırıcısız)", () => {
    const parts = COMPOSITE_PARTS_MAPPING["4'lü set - kapalı"];
    expect(parts).toBeDefined();
    expect(parts).toEqual([
      "1. filtre kapalı",
      "2. filtre kapalı",
      "3. filtre kapalı",
      "membran",
    ]);
  });

  it("4'lü Set - Kapalı (Kokonat) kokonatlı ön filtreler ve membran içermeli", () => {
    const parts = COMPOSITE_PARTS_MAPPING["4'lü set - kapalı (kokonat)"];
    expect(parts).toBeDefined();
    expect(parts).toEqual([
      "1. filtre kapalı kokonatlı",
      "2. filtre kapalı kokonatlı",
      "3. filtre kapalı kokonatlı",
      "membran",
    ]);
  });

  it("4'lü Set - Açık açık ön filtreler ve membran içermeli", () => {
    const parts = COMPOSITE_PARTS_MAPPING["4'lü set - açık"];
    expect(parts).toBeDefined();
    expect(parts).toEqual([
      "1. filtre açık",
      "2. filtre açık",
      "3. filtre açık",
      "membran",
    ]);
  });

  // ── 3'lü Setler ──────────────────────────────────────────────────
  it("3'lü Set - Kapalı sadece 3 kapalı ön filtreyi içermeli", () => {
    const parts = COMPOSITE_PARTS_MAPPING["3'lü set - kapalı"];
    expect(parts).toBeDefined();
    expect(parts).toEqual([
      "1. filtre kapalı",
      "2. filtre kapalı",
      "3. filtre kapalı",
    ]);
  });

  it("3'lü Set - Kapalı (Kokonat) sadece 3 kokonatlı ön filtreyi içermeli", () => {
    const parts = COMPOSITE_PARTS_MAPPING["3'lü set - kapalı (kokonat)"];
    expect(parts).toBeDefined();
    expect(parts).toEqual([
      "1. filtre kapalı kokonatlı",
      "2. filtre kapalı kokonatlı",
      "3. filtre kapalı kokonatlı",
    ]);
  });

  it("3'lü Set - Açık sadece 3 açık ön filtreyi içermeli", () => {
    const parts = COMPOSITE_PARTS_MAPPING["3'lü set - açık"];
    expect(parts).toBeDefined();
    expect(parts).toEqual([
      "1. filtre açık",
      "2. filtre açık",
      "3. filtre açık",
    ]);
  });

  // ── Geriye Dönük Uyumluluk (Eski Bakım Kayıtları) ────────────────
  it('Eski format isimler doğru bileşenlere çözülmeli', () => {
    expect(COMPOSITE_PARTS_MAPPING['5li takım kapalı']).toBeDefined();
    expect(COMPOSITE_PARTS_MAPPING['5li takım kokonat']).toBeDefined();
    expect(COMPOSITE_PARTS_MAPPING['5li takım açık']).toBeDefined();
    expect(COMPOSITE_PARTS_MAPPING['4lü takım kapalı']).toBeDefined();
    expect(COMPOSITE_PARTS_MAPPING['4lü takım kokonat']).toBeDefined();
    expect(COMPOSITE_PARTS_MAPPING['4lü takım açık']).toBeDefined();
    expect(COMPOSITE_PARTS_MAPPING['3 filtre kapalı']).toBeDefined();
    expect(COMPOSITE_PARTS_MAPPING['3 filtre kokonat']).toBeDefined();
    expect(COMPOSITE_PARTS_MAPPING['3 filtre açık']).toBeDefined();
  });
});

describe('⚠️ Stok Durum ve Eşik Fonksiyonları', () => {
  it('Filtre ve membran içeren parçalar yüksek eşik grubunda olmalı', () => {
    expect(isHighThresholdPart('1. filtre kapalı')).toBe(true);
    expect(isHighThresholdPart('Membran 75 GPD')).toBe(true);
    expect(isHighThresholdPart('5li takım kapalı')).toBe(true);
    expect(isHighThresholdPart('Sediment Filtre')).toBe(true);
    expect(isHighThresholdPart('Musluk')).toBe(false);
    expect(isHighThresholdPart('Depo 8 Litre')).toBe(false);
  });

  it('Yüksek eşik parçalarında stok durumları doğru dönmeli (<20 kırmızı, <30 turuncu, >=30 normal)', () => {
    expect(getStokDurumu('1. filtre kapalı', 10)).toBe('kirmizi');
    expect(getStokDurumu('1. filtre kapalı', 19)).toBe('kirmizi');
    expect(getStokDurumu('1. filtre kapalı', 20)).toBe('turuncu');
    expect(getStokDurumu('1. filtre kapalı', 29)).toBe('turuncu');
    expect(getStokDurumu('1. filtre kapalı', 30)).toBe('normal');
    expect(getStokDurumu('1. filtre kapalı', 100)).toBe('normal');
  });

  it('Normal parçalarda stok durumları doğru dönmeli (<10 kırmızı, <15 turuncu, >=15 normal)', () => {
    expect(getStokDurumu('Musluk', 5)).toBe('kirmizi');
    expect(getStokDurumu('Musluk', 9)).toBe('kirmizi');
    expect(getStokDurumu('Musluk', 10)).toBe('turuncu');
    expect(getStokDurumu('Musluk', 14)).toBe('turuncu');
    expect(getStokDurumu('Musluk', 15)).toBe('normal');
    expect(getStokDurumu('Musluk', 50)).toBe('normal');
  });
});

describe('🎯 Cihaz Tipi ve Filtre Gizleme Mantığı', () => {
  const GIZLE_KAPALI = new Set([
    '1. filtre açık', '2. filtre açık', '3. filtre açık',
    "3'lü set - açık", "4'lü set - açık", "5'li set - açık",
  ]);

  const GIZLE_ACIK = new Set([
    '1. filtre kapalı', '2. filtre kapalı', '3. filtre kapalı',
    '1. filtre kapalı kokonatlı', '2. filtre kapalı kokonatlı', '3. filtre kapalı kokonatlı',
    "3'lü set - kapalı", "3'lü set - kapalı (kokonat)",
    "4'lü set - kapalı", "4'lü set - kapalı (kokonat)",
    "5'li set - kapalı", "5'li set - kapalı (kokonat)",
  ]);

  function filterCatalogByDeviceType(items: { ad: string }[], deviceType: 'kapalı' | 'açık' | 'hepsi') {
    const hideSet = deviceType === 'kapalı' ? GIZLE_KAPALI : deviceType === 'açık' ? GIZLE_ACIK : null;
    if (!hideSet) return items;
    return items.filter(item => !hideSet.has(item.ad.toLowerCase().trim()));
  }

  const sampleCatalog = [
    { ad: "5'li Set - Kapalı" },
    { ad: "5'li Set - Kapalı (Kokonat)" },
    { ad: "5'li Set - Açık" },
    { ad: '1. Filtre Kapalı' },
    { ad: '1. Filtre Açık' },
    { ad: 'Membran' },
    { ad: 'Tatlandırıcı' },
    { ad: '8 litre motorsuz aquasweet' },
  ];

  it('Kapalı cihaz seçildiğinde açık filtreler ve setler gizlenmeli', () => {
    const filtered = filterCatalogByDeviceType(sampleCatalog, 'kapalı');
    const names = filtered.map(f => f.ad);

    expect(names).toContain("5'li Set - Kapalı");
    expect(names).toContain("5'li Set - Kapalı (Kokonat)");
    expect(names).not.toContain("5'li Set - Açık");
    expect(names).not.toContain('1. Filtre Açık');
    expect(names).toContain('Membran');
    expect(names).toContain('8 litre motorsuz aquasweet');
  });

  it('Açık cihaz seçildiğinde kapalı ve kokonatlı filtreler ve setler gizlenmeli', () => {
    const filtered = filterCatalogByDeviceType(sampleCatalog, 'açık');
    const names = filtered.map(f => f.ad);

    expect(names).toContain("5'li Set - Açık");
    expect(names).toContain('1. Filtre Açık');
    expect(names).not.toContain("5'li Set - Kapalı");
    expect(names).not.toContain("5'li Set - Kapalı (Kokonat)");
    expect(names).not.toContain('1. Filtre Kapalı');
    expect(names).toContain('Membran');
  });

  it('Hepsi / çift seçim durumunda hiçbir filtre gizlenmemeli', () => {
    const filtered = filterCatalogByDeviceType(sampleCatalog, 'hepsi');
    expect(filtered.length).toBe(sampleCatalog.length);
  });
});
