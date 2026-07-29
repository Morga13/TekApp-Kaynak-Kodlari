export type ThemeMode = "system" | "light" | "dark";

export function getStoredTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem("tekapp_theme");
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    /* ignore */
  }
  return "system";
}

export function applyTheme(mode: ThemeMode) {
  try {
    localStorage.setItem("tekapp_theme", mode);
  } catch {
    /* ignore */
  }

  const isDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function initTheme() {
  const mode = getStoredTheme();
  applyTheme(mode);

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => {
    if (getStoredTheme() === "system") {
      applyTheme("system");
    }
  };

  mediaQuery.addEventListener("change", handleChange);
  return () => mediaQuery.removeEventListener("change", handleChange);
}
