import React, { useState } from "react";
import { Musteri, Bakim } from "../types";
import { Bell, Calendar, Phone, MapPin, Wrench, MessageSquare, Search, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { Capacitor } from '@capacitor/core';
import { formatDateDDMMYYYY } from "../utils/date";

interface BakimHatirlaticiProps {
  musteriler: Musteri[];
  bakimlar: Bakim[];
  onNewBakimClick: (musteriId: number) => void;
  onNavigateToMusteriDetail: (musteriId: number) => void;
}

export default function BakimHatirlatici({
  musteriler,
  bakimlar,
  onNewBakimClick,
  onNavigateToMusteriDetail,
}: BakimHatirlaticiProps) {
  const [search, setSearch] = useState("");
  const [filterPeriod, setFilterPeriod] = useState<"geciken" | "hepsi">("geciken");

  const today = new Date();

  // Her müşteri için en son bakım tarihini bul
  const musteriBakimStats = musteriler.map((m) => {
    const mBakimlar = bakimlar
      .filter((b) => b.musteri_id === m.id && b.tarih)
      .sort((a, b) => b.tarih.localeCompare(a.tarih));

    const latestBakim = mBakimlar[0];
    let daysSince: number | null = null;

    if (latestBakim?.tarih) {
      const parts = latestBakim.tarih.split("-");
      if (parts.length === 3) {
        const bDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const diffTime = today.getTime() - bDate.getTime();
        daysSince = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    return {
      musteri: m,
      latestBakim,
      daysSince,
      isOverdue: daysSince === null || daysSince >= 180, // 6 ay (180 gün) üzeri gecikmiş sayılır
    };
  });

  // Filtreleme
  const filteredList = musteriBakimStats.filter((item) => {
    const nameMatch = item.musteri.ad.toLowerCase().includes(search.toLowerCase()) ||
      (item.musteri.telefon && item.musteri.telefon.includes(search));

    if (!nameMatch) return false;

    if (filterPeriod === "geciken") {
      return item.isOverdue;
    }
    return true;
  }).sort((a, b) => {
    // En uzun süredir bakımsız olanlar en üste
    const daysA = a.daysSince ?? 9999;
    const daysB = b.daysSince ?? 9999;
    return daysB - daysA;
  });

  const gecikenCount = musteriBakimStats.filter((i) => i.isOverdue).length;

  const handleWhatsAppReminder = (item: typeof musteriBakimStats[0]) => {
    if (!item.musteri.telefon) {
      alert("Bu müşterinin kayıtlı telefon numarası bulunmuyor.");
      return;
    }
    let rawPhone = item.musteri.telefon.replace(/\D/g, "");
    if (rawPhone.startsWith("0")) rawPhone = "9" + rawPhone;
    if (!rawPhone.startsWith("90") && rawPhone.length === 10) rawPhone = "90" + rawPhone;

    const tarihText = item.latestBakim ? formatDateDDMMYYYY(item.latestBakim.tarih) : "Henüz bakım yapılmadı";
    const msg = `Sayın ${item.musteri.ad},\nTekApp Su Arıtma cihazınızın bakım zamanı gelmiştir. En son servis tarihiniz: ${tarihText}.\nFiltre değişimi ve kontrol için randevu oluşturmak ister misiniz?`;

    const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`;
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
      window.location.href = whatsappUrl;
    } else {
      window.open(whatsappUrl, '_blank');
    }
  };

  const handleOpenMaps = (adres?: string) => {
    if (!adres || !adres.trim()) {
      alert("Müşterinin adres bilgisi bulunmuyor.");
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`;
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-24">
      {/* Header & İstatistik Banner */}
      <div className="p-4 bg-white border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Bell className="h-5 w-5 animate-bounce" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Bakım Hatırlatıcı</h2>
              <p className="text-[11px] text-slate-400">6 ayı geçen ve bakımı gelen müşteriler</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-600 border border-rose-200 font-mono">
            {gecikenCount} Geciken
          </span>
        </div>

        {/* Sekme Filtresi (Gecikenler / Tüm Müşteriler) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setFilterPeriod("geciken")}
            className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              filterPeriod === "geciken"
                ? "bg-white text-rose-600 shadow-xs"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Bakımı Gelenler ({gecikenCount})
          </button>
          <button
            onClick={() => setFilterPeriod("hepsi")}
            className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              filterPeriod === "hepsi"
                ? "bg-white text-sky-600 shadow-xs"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Tüm Müşteriler ({musteriler.length})
          </button>
        </div>

        {/* Arama Kutusu */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Müşteri ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
          />
        </div>
      </div>

      {/* Müşteri Hatırlatma Listesi */}
      <div className="p-4 space-y-3">
        {filteredList.length > 0 ? (
          filteredList.map(({ musteri, latestBakim, daysSince, isOverdue }) => (
            <div
              key={musteri.id}
              className={`bg-white rounded-2xl border p-4 shadow-xs space-y-3 transition hover:shadow-md ${
                isOverdue ? "border-rose-200/80" : "border-slate-100"
              }`}
            >
              {/* Üst Bilgi */}
              <div className="flex justify-between items-start gap-2">
                <div
                  onClick={() => onNavigateToMusteriDetail(musteri.id)}
                  className="cursor-pointer space-y-1 flex-1"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800 text-sm">{musteri.ad}</h3>
                    {isOverdue ? (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                        {daysSince !== null ? `${daysSince} GÜN OLDU` : "HİÇ BAKIM YAPILMADI"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {daysSince} Gün Önce Yapıldı
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Son Bakım: </span>
                    <span className="font-semibold text-slate-700">
                      {latestBakim ? formatDateDDMMYYYY(latestBakim.tarih) : "Kayıt Yok"}
                    </span>
                  </div>

                  {musteri.adres && (
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[200px]">{musteri.adres}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Hızlı Aksiyon Butonları (WhatsApp, Konum, Arama, Bakım Aç) */}
              <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100">
                {/* WhatsApp Butonu */}
                <button
                  onClick={() => handleWhatsAppReminder({ musteri, latestBakim, daysSince, isOverdue })}
                  className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 active:scale-95"
                  title="WhatsApp Hatırlatma Mesajı Gönder"
                >
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  <span>Hatırlat</span>
                </button>

                {/* Harita Butonu */}
                <button
                  onClick={() => handleOpenMaps(musteri.adres)}
                  className="py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 active:scale-95"
                  title="Google Maps Yol Tarifi"
                >
                  <MapPin className="h-4 w-4 text-sky-600" />
                  <span>Navigasyon</span>
                </button>

                {/* Arama Butonu */}
                <a
                  href={musteri.telefon ? `tel:${musteri.telefon}` : "#"}
                  onClick={(e) => {
                    if (!musteri.telefon) {
                      e.preventDefault();
                      alert("Müşterinin telefon numarası kayıtlı değil.");
                    }
                  }}
                  className="py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 active:scale-95 text-center"
                  title="Telefonla Ara"
                >
                  <Phone className="h-4 w-4 text-indigo-600" />
                  <span>Ara</span>
                </a>

                {/* Bakım Oluştur Butonu */}
                <button
                  onClick={() => onNewBakimClick(musteri.id)}
                  className="py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 active:scale-95"
                  title="Yeni Bakım Ekle"
                >
                  <Wrench className="h-4 w-4 text-amber-600" />
                  <span>Bakım Aç</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-1" />
            <span className="font-bold text-slate-700 text-sm">Bakımı Geciken Müşteri Bulunmuyor</span>
            <span>Tüm müşterilerinizin bakımları güncel durumda.</span>
          </div>
        )}
      </div>
    </div>
  );
}
