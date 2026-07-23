-- TekApp Veritabanı Şeması
-- Supabase SQL Editor'da bu kodu çalıştırın

-- Müşteriler tablosu
CREATE TABLE IF NOT EXISTS musteriler (
  id BIGSERIAL PRIMARY KEY,
  ad TEXT NOT NULL,
  telefon TEXT DEFAULT '',
  adres TEXT DEFAULT '',
  not TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parçalar tablosu
CREATE TABLE IF NOT EXISTS parcalar (
  id BIGSERIAL PRIMARY KEY,
  ad TEXT NOT NULL,
  fiyat NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bakımlar tablosu
CREATE TABLE IF NOT EXISTS bakimlar (
  id BIGSERIAL PRIMARY KEY,
  musteri_id BIGINT REFERENCES musteriler(id) ON DELETE CASCADE,
  tarih TEXT NOT NULL,
  parcalar JSONB DEFAULT '[]',
  toplam NUMERIC(10, 2) DEFAULT 0,
  not TEXT DEFAULT '',
  odendi INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gerçek zamanlı senkronizasyon için replication etkinleştir
ALTER TABLE musteriler REPLICA IDENTITY FULL;
ALTER TABLE parcalar REPLICA IDENTITY FULL;
ALTER TABLE bakimlar REPLICA IDENTITY FULL;

-- Row Level Security - herkese açık (tek kullanıcı uygulaması)
ALTER TABLE musteriler ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcalar ENABLE ROW LEVEL SECURITY;
ALTER TABLE bakimlar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes okuyabilir" ON musteriler FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Herkes okuyabilir" ON parcalar FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Herkes okuyabilir" ON bakimlar FOR ALL USING (true) WITH CHECK (true);

-- Örnek başlangıç verileri (isteğe bağlı - silerseniz temiz başlarsınız)
INSERT INTO musteriler (ad, telefon, adres, "not") VALUES
  ('Ahmet Yılmaz', '0532 111 2233', 'Kadıköy, İstanbul', 'Hafta sonları müsait'),
  ('Mehmet Kaya', '0544 222 3344', 'Çankaya, Ankara', 'Klima bakımları Haziran''da'),
  ('Ayşe Demir', '0555 333 4455', 'Karşıyaka, İzmir', 'Isı pompası kullanıyor')
ON CONFLICT DO NOTHING;

INSERT INTO parcalar (ad, fiyat) VALUES
  ('Yağ Filtresi (Standart)', 250),
  ('Hava Filtresi (Premium)', 350),
  ('Motor Yağı (4 Litre)', 1200),
  ('Kombi Esanjör Temizleme Sıvısı', 450),
  ('Radyatör Temizleme Kimyasalı', 300),
  ('Klima Gazı R410A (100gr)', 180)
ON CONFLICT DO NOTHING;
