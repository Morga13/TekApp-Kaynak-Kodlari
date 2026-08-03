import React, { useState, useEffect, useRef, useCallback } from "react";
import { Musteri, Parca, Bakim, StokKalemi } from "./types";
import {
  getMusteriler,
  saveMusteri,
  deleteMusteri,
  getParcalar,
  saveParca,
  deleteParca,
  getBakimlar,
  saveBakim,
  deleteBakim,
  updateBakimOdemeDurumu,
  importAllData,
  subscribeToChanges,
  unsubscribe,
  isSupabaseConfigured,
  getStok,
  updateStokMiktar,
  addStokKalemi,
  deleteStokKalemi,
} from "./db/supabase";
import { decreaseStockForBakim, increaseStock, StokYetersizError } from "./db/stok";
import type { RealtimeChannel } from "@supabase/supabase-js";

import MusteriListesi from "./components/MusteriListesi";
import MusteriDetay from "./components/MusteriDetay";
import YeniBakimKaydi from "./components/YeniBakimKaydi";
import StokYonetimi from "./components/StokYonetimi";
import Ayarlar from "./components/Ayarlar";

import { Users, PlusCircle, Settings, Loader2, Package, Wrench } from "lucide-react";
import { initTheme } from "./utils/theme";
import appLogo from "./assets/logo.png";
import { App as CapApp } from "@capacitor/app";

