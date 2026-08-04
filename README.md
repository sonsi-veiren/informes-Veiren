# Informe de Propiedades — Veiren

Panel interno que reemplaza el Excel mensual. Se conecta a NAI (el CRM), trae el
listado de propiedades activas y armadas, y permite agregar a mano los datos que
NAI no tiene (inversión en marketing, clics, leads, comentarios).

**No está protegida con login.** Cualquiera con el link puede ver los datos. Para
editar los 4 campos manuales hace falta el código `Veiren2026` (se puede cambiar,
ver más abajo).

## Cómo funciona

1. Al abrir la web, automáticamente se loguea en NAI con las credenciales
   configuradas, trae el listado completo de propiedades, y lo guarda en una base
   de datos Postgres.
2. La tabla y los KPIs se calculan a partir de esa base, no de NAI en vivo — así
   que si NAI está caído o cambia algo, seguís viendo la última foto guardada.
3. Los campos "Inversión mkt", "Clics", "Leads" y "Comentarios" **no vienen de
   NAI** — se hace click en la celda para editarlos a mano, pidiendo el código.

## ⚠️ Importante sobre el scraper

Esto funciona leyendo el HTML de `app.nai.com.uy` porque NAI no tiene una API
pública. Se armó mirando la estructura real de la página de login y del listado
de propiedades (agosto 2026). **Si NAI actualiza su sitio, el scraper puede
romperse** — el error va a aparecer arriba de la tabla ("No se pudo actualizar
desde NAI: ..."), y en ese caso hay que ajustar `lib/scraper.ts` mirando la
nueva estructura del HTML.

## Puesta en marcha (paso a paso)

### 1. Base de datos (Postgres gratis)

Recomendado: [Neon](https://neon.tech) (tiene plan gratis, es el más simple).

1. Crear cuenta en neon.tech.
2. Crear un proyecto nuevo.
3. Copiar el "Connection string" (empieza con `postgres://...`).
4. Guardalo, lo vas a necesitar en el paso 3.

No hace falta crear tablas a mano — la app las crea solas la primera vez que
sincroniza.

### 2. Subir el código a GitHub

1. Crear un repositorio nuevo (privado) en GitHub, por ejemplo `veiren-informe`.
2. Subir esta carpeta completa a ese repositorio.

### 3. Desplegar en Vercel

1. Entrar a [vercel.com](https://vercel.com) con la cuenta de Veiren/DDC.
2. "Add New" → "Project" → importar el repositorio `veiren-informe`.
3. Antes de darle a "Deploy", ir a **Environment Variables** y agregar:

   | Nombre | Valor |
   |---|---|
   | `DATABASE_URL` | el connection string de Neon del paso 1 |
   | `NAI_USER` | el email con el que se loguean en NAI |
   | `NAI_PASSWORD` | la clave de NAI |
   | `EDIT_PASSCODE` | `Veiren2026` (o el código que prefieran) |

4. Deploy. Cuando termine, Vercel da una URL tipo
   `https://veiren-informe.vercel.app` — esa es la que comparten con el equipo.

### 4. Uso diario

- Cada vez que alguien abre la URL, se actualiza sola desde NAI.
- Si alguien quiere forzar una actualización sin recargar la página, está el
  botón "Actualizar desde NAI" arriba a la derecha.

## Estructura del proyecto

```
app/
  page.tsx                     — la pantalla principal (tabla + KPIs)
  api/sync/route.ts            — login a NAI + scraping + guardado en la base
  api/properties/route.ts      — devuelve las propiedades guardadas
  api/properties/[id]/route.ts — edita los campos manuales (pide código)
lib/
  scraper.ts                   — login y parseo del HTML de NAI
  db.ts                        — conexión a Postgres
  schema.sql                   — estructura de las tablas (referencia)
```

## Cambiar el código de edición

Solo hay que cambiar la variable de entorno `EDIT_PASSCODE` en Vercel
(Settings → Environment Variables) y volver a desplegar.
