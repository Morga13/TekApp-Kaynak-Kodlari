import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MapPin, Navigation, Save, X, Loader2, AlertTriangle,
  ChevronUp, ChevronDown, Building2, StickyNote, LocateFixed, Settings,
  Search, Clipboard, Layers, Compass, ExternalLink, Check
} from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import "leaflet/dist/leaflet.css";
import {
  parseCoordinatesOrLink,
  formatAddress,
  parseStoredAddress,
  ParsedCoordinates,
} from "../utils/location";

// ─── Tip Tanımlamaları ────────────────────────────────────────
export interface KonumPayload {
  latitude: number;
  longitude: number;
  auto_address: string;
  address_note: string;
}

interface KonumKaydetProps {
  onSubmit: (payload: KonumPayload) => void;
  onClose: () => void;
  initialCoords?: { latitude: number; longitude: number };
  initialData?: Partial<KonumPayload>;
}

type LocationStatus = "idle" | "last_known" | "refining" | "success" | "denied" | "error";

interface ReverseGeocodeResult {
  mahalleKoy: string;
  sokakCadde: string;
  binaKapiNo: string;
  formatted: string;
}

// ─── BigDataCloud Reverse Geocoding (ücretsiz, iyi TR kapsamı) ─
async function reverseGeocodeBigData(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=tr`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const admins: { name: string; adminLevel: number }[] = d.localityInfo?.administrative ?? [];

    const village = admins.find((a) => a.adminLevel >= 9)?.name;
    const district = admins.find((a) => a.adminLevel >= 7 && a.adminLevel <= 8)?.name;
    const city = admins.find((a) => a.adminLevel >= 5 && a.adminLevel <= 6)?.name;

    const areaParts: string[] = [];
    if (d.principalSubdivision) areaParts.push(d.principalSubdivision);
    if (city && city !== d.principalSubdivision) areaParts.push(city);
    if (district && district !== city) areaParts.push(district);
    if (village && village !== district) areaParts.push(village);
    if (d.locality && !areaParts.includes(d.locality)) areaParts.push(d.locality);

    const mahalleKoy = areaParts.join(" / ");
    const sokakCadde = "";
    const binaKapiNo = "";

    return {
      mahalleKoy: mahalleKoy || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      sokakCadde,
      binaKapiNo,
      formatted: mahalleKoy,
    };
  } catch {
    return null;
  }
}

// ─── Nominatim Reverse Geocoding ──────────────────────────────
async function reverseGeocodeNominatim(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=tr`,
      { headers: { "User-Agent": "TekApp/1.0" }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};

    const il = a.state || a.province || "";
    const ilce = a.county || a.district || a.town || "";
    const koyMahalle = a.village || a.suburb || a.neighbourhood || a.quarter || a.city_district || "";

    const areaParts = [il, ilce, koyMahalle].filter(Boolean);
    const mahalleKoy = areaParts.length >= 2 ? areaParts.join(" / ") : data.display_name || "";

    const sokakCadde = a.road || a.street || a.pedestrian || a.footway || "";
    const binaKapiNo = a.house_number ? `No: ${a.house_number}` : "";

    const parts = [
      mahalleKoy,
      sokakCadde,
      binaKapiNo,
    ].filter(Boolean);

    return {
      mahalleKoy,
      sokakCadde,
      binaKapiNo,
      formatted: parts.join(" - "),
    };
  } catch {
    return null;
  }
}

// ─── Ana Reverse Geocode ──────────────────────────────────────
async function fetchReverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const bigData = await reverseGeocodeBigData(lat, lng);
  const nominatim = await reverseGeocodeNominatim(lat, lng);

  const mahalleKoy = bigData?.mahalleKoy || nominatim?.mahalleKoy || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const sokakCadde = nominatim?.sokakCadde || "";
  const binaKapiNo = nominatim?.binaKapiNo || "";

  const formatted = [mahalleKoy, sokakCadde, binaKapiNo].filter(Boolean).join(" - ");

  return {
    mahalleKoy,
    sokakCadde,
    binaKapiNo,
    formatted: formatted || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
  };
}

