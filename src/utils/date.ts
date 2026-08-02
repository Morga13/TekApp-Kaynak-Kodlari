/**
 * Centralized Date Formatting Utility for TekApp.
 * Formats all dates consistently into Turkish DD.MM.YYYY (Gün/Ay/Yıl) format.
 * Examples:
 *   "2026-08-02" -> "02.08.2026"
 *   "2026/08/02" -> "02.08.2026"
 *   ISO timestamp -> "02.08.2026"
 */

export function formatDateDDMMYYYY(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const cleanStr = dateStr.trim();
    // Handles YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(cleanStr)) {
      const parts = cleanStr.substring(0, 10).split(/[-/]/);
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      return `${day}.${month}.${year}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateStr || "";
  }
}

/**
 * Long Turkish date format (e.g. "2 Ağustos 2026")
 */
export function formatDateLong(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateStr || "";
  }
}
