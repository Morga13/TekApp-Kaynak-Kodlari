import '@testing-library/jest-dom';

// localStorage mock — jsdom'da localStorage zaten mevcut ama
// bazı edge case'ler için güvenli varsayılan
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// document.documentElement.classList temizle her testten önce
beforeEach(() => {
  document.documentElement.className = '';
  localStorage.clear();
});
