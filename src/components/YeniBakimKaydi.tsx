import React, { useState, useEffect, useMemo } from "react";
import { Musteri, Parca, StokKalemi } from "../types";
import { Check, ChevronDown, ChevronUp, Save, AlertCircle, Search, Package } from "lucide-react";
import { generateTaksitPlani, saveTaksitler } from "../utils/cari";

interface SecilenMiktar {
  parcaId: number;
  adet: number;
}

interface YeniBakimKaydiProps {
  initialMusteriId?: number;
  musteriler: Musteri[];
  parcalar: Parca[];
  stokKalemleri: StokKalemi[]; // YENİ: stok tablosundaki bireysel kalemler
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
  stokKalemleri,
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
  const [cihazTipi, setCihazTipi] = useState<'kapalı' | 'açık' | 'hepsi'>('hepsi');

  // ─── Cihaz tipi filtreleme sabitleri ────────────────────────────────
  const GIZLE_KAPALI = new Set([
    "1. filtre açık", "2. filtre açık", "3. filtre açık",
    "3'lü set - açık", "4'lü set - açık", "5'li set - açık",
  ]);
  const GIZLE_ACIK = new Set([
    "1. filtre kapalı", "2. filtre kapalı", "3. filtre kapalı",
    "1. filtre kapalı kokonatlı", "2. filtre kapalı kokonatlı", "3. filtre kapalı kokonatlı",
    "3'lü set - kapalı", "3'lü set - kapalı (kokonat)",
    "4'lü set - kapalı", "4'lü set - kapalı (kokonat)",
    "5'li set - kapalı", "5'li set - kapalı (kokonat)",
  ]);
  // Cihaz ürünleri → listenin en altına taşınır
  const CIHAZ_ANAHTAR = ["watalina", "aquasweet", "depo", "sebil"];

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

  // ─── Birleşik Katalog: parcalar + stok'ta olup parcalarda olmayanlar ─
  // DÜZELTME: "1. Filtre Kapalı", "2. Filtre Kapalı" gibi bireysel filtreler
  // stok tablosunda mevcut ama parcalar tablosunda yok → artık görünür
  const mergedCatalog = useMemo((): Parca[] => {
    const parcaAdSet = new Set(parcalar.map((p) => p.ad.toLowerCase().trim()));
    // Negatif ID'ler: stok'tan gelen öğeler (parcalar tablosundan değil)
    const stokOnly: Parca[] = stokKalemleri
      .filter((s) => !parcaAdSet.has(s.ad.toLowerCase().trim()))
      .map((s) => ({
        id: -(s.id), // negatif ID → stok kaynağını işaret eder
        ad: s.ad,
        fiyat: 0,   // fiyat belirsiz — kullanıcı Özel Fiyat alanından girer
        stok: s.miktar,
      }));
    return [...parcalar, ...stokOnly];
  }, [parcalar, stokKalemleri]);

  const calculatedTotal = useMemo(() => {
    let sum = 0;
    secilenParcalar.forEach((item) => {
      const p = mergedCatalog.find((x) => x.id === item.parcaId);
      if (p) {
        sum += p.fiyat * item.adet;
      }
    });
    return sum;
  }, [secilenParcalar, mergedCatalog]);

