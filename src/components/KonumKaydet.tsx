import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MapPin, Navigation, Save, X, Loader2, AlertTriangle,
  ChevronUp, ChevronDown, Building2, Layers, DoorOpen,
  StickyNote, LocateFixed, Settings
} from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import "leaflet/dist/leaflet.css";

// ─── Tip Tanımlamaları ────────────────────────────────────────
export interface KonumPayload {
  latitude: number;
  longitude: number;
  auto_address: string;
  building_name: string;
  block: string;
  floor: string;
  door_number: string;
  address_note: string;
}

interface KonumKaydetProps {
  onSubmit: (payload: KonumPayload) => void;
  onClose: () => void;
  initialCoords?: { latitude: number; longitude: number };
  initialData?: Partial<KonumPayload>;
}

type LocationStatus = "idle" | "loading" | "success" | "denied" | "error";

// ─── Nominatim Reverse Geocoding ──────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=tr`,
      { headers: { "User-Agent": "TekApp/1.0" } }
    );
    if (!res.ok) return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const data = await res.json();
    const a = data.address || {};
    const parts = [
      a.road || a.street || a.pedestrian || a.footway || "",
      a.house_number ? `No:${a.house_number}` : "",
      a.neighbourhood || a.suburb || a.quarter || "",
      a.district || a.town || a.city_district || "",
      a.city || a.county || "",
    ].filter(Boolean);
    return parts.join(", ") || data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

