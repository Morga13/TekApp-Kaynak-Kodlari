import { describe, it, expect } from 'vitest';
import { normalizePhoneNumber } from '../utils/location';

interface SimpleMusteri {
  id: number;
  ad: string;
  telefon: string;
}

function checkCustomerDuplication(
  input: { id?: number; ad: string; telefon?: string },
  musteriler: SimpleMusteri[]
): { valid: boolean; error?: string } {
  const isNew = !input.id;
  const cleanAd = input.ad.trim().toLowerCase();
  const cleanTel = normalizePhoneNumber(input.telefon);

  // 1. İsim kontrolü
  if (isNew) {
    const nameExists = musteriler.some(
      (m) => m.ad.trim().toLowerCase() === cleanAd
    );
    if (nameExists) {
      return { valid: false, error: `"${input.ad.trim()}" isimli bir müşteri zaten kayıtlı!` };
    }
  } else {
    const nameExists = musteriler.some(
      (m) => m.id !== input.id && m.ad.trim().toLowerCase() === cleanAd
    );
    if (nameExists) {
      return { valid: false, error: `"${input.ad.trim()}" isimli bir başka müşteri zaten kayıtlı!` };
    }
  }

  // 2. Telefon numarası kontrolü
  if (cleanTel && cleanTel.length >= 7) {
    const phoneMatch = musteriler.find((m) => {
      if (!isNew && m.id === input.id) return false;
      const existingTel = normalizePhoneNumber(m.telefon);
      return existingTel && existingTel === cleanTel;
    });

    if (phoneMatch) {
      return { valid: false, error: `Bu numara "${phoneMatch.ad}" ismiyle zaten kayıtlı!` };
    }
  }

  return { valid: true };
}

describe('📞 Telefon Numarası Normalizasyonu', () => {
  it('Farklı formatlardaki Türk telefon numaralarını aynı formata indirgemeli', () => {
    expect(normalizePhoneNumber('0532 123 45 67')).toBe('5321234567');
    expect(normalizePhoneNumber('+90 532 123 4567')).toBe('5321234567');
    expect(normalizePhoneNumber('+905321234567')).toBe('5321234567');
    expect(normalizePhoneNumber('05321234567')).toBe('5321234567');
    expect(normalizePhoneNumber('(0532) 123-4567')).toBe('5321234567');
    expect(normalizePhoneNumber('5321234567')).toBe('5321234567');
    expect(normalizePhoneNumber('905321234567')).toBe('5321234567');
  });

  it('Boş veya tanımsız telefon numarası için boş string dönmeli', () => {
    expect(normalizePhoneNumber('')).toBe('');
    expect(normalizePhoneNumber(undefined)).toBe('');
    expect(normalizePhoneNumber('   ')).toBe('');
  });
});

describe('👥 Müşteri Telefon ve İsim Çakışma Doğrulaması', () => {
  const existingCustomers: SimpleMusteri[] = [
    { id: 1, ad: 'Ahmet Yılmaz', telefon: '0532 111 2233' },
    { id: 2, ad: 'Mehmet Demir', telefon: '+90 544 999 8877' },
    { id: 3, ad: 'Ayşe Kaya', telefon: '' },
  ];

  it('Aynı numara ile yeni müşteri kaydı engellenmeli ve kayıtlı isim belirtilmeli', () => {
    const result = checkCustomerDuplication(
      { ad: 'Ali Veli', telefon: '05321112233' },
      existingCustomers
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Bu numara "Ahmet Yılmaz" ismiyle zaten kayıtlı!');
  });

  it('Farklı formatta girilmiş aynı numara da algılanmalı (+90 vs 0532)', () => {
    const result = checkCustomerDuplication(
      { ad: 'Fatma Şen', telefon: '0544 999 88 77' },
      existingCustomers
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Bu numara "Mehmet Demir" ismiyle zaten kayıtlı!');
  });

  it('Müşteri kendini güncellerken kendi telefon numarası çakışma hatası vermemeli', () => {
    const result = checkCustomerDuplication(
      { id: 1, ad: 'Ahmet Yılmaz (Güncel)', telefon: '0532 111 2233' },
      existingCustomers
    );
    expect(result.valid).toBe(true);
  });

  it('Müşteri güncellenirken başka birinin numarası girilirse engellenmeli', () => {
    const result = checkCustomerDuplication(
      { id: 1, ad: 'Ahmet Yılmaz', telefon: '0544 999 8877' },
      existingCustomers
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Bu numara "Mehmet Demir" ismiyle zaten kayıtlı!');
  });

  it('Farklı ve benzersiz numara ile kayıt başarılı olmalı', () => {
    const result = checkCustomerDuplication(
      { ad: 'Zeynep Yıldız', telefon: '0555 333 2211' },
      existingCustomers
    );
    expect(result.valid).toBe(true);
  });

  it('Telefon alanı boş bırakıldığında çakışma oluşmamalı', () => {
    const result = checkCustomerDuplication(
      { ad: 'Kemal Ak', telefon: '' },
      existingCustomers
    );
    expect(result.valid).toBe(true);
  });

  it('Aynı isimle kayıt oluşturulmaya çalışıldığında isim hatası vermeli', () => {
    const result = checkCustomerDuplication(
      { ad: 'ahmet yılmaz', telefon: '0555 999 0000' },
      existingCustomers
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('"ahmet yılmaz" isimli bir müşteri zaten kayıtlı!');
  });
});