type TabType = "musteriler" | "yeni-bakim" | "stok" | "ayarlar";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("musteriler");
  const [musteriler, setMusteriler] = useState<Musteri[]>([]);
  const [parcalar, setParcalar] = useState<Parca[]>([]);
  const [bakimlar, setBakimlar] = useState<Bakim[]>([]);
  const [stokKalemleri, setStokKalemleri] = useState<StokKalemi[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(isSupabaseConfigured());
  const channelRef = useRef<RealtimeChannel | null>(null);

  const [selectedMusteriId, setSelectedMusteriId] = useState<number | null>(null);
  const [preSelectedMusteriId, setPreSelectedMusteriId] = useState<number | undefined>(undefined);

  // Cache anahtarları
  const CACHE_KEY_M = "tekapp_cache_musteriler";
  const CACHE_KEY_P = "tekapp_cache_parcalar";
  const CACHE_KEY_B = "tekapp_cache_bakimlar";

  // Cache'den oku
  const loadFromCache = useCallback(() => {
    try {
      const m = localStorage.getItem(CACHE_KEY_M);
      const p = localStorage.getItem(CACHE_KEY_P);
      const b = localStorage.getItem(CACHE_KEY_B);
      if (m) setMusteriler(JSON.parse(m));
      if (p) setParcalar(JSON.parse(p));
      if (b) setBakimlar(JSON.parse(b));
      if (m || p || b) setLoading(false);
    } catch { /* ignore */ }
  }, []);

  // Cache'e yaz
  const saveToCache = (m: Musteri[], p: Parca[], b: Bakim[]) => {
    try {
      localStorage.setItem(CACHE_KEY_M, JSON.stringify(m));
      localStorage.setItem(CACHE_KEY_P, JSON.stringify(p));
      localStorage.setItem(CACHE_KEY_B, JSON.stringify(b));
    } catch { /* ignore */ }
  };

  const loadAllData = useCallback(async (showSyncing = false) => {
    try {
      if (showSyncing) setSyncing(true);
      const [m, p, b, s] = await Promise.all([getMusteriler(), getParcalar(), getBakimlar(), getStok()]);
      setMusteriler(m);
      setParcalar(p);
      setBakimlar(b);
      setStokKalemleri(s);
      saveToCache(m, p, b);
      setIsOnline(true);
    } catch (err) {
      console.error("Supabase bağlantı hatası:", err);
      setIsOnline(false);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  const selectedMusteriIdRef = useRef(selectedMusteriId);
  selectedMusteriIdRef.current = selectedMusteriId;

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Donanım / Mobil Geri Tuşu (Capacitor Native + Web Popstate) Dinleyicisi
  useEffect(() => {
    let backListener: any = null;

    const setupBackListener = async () => {
      try {
        backListener = await CapApp.addListener("backButton", () => {
          if (selectedMusteriIdRef.current !== null) {
            setSelectedMusteriId(null);
          } else if (activeTabRef.current !== "musteriler") {
            setActiveTab("musteriler");
          } else {
            CapApp.minimizeApp();
          }
        });
      } catch (err) {
        console.warn("Capacitor App backButton listener desteklenmiyor:", err);
      }
    };

    setupBackListener();

    const handlePopState = () => {
      if (selectedMusteriIdRef.current !== null) {
        setSelectedMusteriId(null);
      } else if (activeTabRef.current !== "musteriler") {
        setActiveTab("musteriler");
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      if (backListener) {
        backListener.remove();
      }
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const handleSelectMusteri = (id: number | null) => {
    if (id !== null) {
      window.history.pushState({ musteriId: id }, "");
    }
    setSelectedMusteriId(id);
  };

  useEffect(() => {
    return initTheme();
  }, []);

  useEffect(() => {
    loadFromCache();
    loadAllData(false);
    if (isSupabaseConfigured()) {
      channelRef.current = subscribeToChanges(() => loadAllData(true));
    }
    const backupInterval = setInterval(() => {
      loadAllData(false);
    }, 30 * 60 * 1000);
    return () => {
      if (channelRef.current) unsubscribe(channelRef.current);
      clearInterval(backupInterval);
    };
  }, [loadAllData, loadFromCache]);

  const handleAddOrEditMusteri = async (m: Omit<Musteri, "id"> & { id?: number }): Promise<boolean> => {
    const isNew = !m.id;
    if (isNew) {
      if (musteriler.some(e => e.ad.trim().toLowerCase() === m.ad.trim().toLowerCase())) {
        alert(`"${m.ad}" zaten kayıtlı!`);
        return false;
      }
    } else {
      if (musteriler.some(e => e.id !== m.id && e.ad.trim().toLowerCase() === m.ad.trim().toLowerCase())) {
        alert(`"${m.ad}" isimli başka bir müşteri var!`);
        return false;
      }
    }
    try {
      const updated = await saveMusteri(m);
      setMusteriler(updated);
      if (isNew) {
        const currentIds = new Set(musteriler.map(i => i.id));
        const newlyAdded = updated.find(i => !currentIds.has(i.id));
        if (newlyAdded) handleStartNewBakimFromCustomer(newlyAdded.id);
      }
      return true;
    } catch (err: any) {
      console.error(err);
      alert("Müşteri kaydedilirken hata oluştu: " + (err?.message || err));
      return false;
    }
  };

  const handleDeleteMusteri = async (id: number) => {
    try {
      const updated = await deleteMusteri(id);
      setMusteriler(updated);
      setBakimlar(prev => prev.filter(b => b.musteri_id !== id));
      if (selectedMusteriId === id) setSelectedMusteriId(null);
    } catch (err: any) {
      console.error(err);
      alert("Müşteri silinirken hata oluştu: " + (err?.message || err));
    }
  };

  const handleAddOrEditParca = async (p: Omit<Parca, "id"> & { id?: number }) => {
    try {
      setParcalar(await saveParca(p));
    } catch (err: any) {
      console.error(err);
      alert("Parça kaydedilirken hata oluştu: " + (err?.message || err));
    }
  };

  const handleDeleteParca = async (id: number) => {
    try {
      setParcalar(await deleteParca(id));
    } catch (err: any) {
      console.error(err);
      alert("Parça silinirken hata oluştu: " + (err?.message || err));
    }
  };

  const handleSaveBakim = async (b: Omit<Bakim, "id">) => {
    try {
      const bakimItems = JSON.parse(b.parcalar || "[]");

      if (Array.isArray(bakimItems) && bakimItems.length > 0) {
        try {
          await decreaseStockForBakim(bakimItems);
          setStokKalemleri(await getStok());
        } catch (stokErr: any) {
          if (stokErr instanceof StokYetersizError) {
            alert(
              "❌ Bakım kaydedilemedi! Stok yetersiz:\n\n" +
              stokErr.hatalar.join("\n")
            );
            return;
          }
          console.error("Stok düşümü hatası:", stokErr);
        }
      }

      const yeniBakimlar = await saveBakim(b);
      setBakimlar(yeniBakimlar);
      setPreSelectedMusteriId(undefined);
    } catch (err: any) {
      console.error(err);
      alert("Bakım kaydı oluşturulurken hata oluştu: " + (err?.message || err));
    }
  };

  const handleIncreaseStock = async (id: number, quantity: number) => {
    try {
      setStokKalemleri(await increaseStock(id, quantity));
    } catch (err: any) {
      alert("Stok artırılırken hata: " + (err?.message || err));
    }
  };

  const handleUpdateStokMiktar = async (id: number, miktar: number) => {
    try {
      setStokKalemleri(await updateStokMiktar(id, miktar));
    } catch (err: any) {
      console.error(err);
      alert("Stok güncellenirken hata oluştu: " + (err?.message || err));
    }
  };

  const handleAddStokKalemi = async (ad: string, miktar: number) => {
    try {
      setStokKalemleri(await addStokKalemi(ad, miktar));
    } catch (err: any) {
      console.error(err);
      alert("Kalem eklenirken hata oluştu: " + (err?.message || err));
    }
  };

  const handleDeleteStokKalemi = async (id: number) => {
    try {
      setStokKalemleri(await deleteStokKalemi(id));
    } catch (err: any) {
      console.error(err);
      alert("Kalem silinirken hata oluştu: " + (err?.message || err));
    }
  };

  const handleDeleteBakim = async (id: number) => {
    try {
      setBakimlar(await deleteBakim(id));
    } catch (err: any) {
      console.error(err);
      alert("Bakım kaydı silinirken hata oluştu: " + (err?.message || err));
    }
  };

  const handleUpdateOdemeDurumu = async (id: number, odendi: number) => {
    try {
      setBakimlar(await updateBakimOdemeDurumu(id, odendi));
    } catch (err: any) {
      console.error(err);
      alert("Ödeme durumu güncellenirken hata oluştu: " + (err?.message || err));
    }
  };

  const handleImportBackup = async (data: { musteriler: Musteri[]; parcalar: Parca[]; bakimlar: Bakim[] }) => {
    try {
      await importAllData(data);
      await loadAllData();
    } catch (err: any) {
      console.error(err);
      alert("Veri yüklenirken hata oluştu: " + (err?.message || err));
    }
  };

  const getBackupPayload = () => ({ musteriler, parcalar, bakimlar });

  const getSortedParcalar = () => {
    const usageCount: { [key: number]: number } = {};
    parcalar.forEach(p => { usageCount[p.id] = 0; });
    bakimlar.forEach(b => {
      try {
        const list = JSON.parse(b.parcalar);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (Array.isArray(list)) list.forEach((item: any) => {
          usageCount[item.id] = (usageCount[item.id] || 0) + (item.adet || 1);
        });
      } catch { /* ignore */ }
    });
    return [...parcalar].sort((a, b) => (usageCount[b.id] || 0) - (usageCount[a.id] || 0));
  };

  const navigateToTab = (tab: TabType) => {
    setActiveTab(tab);
    if (tab !== "musteriler") setSelectedMusteriId(null);
    if (tab !== "yeni-bakim") setPreSelectedMusteriId(undefined);
  };

  const handleStartNewBakimFromCustomer = (custId: number) => {
    setPreSelectedMusteriId(custId);
    setActiveTab("yeni-bakim");
    setSelectedMusteriId(null);
  };

  const getScreenTitle = () => {
    if (activeTab === "musteriler") return selectedMusteriId ? "Müşteri Detay" : "Müşteriler";
    if (activeTab === "yeni-bakim") return "Yeni Bakım";
    if (activeTab === "stok") return "Stok & Malzeme Yönetimi";
    if (activeTab === "ayarlar") return "Ayarlar";
    return "TekApp";
  };

  const renderScreen = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 bg-slate-50">
          <Loader2 className="h-8 w-8 text-sky-500 animate-spin" />
          <span className="text-sm text-slate-500 font-medium">Yükleniyor...</span>
        </div>
      );
    }
    if (activeTab === "musteriler") {
      return (
        <div className="h-full relative w-full overflow-x-hidden">
          <div className={selectedMusteriId !== null ? "hidden" : "h-full"}>
            <MusteriListesi
              musteriler={musteriler}
              bakimlar={bakimlar}
              onAddOrEdit={handleAddOrEditMusteri}
              onDelete={handleDeleteMusteri}
              onSelectMusteri={handleSelectMusteri}
            />
          </div>
          {selectedMusteriId !== null && (
            <MusteriDetay
              musteriId={selectedMusteriId}
              musteriler={musteriler}
              bakimlar={bakimlar}
              onBack={() => setSelectedMusteriId(null)}
              onDeleteBakim={handleDeleteBakim}
              onNewBakimClick={handleStartNewBakimFromCustomer}
              onUpdateOdemeDurumu={handleUpdateOdemeDurumu}
            />
          )}
        </div>
      );
    }
    if (activeTab === "yeni-bakim") {
      return (
        <YeniBakimKaydi
          initialMusteriId={preSelectedMusteriId}
          musteriler={musteriler}
          parcalar={getSortedParcalar()}
          onSave={handleSaveBakim}
          onNavigateToMusteriDetail={(id) => { handleSelectMusteri(id); setActiveTab("musteriler"); }}
        />
      );
    }
    if (activeTab === "stok") {
      return (
        <StokYonetimi
          stokKalemleri={stokKalemleri}
          parcalar={parcalar}
          onUpdateMiktar={handleUpdateStokMiktar}
          onIncreaseStock={handleIncreaseStock}
          onAddKalem={handleAddStokKalemi}
          onDeleteKalem={handleDeleteStokKalemi}
          onRefresh={() => getStok().then(setStokKalemleri).catch((err) => console.error('Stok yenileme hatası:', err))}
          onAddOrEditParca={handleAddOrEditParca}
          onDeleteParca={handleDeleteParca}
        />
      );
    }
    if (activeTab === "ayarlar") {
      return (
        <Ayarlar
          musteriler={musteriler}
          bakimlar={bakimlar}
          onUpdateOdemeDurumu={handleUpdateOdemeDurumu}
          onImportData={handleImportBackup}
          getBackupData={getBackupPayload}
        />
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-white overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Mobil üst başlık */}
      <header className="bg-slate-900 text-white px-4 pt-safe flex items-center justify-between shrink-0 border-b border-slate-800"
        style={{ paddingTop: "env(safe-area-inset-top, 12px)", minHeight: "56px" }}>
        <div className="flex items-center gap-4 py-3">
          <img src={appLogo} alt="TekApp Logo" className="h-9 w-9 rounded-xl object-cover shrink-0 shadow-xs border border-slate-700/60" />
          <span className="font-extrabold text-base tracking-tight text-white pl-1">{getScreenTitle()}</span>
        </div>
      </header>

      {/* İçerik alanı - tam ekran */}
      <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
        {renderScreen()}
      </div>

      {/* Alt navigasyon çubuğu (3 Temel Sekme) */}
      <nav className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center shrink-0 px-2 shadow-xs"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)", paddingTop: "6px", minHeight: "60px" }}>
        {[
          { tab: "musteriler"  as TabType, icon: Users,      label: "Müşteriler" },
          { tab: "stok"        as TabType, icon: Package,    label: "Stok & Malzeme" },
          { tab: "ayarlar"     as TabType, icon: Settings,   label: "Ayarlar" },
        ].map(({ tab, icon: Icon, label }) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => navigateToTab(tab)}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
                isActive
                  ? "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold border border-sky-100 dark:border-sky-800/50"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] mt-1 font-semibold tracking-tight">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
