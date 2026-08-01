import React, { useState } from "react";
import { Musteri, Bakim } from "../types";
import { Search, Plus, Phone, MapPin, FileText, Edit2, Trash2, Eye, X, Smartphone, MessageSquare, LocateFixed, Loader2, Wallet } from "lucide-react";
import { Contacts } from "@capacitor-community/contacts";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from '@capacitor/core';
import { getMusteriCariOzet, saveTahsilat } from "../utils/cari";

interface MusteriListesiProps {
  musteriler: Musteri[];
  bakimlar?: Bakim[];
  onAddOrEdit: (musteri: Omit<Musteri, "id"> & { id?: number }) => Promise<boolean>;
  onDelete: (id: number) => void;
  onSelectMusteri: (id: number) => void;
}

export default function MusteriListesi({
  musteriler,
  bakimlar = [],
  onAddOrEdit,
  onDelete,
  onSelectMusteri
}: MusteriListesiProps) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [virtualContactsOpen, setVirtualContactsOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [realContacts, setRealContacts] = useState<{ad: string, telefon: string}[]>([]);
  
  const safeOpenUrl = (url: string) => {
    if (Capacitor.isNativePlatform()) {
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  };

  // Form states
  const [editId, setEditId] = useState<number | undefined>(undefined);
  const [ad, setAd] = useState("");
  const [telefon, setTelefon] = useState("");
  const [adres, setAdres] = useState("");
  const [hasAcik, setHasAcik] = useState(false);
  const [hasKapali, setHasKapali] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [konumYukleniyor, setKonumYukleniyor] = useState(false);
  const [konumHata, setKonumHata] = useState<string | null>(null);

  // Hızlı Ödeme Al Modalı State
  const [odemeModalMusteri, setOdemeModalMusteri] = useState<Musteri | null>(null);
  const [tahsilatTutar, setTahsilatTutar] = useState("");
  const [tahsilatTarih, setTahsilatTarih] = useState(new Date().toISOString().split("T")[0]);
  const [tahsilatNot, setTahsilatNot] = useState("");

  const handleOpenQuickOdeme = (m: Musteri) => {
    const ozet = getMusteriCariOzet(m.id, bakimlar);
    setOdemeModalMusteri(m);
    setTahsilatTutar(ozet.kalanBakiye > 0 ? String(ozet.kalanBakiye) : "");
    setTahsilatTarih(new Date().toISOString().split("T")[0]);
    setTahsilatNot("Tahsilat");
  };

  const handleSaveQuickTahsilat = () => {
    if (!odemeModalMusteri) return;
    const tutarNum = parseFloat(tahsilatTutar.replace(",", "."));
    if (isNaN(tutarNum) || tutarNum <= 0) {
      alert("Lütfen geçerli bir ödeme tutarı giriniz.");
      return;
    }

    saveTahsilat({
      musteri_id: odemeModalMusteri.id,
      tarih: tahsilatTarih || new Date().toISOString().split("T")[0],
      tutar: tutarNum,
      aciklama: tahsilatNot.trim() || "Tahsilat"
    });

    setOdemeModalMusteri(null);
    setTahsilatTutar("");
    alert(`${odemeModalMusteri.ad} için ${tutarNum.toLocaleString('tr-TR')} ₺ tahsilat başarıyla kaydedildi.`);
  };

  const handlePickContact = async () => {
    try {
      const isNative = Capacitor.isNativePlatform();
      if (!isNative) {
        alert("Rehberden kişi seçimi sadece mobil cihazlarda (Android & iOS) kullanılabilir.");
        return;
      }

      // Önce izin durumunu kontrol et, yoksa iste
      let permResult = await Contacts.checkPermissions();
      if (permResult.contacts !== "granted") {
        permResult = await Contacts.requestPermissions();
      }

      if (permResult.contacts !== "granted") {
        alert(
          "Rehbere erişim izni verilmedi.\n\n" +
          "Telefon Ayarları → Uygulamalar → TekApp → İzinler → Kişiler (Contacts) bölümünden erişim izni veriniz."
        );
        return;
      }

      const platform = Capacitor.getPlatform();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ContactsAny = Contacts as any;

      if (platform === "android" && typeof ContactsAny.pickContact === "function") {
        // Android Native Person Picker
        const result = await ContactsAny.pickContact({
          projection: { name: true, phones: true }
        });
        const contact = result?.contact;
        if (contact) {
          const isim = contact.displayName || contact.name?.display || contact.name?.given || "";
          const tel = contact.phoneNumbers?.[0]?.number || contact.phones?.[0]?.number || "";
          setAd(isim);
          setTelefon(tel.replace(/\s+/g, ""));
        }
      } else {
        // iOS ve diğer sistemlerde güvenli getContacts fallback'i
        const { contacts } = await Contacts.getContacts({
          projection: { name: true, phones: true }
        });

        if (!contacts || contacts.length === 0) {
          alert("Rehberinizde kayıtlı kişi bulunamadı.");
          return;
        }

        setRealContacts(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (contacts as any[])
            .filter((c) => (c.phoneNumbers && c.phoneNumbers.length > 0) || (c.phones && c.phones.length > 0))
            .map((c) => {
              const phoneObj = c.phoneNumbers?.[0] || c.phones?.[0];
              const tel: string = phoneObj?.number || "";
              const given: string = c.name?.given || "";
              const family: string = c.name?.family || "";
              const fullFromParts = `${given} ${family}`.trim();
              const ad: string = c.displayName || c.name?.display || fullFromParts || "(İsimsiz)";
              return {
                ad: ad.trim(),
                telefon: tel.replace(/\s+/g, ""),
              };
            })
            .filter((c: { telefon: string }) => c.telefon.length > 0)
        );
        setContactSearch("");
        setVirtualContactsOpen(true);
      }
    } catch (err) {
      console.error("Rehber hatası:", err);
      const msg = String(err);
      if (
        msg.toLowerCase().includes("cancel") ||
        msg.toLowerCase().includes("dismissed") ||
        msg.toLowerCase().includes("user denied")
      ) return;
      alert("Rehbere erişilemedi: " + (err instanceof Error ? err.message : msg));
    }
  };


  const searchLower = search.toLocaleLowerCase("tr-TR");

  const filtered = React.useMemo(() => {
    if (!searchLower.trim()) return musteriler;
    return musteriler.filter(
      (m) =>
        m.ad.toLocaleLowerCase("tr-TR").includes(searchLower) ||
        (m.telefon && m.telefon.includes(searchLower))
    );
  }, [musteriler, searchLower]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ad.trim()) return;

    // Yerel duplikasyon kontrolü
    const isNew = !editId;
    if (isNew) {
      const exists = musteriler.some(
        (existing) => existing.ad.trim().toLowerCase() === ad.trim().toLowerCase()
      );
      if (exists) {
        setError(`"${ad.trim()}" isimli bir müşteri zaten kayıtlı!`);
        return;
      }
    } else {
      const exists = musteriler.some(
        (existing) => existing.id !== editId && existing.ad.trim().toLowerCase() === ad.trim().toLowerCase()
      );
      if (exists) {
        setError(`"${ad.trim()}" isimli bir başka müşteri zaten kayıtlı!`);
        return;
      }
    }

    const deviceTypes: string[] = [];
    if (hasAcik) deviceTypes.push("Açık Cihaz");
    if (hasKapali) deviceTypes.push("Kapalı Cihaz");

    setError(null);
    const success = await onAddOrEdit({
      id: editId,
      ad: ad.trim(),
      telefon: telefon.trim(),
      adres: adres.trim(),
      not: deviceTypes.join(", ")
    });
    if (success) {
      closeModal();
    }
  };

  // GPS konum al + reverse geocoding (Capacitor Geolocation + Nominatim)
  const handleKonumuKullan = async () => {
    setKonumYukleniyor(true);
    setKonumHata(null);

    let latitude: number | null = null;
    let longitude: number | null = null;

    try {
      if (Capacitor.isNativePlatform()) {
        // Native İzin Kontrolü ve İsteği
        let perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          perm = await Geolocation.requestPermissions();
        }
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          setKonumHata("Konum izni reddedildi. Cihaz ayarlarından TekApp konum iznini açınız.");
          setKonumYukleniyor(false);
          return;
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } else {
        // Web Fallback
        if (!navigator.geolocation) {
          setKonumHata("Tarayıcınız konum özelliğini desteklemiyor.");
          setKonumYukleniyor(false);
          return;
        }
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      }

      if (latitude !== null && longitude !== null) {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=tr`,
          { headers: { "User-Agent": "TekApp/1.0" } }
        );
        const data = await res.json();
        const a = data.address || {};
        const parcalar = [
          a.road || a.pedestrian || a.footway || "",
          a.house_number ? `No:${a.house_number}` : "",
          a.neighbourhood || a.suburb || a.quarter || "",
          a.district || a.town || a.city_district || "",
          a.city || a.county || a.state || "",
        ].filter(Boolean);
        const gelenAdres = parcalar.join(", ") || data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setAdres(gelenAdres);
      }
    } catch (err: unknown) {
      console.error("Konum hatası:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("disabled")) {
        setKonumHata("Konum izni kapalı. Telefon ayarlarından konum servislerini ve izinleri açınız.");
      } else {
        setKonumHata("Konum alınamadı. Lütfen GPS bağlantınızı kontrol edin.");
      }
    } finally {
      setKonumYukleniyor(false);
    }
  };

  const startEdit = (m: Musteri) => {
    setEditId(m.id);
    setAd(m.ad);
    setTelefon(m.telefon || "");
    setAdres(m.adres || "");
    const notStr = m.not || "";
    setHasAcik(notStr.includes("Açık Cihaz"));
    setHasKapali(notStr.includes("Kapalı Cihaz"));
    setError(null);
    setKonumHata(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditId(undefined);
    setAd("");
    setTelefon("");
    setAdres("");
    setHasAcik(false);
    setHasKapali(false);
    setError(null);
    setKonumHata(null);
    setModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full max-w-full overflow-x-hidden">
      {/* Search Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Müşteri ara (İsim veya Telefon)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
          />
        </div>
      </div>

      {/* Customer List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 pb-24 w-full max-w-full overflow-x-hidden">
        {filtered.length > 0 ? (
          filtered.map((m) => {
            const cari = getMusteriCariOzet(m.id, bakimlar);
            return (
              <div
                key={m.id}
                className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition flex justify-between items-start gap-2.5 min-w-0 max-w-full overflow-hidden"
              >
                <div
                  onClick={() => onSelectMusteri(m.id)}
                  className="flex-1 min-w-0 cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <h3 className="font-bold text-slate-800 text-[15px] truncate max-w-full">{m.ad}</h3>
                    {cari.kalanBakiye > 0 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                        Borç: {cari.kalanBakiye.toLocaleString("tr-TR")} ₺
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        <span className="h-1 w-1 rounded-full bg-emerald-500" />
                        Borcu Yok
                      </span>
                    )}
                    {m.not?.includes("Açık Cihaz") && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                        AÇIK CİHAZ
                      </span>
                    )}
                    {m.not?.includes("Kapalı Cihaz") && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                        <span className="h-1 w-1 rounded-full bg-blue-400" />
                        KAPALI CİHAZ
                      </span>
                    )}
                  </div>
                {m.telefon && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{m.telefon}</span>
                  </div>
                )}
                {m.adres && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate min-w-0 flex-1">{m.adres}</span>
                  </div>
                )}
                {m.not && m.not !== "Açık Cihaz" && m.not !== "Kapalı Cihaz" && (
                  <div className="flex items-start gap-2 text-xs text-slate-400 italic min-w-0">
                    <FileText className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                    <span className="line-clamp-1 truncate">{m.not}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 border-l border-slate-100 pl-2 shrink-0">
                {cari.kalanBakiye > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenQuickOdeme(m);
                    }}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs active:scale-95 shrink-0 mr-1"
                    title="Bu müşteri için ödeme / tahsilat gir"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Ödeme Al
                  </button>
                )}
                {m.telefon && (
                  <button
                    onClick={() => {
                      let raw = m.telefon.replace(/\D/g, "");
                      if (raw.startsWith("0")) raw = "9" + raw;
                      if (!raw.startsWith("90") && raw.length === 10) raw = "90" + raw;
                      safeOpenUrl(`https://wa.me/${raw}`);
                    }}
                    className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg transition active:scale-95"
                    title="WhatsApp Mesaj Gönder"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                )}
                {m.adres && (
                  <button
                    onClick={() => {
                      safeOpenUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.adres)}`);
                    }}
                    className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition"
                    title="Google Maps Yol Tarifi"
                  >
                    <MapPin className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => onSelectMusteri(m.id)}
                  className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-slate-50 rounded-lg transition"
                  title="Detayları Gör"
                >
                  <Eye className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={() => startEdit(m)}
                  className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition"
                  title="Düzenle"
                >
                  <Edit2 className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`${m.ad} isimli müşteriyi silmek istediğinize emin misiniz?`)) {
                      onDelete(m.id);
                    }
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition"
                  title="Sil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Search className="h-6 w-6" />
            </div>
            <p className="text-slate-500 font-medium text-sm">Kayıtlı Müşteri Bulunamadı</p>
            <p className="text-slate-400 text-xs mt-1">Yeni bir müşteri kaydetmek için aşağıdaki + butonuna tıklayın.</p>
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => {
          setEditId(undefined);
          setModalOpen(true);
        }}
        className="absolute bottom-20 right-6 h-12 w-12 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20 flex items-center justify-center transition active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-[15px]">
                {editId ? "Müşteriyi Düzenle" : "Yeni Müşteri Ekle"}
              </h3>
              <button onClick={closeModal} className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-150 rounded-lg text-xs font-bold text-rose-600 flex items-center gap-1.5 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                  {error}
                </div>
              )}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-600">Müşteri Adı Soyadı</label>
                  <button
                    type="button"
                    onClick={handlePickContact}
                    className="text-[10px] font-extrabold text-sky-600 hover:text-sky-700 flex items-center gap-1 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100 transition active:scale-95"
                  >
                    <Smartphone className="h-3 w-3" />
                    Rehberden Seç
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet Yılmaz"
                  value={ad}
                  onChange={(e) => {
                    setAd(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Telefon Numarası <span className="text-[10px] text-slate-400 font-normal">(İsteğe Bağlı)</span></label>
                <input
                  type="tel"
                  placeholder="Örn: 0532 123 4567"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600">Adres</label>
                  <button
                    type="button"
                    onClick={handleKonumuKullan}
                    disabled={konumYukleniyor}
                    className="flex items-center gap-1 px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-[10px] font-bold transition active:scale-95 disabled:opacity-50"
                  >
                    {konumYukleniyor
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <LocateFixed className="h-3 w-3" />
                    }
                    {konumYukleniyor ? "Konum alınıyor..." : "Konumumu Kullan"}
                  </button>
                </div>
                <textarea
                  placeholder="Müşterinin adresi (Konumumu Kullan ile otomatik doldurup manuel kat/daire ekleyebilirsiniz)"
                  value={adres}
                  onChange={(e) => setAdres(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"
                />
                {konumHata && (
                  <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1 font-medium">
                    <X className="h-3 w-3 shrink-0" />{konumHata}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Cihaz Durumu (Çoklu Seçilebilir)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHasAcik(!hasAcik)}
                    className={`py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      hasAcik
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs"
                        : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${hasAcik ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                    Açık Cihaz
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasKapali(!hasKapali)}
                    className={`py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      hasKapali
                        ? "bg-blue-50 text-blue-700 border-blue-300 shadow-xs"
                        : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${hasKapali ? "bg-blue-500" : "bg-slate-300"}`} />
                    Kapalı Cihaz
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-semibold transition"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-semibold transition"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Virtual Contacts Selector Modal */}
      {virtualContactsOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-[15px]">Rehberden Seç</h3>
                <p className="text-[10px] text-slate-400 font-medium">Lütfen eklemek istediğiniz kişiyi seçin</p>
              </div>
              <button 
                type="button"
                onClick={() => setVirtualContactsOpen(false)} 
                className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-3 bg-white border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Kişi ara..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 transition"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
              {realContacts
                .filter(c => c.ad.toLowerCase().includes(contactSearch.toLowerCase()))
                .map((contact, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setAd(contact.ad);
                    setTelefon(contact.telefon);
                    setVirtualContactsOpen(false);
                    setRealContacts([]);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                      {contact.ad ? contact.ad[0].toUpperCase() : "?"}
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-800 block">{contact.ad || "İsimsiz"}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">{contact.telefon}</span>
                    </div>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-slate-400" />
                </button>
              ))}
              {realContacts.filter(c => c.ad.toLowerCase().includes(contactSearch.toLowerCase())).length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  {contactSearch ? "Aramanıza uygun kişi bulunamadı." : "Kayıtlı kişi yok."}
                </div>
              )}
            </div>


          </div>
        </div>
      )}

      {/* 💵 ALACAKLAR EKRANINDAN DİREKT ÖDEME AL MODALI */}
      {odemeModalMusteri && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden space-y-4">
            <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Ödeme Al / Tahsilat Kaydı</h3>
                  <p className="text-[11px] text-slate-300">{odemeModalMusteri.ad}</p>
                </div>
              </div>
              <button onClick={() => setOdemeModalMusteri(null)} className="p-1.5 rounded-full text-slate-400 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tahsilat Tutarı (₺)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Örn: 1000"
                  value={tahsilatTutar}
                  onChange={(e) => setTahsilatTutar(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-base font-extrabold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Ödeme Tarihi</label>
                <input
                  type="date"
                  value={tahsilatTarih}
                  onChange={(e) => setTahsilatTarih(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Açıklama / Not (Opsiyonel)</label>
                <input
                  type="text"
                  placeholder="Örn: Kısmi Tahsilat"
                  value={tahsilatNot}
                  onChange={(e) => setTahsilatNot(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setOdemeModalMusteri(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveQuickTahsilat}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  Ödemeyi Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
