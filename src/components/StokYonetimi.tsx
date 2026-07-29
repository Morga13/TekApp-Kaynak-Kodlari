import React, { useState } from "react";
import { StokKalemi, Parca } from "../types";
import {
  Package, Plus, Minus, AlertTriangle, RefreshCw,
  Trash2, X, PlusCircle, ArrowUpCircle, Tag, Edit2, Wrench, Search
} from "lucide-react";
import { getStokDurumu, isHighThresholdPart, calculateEffectiveStock } from "../db/stok";

interface StokYonetimiProps {
  stokKalemleri: StokKalemi[];
  parcalar: Parca[];
  onUpdateMiktar: (id: number, yeniMiktar: number) => void;
  onIncreaseStock: (id: number, quantity: number) => void;
  onAddKalem: (ad: string, miktar: number) => void;
  onDeleteKalem: (id: number) => void;
  onRefresh: () => void;
  onAddOrEditParca: (parca: Omit<Parca, "id"> & { id?: number }) => void;
  onDeleteParca: (id: number) => void;
}

// Sabit 11 temel stok kalemi (silinemez)
const SABIT_KALEMLER = [
  "1. filtre açık", "2. filtre açık", "3. filtre açık",
  "1. filtre kapalı", "2. filtre kapalı", "3. filtre kapalı",
  "1. filtre kapalı kokonatlı", "2. filtre kapalı kokonatlı", "3. filtre kapalı kokonatlı",
  "membran", "tatlandırıcı",
];
const isSabit = (ad: string) =>
  SABIT_KALEMLER.some((s) => s.toLowerCase() === ad.toLowerCase().trim());

function stokStil(ad: string, miktar: number) {
  const durum = getStokDurumu(ad, miktar);
  if (durum === "kirmizi")
    return {
      bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700",
      badge: "bg-rose-100 text-rose-700 border-rose-200",
      dot: "bg-rose-500 animate-pulse", label: "Kritik",
    };
  if (durum === "turuncu")
    return {
      bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
      dot: "bg-amber-400", label: "Düşük",
    };
  return {
    bg: "bg-white", border: "border-slate-100", text: "text-slate-700",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500", label: "Yeterli",
  };
}

// Stok Grup tanımları
const GRUPLAR = [
  { key: "acik", baslik: "Açık Filtreler", renk: "text-sky-600", fn: (ad: string) => ad.toLowerCase().includes("açık") && ad.toLowerCase().includes("filtre") },
  { key: "kapali", baslik: "Kapalı Filtreler", renk: "text-slate-600", fn: (ad: string) => ad.toLowerCase().includes("kapalı") && !ad.toLowerCase().includes("kokonat") },
  { key: "kokonat", baslik: "Kokonatlı Filtreler", renk: "text-teal-600", fn: (ad: string) => ad.toLowerCase().includes("kokonat") },
  { key: "membran", baslik: "Membran & Tatlandırıcı", renk: "text-purple-600", fn: (ad: string) => ad.toLowerCase().includes("membran") || ad.toLowerCase().includes("tatlandırıcı") },
  { key: "cihazlar", baslik: "Su Arıtma Cihazları", renk: "text-blue-600", fn: (ad: string) => ad.toLowerCase().includes("litre") || ad.toLowerCase().includes("aquasweet") || ad.toLowerCase().includes("watalina") },
  { key: "diger", baslik: "Teknik Parçalar & Musluklar", renk: "text-orange-600", fn: (_ad: string) => true },
];

