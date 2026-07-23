-- ─────────────────────────────────────────────────────────────────
-- STOK TABLOSU (yoksa oluştur)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stok (
  id        BIGSERIAL PRIMARY KEY,
  ad        TEXT NOT NULL UNIQUE,
  miktar    INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stok ENABLE ROW LEVEL SECURITY;

-- Eğer hata verirse (zaten var derse) bu satırı silebilirsiniz:
CREATE POLICY "Herkes erisebilir" ON stok FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE stok REPLICA IDENTITY FULL;

-- ─────────────────────────────────────────────────────────────────
-- TÜM STOK KALEMLERİ (50'şer adet varsayılan)
-- Varsa atla (ON CONFLICT DO NOTHING)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO stok (ad, miktar) VALUES

  -- Açık filtreler
  ('1. filtre açık',                50),
  ('2. filtre açık',                50),
  ('3. filtre açık',                50),

  -- Kapalı filtreler
  ('1. filtre kapalı',              50),
  ('2. filtre kapalı',              50),
  ('3. filtre kapalı',              50),

  -- Kokonatlı kapalı filtreler
  ('1. filtre kapalı kokonatlı',    50),
  ('2. filtre kapalı kokonatlı',    50),
  ('3. filtre kapalı kokonatlı',    50),

  -- Temel parçalar
  ('membran',                       50),
  ('tatlandırıcı',                  50),

  -- Su arıtma cihazları (tam ürünler)
  ('8litre motorlu watalina',       50),
  ('12 litre motorlu aquasweet',    50),
  ('12 litre motorlu watalina',     50),
  ('8 litre motorsuz aquasweet',    50),
  ('8litre motorsuz watalina',      50),
  ('8 litre motorlu aquasweet',     50),

  -- Depo ve teknik parçalar
  ('depo 12 litre',                 50),
  ('depo 8 litre',                  50),
  ('filtre kabı',                   50),
  ('motor',                         50),
  ('motor kafası',                  50),
  ('adaptör',                       50),
  ('yüksek basınç',                 50),
  ('alçak basınç',                  50),
  ('şatawalf',                      50),
  ('kısıcı',                        50),
  ('sipap',                         50),

  -- Musluklar
  ('musluk siyah kutu',             50),
  ('musluk beyaz kutu',             50),
  ('lüx musluk',                    50),
  ('çiftli musluk',                 50),
  ('çiftli musluk 2',               50)

ON CONFLICT (ad) DO NOTHING;
