import React, { useState, useEffect, useRef, useCallback } from "react";
import { Capacitor } from '@capacitor/core';
import { Musteri, Bakim, DeğişenParça } from "../types";
import {
  Phone, MapPin, FileText, Calendar, Trash2, ShieldAlert, Plus, MessageSquare,
  Bell, X, Clock, CalendarCheck, Wallet, ChevronLeft
} from "lucide-react";
import { saveTahsilat, getMusteriCariOzet } from "../utils/cari";
import { formatDateDDMMYYYY } from "../utils/date";

interface MusteriDetayProps {
  musteriId: number;
  musteriler: Musteri[];
  bakimlar: Bakim[];
  onBack: () => void;
  onDeleteBakim: (id: number) => void;
  onNewBakimClick: (id: number) => void;
  onUpdateOdemeDurumu: (id: number, odendi: number) => void;
}

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
  const mBakimlar = React.useMemo(() => bakimlar
    .filter((b) => b.musteri_id === musteriId)
    .sort((a, b) => b.tarih.localeCompare(a.tarih)), [bakimlar, musteriId]);

  // Hatırlatıcı state
  const [hatirlaticiModalOpen, setHatirlaticiModalOpen] = useState(false);
  const [ozelTarih, setOzelTarih] = useState("");
  const [aktifHatirlatici, setAktifHatirlatici] = useState<string | null>(null);

  // Tahsilat Modal State
  const [odemeModalOpen, setOdemeModalOpen] = useState(false);
  const [tahsilatTutar, setTahsilatTutar] = useState("");
  const [tahsilatTarih, setTahsilatTarih] = useState(new Date().toISOString().split("T")[0]);

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
    if (dx > 0 && dy < 60 && touchStartX.current < 80) {
      setSwiping(true);
      setSwipeDx(Math.min(dx, window.innerWidth));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swiping && swipeDx > 100) {
      setSwipeDx(window.innerWidth);
      setTimeout(() => onBack(), 200);
    } else {
      setSwipeDx(0);
      setSwiping(false);
    }
  }, [swiping, swipeDx, onBack]);

  useEffect(() => {
    const all = getHatirlaticilar();
    setAktifHatirlatici(all[musteriId] || null);
  }, [musteriId]);

  if (!musteri) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 h-full">
        <ShieldAlert className="h-10 w-10 text-amber-500 mb-2" />
        <p className="text-slate-600 font-medium">Müşteri bulunamadı.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 shadow-sm text-white rounded-lg text-sm font-semibold">
          Geri Dön
        </button>
      </div>
    );
  }

  const parseParts = (jsonStr: string): DeğişenParça[] => {
    try {
      return JSON.parse(jsonStr || "[]");
    } catch {
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

  const handleSetHatirlatici = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const tarihStr = d.toISOString().split("T")[0];
    setHatirlatici(musteriId, tarihStr);
    setAktifHatirlatici(tarihStr);
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

  const handleSaveTahsilat = () => {
    const tutarNum = parseFloat(tahsilatTutar.replace(",", "."));
    if (isNaN(tutarNum) || tutarNum <= 0) {
      alert("Lütfen geçerli bir ödeme tutarı giriniz.");
      return;
    }

    saveTahsilat({
      musteri_id: musteriId,
      tarih: tahsilatTarih || new Date().toISOString().split("T")[0],
      tutar: tutarNum,
      aciklama: "Tahsilat"
    });

    setTahsilatTutar("");
    setOdemeModalOpen(false);
    alert(`${musteri.ad} için ${tutarNum.toLocaleString('tr-TR')} ₺ ödeme başarıyla kaydedildi.`);
  };

  const kalan = aktifHatirlatici ? kalanGun(aktifHatirlatici) : null;
  const hatirlaticiGecmis = kalan !== null && kalan < 0;
  const hatirlaticiYakin = kalan !== null && kalan >= 0 && kalan <= 14;

  const cariOzet = React.useMemo(() => getMusteriCariOzet(musteriId, bakimlar), [musteriId, bakimlar]);

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
      <div className="bg-slate-800 text-white p-4 flex flex-col gap-3 shadow-md shrink-0">
        
        {/* 1. ÜST BLOK: Müşteri Bilgi Kartı */}
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-full bg-slate-700 dark:bg-slate-600 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-xs">
            {musteri.ad[0].toUpperCase()}
          </div>
          
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white truncate">{musteri.ad}</h2>
              <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-md border border-slate-600">
                Kapalı Cihaz
              </span>
            </div>

            {musteri.telefon && (
              <p className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {musteri.telefon}
              </p>
            )}

            {musteri.adres && (
              <div className="flex items-start gap-1.5 text-xs text-slate-300 pt-0.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="flex-1 line-clamp-2">{musteri.adres}</span>
                <button
                  onClick={() => safeOpenUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(musteri.adres)}`)}
                  className="text-sky-300 hover:underline text-[11px] shrink-0 font-medium ml-1"
                >
                  Yol Tarifi
                </button>
              </div>
            )}

            {musteri.not && (
              <div className="flex items-start gap-1.5 text-xs italic text-slate-400 pt-0.5">
                <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{musteri.not}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. ALT BLOK: Aksiyon Butonları Satırı */}
        <div className="pt-2 border-t border-slate-700/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* Geri Butonu (<) */}
          <button
            onClick={onBack}
            className="p-1.5 min-h-[36px] min-w-[36px] bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white rounded-lg transition flex items-center justify-center shrink-0 border border-slate-600 cursor-pointer"
            title="Geri Dön"
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>

          {/* Mesaj İkonu (WhatsApp) */}
          {musteri.telefon && (
            <button
              onClick={() => {
                let raw = musteri.telefon.replace(/\D/g, "");
                if (raw.startsWith("0")) raw = "9" + raw;
                if (!raw.startsWith("90") && raw.length === 10) raw = "90" + raw;
                safeOpenUrl(`https://wa.me/${raw}`);
              }}
              className="p-1.5 min-h-[36px] min-w-[36px] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg transition flex items-center justify-center shrink-0 shadow-xs border border-emerald-500 cursor-pointer"
              title="WhatsApp Mesaj Gönder"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Ödeme Al Butonu */}
          <button
            onClick={() => setOdemeModalOpen(true)}
            className="px-2.5 py-1.5 min-h-[36px] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 shrink-0 shadow-xs border border-emerald-500 cursor-pointer"
            title="Ödeme Al"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Ödeme Al</span>
          </button>

          {/* Borcu/Bakiye Durum Butonu */}
          {cariOzet.kalanBakiye > 0 ? (
            <div className="px-2.5 py-1.5 min-h-[36px] bg-rose-500/20 border border-rose-400/40 text-rose-300 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 font-mono tracking-tight">
              🔴 Borç: {cariOzet.kalanBakiye.toLocaleString("tr-TR")} ₺
            </div>
          ) : (
            <div className="px-2.5 py-1.5 min-h-[36px] bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 tracking-tight">
              🟢 Borcu Yok
            </div>
          )}
        </div>
      </div>

      {/* Ana İçerik Alanı */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 pb-24">

        {/* 🔔 Bakım Hatırlatıcısı Kartı */}
        <div className={`rounded-xl border p-3 shadow-xs transition ${
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
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                hatirlaticiGecmis
                  ? "bg-rose-100 text-rose-600"
                  : hatirlaticiYakin
                    ? "bg-amber-100 text-amber-600"
                    : aktifHatirlatici
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-slate-100 text-slate-400"
              }`}>
                <Bell className={`h-4 w-4 ${hatirlaticiGecmis || hatirlaticiYakin ? "animate-bounce" : ""}`} />
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
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 active:scale-95 ${
                  aktifHatirlatici
                    ? "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    : "bg-sky-700 text-white hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 shadow-sm"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {aktifHatirlatici ? "Değiştir" : "Ekle"}
              </button>
            </div>
          </div>
        </div>

        {/* GEÇMİŞ BAKIMLAR VE HİZMETLER */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1 shrink-0">
            <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Geçmiş Hizmet & Satış Kayıtları</h3>
            <button
              onClick={() => onNewBakimClick(musteri.id)}
              className="flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 py-1 px-2.5 bg-sky-50 rounded-lg border border-sky-100 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Yeni Kayıt Ekle
            </button>
          </div>

          {mBakimlar.length > 0 ? (
            mBakimlar.map((b) => {
              const parcalar = parseParts(b.parcalar);
              return (
                <div key={b.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs relative space-y-2.5">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{formatDateDDMMYYYY(b.tarih)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (confirm("Bu hizmet kaydını silmek istediğinize emin misiniz?")) {
                            onDeleteBakim(b.id);
                          }
                        }}
                        className="p-1 text-slate-300 hover:text-rose-500 transition"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Kullanılan Ürünler / Parçalar:
                    </span>
                    <div className="space-y-1">
                      {parcalar.map((p, idx) => (
                        <div key={idx} className="flex justify-between text-xs bg-slate-50 p-2 rounded-lg font-medium text-slate-700">
                          <span>{p.ad} x{p.adet}</span>
                          <span className="font-mono text-slate-500">{(p.fiyat * p.adet).toLocaleString("tr-TR")} ₺</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {b.not && (
                    <div className="bg-slate-50 rounded-lg p-2.5 text-xs text-slate-600 border border-slate-100">
                      <span className="font-bold text-slate-500 block mb-0.5 text-[10px]">Not:</span>
                      <p className="leading-relaxed">{b.not}</p>
                    </div>
                  )}

                  <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-right">
                    <span className="text-xs font-bold text-slate-400 text-[10px]">İşlem Tutarı:</span>
                    <span className="text-sm font-extrabold text-slate-800 font-mono">
                      {b.toplam.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-400 italic bg-white p-6 rounded-xl border border-slate-100 text-center">
              Henüz hizmet kaydı bulunmuyor.
            </p>
          )}
        </div>
      </div>

      {/* 💵 ÖDEME AL / TAHSİLAT MODALI */}
      {odemeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-sm dark:bg-slate-800 w-full max-w-sm overflow-hidden space-y-4">
            <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Ödeme Al / Tahsilat Kaydı</h3>
                  <p className="text-[11px] text-slate-300">{musteri.ad}</p>
                </div>
              </div>
              <button onClick={() => setOdemeModalOpen(false)} className="p-1.5 rounded-full text-slate-400 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tahsilat Tutarı (₺)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Örn: 1200"
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

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setOdemeModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveTahsilat}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  Ödemeyi Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔔 HATIRLATICI MODALI */}
      {hatirlaticiModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-sm dark:bg-slate-800 w-full max-w-sm overflow-hidden">
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

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">İstediğiniz Tarihi Girin</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={ozelTarih}
                    onChange={(e) => setOzelTarih(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                  />
                  <button
                    onClick={handleSetOzelTarih}
                    disabled={!ozelTarih}
                    className="px-4 py-2 bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-sm font-bold transition active:scale-95 cursor-pointer"
                  >
                    Kaydet
                  </button>
                </div>
              </div>

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
