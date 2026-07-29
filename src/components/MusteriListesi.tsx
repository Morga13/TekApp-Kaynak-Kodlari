import React, { useState } from "react";
import { Musteri } from "../types";
import { Search, Plus, Phone, MapPin, FileText, Edit2, Trash2, Eye, X, Smartphone, MessageSquare } from "lucide-react";
import { Contacts } from "@capacitor-community/contacts";
import { Capacitor } from '@capacitor/core';


interface MusteriListesiProps {
  musteriler: Musteri[];
  onAddOrEdit: (musteri: Omit<Musteri, "id"> & { id?: number }) => Promise<boolean>;
  onDelete: (id: number) => void;
  onSelectMusteri: (id: number) => void;
}

export default function MusteriListesi({
  musteriler,
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

  const handlePickContact = async () => {
    try {
      // Önce izin iste
      const permResult = await Contacts.requestPermissions();
      if (permResult.contacts !== "granted") {
        alert(
          "Rehbere erişim izni verilmedi.\n\n" +
          "Telefon Ayarları → Uygulamalar → TekApp → İzinler → Kişiler bölümünden izin veriniz."
        );
        return;
      }

      // pickContact metodunu dene (Android sistemi kişi seçiciyi açar)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ContactsAny = Contacts as any;
      if (typeof ContactsAny.pickContact === "function") {
        const result = await ContactsAny.pickContact({
          projection: { name: true, phones: true }
        });
        const contact = result?.contact;
        if (contact) {
          const isim = contact.displayName || contact.name?.display || contact.name?.given || "";
          const tel = contact.phoneNumbers?.[0]?.number || contact.phones?.[0]?.number || "";
          setAd(isim);
          setTelefon(tel.replace(/\s+/g, "")); // boşlukları temizle
        }
      } else {
        // pickContact yoksa getContacts ile listeyi çek
        const { contacts } = await Contacts.getContacts({
          projection: { name: true, phones: true }
        });
        setRealContacts(
          contacts
            .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
            .map((c) => ({
              ad: c.displayName || c.name?.display || c.name?.given || "(İsimsiz)",
              telefon: c.phoneNumbers?.[0]?.number?.replace(/\s+/g, "") || "",
            }))
        );
        setContactSearch("");
        setVirtualContactsOpen(true);
      }
    } catch (err) {
      console.error("Rehber hatası:", err);
      const msg = String(err);
      // Kullanıcı iptal ettiyse sessizce geç
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

  const startEdit = (m: Musteri) => {
    setEditId(m.id);
    setAd(m.ad);
    setTelefon(m.telefon || "");
    setAdres(m.adres || "");
    const notStr = m.not || "";
    setHasAcik(notStr.includes("Açık Cihaz"));
    setHasKapali(notStr.includes("Kapalı Cihaz"));
    setError(null);
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
    setModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
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
      <div className="flex-1 p-4 overflow-y-auto space-y-3 pb-24">
        {filtered.length > 0 ? (
          filtered.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition flex justify-between items-start gap-3"
            >
              <div
                onClick={() => onSelectMusteri(m.id)}
                className="flex-1 cursor-pointer space-y-1.5"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-800 text-[15px]">{m.ad}</h3>
                  {m.not?.includes("Açık Cihaz") && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                      AÇIK CİHAZ
                    </span>
                  )}
                  {m.not?.includes("Kapalı Cihaz") && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                      <span className="h-1 w-1 rounded-full bg-blue-400" />
                      KAPALI CİHAZ
                    </span>
                  )}
                </div>
                {m.telefon && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{m.telefon}</span>
                  </div>
                )}
                {m.adres && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate max-w-[200px]">{m.adres}</span>
                  </div>
                )}
                {m.not && m.not !== "Açık Cihaz" && m.not !== "Kapalı Cihaz" && (
                  <div className="flex items-start gap-2 text-xs text-slate-400 italic">
                    <FileText className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{m.not}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 border-l border-slate-100 pl-2 shrink-0">
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
          ))
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
                <label className="block text-xs font-bold text-slate-600 mb-1">Adres</label>
                <textarea
                  placeholder="Müşterinin adresi"
                  value={adres}
                  onChange={(e) => setAdres(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"
                />
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
    </div>
  );
}
