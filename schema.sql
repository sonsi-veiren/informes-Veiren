-- Este esquema se crea automaticamente la primera vez que se hace click en "Actualizar desde NAI".
-- Se deja aca como referencia / para crearlo a mano si se prefiere.

CREATE TABLE IF NOT EXISTS properties (
  nai_id INTEGER PRIMARY KEY,
  titulo TEXT,
  ubicacion TEXT,
  agrupacion TEXT,
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
  -- Se completan solos cuando el sistema detecta que la propiedad dejo de
  -- estar en venta/alquiler (no vienen de NAI, se infieren comparando syncs)
  fecha_cierre_venta TIMESTAMPTZ,
  fecha_cierre_alquiler TIMESTAMPTZ,
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

-- Una fila por propiedad en cada sincronizacion. Permite analizar tendencias
-- (evolucion de precios, cuanto tarda en venderse/alquilarse) una vez que se
-- acumulen varios meses de historial. No tiene datos de antes de activar esto.
CREATE TABLE IF NOT EXISTS properties_history (
  id SERIAL PRIMARY KEY,
  nai_id INTEGER NOT NULL,
  operacion TEXT,
  tags TEXT[],
  precio_venta NUMERIC,
  precio_alquiler NUMERIC,
  captured_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_properties_history_nai_id ON properties_history (nai_id);