  const filteredParcalar = useMemo(() => {
    const gizleSet = cihazTipi === 'kapalı' ? GIZLE_KAPALI
                   : cihazTipi === 'açık'   ? GIZLE_ACIK
                   : null;

    const isCihaz = (ad: string) =>
      CIHAZ_ANAHTAR.some((k) => ad.toLowerCase().includes(k));

    const filtered = mergedCatalog.filter((p) => {
      const adLower = p.ad.toLowerCase().trim();
      if (gizleSet && gizleSet.has(adLower)) return false;
      if (!parcaSearch) return true;
      return adLower.includes(parcaSearch.toLowerCase());
    });

    // Cihazları sona taşı
    const normal  = filtered.filter((p) => !isCihaz(p.ad));
    const cihazlar = filtered.filter((p) =>  isCihaz(p.ad));
    return [...normal, ...cihazlar];
  }, [mergedCatalog, parcaSearch, cihazTipi]);

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
        const p = mergedCatalog.find((x) => x.id === item.parcaId);
        if (!p) return null;
        return {
          id: Math.abs(p.id), // stok'tan gelenlerin ID'si negatif olabilir
          ad: p.ad,
          fiyat: p.fiyat,
          adet: item.adet
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

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
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto p-4 pb-24 space-y-4">
      {/* Müşteri Seçici */}
      <div className="relative">
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Müşteri Seçimi</label>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex justify-between items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
        >
          <span>{selectedCustomer ? selectedCustomer.ad : "Bir Müşteri Seçin..."}</span>
          {dropdownOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>

        {dropdownOpen && (
          <div className="absolute top-[68px] inset-x-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm z-20 max-h-48 overflow-y-auto py-1 animate-scale">
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
                    secilenMusteriId === m.id ? "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-semibold" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
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
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">İşlem Tarihi</label>
        <input
          type="date"
          required
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* Katalogdan Ürün / Hizmet Seçimi */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">Katalogdan Ürün / Hizmet Seçimi (Otomatik Fiyatlandırılır)</label>
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

        {/* Cihaz Tipi Toggle */}
        <div className="flex gap-1.5 mb-1.5">
          {(['hepsi', 'kapalı', 'açık'] as const).map((tip) => (
            <button
              key={tip}
              type="button"
              onClick={() => setCihazTipi(tip)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition border ${
                cihazTipi === tip
                  ? tip === 'kapalı'
                    ? 'bg-sky-600 border-sky-600 text-white'
                    : tip === 'açık'
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-slate-700 border-slate-700 text-white'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              {tip === 'hepsi' ? 'Tümü' : tip === 'kapalı' ? '🔵 Kapalı' : '🟢 Açık'}
            </button>
          ))}
        </div>

        <div className="relative mb-1.5">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Katalogda ürün veya hizmet ara..."
            value={parcaSearch}
            onChange={(e) => setParcaSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden max-h-60 overflow-y-auto">
          {mergedCatalog.length > 0 ? (() => {
            if (filteredParcalar.length === 0) return (
              <div className="p-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
                <Search className="h-5 w-5 text-slate-300" />
                <span>"{parcaSearch}" için katalogda kayıt bulunamadı.</span>
              </div>
            );
            return filteredParcalar.map((p) => {
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
                        isSelected ? "bg-sky-700 border-sky-700 dark:bg-sky-600 dark:border-sky-600 text-white" : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 block">{p.ad}</span>
                        {p.id < 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded text-[9px] font-bold">
                            <Package className="h-2.5 w-2.5" />
                            Stok
                          </span>
                        )}
                      </div>
                      {p.fiyat > 0 ? (
                        <span className="text-[11px] text-emerald-600 font-bold font-mono">
                          {p.fiyat.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                          Fiyat belirle → Özel Fiyat alanına girin
                        </span>
                      )}
                    </div>
                  </button>

                  {isSelected && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateAdet(p.id, -1)}
                        className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-sm focus:outline-none"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">{selectedItem.adet}</span>
                      <button
                        type="button"
                        onClick={() => updateAdet(p.id, 1)}
                        className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-sm focus:outline-none"
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
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Açıklama / Not (Opsiyonel)</label>
        <textarea
          placeholder="İşlem ile ilgili not..."
          value={not}
          onChange={(e) => setNot(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
        />
      </div>

      {/* Ödeme Durumu */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">Ödeme Durumu</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOdendi(1)}
            className={`py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                odendi === 1
                  ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/50"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${odendi === 1 ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
              Peşin Ödendi
            </button>
            <button
              type="button"
              onClick={() => setOdendi(0)}
              className={`py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                odendi === 0
                  ? "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700/50"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${odendi === 0 ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-600"}`} />
            Borç Kaydı (Ödeme Bekliyor)
          </button>
        </div>
      </div>

      {/* Fiyat Tutar Özeti */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 shrink-0">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-400">Katalog Tutar Toplamı:</span>
          <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
            {calculatedTotal.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
            İndirimli / Özel Son Fiyat (TL) <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">(Opsiyonel)</span>
          </label>
          <input
            type="number"
            placeholder={`Örn: ${calculatedTotal > 0 ? calculatedTotal - 200 : 1000}`}
            value={ozelFiyat}
            onChange={(e) => setOzelFiyat(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
          />
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Kaydedilecek Borç / İşlem Tutarı:</span>
          <span className="text-lg font-black text-emerald-600 dark:text-emerald-500 font-mono">
            {(ozelFiyat && !isNaN(Number(ozelFiyat)) ? Number(ozelFiyat) : calculatedTotal).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
          </span>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-sky-700 hover:bg-sky-800 active:bg-sky-900 dark:bg-sky-600 dark:hover:bg-sky-500 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-bold text-sm shadow-sm transition"
      >
        <Save className="h-4.5 w-4.5" />
        Kaydı Tamamla
      </button>
    </form>
  );
}
