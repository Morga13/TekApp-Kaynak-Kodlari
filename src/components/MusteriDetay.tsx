import React, { useState, useEffect, useRef, useCallback } from "react";
import { Capacitor } from '@capacitor/core';
import { Musteri, Bakim, DeğişenParça } from "../types";
import { Phone, MapPin, FileText, Calendar, Trash2, ShieldAlert, Plus, MessageSquare, Bell, X, Clock, CalendarCheck } from "lucide-react";

interface MusteriDetayProps {
  musteriId: number;
  musteriler: Musteri[];
  bakimlar: Bakim[];
  onBack: () => void;
  onDeleteBakim: (id: number) => void;
  onNewBakimClick: (id: number) => void;
  onUpdateOdemeDurumu: (id: number, odendi: number) => void;
}

// Hatırlatıcı verilerini localStorage'dan oku/yaz
const HATIRLATICI_KEY = "tekapp_bakim_hatirlatici";

function getHatirlaticilar(): Record<number, string> {
  try {
    const data = localStorage.getItem(HATIRLATICI_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function setHatirlatici(musteriId: number, tarih: string) {
  const all = getHatirlaticilar();
  all[musteriId] = tarih;
  try {
    localStorage.setItem(HATIRLATICI_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

function silHatirlatici(musteriId: number) {
  const all = getHatirlaticilar();
  delete all[musteriId];
  try {
    localStorage.setItem(HATIRLATICI_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

function formatTarih(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function kalanGun(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function MusteriDetay({
  musteriId,
  musteriler,
  bakimlar,
  onBack,
  onDeleteBakim,
  onNewBakimClick,
  onUpdateOdemeDurumu
}: MusteriDetayProps) {
  const musteri = musteriler.find((m) => m.id === musteriId);
  const mBakimlar = bakimlar.filter((b) => b.musteri_id === musteriId);

  // Hatırlatıcı state
  const [hatirlaticiModalOpen, setHatirlaticiModalOpen] = useState(false);
  const [ozelTarih, setOzelTarih] = useState("");
  const [aktifHatirlatici, setAktifHatirlatici] = useState<string | null>(null);

  // --- Swipe-Back Gesture ---
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const [swipeDx, setSwipeDx] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    setSwiping(false);
    setSwipeDx(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = Math.abs(touch.clientY - touchStartY.current);
    // Sadece soldan sağa swipe, dikey kayma değil, ve sol kenar başlangıcı (ilk 80px)
    if (dx > 0 && dy < 60 && touchStartX.current < 80) {
      setSwiping(true);
      setSwipeDx(Math.min(dx, window.innerWidth));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swiping && swipeDx > 100) {
      // Eşiği geçti: geri dön animasyonu + navigate
      setSwipeDx(window.innerWidth);
      setTimeout(() => onBack(), 200);
    } else {
      // Geri çek
      setSwipeDx(0);
      setSwiping(false);
    }
  }, [swiping, swipeDx, onBack]);
  // --- /Swipe-Back Gesture ---

  useEffect(() => {
    const all = getHatirlaticilar();
    setAktifHatirlatici(all[musteriId] || null);
  }, [musteriId]);

  if (!musteri) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 h-full">
        <ShieldAlert className="h-10 w-10 text-amber-500 mb-2" />
        <p className="text-slate-600 font-medium">Müşteri bulunamadı.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-semibold">
          Geri Dön
        </button>
      </div>
    );
  }

  // Helper to parse sqlite dynamic parts array safely
  const parseParts = (jsonStr: string): DeğişenParça[] => {
    try {
      return JSON.parse(jsonStr || "[]");
    } catch (e) {
      return [];
    }
  };

  const safeOpenUrl = (url: string) => {
    if (Capacitor.isNativePlatform()) {
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  };

  // Hatırlatıcı kaydet
  const handleSetHatirlatici = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const tarih = d.toISOString().split("T")[0];
    setHatirlatici(musteriId, tarih);
    setAktifHatirlatici(tarih);
    setHatirlaticiModalOpen(false);
  };

  const handleSetOzelTarih = () => {
    if (!ozelTarih) return;
    setHatirlatici(musteriId, ozelTarih);
    setAktifHatirlatici(ozelTarih);
    setOzelTarih("");
    setHatirlaticiModalOpen(false);
  };

  const handleSilHatirlatici = () => {
    silHatirlatici(musteriId);
    setAktifHatirlatici(null);
  };

  // Hatırlatıcı durumu
  const kalan = aktifHatirlatici ? kalanGun(aktifHatirlatici) : null;
  const hatirlaticiGecmis = kalan !== null && kalan < 0;
  const hatirlaticiYakin = kalan !== null && kalan >= 0 && kalan <= 14;

  return (
    <div
      className="flex flex-col h-full bg-slate-50"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: swipeDx > 0 ? `translateX(${swipeDx}px)` : undefined,
        transition: swiping && swipeDx > 0 ? "none" : "transform 0.2s cubic-bezier(0.25,0.46,0.45,0.94)",
        boxShadow: swipeDx > 0 ? `-8px 0 24px rgba(0,0,0,0.18)` : undefined,
      }}
    >
      {/* Profil Header */}
      <div className="bg-slate-800 text-white px-4 py-5 flex flex-col gap-4 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-sky-400 text-white font-bold text-lg flex items-center justify-center">
            {musteri.ad ? musteri.ad[0]?.toUpperCase() || '?' : '?'}
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-100">{musteri.ad}</h2>
            {musteri.telefon && (
              <a
                href={`tel:${musteri.telefon}`}
                className="flex items-center gap-1.5 text-xs text-sky-300 font-semibold mt-0.5"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>{musteri.telefon}</span>
              </a>
            )}
          </div>
        </div>

        {/* Adres ve Notlar */}
        <div className="space-y-2 border-t border-slate-700/60 pt-3 text-xs text-slate-300">
          {musteri.adres && (
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{musteri.adres}</span>
              </div>
              <button
                onClick={() => {
                  safeOpenUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(musteri.adres)}`);
                }}
                className="text-[10px] font-bold text-sky-300 hover:text-sky-200 bg-sky-500/20 px-2 py-0.5 rounded-md border border-sky-400/30 shrink-0 transition"
              >
                Harita
              </button>
            </div>
          )}
          {musteri.not && (
            <div className="flex items-start gap-2">
              {musteri.not === "Açık Cihaz" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AÇIK CİHAZ
                </span>
              ) : musteri.not === "Kapalı Cihaz" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-500/20 text-slate-400 border border-slate-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  KAPALI CİHAZ
                </span>
              ) : (
                <>
                  <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed italic text-slate-300">{musteri.not}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bakım Geçmişi */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 pb-24">

        {/* 🔔 Bakım Hatırlatıcısı Kartı */}
        <div className={`rounded-xl border p-3.5 shadow-sm transition ${
          hatirlaticiGecmis
            ? "bg-rose-50 border-rose-200"
            : hatirlaticiYakin
              ? "bg-amber-50 border-amber-200"
              : aktifHatirlatici
                ? "bg-emerald-50 border-emerald-200"
                : "bg-white border-slate-100"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                hatirlaticiGecmis
                  ? "bg-rose-100 text-rose-600"
                  : hatirlaticiYakin
                    ? "bg-amber-100 text-amber-600"
                    : aktifHatirlatici
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-slate-100 text-slate-400"
              }`}>
                <Bell className={`h-5 w-5 ${hatirlaticiGecmis || hatirlaticiYakin ? "animate-bounce" : ""}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700">Bakım Hatırlatıcısı</p>
                {aktifHatirlatici ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <CalendarCheck className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className={`text-[11px] font-semibold ${
                      hatirlaticiGecmis ? "text-rose-600" : hatirlaticiYakin ? "text-amber-600" : "text-emerald-600"
                    }`}>
                      {formatTarih(aktifHatirlatici)}
                      {hatirlaticiGecmis
                        ? ` (${Math.abs(kalan!)} gün geçti!)`
                        : kalan === 0
                          ? " (Bugün!)"
                          : ` (${kalan} gün kaldı)`
                      }
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">Henüz hatırlatıcı eklenmedi</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {aktifHatirlatici && (
                <button
                  onClick={handleSilHatirlatici}
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                  title="Hatırlatıcıyı Sil"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setHatirlaticiModalOpen(true)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 active:scale-95 ${
                  aktifHatirlatici
                    ? "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    : "bg-sky-500 text-white hover:bg-sky-600 shadow-sm"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {aktifHatirlatici ? "Değiştir" : "Ekle"}
              </button>
            </div>
          </div>
        </div>

        {/* Bakım Başlığı */}
        <div className="flex justify-between items-center px-1 shrink-0">
          <h3 className="font-bold text-slate-700 text-sm">Geçmiş Bakımlar ({mBakimlar.length})</h3>
          <button
            onClick={() => onNewBakimClick(musteri.id)}
            className="flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 py-1 px-2.5 bg-sky-50 rounded-lg border border-sky-100 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Yeni Bakım Ekle
          </button>
        </div>

        {mBakimlar.length > 0 ? (
          mBakimlar.map((b) => {
            const parcalar = parseParts(b.parcalar);
            return (
              <div key={b.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs relative">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 mb-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{b.tarih}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {musteri.telefon && (
                      <button
                        onClick={() => {
                          let rawPhone = musteri.telefon.replace(/\D/g, "");
                          if (rawPhone.startsWith("0")) rawPhone = "9" + rawPhone;
                          if (!rawPhone.startsWith("90") && rawPhone.length === 10) rawPhone = "90" + rawPhone;
                          const parcaListStr = parcalar.map(p => `${p.ad} (x${p.adet || 1})`).join(", ");
                          const msg = `Sayın ${musteri.ad},\n${b.tarih} tarihinde cihazınıza aşağıdaki bakım yapılmıştır:\n\nDeğişen Parçalar: ${parcaListStr}\nToplam Tutar: ${b.toplam} TL (${b.odendi === 1 ? 'Ödendi' : 'Ödeme Bekliyor'}).\n\nBizi tercih ettiğiniz için teşekkür ederiz.`;
                          safeOpenUrl(`https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`);
                        }}
                        className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold transition flex items-center gap-1"
                        title="WhatsApp Servis Fişi Gönder"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Fiş Gönder
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm("Bu bakım kaydını silmek istediğinize emin misiniz?")) {
                          onDeleteBakim(b.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-50 rounded transition"
                      title="Bakım Kaydını Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 block tracking-wider uppercase">Değişen Parçalar:</span>
                  <div className="divide-y divide-slate-50">
                    {parcalar.map((p, idx) => (
                      <div key={idx} className="flex justify-between py-1.5 text-xs">
                        <span className="text-slate-700 font-medium">{p.ad} <span className="text-slate-400 text-[10px] font-bold">x{p.adet || 1}</span></span>
                        <span className="text-slate-500 font-mono">
                          {((p.fiyat || 0) * (p.adet || 1)).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {b.not && (
                  <div className="bg-slate-50 rounded-lg p-2.5 mt-3 text-xs text-slate-600 border border-slate-100">
                    <span className="font-bold text-slate-500 block mb-0.5 text-[10px]">Bakım Notu:</span>
                    <p className="leading-relaxed">{b.not}</p>
                  </div>
                )}

                <div className="flex justify-between items-center border-t border-slate-100 mt-3 pt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-400 text-[10px]">Ödeme:</span>
                    <button
                      onClick={() => {
                        const yeniDurum = b.odendi === 1 ? 0 : 1;
                        onUpdateOdemeDurumu(b.id, yeniDurum);
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition flex items-center gap-1 border ${
                        b.odendi === 1
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                      }`}
                      title="Değiştirmek için tıklayın"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${b.odendi === 1 ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {b.odendi === 1 ? "ÖDENDİ" : "BEKLİYOR"}
                    </button>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 block text-[10px] leading-none mb-0.5">Toplam Tutar</span>
                    <span className="text-sm font-extrabold text-slate-800 font-mono">
                      {b.toplam.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-2">
              <Calendar className="h-6 w-6" />
            </div>
            <p className="text-slate-500 text-xs font-medium">Bu müşteriye ait henüz bakım kaydı bulunmuyor.</p>
            <button
              onClick={() => onNewBakimClick(musteri.id)}
              className="mt-3 text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 py-2 px-4 rounded-lg shadow-xs transition"
            >
              İlk Bakım Kaydını Ekle
            </button>
          </div>
        )}
      </div>

      {/* 🔔 Hatırlatıcı Modal */}
      {hatirlaticiModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-[15px]">🔔 Bakım Hatırlatıcısı</h3>
                <p className="text-[11px] text-amber-700 font-medium mt-0.5">{musteri.ad}</p>
              </div>
              <button onClick={() => setHatirlaticiModalOpen(false)} className="p-1 rounded-full hover:bg-amber-100 text-slate-400 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-500 font-medium">Bir sonraki bakım ne zaman yapılmalı?</p>

              {/* Seçenek 1: 6 Ay */}
              <button
                onClick={() => handleSetHatirlatici(6)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50 transition active:scale-[0.98] group"
              >
                <div className="h-10 w-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-sm shrink-0 group-hover:bg-sky-200 transition">
                  6ay
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-700">6 Ay Sonra</p>
                  <p className="text-[11px] text-slate-400">
                    {(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return formatTarih(d.toISOString()); })()}
                  </p>
                </div>
              </button>

              {/* Seçenek 2: 1 Yıl */}
              <button
                onClick={() => handleSetHatirlatici(12)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition active:scale-[0.98] group"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0 group-hover:bg-emerald-200 transition">
                  1yıl
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-700">1 Yıl Sonra</p>
                  <p className="text-[11px] text-slate-400">
                    {(() => { const d = new Date(); d.setMonth(d.getMonth() + 12); return formatTarih(d.toISOString()); })()}
                  </p>
                </div>
              </button>

              {/* Seçenek 3: Özel Tarih */}
              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">İstediğiniz Tarihi Girin</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={ozelTarih}
                    onChange={(e) => setOzelTarih(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                  />
                  <button
                    onClick={handleSetOzelTarih}
                    disabled={!ozelTarih}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-sm font-bold transition active:scale-95"
                  >
                    Kaydet
                  </button>
                </div>
              </div>

              {/* İptal */}
              <button
                onClick={() => setHatirlaticiModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
