import React from "react";
import { Musteri, Bakim, DeğişenParça } from "../types";
import { ArrowLeft, Phone, MapPin, FileText, Calendar, Trash2, ShieldAlert, Plus, MessageSquare } from "lucide-react";

interface MusteriDetayProps {
  musteriId: number;
  musteriler: Musteri[];
  bakimlar: Bakim[];
  onBack: () => void;
  onDeleteBakim: (id: number) => void;
  onNewBakimClick: (id: number) => void;
  onUpdateOdemeDurumu: (id: number, odendi: number) => void;
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

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Profil Header */}
      <div className="bg-slate-800 text-white px-4 py-5 flex flex-col gap-4 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-700 rounded-lg transition" title="Geri">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-11 w-11 rounded-full bg-sky-400 text-white font-bold text-lg flex items-center justify-center">
            {musteri.ad[0].toUpperCase()}
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
                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(musteri.adres)}`, "_blank");
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
                          window.open(`https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`, "_blank");
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
    </div>
  );
}