export default function StokYonetimi({
  stokKalemleri,
  parcalar,
  onUpdateMiktar,
  onIncreaseStock,
  onAddKalem,
  onDeleteKalem,
  onRefresh,
  onAddOrEditParca,
  onDeleteParca,
}: StokYonetimiProps) {
  const [subTab, setSubTab] = useState<"stok" | "katalog">("stok");
  const [searchKatalog, setSearchKatalog] = useState("");

  // Form states
  const [editValues, setEditValues] = useState<Record<number, string>>({});
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [increaseModalOpen, setIncreaseModalOpen] = useState(false);
  const [selectedKalem, setSelectedKalem] = useState<StokKalemi | null>(null);

  // Katalog Modal States
  const [katalogModalOpen, setKatalogModalOpen] = useState(false);
  const [editParcaId, setEditParcaId] = useState<number | undefined>(undefined);
  const [parcaAd, setParcaAd] = useState("");
  const [parcaFiyat, setParcaFiyat] = useState("");

  // Stok yeni kalem form
  const [yeniAd, setYeniAd] = useState("");
  const [yeniMiktar, setYeniMiktar] = useState("0");
  const [yeniFiyat, setYeniFiyat] = useState("");

  // Stok artırım form
  const [artisAdet, setArtisAdet] = useState("1");

  const kritikSayi = stokKalemleri.filter(
    (k) => getStokDurumu(k.ad, k.miktar) !== "normal"
  ).length;

  const handleInputChange = (id: number, val: string) =>
    setEditValues((prev) => ({ ...prev, [id]: val }));

  const handleInputBlur = (k: StokKalemi) => {
    const raw = editValues[k.id];
    if (raw === undefined || raw === "") return;
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 0) onUpdateMiktar(k.id, parsed);
    setEditValues((prev) => { const n = { ...prev }; delete n[k.id]; return n; });
  };

  // Yeni Stok Kalemi Eklendiğinde Hem Stoğa Hem Kataloğa Ekle
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!yeniAd.trim()) return;
    const ad = yeniAd.trim();
    const miktar = parseInt(yeniMiktar, 10) || 0;
    const fiyat = parseFloat(yeniFiyat) || 0;

    // 1. Stoğa ekle
    onAddKalem(ad, miktar);

    // 2. Kataloğa da otomatik ekle (fiyat bilgisiyle)
    const existingParca = parcalar.find((p) => p.ad.toLowerCase() === ad.toLowerCase());
    onAddOrEditParca({
      id: existingParca ? existingParca.id : undefined,
      ad: ad,
      fiyat: fiyat,
      stok: miktar,
    });

    setYeniAd("");
    setYeniMiktar("0");
    setYeniFiyat("");
    setAddModalOpen(false);
  };

  const handleIncreaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKalem) return;
    const q = parseInt(artisAdet, 10);
    if (!isNaN(q) && q > 0) onIncreaseStock(selectedKalem.id, q);
    setArtisAdet("1"); setSelectedKalem(null); setIncreaseModalOpen(false);
  };

  const handleKatalogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcaAd.trim() || !parcaFiyat.trim() || isNaN(parseFloat(parcaFiyat))) return;
    const existingParca = parcalar.find((p) => p.id === editParcaId);
    onAddOrEditParca({
      id: editParcaId,
      ad: parcaAd.trim(),
      fiyat: parseFloat(parcaFiyat),
      stok: existingParca ? existingParca.stok : 0,
    });
    setKatalogModalOpen(false);
    setEditParcaId(undefined);
    setParcaAd("");
    setParcaFiyat("");
  };

  // Gruplanmış stok listesi
  const used = new Set<number>();
  const grouped = GRUPLAR.map((g, gi) => {
    const items = stokKalemleri.filter((k) => {
      if (used.has(k.id)) return false;
      if (gi < GRUPLAR.length - 1 ? g.fn(k.ad) : !used.has(k.id)) {
        used.add(k.id);
        return true;
      }
      return false;
    });
    return { ...g, items };
  });

  const searchKatalogLower = searchKatalog.toLocaleLowerCase("tr-TR");
  const filteredParcalar = React.useMemo(() => {
    if (!searchKatalogLower.trim()) return parcalar;
    return parcalar.filter((p) =>
      p.ad.toLocaleLowerCase("tr-TR").includes(searchKatalogLower)
    );
  }, [parcalar, searchKatalogLower]);

  const renderKalem = (k: StokKalemi) => {
    const stil = stokStil(k.ad, k.miktar);
    const displayVal = editValues[k.id] !== undefined ? editValues[k.id] : k.miktar.toString();
    const sabit = isSabit(k.ad);

    return (
      <div key={k.id} className={`flex items-center gap-2 rounded-xl border p-3 shadow-sm transition ${stil.bg} ${stil.border}`}>
        {/* Isim alanı - tam görünüm için break-words ve leading-snug eklendi */}
        <div className="flex-1 min-w-0 pr-1">
          <p className="font-semibold text-slate-800 text-sm leading-snug break-words">{k.ad}</p>
          <div className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${stil.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${stil.dot}`} />
            {stil.label}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setSelectedKalem(k); setArtisAdet("1"); setIncreaseModalOpen(true); }}
            className="h-7 w-7 rounded-lg bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 active:scale-95 transition shadow-sm"
            title="Stok Ekle"
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => onUpdateMiktar(k.id, Math.max(0, k.miktar - 1))}
            className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 active:scale-95 transition shadow-sm"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number" min={0}
            value={displayVal}
            onChange={(e) => handleInputChange(k.id, e.target.value)}
            onBlur={() => handleInputBlur(k)}
            className={`w-11 text-center font-bold text-sm border rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-sky-400 ${stil.text} ${stil.border} bg-white`}
          />
          <button
            onClick={() => onUpdateMiktar(k.id, k.miktar + 1)}
            className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 active:scale-95 transition shadow-sm"
          >
            <Plus className="h-3 w-3" />
          </button>

          {!sabit && (
            <button
              onClick={() => { if (confirm(`"${k.ad}" silinsin mi?`)) onDeleteKalem(k.id); }}
              className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 active:scale-95 transition shadow-sm"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto pb-24">
      {/* Üst Alt-Sekme Geçişi */}
      <div className="p-3 bg-white border-b border-slate-200 space-y-2">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setSubTab("stok")}
            className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              subTab === "stok"
                ? "bg-white text-sky-600 shadow-xs"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Package className="h-4 w-4" />
            Stok Miktarları ({stokKalemleri.length})
          </button>
          <button
            onClick={() => setSubTab("katalog")}
            className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              subTab === "katalog"
                ? "bg-white text-emerald-600 shadow-xs"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Tag className="h-4 w-4" />
            Ürün & Fiyat Kataloğu ({parcalar.length})
          </button>
        </div>

        {subTab === "stok" && (
          <div className="flex items-center justify-between pt-1">
            {kritikSayi > 0 ? (
              <span className="text-xs font-semibold text-amber-700 flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                {kritikSayi} kalem kritik seviyede!
              </span>
            ) : (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Tüm stoklar yeterli ✓
              </span>
            )}
            <button onClick={onRefresh} className="flex items-center gap-1 text-xs text-sky-600 font-semibold active:scale-95 transition">
              <RefreshCw className="h-3.5 w-3.5" /> Yenile
            </button>
          </div>
        )}
      </div>

      {/* SEKME 1: STOK ADETLERİ VE YÖNETİMİ */}
      {subTab === "stok" && (
        <div className="p-4 space-y-5">
          {grouped.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.key}>
                <h3 className={`text-[11px] font-extrabold uppercase tracking-widest mb-2 ${g.renk}`}>
                  {g.baslik} <span className="font-normal opacity-60">({g.items.length})</span>
                </h3>
                <div className="space-y-2">{g.items.map(renderKalem)}</div>
              </div>
            )
          )}
        </div>
      )}

      {/* SEKME 2: PARÇA VE FİYAT KATALOĞU */}
      {subTab === "katalog" && (
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Katalog ürünü ara..."
              value={searchKatalog}
              onChange={(e) => setSearchKatalog(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>

          {filteredParcalar.length > 0 ? (
            filteredParcalar.map((p) => {
              const efektifStok = calculateEffectiveStock(p.ad, stokKalemleri);
              const stil = stokStil(p.ad, efektifStok);
              return (
                <div key={p.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0 pr-1">
                      <h3 className="font-semibold text-slate-800 text-sm leading-snug break-words">{p.ad}</h3>
                      <span className="text-emerald-600 font-bold font-mono text-sm mt-0.5 block">
                        {p.fiyat.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                      </span>
                      <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold ${stil.bg} ${stil.text} ${stil.border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${stil.dot}`} />
                        Stok: {efektifStok} adet — {stil.label}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditParcaId(p.id);
                          setParcaAd(p.ad);
                          setParcaFiyat(p.fiyat.toString());
                          setKatalogModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition"
                        title="Fiyatı / Adı Düzenle"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`"${p.ad}" kataloğunuzdan silinsin mi?`)) {
                            onDeleteParca(p.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition"
                        title="Katalogdan Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 text-xs">
              <Wrench className="h-8 w-8 text-slate-300 mb-2" />
              <span>Aradığınız ürün katalogda bulunamadı.</span>
            </div>
          )}
        </div>
      )}

      {/* FAB: Yeni Ekle */}
      {subTab === "stok" ? (
        <button
          onClick={() => setAddModalOpen(true)}
          className="fixed bottom-20 right-6 h-12 w-12 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20 flex items-center justify-center transition active:scale-95 z-40"
          title="Yeni Stok & Katalog Ürünü Ekle"
        >
          <PlusCircle className="h-6 w-6" />
        </button>
      ) : (
        <button
          onClick={() => {
            setEditParcaId(undefined);
            setParcaAd("");
            setParcaFiyat("");
            setKatalogModalOpen(true);
          }}
          className="fixed bottom-20 right-6 h-12 w-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center transition active:scale-95 z-40"
          title="Kataloğa Yeni Ürün Ekle"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Modal: Yeni Stok Kalemi & Katalog Ürünü Ekle */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-[15px]">Yeni Stok ve Ürün Ekle</h3>
                <p className="text-[11px] text-slate-400 font-medium">Hem stoğa hem ürün kataloğuna eklenir</p>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Ürün / Kalem Adı</label>
                <input type="text" required placeholder="Örn: Motor, Musluk, Kısıcı..."
                  value={yeniAd} onChange={(e) => setYeniAd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Satış Fiyatı (TL)</label>
                <input type="number" required min={0} step="0.01" placeholder="Örn: 450"
                  value={yeniFiyat} onChange={(e) => setYeniFiyat(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Başlangıç Miktarı (Stok Adedi)</label>
                <input type="number" required min={0} value={yeniMiktar}
                  onChange={(e) => setYeniMiktar(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAddModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-semibold transition">İptal</button>
                <button type="submit"
                  className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-semibold transition">Stoğa ve Kataloğa Ekle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Stok Ekle (increaseStock) */}
      {increaseModalOpen && selectedKalem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-[15px]">Stok Ekle</h3>
                <p className="text-xs text-emerald-700 font-semibold mt-0.5">{selectedKalem.ad}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Mevcut: {selectedKalem.miktar} adet</p>
              </div>
              <button onClick={() => setIncreaseModalOpen(false)} className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleIncreaseSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Eklenecek Adet</label>
                <input type="number" required min={1} value={artisAdet}
                  onChange={(e) => setArtisAdet(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center text-xl font-bold" />
                <p className="text-xs text-slate-400 mt-1 text-center">
                  Ekledikten sonra: {selectedKalem.miktar + (parseInt(artisAdet, 10) || 0)} adet
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIncreaseModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-semibold transition">İptal</button>
                <button type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition">
                  ✓ Stok Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Kataloğa Parça Ekle / Düzenle */}
      {katalogModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-[15px]">
                {editParcaId ? "Katalog Ürününü Düzenle" : "Yeni Katalog Ürünü"}
              </h3>
              <button onClick={() => setKatalogModalOpen(false)} className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleKatalogSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Ürün / Parça Adı</label>
                <input type="text" required placeholder="Örn: 5'li Takım Kapalı"
                  value={parcaAd} onChange={(e) => setParcaAd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Satış Fiyatı (TL)</label>
                <input type="number" required min={0} step="0.01" placeholder="Örn: 1700"
                  value={parcaFiyat} onChange={(e) => setParcaFiyat(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setKatalogModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-semibold transition">İptal</button>
                <button type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
