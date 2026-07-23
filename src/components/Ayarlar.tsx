import React, { useRef, useState, useMemo } from "react";
import { Upload, Download, TrendingUp, CreditCard, ChevronDown, ChevronUp, CheckCircle2, Calendar, PackageCheck, Layers, Database } from "lucide-react";
import { Musteri, Parca, Bakim } from "../types";
import { COMPOSITE_PARTS_MAPPING } from "../db/stok";

interface AyarlarProps {
  musteriler?: Musteri[];
  bakimlar?: Bakim[];
  onUpdateOdemeDurumu?: (id: number, odendi: number) => void;
  onImportData: (data: { musteriler: Musteri[]; parcalar: Parca[]; bakimlar: Bakim[] }) => void;
  getBackupData: () => { musteriler: Musteri[]; parcalar: Parca[]; bakimlar: Bakim[] };
}

const normalizeAd = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

const toTitleCase = (str: string) => {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

const getKategori = (ad: string): string => {
  const n = normalizeAd(ad);
  if (n.includes("litre") || n.includes("aquasweet") || n.includes("watalina") || n.includes("cihaz") || n.includes("su arıtma") || n.includes("sistemi") || n.includes("arıtma")) {
    return "Su Arıtma Cihazları";
  }
  if (n.includes("filtre") || n.includes("membran") || n.includes("tatlandırıcı") || n.includes("karbon") || n.includes("sediment") || n.includes("post") || n.includes("alkali") || n.includes("mineral") || n.includes("mebran") || n.includes("detox") || n.includes("housing") || n.includes("kapsül")) {
    return "Filtreler";
  }
  if (n === "bilinmeyen parça") return "Diğer";
  return "Teknik Parçalar"; 
};

export default function Ayarlar({
  musteriler = [],
  bakimlar = [],
  onUpdateOdemeDurumu,
  onImportData,
  getBackupData
}: AyarlarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"ciro" | "odeme" | "yedek">("ciro");

  // Trigger Local Download of JSON Backup file
  const handleExport = () => {
    try {
      const backup = getBackupData();
      const payload = {
        versiyon: "1.0",
        tarih: new Date().toISOString(),
        ...backup
      };
      
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `tekapp_yedek_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert("Yedek dosyası (.json) başarıyla indirildi. Bu dosyayı bilgisayarınızda veya Google Drive'da saklayabilirsiniz.");
    } catch (e) {
      console.error(e);
      alert("Yedek oluşturulurken bir hata oluştu.");
    }
  };

  // Read JSON backup file and upload
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Geri yükleme işlemi, mevcut uygulamadaki tüm kayıtları silecektir ve yedekteki kayıtları geri yükleyecektir. Emin misiniz?")) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const backup = JSON.parse(text);

        if (!backup.musteriler || !backup.parcalar || !backup.bakimlar) {
          throw new Error("Geçersiz dosya yapısı. Yedek dosyası 'musteriler', 'parcalar' ve 'bakimlar' verilerini içermelidir.");
        }

        onImportData({
          musteriler: backup.musteriler,
          parcalar: backup.parcalar,
          bakimlar: backup.bakimlar
        });

        alert("Tüm veritabanı kayıtları yedek dosyasından başarıyla geri yüklendi!");
        window.location.reload(); // Refresh to reload state
      } catch (err: any) {
        alert("Geri yükleme başarısız: " + (err.message || "Geçersiz JSON formatı."));
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  // 1. AYLIK CİRO VE PARÇA İSTATİSTİKLERİ HESAPLAMA
  const getMonthlyStats = () => {
    const monthsMap: {
      [key: string]: {
        monthKey: string;
        monthName: string;
        totalCiro: number;
        bakimCount: number;
        parcalarUsage: { [parcaAd: string]: number };
      };
    } = {};

    bakimlar.forEach((b) => {
      if (!b.tarih) return;
      const dateParts = b.tarih.split("-");
      if (dateParts.length < 2) return;
      const year = dateParts[0];
      const month = dateParts[1];
      const monthKey = `${year}-${month}`;

      const dateObj = new Date(Number(year), Number(month) - 1, 1);
      const monthName = dateObj.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = {
          monthKey,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          totalCiro: 0,
          bakimCount: 0,
          parcalarUsage: {}
        };
      }

      monthsMap[monthKey].totalCiro += Number(b.toplam || 0);
      monthsMap[monthKey].bakimCount += 1;

      // Parçaları ayrıştır ve adedini topla
      try {
        const partsList = typeof b.parcalar === "string" ? JSON.parse(b.parcalar) : b.parcalar;
        if (Array.isArray(partsList)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          partsList.forEach((item: any) => {
            const ad = item.ad || "Bilinmeyen Parça";
            const adet = Number(item.adet || 1);
            
            const nAd = normalizeAd(ad);
            const bilesenler = COMPOSITE_PARTS_MAPPING[nAd];

            if (bilesenler) {
              bilesenler.forEach(b => {
                const displayAd = toTitleCase(b);
                monthsMap[monthKey].parcalarUsage[displayAd] = (monthsMap[monthKey].parcalarUsage[displayAd] || 0) + adet;
              });
            } else {
              monthsMap[monthKey].parcalarUsage[ad] = (monthsMap[monthKey].parcalarUsage[ad] || 0) + adet;
            }
          });
        }
      } catch {
        /* ignore parse error */
      }
    });

    return Object.values(monthsMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  };

  const monthlyStats = useMemo(() => getMonthlyStats(), [bakimlar]);

  // 2. BEKLEYEN ÖDEMELER
  const bekleyenBakimlar = bakimlar
    .filter((b) => Number(b.odendi) === 0)
    .sort((a, b) => b.id - a.id);

  const toplamBekleyenTutar = bekleyenBakimlar.reduce((sum, b) => sum + Number(b.toplam || 0), 0);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-4 pb-24 space-y-4">
      
      {/* Üst Sekme Geçiş Butonları (Aylık Ciro / Bekleyen Ödemeler / Veri Yedekleme) */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/80 rounded-xl shrink-0">
        <button
          onClick={() => setActiveSubTab("ciro")}
          className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeSubTab === "ciro"
              ? "bg-white text-emerald-600 shadow-xs font-extrabold"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Aylık Ciro</span>
        </button>

        <button
          onClick={() => setActiveSubTab("odeme")}
          className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 relative ${
            activeSubTab === "odeme"
              ? "bg-white text-rose-600 shadow-xs font-extrabold"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <CreditCard className="h-3.5 w-3.5" />
          <span>Alacaklar</span>
          {bekleyenBakimlar.length > 0 && (
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("yedek")}
          className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeSubTab === "yedek"
              ? "bg-white text-sky-600 shadow-xs font-extrabold"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          <span>Yedekleme</span>
        </button>
      </div>

      {/* 1. AYLIK CİRO VE PARÇA İSTATİSTİKLERİ */}
      {activeSubTab === "ciro" && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 pl-1">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Aylık Ciro ve Kullanılan Parçalar</h3>
          </div>

          {monthlyStats.length > 0 ? (
            <div className="space-y-2.5">
              {monthlyStats.map((m) => {
                const isExpanded = expandedMonth === m.monthKey;
                const parcaEntries = Object.entries(m.parcalarUsage).sort((a, b) => b[1] - a[1]);

                return (
                  <div
                    key={m.monthKey}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs transition"
                  >
                    <button
                      onClick={() => setExpandedMonth(isExpanded ? null : m.monthKey)}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/50 transition focus:outline-none cursor-pointer"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span className="font-bold text-slate-800 text-sm">{m.monthName}</span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                            {m.bakimCount} Servis
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 block pl-6">
                          Kullanılan parça detaylarını görmek için tıklayın
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Toplam Ciro</span>
                          <span className="text-base font-black text-emerald-600 font-mono">
                            {m.totalCiro.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Parça Detayı Accordion */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 bg-slate-50/70 border-t border-slate-100 animate-slide-down">
                        <div className="flex items-center gap-1.5 mb-3.5 text-xs font-bold text-slate-600 bg-white p-2 rounded-lg border border-slate-200/60 shadow-sm">
                          <Layers className="h-4 w-4 text-indigo-500" />
                          <span>Kullanılan Parçalar (Kategorik Görünüm)</span>
                        </div>

                        {parcaEntries.length > 0 ? (
                          <div className="space-y-4">
                            {["Filtreler", "Teknik Parçalar", "Su Arıtma Cihazları", "Diğer"].map(kategori => {
                              const kategoriParcalar = parcaEntries.filter(([ad]) => getKategori(ad) === kategori);
                              if (kategoriParcalar.length === 0) return null;

                              return (
                                <div key={kategori} className="space-y-2">
                                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                    {kategori}
                                  </h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {kategoriParcalar.map(([parcaAd, adet]) => (
                                      <div
                                        key={parcaAd}
                                        className="bg-white border border-slate-200/80 rounded-lg p-2.5 flex justify-between items-center text-xs shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition hover:border-sky-200"
                                      >
                                        <span className="font-medium text-slate-700 truncate max-w-[180px]">{parcaAd}</span>
                                        <span className="font-extrabold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100 font-mono">
                                          {adet} Adet
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Bu ayda parça kaydı bulunamadı.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs">
              Henüz girilmiş bir bakım kaydı veya ciro verisi bulunmuyor.
            </div>
          )}
        </div>
      )}

      {/* 2. BEKLEYEN ÖDEMELER (TAHSİLAT) */}
      {activeSubTab === "odeme" && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between pl-1">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-rose-600" />
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Bekleyen Ödemeler (Alacaklar)</h3>
            </div>
            {toplamBekleyenTutar > 0 && (
              <span className="text-xs font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-mono">
                Toplam: {toplamBekleyenTutar.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
              </span>
            )}
          </div>

          {bekleyenBakimlar.length > 0 ? (
            <div className="space-y-2.5">
              {bekleyenBakimlar.map((b) => {
                const musteri = musteriler.find((m) => m.id === b.musteri_id);
                return (
                  <div
                    key={b.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-xs gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">
                          {musteri ? musteri.ad : `Müşteri #${b.musteri_id}`}
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                          {b.tarih}
                        </span>
                      </div>
                      {musteri?.telefon && (
                        <span className="text-xs text-slate-400 block">{musteri.telefon}</span>
                      )}
                      {b.not && <span className="text-xs text-slate-500 italic block">{b.not}</span>}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-sm font-black text-rose-600 font-mono">
                        {Number(b.toplam).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                      </span>
                      {onUpdateOdemeDurumu && (
                        <button
                          onClick={() => {
                            if (confirm(`${musteri ? musteri.ad : "Müşteri"} için ${b.toplam} TL ödeme alındı olarak işaretlensin mi?`)) {
                              onUpdateOdemeDurumu(b.id, 1);
                            }
                          }}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Ödendi Yap
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs flex flex-col items-center gap-1.5">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mb-1" />
              <span className="font-semibold text-slate-700">Tüm Ödemeler Tahsil Edildi</span>
              <span>Bekleyen herhangi bir alacak kaydı bulunmuyor.</span>
            </div>
          )}
        </div>
      )}

      {/* 3. VERİ YÖNETİMİ (YEDEKLER) */}
      {activeSubTab === "yedek" && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Veri Yönetimi</h3>
          
          {/* Export Card */}
          <button
            onClick={handleExport}
            className="w-full bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-xs hover:shadow-md transition text-left focus:outline-none cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-slate-800 text-sm block">Verileri Yedekle (JSON İndir)</span>
                <span className="text-xs text-slate-400 mt-1 block leading-relaxed">
                  Tüm müşteri, parça ve bakım kayıtlarını tek bir JSON yedek dosyası olarak kaydet.
                </span>
              </div>
            </div>
          </button>

          {/* Import Card */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="w-full bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-xs hover:shadow-md transition text-left focus:outline-none cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-slate-800 text-sm block">Yedekten Geri Yükle</span>
                <span className="text-xs text-slate-400 mt-1 block leading-relaxed">
                  Daha önce indirdiğin bir yedek (.json) dosyasını yükleyerek tüm verileri geri yükle.
                </span>
              </div>
            </div>
          </button>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleImport}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
