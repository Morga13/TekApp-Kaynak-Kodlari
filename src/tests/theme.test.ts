import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredTheme, applyTheme } from '../utils/theme';

describe('🎨 Tema Yönetimi (theme.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  describe('getStoredTheme()', () => {
    it('localStorage boşken varsayılan olarak "system" döndürmeli', () => {
      expect(getStoredTheme()).toBe('system');
    });

    it('"dark" kaydedilmişse "dark" döndürmeli', () => {
      localStorage.setItem('tekapp_theme', 'dark');
      expect(getStoredTheme()).toBe('dark');
    });

    it('"light" kaydedilmişse "light" döndürmeli', () => {
      localStorage.setItem('tekapp_theme', 'light');
      expect(getStoredTheme()).toBe('light');
    });

    it('Geçersiz değer varsa "system" döndürmeli', () => {
      localStorage.setItem('tekapp_theme', 'rainbow');
      expect(getStoredTheme()).toBe('system');
    });
  });

  describe('applyTheme()', () => {
    it('"dark" seçilince <html> elemanına "dark" sınıfı eklenmeli', () => {
      applyTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('"light" seçilince "dark" sınıfı kaldırılmalı', () => {
      document.documentElement.classList.add('dark');
      applyTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('"dark" seçilince localStorage\'a "dark" yazılmalı', () => {
      applyTheme('dark');
      expect(localStorage.getItem('tekapp_theme')).toBe('dark');
    });

    it('"light" seçilince localStorage\'a "light" yazılmalı', () => {
      applyTheme('light');
      expect(localStorage.getItem('tekapp_theme')).toBe('light');
    });

    it('"system" seçilince cihaz koyu modda değilse "dark" sınıfı eklenmemeli', () => {
      // matchMedia mock false döndürüyor (setup.ts'de tanımlı)
      applyTheme('system');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});