// ─── Ana Bileşen ──────────────────────────────────────────────
export default function KonumKaydet({
  onSubmit,
  onClose,
  initialCoords,
  initialData,
}: KonumKaydetProps) {
  // İlk veri çözümlemesi
  const initialParsed = useMemo(() => {
    if (initialData?.auto_address) {
      return parseStoredAddress(initialData.auto_address);
    }
    return null;
  }, [initialData]);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialCoords
      ? { lat: initialCoords.latitude, lng: initialCoords.longitude }
      : initialParsed?.coords
      ? { lat: initialParsed.coords.lat, lng: initialParsed.coords.lng }
      : null
  );

  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);

  // Ayrıştırılmış Adres Alanları
  const [mahalleKoy, setMahalleKoy] = useState(initialParsed?.mahalleKoy || "");
  const [sokakCadde, setSokakCadde] = useState(initialParsed?.sokakCadde || "");
  const [binaKapiNo, setBinaKapiNo] = useState(initialParsed?.binaKapiNo || "");
  const [adresTarifi, setAdresTarifi] = useState(
    initialParsed?.adresTarifi || initialData?.address_note || ""
  );

  // Arama & Yapıştırma State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Harita Katmanı: "hybrid" (Google Uydu + Yollar) vs "street" (OSM)
  const [mapLayer, setMapLayer] = useState<"hybrid" | "street">("hybrid");

  const [isFormExpanded, setIsFormExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reverseGeoLoading, setReverseGeoLoading] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileLayerRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // Unmount guard
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSet = useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (val: T) => {
      if (isMountedRef.current) setter(val);
    },
    []
  );

  // ─── Marker ekle/taşı ─────────────────────────────────────
  const placeMarker = useCallback(
    async (lat: number, lng: number, runGeocode = true) => {
      const map = mapRef.current;
      if (!map) return;

      const L = (await import("leaflet")).default;

      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
        marker.on("dragend", async () => {
          const pos = marker.getLatLng();
          if (!isMountedRef.current) return;
          safeSet(setCoords)({ lat: pos.lat, lng: pos.lng });
          safeSet(setAccuracyM)(null);
          safeSet(setReverseGeoLoading)(true);
          const res = await fetchReverseGeocode(pos.lat, pos.lng);
          if (isMountedRef.current) {
            setMahalleKoy(res.mahalleKoy);
            if (res.sokakCadde) setSokakCadde(res.sokakCadde);
            if (res.binaKapiNo) setBinaKapiNo(res.binaKapiNo);
            setReverseGeoLoading(false);
          }
        });
        markerRef.current = marker;
      }

      map.setView([lat, lng], map.getZoom() > 15 ? map.getZoom() : 18, { animate: true });

      if (runGeocode) {
        safeSet(setReverseGeoLoading)(true);
        const res = await fetchReverseGeocode(lat, lng);
        if (isMountedRef.current) {
          setMahalleKoy(res.mahalleKoy);
          if (res.sokakCadde) setSokakCadde(res.sokakCadde);
          if (res.binaKapiNo) setBinaKapiNo(res.binaKapiNo);
          setReverseGeoLoading(false);
        }
      }
    },
    [safeSet]
  );

  // ─── GPS Konum Alma ───────────────────────────────────────
  const fetchLocation = useCallback(async () => {
    safeSet(setLocationStatus)("idle");
    safeSet(setLocationError)(null);
    safeSet(setAccuracyM)(null);

    if (Capacitor.isNativePlatform()) {
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted") {
        perm = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
      }
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
        safeSet(setLocationStatus)("denied");
        safeSet(setLocationError)(
          "Konum izni verilmeli. Telefon Ayarları → İzinler → Konum → 'Tam Konum' iznini açınız."
        );
        return;
      }
    } else {
      if (!navigator.geolocation) {
        safeSet(setLocationStatus)("error");
        safeSet(setLocationError)("Tarayıcınız konum özelliğini desteklemiyor.");
        return;
      }
    }

    try {
      let lastLat: number | null = null;
      let lastLng: number | null = null;

      if (Capacitor.isNativePlatform()) {
        const lastPos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 2000,
          maximumAge: 3000,
        });
        if (lastPos?.coords) {
          const ageMs = Date.now() - (lastPos.timestamp ?? 0);
          if (ageMs < 10000) {
            lastLat = lastPos.coords.latitude;
            lastLng = lastPos.coords.longitude;
          }
        }
      }

      if (lastLat !== null && lastLng !== null && isMountedRef.current) {
        setCoords({ lat: lastLat, lng: lastLng });
        setLocationStatus("last_known");
        await placeMarker(lastLat, lastLng, false);
      }
    } catch {
      // cache yoksa devam et
    }

    safeSet(setLocationStatus)("refining");

    const tryGetPosition = async (highAccuracy: boolean): Promise<{ lat: number; lng: number; accuracy: number }> => {
      if (Capacitor.isNativePlatform()) {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 15000 : 8000,
          maximumAge: 0,
        });
        return {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 0,
        };
      } else {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: highAccuracy,
            timeout: highAccuracy ? 15000 : 8000,
            maximumAge: 0,
          });
        });
        return {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 0,
        };
      }
    };

    let finalCoords: { lat: number; lng: number; accuracy: number } | null = null;

    try {
      finalCoords = await tryGetPosition(true);
    } catch (highAccErr) {
      if (!isMountedRef.current) return;

      const errMsg = highAccErr instanceof Error ? highAccErr.message : String(highAccErr);
      const isDenied = errMsg.toLowerCase().includes("denied") || errMsg.toLowerCase().includes("disabled");

      if (isDenied) {
        setLocationStatus("denied");
        setLocationError("Konum izni veya GPS kapalı. Ayarlardan 'Tam Konum' iznini açınız.");
        return;
      }

      try {
        finalCoords = await tryGetPosition(false);
        if (isMountedRef.current) {
          const accM = Math.round(finalCoords.accuracy);
          setLocationError(
            `GPS sinyali zayıf — ağ konumu kullanılıyor (~${accM}m). Daha kesin konum için haritada pini tam kapıya sürükleyebilirsiniz.`
          );
        }
      } catch {
        if (!isMountedRef.current) return;
        setLocationStatus("error");
        setLocationError("GPS sinyali alınamadı. Arama çubuğuna adres/koordinat yapıştırabilir veya haritaya tıklayabilirsiniz.");
        return;
      }
    }

    if (!isMountedRef.current || !finalCoords) return;

    setCoords({ lat: finalCoords.lat, lng: finalCoords.lng });
    setAccuracyM(finalCoords.accuracy);
    setLocationStatus("success");
    await placeMarker(finalCoords.lat, finalCoords.lng, true);
  }, [placeMarker, safeSet]);

  // ─── Harita Başlat ─────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any = null;
    const container = mapContainerRef.current;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (!isMountedRef.current || !container) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((container as any)._leaflet_id) return;

        const defaultCenter: [number, number] = initialCoords
          ? [initialCoords.latitude, initialCoords.longitude]
          : initialParsed?.coords
          ? [initialParsed.coords.lat, initialParsed.coords.lng]
          : [37.2912, 40.5821]; // Mardin/Kızıltepe varsayılan

        map = L.map(container, {
          center: defaultCenter,
          zoom: (initialCoords || initialParsed?.coords) ? 18 : 14,
          zoomControl: false,
          attributionControl: false,
        });

        // Google Hybrid (Uydu + Sokak/Köy İsimleri)
        const hybridLayer = L.tileLayer(
          "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
          { maxZoom: 21, subdomains: ["mt0", "mt1", "mt2", "mt3"] }
        );

        hybridLayer.addTo(map);
        tileLayerRef.current = hybridLayer;

        L.control.zoom({ position: "bottomright" }).addTo(map);
        mapRef.current = map;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", async (e: any) => {
          if (!isMountedRef.current) return;
          setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
          setAccuracyM(null);
          await placeMarker(e.latlng.lat, e.latlng.lng, true);
        });

        if (initialCoords) {
          await placeMarker(initialCoords.latitude, initialCoords.longitude, false);
        } else if (initialParsed?.coords) {
          await placeMarker(initialParsed.coords.lat, initialParsed.coords.lng, false);
        }
      } catch (e) {
        console.error("Leaflet başlatma hatası:", e);
      }
    })();

    return () => {
      try {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
          markerRef.current = null;
        }
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Katman Değiştir (Uydu / Sokak) ────────────────────────
  const toggleMapLayer = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const L = (await import("leaflet")).default;

    const newLayer = mapLayer === "hybrid" ? "street" : "hybrid";
    setMapLayer(newLayer);

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let layer;
    if (newLayer === "hybrid") {
      layer = L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
        maxZoom: 21,
      });
    } else {
      layer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      });
    }

    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [mapLayer]);

  // ─── İlk açılışta otomatik konum al ───────────────────────
  useEffect(() => {
    if (!initialCoords && !initialParsed?.coords) {
      const t = setTimeout(() => {
        fetchLocation();
      }, 300);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Arama / Koordinat / WhatsApp Linki İşleme ───────────────
  const handleSearchOrCoordinate = useCallback(
    async (queryText: string) => {
      const text = queryText.trim();
      if (!text) return;

      setIsSearching(true);
      try {
        // 1. Koordinat veya Google Maps Linki mi?
        const parsed = parseCoordinatesOrLink(text);
        if (parsed) {
          setCoords({ lat: parsed.lat, lng: parsed.lng });
          setAccuracyM(null);
          await placeMarker(parsed.lat, parsed.lng, true);
          setSearchQuery("");
          setIsSearching(false);
          return;
        }

        // 2. Metin Arama (Nominatim)
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=1&accept-language=tr&countrycodes=tr`,
          { headers: { "User-Agent": "TekApp/1.0" }, signal: AbortSignal.timeout(7000) }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            setCoords({ lat, lng: lon });
            setAccuracyM(null);
            await placeMarker(lat, lon, true);
            setSearchQuery("");
          } else {
            alert("Aradığınız adres bulunamadı. Lütfen daha belirgin bir isim, ilçe veya koordinat girin.");
          }
        }
      } catch (err) {
        console.error("Arama hatası:", err);
        alert("Arama yapılamadı. Koordinatları doğrudan (örn: 37.1945, 40.5821) girebilirsiniz.");
      } finally {
        if (isMountedRef.current) setIsSearching(false);
      }
    },
    [placeMarker]
  );

  // ─── Panodan Yapıştır ─────────────────────────────────────
  const handlePasteClipboard = useCallback(async () => {
    try {
      let text = "";
      if (navigator.clipboard?.readText) {
        text = await navigator.clipboard.readText();
      }
      if (!text) {
        text = prompt("WhatsApp'tan gelen konumu, Google Maps linkini veya koordinatları yapıştırın:") || "";
      }
      if (text.trim()) {
        setSearchQuery(text.trim());
        await handleSearchOrCoordinate(text.trim());
      }
    } catch {
      const text = prompt("WhatsApp'tan gelen konumu, Google Maps linkini veya koordinatları yapıştırın:") || "";
      if (text.trim()) {
        setSearchQuery(text.trim());
        await handleSearchOrCoordinate(text.trim());
      }
    }
  }, [handleSearchOrCoordinate]);

  // ─── Form Gönder (Tam ve Net Adresi Oluştur) ───────────────
  const handleSubmit = useCallback(async () => {
    if (!coords && !mahalleKoy.trim()) {
      alert("Lütfen en az bir mahalle/köy adı girin veya haritadan konum seçin.");
      return;
    }

    setIsSaving(true);
    try {
      const finalAddress = formatAddress({
        mahalleKoy,
        sokakCadde,
        binaKapiNo,
        adresTarifi,
        coords: coords || null,
      });

      onSubmit({
        latitude: coords?.lat || 0,
        longitude: coords?.lng || 0,
        auto_address: finalAddress,
        address_note: adresTarifi,
      });
    } finally {
      if (isMountedRef.current) setIsSaving(false);
    }
  }, [coords, mahalleKoy, sokakCadde, binaKapiNo, adresTarifi, onSubmit]);

  const canSave = useMemo(
    () => (coords !== null || mahalleKoy.trim().length > 0),
    [coords, mahalleKoy]
  );

  const handleCopyCoordinates = () => {
    if (!coords) return;
    const txt = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    navigator.clipboard?.writeText(txt);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const isLoading = locationStatus === "last_known" || locationStatus === "refining";
  const loadingLabel = locationStatus === "last_known"
    ? "Son bilinen konum alındı, rafine ediliyor..."
    : "Yüksek hassasiyetli GPS bekleniyor...";

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">

      {/* ── Üst Bar: Arama / Koordinat / WhatsApp Link Girişi ── */}
      <div className="flex flex-col bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-20 shadow-xs">
        <div className="flex items-center justify-between px-3 py-2.5">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition active:scale-95"
            title="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Compass className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            Net Konum & Kapı Numarası Seçimi
          </h2>
          <button
            onClick={toggleMapLayer}
            className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition border ${
              mapLayer === "hybrid"
                ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
            }`}
            title="Uydu / Sokak Katmanı Değiştir"
          >
            <Layers className="h-3 w-3" />
            {mapLayer === "hybrid" ? "🛰️ Uydu" : "🗺️ Sokak"}
          </button>
        </div>

        {/* Arama & Yapıştırma Çubuğu */}
        <div className="px-3 pb-2.5 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchOrCoordinate(searchQuery);
                }
              }}
              placeholder="Adres ara, koordinat (37.19, 40.58) veya link yapıştır..."
              className="w-full pl-8 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleSearchOrCoordinate(searchQuery)}
            disabled={!searchQuery.trim() || isSearching}
            className="px-3 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
          >
            {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Bul"}
          </button>

          <button
            type="button"
            onClick={handlePasteClipboard}
            className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
            title="Panodaki WhatsApp konumu / Google Maps linkini yapıştır"
          >
            <Clipboard className="h-3.5 w-3.5" />
            Yapıştır
          </button>
        </div>
      </div>

      {/* ── Harita Bölgesi ── */}
      <div className="relative flex-1 min-h-0" style={{ minHeight: isFormExpanded ? "38%" : "80%" }}>
        <div
          ref={mapContainerRef}
          className="absolute inset-0 z-0"
          style={{ touchAction: "manipulation" }}
        />

        {/* GPS Yükleniyor Bildirimi */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-end justify-center pb-6 pointer-events-none">
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xs rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg border border-slate-200 dark:border-slate-700 mx-4 w-full max-w-xs animate-slide-up">
              <Loader2 className="h-5 w-5 text-sky-600 animate-spin shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{loadingLabel}</p>
                <p className="text-[10px] text-slate-400">Pini çatının veya kapının üzerine sürükleyebilirsiniz</p>
              </div>
            </div>
          </div>
        )}

        {/* İzin / Hata Kartı */}
        {(locationStatus === "denied" || locationStatus === "error") && !coords && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl px-5 py-5 flex flex-col items-center gap-3 shadow-sm border border-slate-200 dark:border-slate-700 max-w-xs w-full">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 text-center">
                {locationError}
              </p>
              <button
                onClick={fetchLocation}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Navigation className="h-3.5 w-3.5" />
                Tekrar Dene
              </button>
            </div>
          </div>
        )}

        {/* Konumuma Dön Düğmesi */}
        {coords && !isLoading && (
          <button
            onClick={fetchLocation}
            className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sky-600 dark:text-sky-400 transition active:scale-95 hover:bg-sky-50"
            title="GPS Konumuma Git"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        )}

        {/* Koordinat & Hassasiyet Etiketi */}
        {coords && (
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 pointer-events-auto">
            <div className="bg-slate-900/85 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1.5 shadow-sm">
              <MapPin className="h-3 w-3 text-emerald-400" />
              <span>{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</span>
            </div>
            {accuracyM !== null && (
              <div className={`px-2 py-0.5 rounded-lg text-[9px] font-bold backdrop-blur-xs w-fit ${
                accuracyM <= 15
                  ? "bg-emerald-600/90 text-white"
                  : accuracyM <= 50
                  ? "bg-sky-600/90 text-white"
                  : "bg-amber-500/90 text-white"
              }`}>
                ±{Math.round(accuracyM)}m hassasiyet
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Form (Bottom Sheet: Ayrıntılı Net Adres Alanları) ── */}
      <div
        className={`bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-all duration-300 overflow-y-auto shrink-0 ${
          isFormExpanded ? "max-h-[62%]" : "max-h-12"
        }`}
      >
        <button
          onClick={() => setIsFormExpanded(!isFormExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 transition active:bg-slate-100"
        >
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-sky-600" />
            Adres & Kapı Numarası Detayları
            {reverseGeoLoading && <Loader2 className="inline h-3 w-3 animate-spin text-sky-600" />}
          </span>
          {isFormExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
        </button>

        {isFormExpanded && (
          <div className="p-4 space-y-3">

            {/* 1. Bölge (İl / İlçe / Mahalle / Köy) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                İl / İlçe / Mahalle veya Köy Adı
              </label>
              <input
                type="text"
                value={mahalleKoy}
                onChange={(e) => setMahalleKoy(e.target.value)}
                placeholder="Örn: Mardin / Kızıltepe / Taşyapı Köyü"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* 2. Cadde / Sokak ve Kapı No (Yan Yana) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Cadde / Sokak / Mevki
                </label>
                <input
                  type="text"
                  value={sokakCadde}
                  onChange={(e) => setSokakCadde(e.target.value)}
                  placeholder="Örn: Atatürk Cad. / 120. Sok."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Bina No / Kapı / Daire
                </label>
                <input
                  type="text"
                  value={binaKapiNo}
                  onChange={(e) => setBinaKapiNo(e.target.value)}
                  placeholder="Örn: No: 14 Kat: 2 D: 5"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* 3. Bina Tarifi / Açık Not */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                <StickyNote className="h-3 w-3 text-slate-400" />
                Adres Tarifi / Bina Tanımı (İsteğe Bağlı)
              </label>
              <textarea
                value={adresTarifi}
                onChange={(e) => setAdresTarifi(e.target.value)}
                rows={2}
                placeholder="Örn: Köy camisi yanı, yeşil demir kapılı 2 katlı müstakil ev / A101 market üstü..."
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              />
            </div>

            {/* 4. Koordinat & Navigasyon Bilgi Kartı */}
            {coords && (
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate">
                    {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyCoordinates}
                    className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-200 flex items-center gap-1 hover:bg-slate-100"
                  >
                    {copiedCoords ? <Check className="h-3 w-3 text-emerald-600" /> : <Clipboard className="h-3 w-3" />}
                    {copiedCoords ? "Kopyalandı" : "Kopyala"}
                  </button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-700 rounded-lg text-[10px] font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1 hover:bg-sky-100"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Test Et
                  </a>
                </div>
              </div>
            )}

            {/* Kaydet & Aktar Butonu */}
            <button
              onClick={handleSubmit}
              disabled={!canSave || isSaving}
              className={`w-full py-3.5 rounded-xl text-xs font-bold transition active:scale-[0.98] flex items-center justify-center gap-2 ${
                canSave && !isSaving
                  ? "bg-sky-600 hover:bg-sky-700 text-white shadow-sm cursor-pointer"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Net Adresi Müşteri Formuna Aktar
                </>
              )}
            </button>

            <div style={{ height: "env(safe-area-inset-bottom, 12px)" }} />
          </div>
        )}
      </div>
    </div>
  );
}
