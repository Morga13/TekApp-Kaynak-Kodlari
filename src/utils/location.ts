/**
 * Konum, Koordinat, Google Maps Linki ve Navigasyon Yardımcıları
 */

export interface ParsedCoordinates {
  lat: number;
  lng: number;
}

export interface AddressComponents {
  mahalleKoy: string;
  sokakCadde: string;
  binaKapiNo: string;
  adresTarifi: string;
  coords?: ParsedCoordinates;
}

/**
 * Metin, WhatsApp mesajı, koordinat veya Google Maps linkinden koordinat ayıklar.
 * Desteklenen formatlar:
 * - "37.194521, 40.582134"
 * - "37.194521 40.582134"
 * - "37.194521/40.582134"
 * - "https://maps.google.com/?q=37.194521,40.582134"
 * - "https://www.google.com/maps/place/.../@37.194521,40.582134,17z"
 * - "https://maps.google.com/maps?daddr=37.194521,40.582134"
 * - "geo:37.194521,40.582134"
 * - "Adres metni [📍 37.194521, 40.582134]"
 */
export function parseCoordinatesOrLink(input: string): ParsedCoordinates | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 1. Google Maps / URL içindeki koordinat desenleri (q=, @, ll=, daddr=, destination=)
  const urlMatches = [
    /[?&]q=(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/,
    /@(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/,
    /[?&]ll=(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/,
    /[?&]daddr=(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/,
    /[?&]destination=(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/,
    /geo:(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/,
  ];

  for (const regex of urlMatches) {
    const match = trimmed.match(regex);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (isValidLatLng(lat, lng)) {
        return { lat, lng };
      }
    }
  }

  // 2. Özel etiket [📍 37.194521, 40.582134]
  const tagMatch = trimmed.match(/\[📍\s*(-?\d{1,2}\.\d{3,})[,\s/]+(-?\d{1,3}\.\d{3,})\s*\]/);
  if (tagMatch) {
    const lat = parseFloat(tagMatch[1]);
    const lng = parseFloat(tagMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng };
    }
  }

  // 3. Doğrudan koordinat çifti ("37.194521, 40.582134" veya "37.194521 40.582134")
  const directMatch = trimmed.match(/(-?\d{1,2}\.\d{4,})[,\s/]+(-?\d{1,3}\.\d{4,})/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng };
    }
  }

  return null;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Adres dizesi koordinat içeriyorsa doğrudan rota / navigasyon başlatacak URL döner.
 * Koordinat yoksa Google Maps arama URL'i döner.
 */
export function getMapsNavigationUrl(address: string): string {
  if (!address || !address.trim()) return '';
  const coords = parseCoordinatesOrLink(address);
  if (coords) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

/**
 * Parçalı adres bileşenlerini ve koordinatı tek, net bir adres metnine dönüştürür.
 */
export function formatAddress(components: {
  mahalleKoy?: string;
  sokakCadde?: string;
  binaKapiNo?: string;
  adresTarifi?: string;
  coords?: ParsedCoordinates | null;
}): string {
  const parts: string[] = [];

  const mk = components.mahalleKoy?.trim();
  const sc = components.sokakCadde?.trim();
  const bk = components.binaKapiNo?.trim();
  const at = components.adresTarifi?.trim();

  if (mk) parts.push(mk);
  if (sc) parts.push(sc);
  if (bk) parts.push(bk);
  if (at) parts.push(`(${at})`);

  if (components.coords) {
    const coordTag = `[📍 ${components.coords.lat.toFixed(6)}, ${components.coords.lng.toFixed(6)}]`;
    parts.push(coordTag);
  }

  return parts.join(' - ');
}

/**
 * Kayıtlı bir adres metnini parçalayarak bileşenlere ayırır.
 */
export function parseStoredAddress(storedAddress: string): AddressComponents {
  if (!storedAddress) {
    return {
      mahalleKoy: '',
      sokakCadde: '',
      binaKapiNo: '',
      adresTarifi: '',
    };
  }

  const coords = parseCoordinatesOrLink(storedAddress);

  // Koordinat etiketini temizle
  let cleanText = storedAddress.replace(/\[📍[^\]]+\]/g, '').trim();

  // Parantez içindeki tarifi ayıkla
  let adresTarifi = '';
  const tarifMatch = cleanText.match(/\(([^)]+)\)/);
  if (tarifMatch) {
    adresTarifi = tarifMatch[1].trim();
    cleanText = cleanText.replace(/\([^)]+\)/g, '').trim();
  }

  const chunks = cleanText
    .split('-')
    .map((c) => c.trim())
    .filter(Boolean);

  const mahalleKoy = chunks[0] || '';
  const sokakCadde = chunks[1] || '';
  const binaKapiNo = chunks.slice(2).join(' ') || '';

  return {
    mahalleKoy,
    sokakCadde,
    binaKapiNo,
    adresTarifi,
    coords: coords || undefined,
  };
}

/**
 * Telefon numarasını standartlaştırır (boşluk, parantez, tire, ülke kodu temizlenir).
 * Örn: "0532 123 45 67" -> "5321234567"
 *      "+90 532 123 4567" -> "5321234567"
 *      "5321234567" -> "5321234567"
 */
export function normalizePhoneNumber(phone?: string): string {
  if (!phone || typeof phone !== 'string') return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length === 12) {
    digits = digits.substring(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.substring(1);
  }
  return digits;
}
