-- Este esquema se crea automaticamente la primera vez que se hace click en "Actualizar desde NAI".
-- Se deja aca como referencia / para crearlo a mano si se prefiere.

CREATE TABLE IF NOT EXISTS properties (
  nai_id INTEGER PRIMARY KEY,
  titulo TEXT,
  ubicacion TEXT,
  tipo TEXT,
  fecha_ingreso TEXT,
  ult_movimiento TEXT,
  operacion TEXT,
  precio_venta NUMERIC,
  moneda_venta TEXT,
  precio_alquiler NUMERIC,
  moneda_alquiler TEXT,
  superficie NUMERIC,
  dormitorios NUMERIC,
  banos NUMERIC,
  agente TEXT,
  tags TEXT[],
  url TEXT,
  -- Campos manuales: no vienen de NAI, se editan a mano desde la web (protegidos con codigo)
  inversion_mkt NUMERIC,
  clics NUMERIC,
  leads NUMERIC,
  comentarios TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  manual_updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  properties_count INTEGER,
  status TEXT,
  error TEXT
);
