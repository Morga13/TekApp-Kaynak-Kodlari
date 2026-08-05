import React, { useState, useMemo } from "react";
import { Parca, StokKalemi } from "../types";
import { Search, Plus, Wrench, Edit2, Trash2, X, Package } from "lucide-react";
import { getStokDurumu, calculateEffectiveStock } from "../db/stok";

interface ParcaKataloguProps {
  parcalar: Parca[];
  stokKalemleri: StokKalemi[];
  onAddOrEdit: (parca: Omit<Parca, "id"> & { id?: number }) => void;
  onDelete: (id: number) => void;
}

// Stok durumuna göre stil bilgilerini döndür
function stokStil(ad: string, stok: number) {
  const durum = getStokDurumu(ad, stok);
  if (durum === "kirmizi")
    return {
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
      label: "Kritik Stok",
      dot: "bg-rose-500 animate-pulse",
    };
  if (durum === "turuncu")
    return {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      label: "Düşük Stok",
      dot: "bg-amber-400",
    };
  return {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "Yeterli",
    dot: "bg-emerald-500",
  };
}

export default function ParcaKatalogu({
  parcalar,
  stokKalemleri,
  onAddOrEdit,
  onDelete
}: ParcaKataloguProps) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // Form states
  const [editId, setEditId] = useState<number | undefined>(undefined);
  const [ad, setAd] = useState("");
  const [fiyat, setFiyat] = useState("");

  const filtered = useMemo(() => parcalar.filter((p) => p.ad.toLowerCase().includes(search.toLowerCase())), [parcalar, search]);

  // Uyarı gerektiren parça sayısını hesapla (efektif stoka göre)
  const uyariSayisi = useMemo(() => parcalar.filter(
    (p) => getStokDurumu(p.ad, calculateEffectiveStock(p.ad, stokKalemleri)) !== "normal"
  ).length, [parcalar, stokKalemleri]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ad.trim() || !fiyat.trim() || isNaN(parseFloat(fiyat))) return;
    
    // Parçanın eski stok değerini koruyalım (veritabanı sütunu olduğu için 0 gönderiyoruz, esas stok Stok Yönetimi sekmesinden yönetilecek)
    const existingParca = parcalar.find(p => p.id === editId);
    
    onAddOrEdit({
      id: editId,
      ad: ad.trim(),
      fiyat: parseFloat(fiyat),
      stok: existingParca ? existingParca.stok : 0, 
    });
    closeModal();
  };

  const startEdit = (p: Parca) => {
    setEditId(p.id);
    setAd(p.ad);
    setFiyat(p.fiyat.toString());
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditId(undefined);
    setAd("");
    setFiyat("");
    setModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Search Header */}
      <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Parça adı ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
          />
        </div>
        {/* Stok uyarı özeti */}
        {uyariSayisi > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <Package className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-xs font-semibold text-amber-700">
              {uyariSayisi} parçanın stoğu kritik seviyede!
            </span>
          </div>
        )}
      </div>

      {/* Part List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 pb-24">
        {filtered.length > 0 ? (
          filtered.map((p) => {
            const efektifStok = calculateEffectiveStock(p.ad, stokKalemleri);
            const stil = stokStil(p.ad, efektifStok);
            return (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{p.ad}</h3>
                    <span className="text-emerald-600 font-bold font-mono text-sm mt-0.5 block">
                      {p.fiyat.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                    </span>
                    {/* Stok rozeti (Efektif Stok) */}
                    <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold ${stil.bg} ${stil.text} ${stil.border}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${stil.dot}`} />
                      Stok: {efektifStok} adet — {stil.label}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => startEdit(p)}
                      className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition"
                      title="Düzenle"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`${p.ad} isimli parçayı silmek istediğinize emin misiniz?`)) {
                          onDelete(p.id);
                        }
                      }}
                      className="p-2 text-slate-500 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <Wrench className="h-6 w-6" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Kayıtlı Parça Bulunamadı</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Parça eklemek için aşağıdaki + butonunu kullanın.</p>
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => {
          setEditId(undefined);
          setModalOpen(true);
        }}
        className="fixed bottom-20 right-6 h-12 w-12 rounded-full bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white shadow-sm flex items-center justify-center transition active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-[15px]">
                {editId ? "Parçayı Düzenle" : "Yeni Parça Ekle"}
              </h3>
              <button onClick={closeModal} className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Parça Adı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Membran"
                  value={ad}
                  onChange={(e) => setAd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Fiyat (TL)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder="Örn: 1250"
                  value={fiyat}
                  onChange={(e) => setFiyat(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-semibold transition"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white rounded-lg text-sm font-semibold transition"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
