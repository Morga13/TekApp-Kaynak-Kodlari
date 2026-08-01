import React, { useState, useEffect } from "react";
import { Musteri, Parca } from "../types";
import { Check, ChevronDown, ChevronUp, Save, Plus, AlertCircle, Search } from "lucide-react";
import { generateTaksitPlani, saveTaksitler } from "../utils/cari";

interface SecilenMiktar {
  parcaId: number;
  adet: number;
}

interface YeniBakimKaydiProps {
  initialMusteriId?: number;
  musteriler: Musteri[];
  parcalar: Parca[];
  onSave: (bakim: {
    musteri_id: number;
    tarih: string;
    parcalar: string;
    toplam: number;
    not: string;
    odendi: number;
  }) => void;
  onNavigateToMusteriDetail: (id: number) => void;
}

export default function YeniBakimKaydi({
  initialMusteriId,
  musteriler,
  parcalar,
  onSave,
  onNavigateToMusteriDetail
}: YeniBakimKaydiProps) {
  const [secilenMusteriId, setSecilenMusteriId] = useState<number | undefined>(initialMusteriId);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tarih, setTarih] = useState("");
  const [secilenParcalar, setSecilenParcalar] = useState<SecilenMiktar[]>([]);
  const [not, setNot] = useState("");
  const [odendi, setOdendi] = useState<number>(0); // 0: Borç (Ödeme Bekliyor), 1: Peşin Ödendi
  const [parcaSearch, setParcaSearch] = useState("");
  const [ozelFiyat, setOzelFiyat] = useState<string>("");

  useEffect(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setTarih(`${year}-${month}-${day}`);
  }, []);

  useEffect(() => {
    if (initialMusteriId) {
      setSecilenMusteriId(initialMusteriId);
    }
  }, [initialMusteriId]);

  const toggleParcaSelection = (parcaId: number) => {
    const exists = secilenParcalar.find((item) => item.parcaId === parcaId);
    if (exists) {
      setSecilenParcalar(secilenParcalar.filter((item) => item.parcaId !== parcaId));
    } else {
      setSecilenParcalar([...secilenParcalar, { parcaId, adet: 1 }]);
    }
  };

  const updateAdet = (parcaId: number, diff: number) => {
    setSecilenParcalar(
      secilenParcalar.map((item) => {
        if (item.parcaId === parcaId) {
          const next = item.adet + diff;
          return { ...item, adet: next < 1 ? 1 : next };
        }
        return item;
      })
    );
  };

  const calculateTotal = () => {
    let sum = 0;
    secilenParcalar.forEach((item) => {
      const p = parcalar.find((x) => x.id === item.parcaId);
      if (p) {
        sum += p.fiyat * item.adet;
      }
    });
    return sum;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secilenMusteriId) {
      alert("Lütfen bir müşteri seçin.");
      return;
    }
    if (secilenParcalar.length === 0 && (!ozelFiyat || Number(ozelFiyat) <= 0)) {
      alert("Lütfen en az bir adet ürün/hizmet seçin veya özel tutar girin.");
      return;
    }
    if (!tarih.trim()) {
      alert("Lütfen tarih alanını boş bırakmayın.");
      return;
    }

    const partsToSave = secilenParcalar
      .map((item) => {
        const p = parcalar.find((x) => x.id === item.parcaId);
        if (!p) return null;
        return {
          id: p.id,
          ad: p.ad,
          fiyat: p.fiyat,
          adet: item.adet
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const calculatedTotal = calculateTotal();
    const finalTotal = ozelFiyat && !isNaN(Number(ozelFiyat)) ? Number(ozelFiyat) : calculatedTotal;

    onSave({
      musteri_id: secilenMusteriId,
      tarih: tarih.trim(),
      parcalar: JSON.stringify(partsToSave),
      toplam: finalTotal,
      not: not.trim(),
      odendi: odendi
    });

    setSecilenParcalar([]);
    setNot("");
    setOzelFiyat("");
    setOdendi(0);
    alert("İşlem / Bakım kaydı başarıyla oluşturuldu.");
    onNavigateToMusteriDetail(secilenMusteriId);
  };

  const selectedCustomer = musteriler.find((m) => m.id === secilenMusteriId);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-slate-50 overflow-y-auto p-4 pb-24 space-y-4">
      {/* Müşteri Seçici */}
      <div className="relative">
        <label className="block text-xs font-bold text-slate-600 mb-1">Müşteri Seçimi</label>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex justify-between items-center bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
        >
          <span>{selectedCustomer ? selectedCustomer.ad : "Bir Müşteri Seçin..."}</span>
          {dropdownOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>

        {dropdownOpen && (
          <div className="absolute top-[68px] inset-x-0 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto py-1 animate-scale">
            {musteriler.length > 0 ? (
              musteriler.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => {
                    setSecilenMusteriId(m.id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs transition flex items-center justify-between gap-2 ${
                    secilenMusteriId === m.id ? "bg-sky-50 text-sky-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">{m.ad}</span>
                    {m.telefon && <span className="text-[10px] text-slate-400 mt-0.5">{m.telefon}</span>}
                  </div>
                </button>
              ))
            ) : (
              <div className="p-3 text-xs text-rose-500 font-medium text-center">
                Lütfen önce Müşteri Listesinden bir müşteri ekleyin.
              </div>
            )}
          </div>
        )}
      </div>

      {/* İşlem Tarihi */}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">İşlem Tarihi</label>
        <input
          type="date"
          required
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* Katalogdan Ürün / Hizmet Seçimi */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold text-slate-600">Katalogdan Ürün / Hizmet Seçimi (Otomatik Fiyatlandırılır)</label>
          {secilenParcalar.length > 0 && (
            <button
              type="button"
              onClick={() => setSecilenParcalar([])}
              className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition shrink-0"
            >
              Temizle ({secilenParcalar.length})
            </button>
          )}
        </div>

        <div className="relative mb-1.5">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Katalogda ürün veya hizmet ara..."
            value={parcaSearch}
            onChange={(e) => setParcaSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden max-h-60 overflow-y-auto">
          {parcalar.length > 0 ? (() => {
            const filtered = parcalar.filter((p) => p.ad.toLowerCase().includes(parcaSearch.toLowerCase()));
            if (filtered.length === 0) return (
              <div className="p-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
                <Search className="h-5 w-5 text-slate-300" />
                <span>"{parcaSearch}" için katalogda kayıt bulunamadı.</span>
              </div>
            );
            return filtered.map((p) => {
              const selectedItem = secilenParcalar.find((item) => item.parcaId === p.id);
              const isSelected = !!selectedItem;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 transition ${
                    isSelected ? "bg-sky-50/55" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleParcaSelection(p.id)}
                    className="flex-1 flex items-center gap-3 text-left focus:outline-none"
                  >
                    <div
                      className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 transition ${
                        isSelected ? "bg-sky-500 border-sky-500 text-white" : "border-slate-300"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">{p.ad}</span>
                      <span className="text-[11px] text-emerald-600 font-bold font-mono">
                        {p.fiyat.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                      </span>
                    </div>
                  </button>

                  {isSelected && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateAdet(p.id, -1)}
                        className="h-6 w-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-sm focus:outline-none"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold font-mono text-slate-800">{selectedItem.adet}</span>
                      <button
                        type="button"
                        onClick={() => updateAdet(p.id, 1)}
                        className="h-6 w-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-sm focus:outline-none"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            });
          })() : (
            <div className="p-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
              <AlertCircle className="h-5 w-5 text-slate-300" />
              <span>Katalog boş. Önce parça/ürün kataloğuna ekleyin.</span>
            </div>
          )}
        </div>
      </div>

      {/* İşlem Notu */}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Açıklama / Not (Opsiyonel)</label>
        <textarea
          placeholder="İşlem ile ilgili not..."
          value={not}
          onChange={(e) => setNot(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
        />
      </div>

      {/* Ödeme Durumu */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-600">Ödeme Durumu</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOdendi(1)}
            className={`py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
              odendi === 1
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${odendi === 1 ? "bg-emerald-500" : "bg-slate-300"}`} />
            Peşin Ödendi
          </button>
          <button
            type="button"
            onClick={() => setOdendi(0)}
            className={`py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
              odendi === 0
                ? "bg-rose-50 text-rose-700 border-rose-300"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${odendi === 0 ? "bg-rose-500" : "bg-slate-300"}`} />
            Borç Kaydı (Ödeme Bekliyor)
          </button>
        </div>
      </div>

      {/* Fiyat Tutar Özeti */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shrink-0">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-600">Katalog Tutar Toplamı:</span>
          <span className="font-bold text-slate-800 font-mono">
            {calculateTotal().toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            İndirimli / Özel Son Fiyat (TL) <span className="text-[10px] text-slate-400 font-normal">(Opsiyonel)</span>
          </label>
          <input
            type="number"
            placeholder={`Örn: ${calculateTotal() > 0 ? calculateTotal() - 200 : 1000}`}
            value={ozelFiyat}
            onChange={(e) => setOzelFiyat(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
          />
        </div>

        <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
          <span className="text-xs font-bold text-emerald-800">Kaydedilecek Borç / İşlem Tutarı:</span>
          <span className="text-lg font-black text-emerald-600 font-mono">
            {(ozelFiyat && !isNaN(Number(ozelFiyat)) ? Number(ozelFiyat) : calculateTotal()).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
          </span>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white rounded-lg py-3 flex items-center justify-center gap-2 font-bold text-sm shadow-md transition"
      >
        <Save className="h-4.5 w-4.5" />
        Kaydı Tamamla
      </button>
    </form>
  );
}