// ─── Ana Bileşen ──────────────────────────────────────────────
export default function KonumKaydet({
  onSubmit,
  onClose,
  initialCoords,
  initialData,
}: KonumKaydetProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialCoords ? { lat: initialCoords.latitude, lng: initialCoords.longitude } : null
  );
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [autoAddress, setAutoAddress] = useState(initialData?.auto_address || "");
  const [buildingName, setBuildingName] = useState(initialData?.building_name || "");
  const [block, setBlock] = useState(initialData?.block || "");
  const [floor, setFloor] = useState(initialData?.floor || "");
  const [doorNumber, setDoorNumber] = useState(initialData?.door_number || "");
  const [addressNote, setAddressNote] = useState(initialData?.address_note || "");
  const [isFormExpanded, setIsFormExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reverseGeoLoading, setReverseGeoLoading] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // Unmount guard
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ─── Güvenli State Setter'lar ──────────────────────────────
  const safeSet = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (val: T) => {
    if (isMountedRef.current) setter(val);
  }, []);

  // ─── Marker ekle/taşı (inline, ref kullanır) ─────────────
  const placeMarker = useCallback(async (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;

    // L'yi lazy import ile al — global scope'ta çağrılmıyor!
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
        safeSet(setReverseGeoLoading)(true);
        const addr = await reverseGeocode(pos.lat, pos.lng);
        safeSet(setAutoAddress)(addr);
        safeSet(setReverseGeoLoading)(false);
      });
      markerRef.current = marker;
    }

    map.setView([lat, lng], 18, { animate: true });

    // Adres güncelle
    safeSet(setReverseGeoLoading)(true);
    const addr = await reverseGeocode(lat, lng);
    if (isMountedRef.current) {
      setAutoAddress(addr);
      setReverseGeoLoading(false);
    }
  }, [safeSet]);

  // ─── GPS Konumu Al ─────────────────────────────────────────
  const fetchLocation = useCallback(async () => {
    safeSet(setLocationStatus)("loading");
    safeSet(setLocationError)(null);
    try {
      let latitude: number;
      let longitude: number;

      if (Capacitor.isNativePlatform()) {
        let perm = await Geolocation.checkPermissions();
        if (perm.location !== "granted") {
          perm = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
        }
        if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
          safeSet(setLocationStatus)("denied");
          safeSet(setLocationError)("Konum izni verilmeli. Telefon Ayarları → İzinler → Konum → 'Tam Konum' iznini açınız.");
          return;
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } else {
        if (!navigator.geolocation) {
          safeSet(setLocationStatus)("error");
          safeSet(setLocationError)("Tarayıcınız konum özelliğini desteklemiyor.");
          return;
        }
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      }

      if (!isMountedRef.current) return;
      setCoords({ lat: latitude, lng: longitude });
      setLocationStatus("success");
      await placeMarker(latitude, longitude);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("disabled")) {
        setLocationStatus("denied");
        setLocationError("Konum izni veya GPS kapalı. Ayarlardan 'Tam Konum' ve 'Yüksek Hassasiyet' ayarını açınız.");
      } else if (msg.toLowerCase().includes("timeout")) {
        setLocationStatus("error");
        setLocationError("Konum alınamadı — GPS sinyali zayıf. Açık alanda tekrar deneyin.");
      } else {
        setLocationStatus("error");
        setLocationError("Konum alınamadı. Lütfen GPS bağlantınızı kontrol edin.");
      }
    }
  }, [placeMarker, safeSet]);

  // ─── Leaflet Harita Başlat (lazy import ile güvenli) ──────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let map: any = null;
    const container = mapContainerRef.current;

    (async () => {
      try {
        // Lazy import — DOM hazır olduğunda çalışır, global scope'ta değil
        const L = (await import("leaflet")).default;
        if (!isMountedRef.current || !container) return;

        // Eğer container zaten başlatılmışsa temizle
        if ((container as any)._leaflet_id) return;

        const defaultCenter: [number, number] = initialCoords
          ? [initialCoords.latitude, initialCoords.longitude]
          : [39.9334, 32.8597];

        map = L.map(container, {
          center: defaultCenter,
          zoom: initialCoords ? 18 : 6,
          zoomControl: false,
          attributionControl: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
        L.control.zoom({ position: "bottomright" }).addTo(map);
        mapRef.current = map;

        // Haritaya tıkla → pin taşı
        map.on("click", async (e: any) => {
          if (!isMountedRef.current) return;
          setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
          await placeMarker(e.latlng.lat, e.latlng.lng);
        });

        // Başlangıç konumu varsa marker koy
        if (initialCoords) {
          await placeMarker(initialCoords.latitude, initialCoords.longitude);
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
      } catch { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── İlk açılışta otomatik konum al ───────────────────────
  useEffect(() => {
    if (!initialCoords) {
      // Harita DOM'a mount olduktan sonra GPS'i başlat
      const t = setTimeout(() => { fetchLocation(); }, 300);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Form Gönder ───────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!coords) return;
    setIsSaving(true);
    try {
      onSubmit({
        latitude: coords.lat,
        longitude: coords.lng,
        auto_address: autoAddress,
        building_name: buildingName,
        block,
        floor,
        door_number: doorNumber,
        address_note: addressNote,
      });
    } finally {
      if (isMountedRef.current) setIsSaving(false);
    }
  }, [coords, autoAddress, buildingName, block, floor, doorNumber, addressNote, onSubmit]);

  const canSave = useMemo(() => coords !== null && autoAddress.trim().length > 0, [coords, autoAddress]);

  const handleRelocate = useCallback(() => fetchLocation(), [fetchLocation]);

  const openAppSettings = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Geolocation.requestPermissions({ permissions: ["location"] });
      } catch { /* ignore */ }
    }
    fetchLocation();
  }, [fetchLocation]);

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">

      {/* Üst Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-20">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-sky-700 dark:text-sky-400" />
          Pin ile Adres Kaydet
        </h2>
        <div className="w-8" />
      </div>

      {/* Harita */}
      <div className="relative flex-1 min-h-0" style={{ minHeight: isFormExpanded ? "40%" : "70%" }}>
        <div
          ref={mapContainerRef}
          className="absolute inset-0 z-0"
          style={{ touchAction: "manipulation" }}
        />

        {/* GPS Yükleniyor */}
        {locationStatus === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs pointer-events-none">
            <div className="bg-white dark:bg-slate-800 rounded-xl px-5 py-4 flex flex-col items-center gap-3 shadow-sm border border-slate-200 dark:border-slate-700">
              <Loader2 className="h-8 w-8 text-sky-700 dark:text-sky-400 animate-spin" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">GPS konumu alınıyor...</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Yüksek hassasiyetli konum bekleniyor</p>
            </div>
          </div>
        )}

        {/* İzin Hatası */}
        {(locationStatus === "denied" || locationStatus === "error") && !coords && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl px-5 py-5 flex flex-col items-center gap-4 shadow-sm border border-slate-200 dark:border-slate-700 max-w-xs w-full">
              <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 text-center leading-relaxed">
                {locationError}
              </p>
              <div className="flex gap-2 w-full">
                {locationStatus === "denied" && (
                  <button
                    onClick={openAppSettings}
                    className="flex-1 py-2.5 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    İzin Ver
                  </button>
                )}
                <button
                  onClick={fetchLocation}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Tekrar Dene
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Konumuma Dön */}
        {coords && locationStatus !== "loading" && (
          <button
            onClick={handleRelocate}
            className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sky-700 dark:text-sky-400 transition active:scale-95 hover:bg-sky-50 dark:hover:bg-slate-700"
            title="Konumuma Dön"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        )}

        {/* Koordinat Chip */}
        {coords && (
          <div className="absolute top-3 left-3 z-10 bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-tight">
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          </div>
        )}
      </div>

      {/* Form (Bottom Sheet) */}
      <div
        className={`bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-all duration-300 overflow-y-auto shrink-0 ${
          isFormExpanded ? "max-h-[60%]" : "max-h-14"
        }`}
      >
        <button
          onClick={() => setIsFormExpanded(!isFormExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 transition active:bg-slate-100"
        >
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-sky-700 dark:text-sky-400" />
            Adres Detayları
          </span>
          {isFormExpanded
            ? <ChevronDown className="h-4 w-4 text-slate-400" />
            : <ChevronUp className="h-4 w-4 text-slate-400" />}
        </button>

        {isFormExpanded && (
          <div className="p-4 space-y-3.5">
            {/* İl/İlçe/Sokak */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                İl / İlçe / Sokak
                {reverseGeoLoading && <Loader2 className="inline h-3 w-3 ml-1.5 animate-spin text-sky-600" />}
              </label>
              <textarea
                value={autoAddress}
                onChange={(e) => setAutoAddress(e.target.value)}
                rows={2}
                placeholder="GPS konumu alındığında otomatik dolacak..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 resize-none transition"
              />
            </div>

            {/* Apartman + Blok */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Apartman / Bina</label>
                <input type="text" value={buildingName} onChange={(e) => setBuildingName(e.target.value)}
                  placeholder="Örn: Yıldız Apt."
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Blok / Giriş</label>
                <input type="text" value={block} onChange={(e) => setBlock(e.target.value)}
                  placeholder="Örn: B Blok"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition" />
              </div>
            </div>

            {/* Kat + Daire */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Kat No
                </label>
                <input type="text" inputMode="numeric" value={floor} onChange={(e) => setFloor(e.target.value)}
                  placeholder="Örn: 3"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide flex items-center gap-1">
                  <DoorOpen className="h-3 w-3" /> Daire No
                </label>
                <input type="text" inputMode="numeric" value={doorNumber} onChange={(e) => setDoorNumber(e.target.value)}
                  placeholder="Örn: 7"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition" />
              </div>
            </div>

            {/* Adres Notu */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide flex items-center gap-1">
                <StickyNote className="h-3 w-3" /> Adres Tarifi / Notu
              </label>
              <textarea value={addressNote} onChange={(e) => setAddressNote(e.target.value)}
                rows={2}
                placeholder="Örn: Mavi binanın arkasında, market karşısı..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 resize-none transition" />
            </div>

            {/* Uyarı (konum varken) */}
            {locationError && coords && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {locationError}
              </p>
            )}

            {/* Kaydet */}
            <button
              onClick={handleSubmit}
              disabled={!canSave || isSaving}
              className={`w-full py-3.5 rounded-xl text-sm font-bold transition active:scale-[0.98] flex items-center justify-center gap-2 ${
                canSave && !isSaving
                  ? "bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white shadow-sm cursor-pointer"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              }`}
            >
              {isSaving
                ? <><Loader2 className="h-4 w-4 animate-spin" />Kaydediliyor...</>
                : <><Save className="h-4 w-4" />Konumu Kaydet</>
              }
            </button>

            <div style={{ height: "env(safe-area-inset-bottom, 16px)" }} />
          </div>
        )}
      </div>
    </div>
  );
}
