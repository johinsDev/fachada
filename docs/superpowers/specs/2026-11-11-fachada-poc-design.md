# Fachada · POC

Diseño del prueba de concepto. Fecha: 2026-11-11. Autor: Johan (con Claude).

## Qué es y por qué

Fachada es «Shopify para constructoras» (sin llegar a Shopify): una
constructora se registra, recibe al instante un sitio de proyectos de
vivienda en un subdominio y un admin para gestionar proyectos y leads, y
puede cambiar su sitio pidiéndoselo a una IA en lenguaje natural. La IA
modifica el **código Astro real** del sitio dentro de un sandbox, con
preview en vivo, al estilo de Vibe
(github.com/code-with-antonio/nextjs-vibe), pero para real estate y todo
sobre Cloudflare.

Sale de Las Galias: el sitio y el CMS que hicimos para esa constructora
son el dominio ya resuelto (catálogo, ficha de proyecto, leads, reglas de
rendimiento). El documento de arquitectura de largo plazo es «Plataforma
para constructoras — arquitectura»
(https://claude.ai/artifact/SFYh3XuuYq1E6WJhrx1MRt); este POC es una
versión mínima y demostrable de esa idea, no su fase 1.

**Para quién:** una demo para Sergey, socio de Johan en real estate.
**Éxito:** Sergey ve el recorrido completo funcionando de verdad, de
principio a fin, y entiende que con integraciones esto se vuelve un
producto.

## El recorrido de la demo (todo debe funcionar de verdad)

1. **Registro.** Una landing pública de Fachada con un formulario: nombre
   de la constructora, correo, contraseña y plantilla inicial. Al enviar,
   se crea la constructora (tenant), su usuario y su sitio, y el sitio
   queda publicado en `<slug>.<dominio-de-sitios>`.
2. **Admin.** Entra directo a su admin, con:
   - **Proyectos:** crear, editar, borrar. Nombre, slug, ciudad, precio
     desde (COP), rango de área (m²), alcobas, baños, descripción, estado
     (sobre planos / en construcción / entrega inmediata), fotos (subidas
     a R2), publicado sí/no.
   - **Leads:** lista de lo que llega por los formularios del sitio, la
     más nueva primero, filtro por proyecto, exportar CSV.
   - **Sitio:** la versión publicada, el historial de versiones,
     «Cambiar de plantilla», «Editar con IA» y «Publicar».
   - **Ajustes:** Empresa (nombre, logo, WhatsApp, colores base),
     Dominio e Integraciones (ver abajo).
3. **Crear un proyecto y verlo de una.** Al guardar un proyecto
   publicado, el sitio se vuelve a compilar y el proyecto aparece en el
   catálogo y con su ficha.
4. **Cambiar de plantilla** entre las dos disponibles. Es rápido y no
   pierde datos (los datos viven en la base, no en el código).
5. **Editar con IA.** Un chat al lado de un preview en vivo. El autor
   pide «pon el fondo oscuro y agrega una sección de preguntas
   frecuentes», el agente edita archivos en el sandbox y el preview
   cambia. «Publicar» compila y publica esa versión.

## Lo que es de muestra (hardcodeado)

- **Integraciones:** tarjetas de HubSpot, Sinco, bot de WhatsApp, Meta
  Lead Ads, Google Tag Manager, Salesforce y Zapier. «Conectar» abre un
  formulario y la tarjeta queda como «Conectada», guardado en la base,
  pero no se envía nada a ningún lado.
- **Dominio propio:** la pantalla pide el dominio, muestra el registro
  DNS que habría que crear (`www` CNAME → `sitios.<dominio-plataforma>`) y
  un estado «Pendiente de verificación». No llama a Cloudflare. Hacerlo
  real después es Cloudflare for SaaS (custom hostnames): un fallback
  origin y una ruta `*/*` del Worker de sitios en la zona SaaS, la
  llamada al API que registra el hostname, los registros de validación
  del certificado que el cliente agrega y una tabla dominio → tenant. Un
  dominio raíz no admite CNAME: se usa `www`. El Worker de sitios ya
  resuelve por host, así que no cambia.

## Decisiones de Johan

- Repo nuevo en la cuenta `johinsDev`, privado: `johinsDev/fachada`.
  Monorepo TypeScript, **Hono**, **oxlint**. Sin CI.
- Todo servido desde **Cloudflare**. Los archivos y los sitios en **R2**.
- El código de cada sitio **no vive en ningún repo**: vive en R2,
  versionado.
- La IA modifica el **código**, no solo configuración. Sandbox para
  Astro.
- IA con **AI SDK**, con la API key de Anthropic de Johan. (Chat SDK de
  Vercel es para bots de Slack/Teams, que es no-meta; no se usa.)
- Dos plantillas: **«Galias»** (la ficha y el catálogo de Las Galias) y
  **«Pro»** (moderna, con animaciones de scroll; referencia de estilo:
  jiro.build/templates/real-estate-construction/real-estate-listing-website-luxterra).
- No tiene que ser perfecto: es para mostrar.

## Cómo se construye (decisiones de Claude, revisables)

### Monorepo

bun workspaces + turbo, oxlint, prettier. Código en inglés, interfaz en
español (Colombia).

```
apps/
  api/        Hono en un Worker: auth, CRUD, leads públicos, agente, builds
  admin/      SPA React (Vite + Tailwind v4 + shadcn) servida como static assets
  sites/      Worker que sirve los sitios publicados desde R2 por Host
  marketing/  la landing de registro de Fachada (puede vivir dentro de admin)
packages/
  templates/  galias/ y pro/: proyectos Astro completos, la semilla de cada sitio
  shared/     tipos y esquemas (valibot) compartidos entre api, admin y plantillas
sandbox/      Dockerfile de la imagen del sandbox (node + deps de ambas plantillas)
```

El admin habla con el API por el cliente RPC de Hono (tipos de punta a
punta). El chat usa `useChat` de AI SDK UI contra un endpoint del API que
hace `streamText`.

### Datos (D1)

D1 (SQLite de Cloudflare) para el POC, no Postgres: no hay que montar
nada más. Toda tabla con `tenant_id`; el API saca el tenant de la sesión
(admin) o del host (endpoints públicos del sitio), nunca de un parámetro
del cliente.

Tablas: `tenants` (slug, nombre, plantilla, ajustes de empresa,
`active_version_id`), `users`, `sessions`, `projects`, `project_photos`,
`leads`, `site_versions` (id, tenant, plantilla, autor, prompt resumido,
estado, fecha), `integrations` (tenant, proveedor, estado, config de
muestra), `domains` (tenant, hostname, estado de muestra),
`chat_messages`.

Auth: correo + contraseña con cookie de sesión, sin verificación de
correo, un solo rol.

### Cómo se guarda y se sirve un sitio

- Cada versión en R2:
  `sites/<tenantId>/<versionId>/src.tar` (el proyecto Astro sin
  `node_modules`) y `sites/<tenantId>/<versionId>/dist/...` (el HTML
  estático).
- El Worker `sites` recibe la petición, saca el slug del subdominio
  (o busca el hostname en `domains` a futuro), lee
  `active_version_id` y sirve el archivo desde R2 con su
  `content-type`. Rollback = cambiar `active_version_id`, sin compilar.
- **Un solo dominio: `fachada.dev`** (zona `e397ccb169793b8dd4a68327ed2cf041`,
  activa, en la cuenta de Cloudflare de Johan
  `9fe45bafe8be5dd315f8164b97ff9399`, con Workers Paid, R2 Paid e
  Images). `app.fachada.dev` el admin y la landing
  de registro, `api.fachada.dev` el API, y la ruta comodín `*.fachada.dev/*` al
  Worker `sites`. Ese Worker primero llama `proxyToSandbox()`: si el host
  es de un preview (`<port>-<sandboxId>-<token>.fachada.dev`) lo entrega al
  sandbox; si no, es `<slug>.fachada.dev` y sirve el sitio desde R2. Todo queda
  a un nivel, así que el certificado universal gratis lo cubre (sin
  Advanced Certificate Manager). Las rutas específicas (`app.`, `api.`)
  ganan sobre el comodín. Slugs reservados: `app`, `api`, `www`.
- La subida a R2 la hace el Worker leyendo los archivos del sandbox y
  haciendo `put` (el contenedor no tiene binding de R2; `mountBucket`
  queda descartado porque no corre en `wrangler dev`).
- Fotos: bucket de R2 con dominio propio (no `r2.dev`, que tiene límite
  de tasa) y **Cloudflare Image Transformations** para anchos, calidad 75
  y AVIF/WebP; así el build no descarga fotos y sigue rápido.

### Datos en las plantillas

La IA nunca escribe precios ni datos de proyectos en el código. Antes de
`astro dev` o `astro build`, la plataforma escribe
`src/data/site.json` en el sandbox con la empresa, sus ajustes y sus
proyectos publicados (fotos como URLs públicas de R2). Las plantillas
leen ese archivo. Por eso:

- **Preview siempre instantáneo, publicar puede tardar** (decisión de
  Johan). Cambiar un proyecto en el admin escribe el `site.json` nuevo en
  el sandbox que corre `astro dev`, y el preview se actualiza al momento
  por HMR. En paralelo se encola un **rebuild** (mismo código de la
  versión activa + datos nuevos) que publica una versión nueva; tardar
  20–90 s con un estado «Publicando…» es aceptable.
- Para que el preview esté siempre listo, el sandbox del tenant se
  mantiene despierto mientras el admin está abierto (latido desde el
  admin y `sleepAfter` alto). El único momento no instantáneo es el
  primer arranque tras dormirse; el admin muestra «Encendiendo preview…».
- Cambiar de plantilla = nueva versión desde la semilla de la otra
  plantilla con los mismos datos. Las ediciones hechas con IA sobre la
  plantilla anterior no se llevan; el admin lo avisa antes.

Los formularios de las plantillas hacen `POST` a
`<api>/public/leads`; el API deduce el tenant del `Origin` (con CORS
para los dominios de sitios y de previews) y guarda el lead. Un lead
enviado desde un origen de preview se asocia al tenant dueño de ese
sandbox y se guarda marcado como prueba. El `Origin` se puede falsificar
fuera del navegador: para el POC se acepta, no es frontera de seguridad.

### Sandbox y compilación

**Cloudflare Sandbox SDK** (`@cloudflare/sandbox`, sobre Containers),
con una imagen propia que trae node y las dependencias de ambas
plantillas ya instaladas, para que no haya `npm install` por sesión.

- **Editar con IA:** se crea o se retoma el sandbox del tenant (id en
  minúsculas apto para DNS), se descomprime ahí el borrador o, si no hay,
  el `src.tar` de la versión activa, se escribe `site.json`, se arranca
  `astro dev` y se expone el puerto; esa URL es el preview que el admin
  muestra en un iframe (HMR en vivo).
- **Preview URLs:** `exposePort` no funciona en `workers.dev`; necesita
  un dominio propio con DNS comodín y una ruta comodín a un Worker cuyo
  `fetch` llama `proxyToSandbox()`. Es un apex o etiqueta distinta de la
  de sitios. En `astro.config` de ambas plantillas: `server.allowedHosts`
  para ese dominio y HMR por `wss` en 443 a través del proxy; sin eso el
  preview carga pero no se actualiza, que es el centro de la demo.
- **Borrador que sobrevive:** el sistema de archivos del sandbox se
  pierde al dormir (`sleepAfter`, 10 min por defecto) o al reiniciar.
  Después de cada turno del agente se guarda
  `sites/<tenantId>/draft/src.tar` en R2; al retomar se restaura desde
  ahí. Como los datos no están en el código, un rebuild por cambio de
  proyecto no choca con el borrador (el siguiente `site.json` ya trae lo
  nuevo). Cambiar de plantilla descarta el borrador, y el admin lo avisa.
- **Publicar / rebuild:** en el sandbox, `astro build`; el Worker sube
  `src.tar` y `dist/` a R2 bajo un `versionId` nuevo y la activa solo si
  el build pasó. Los builds de un tenant van por un Durable Object que los
  encola y agrupa (varios guardados seguidos = un build), porque un build
  dura más que una petición.
- **Registro:** el primer build ocurre al registrarse; el admin muestra
  «Creando tu sitio…» mientras tanto.
- **Antes de la demo:** calentar el sandbox justo antes de la reunión o
  subir `sleepAfter`; uno calentado horas antes ya estará dormido.

Plan B, si el SDK de Cloudflare se complica para la demo: Vercel
Sandbox. Solo cambia dónde corre la compilación; R2, el Worker de sitios
y el resto quedan igual.

### El agente

AI SDK `streamText` con el proveedor de Anthropic (key de Johan como
secreto del Worker). Modelo: el Sonnet más reciente, por velocidad. Las
herramientas operan solo dentro del sandbox del tenant y solo bajo
`src/` y `public/`:

- `listFiles`, `readFile`, `writeFile`, `deleteFile`
- `checkBuild`: corre `astro check` y `astro build` y devuelve los
  errores para que el agente los corrija antes de responder

El agente **no** toca `package.json`, `astro.config.*` ni agrega
paquetes: la imagen del sandbox trae un set fijo de dependencias y así
nunca hay `npm install` frente a Sergey. El system prompt lo dice: un
carrusel o una animación se hace con lo que hay (CSS, el
IntersectionObserver de la plantilla), y las fuentes van como archivos
en `public/`.

El system prompt lleva las reglas del dominio y de rendimiento sacadas
de `AGENTS.md` de Las Galias: no escribir precios ni datos a mano (todo
sale de `site.json`), imágenes con anchos y `sizes`, islas que hidratan
al primer uso, sin preload de fuentes, contraste 4,5:1, textos en
español de Colombia. El historial del chat se guarda por tenant.

### Las plantillas

- **«Galias»:** home con catálogo (filtro por ciudad), ficha de proyecto
  (galería, datos, formulario de lead, botón de WhatsApp), basada en
  `apps/web` de Las Galias pero sin lo que depende de Strapi (simuladores,
  lanzamientos, footer del CMS, FAQ bot). Johan confirmó que se puede
  usar el código y el diseño de Las Galias con su nombre para la demo.
- **«Pro»:** diseño propio, claro y elegante, centrado en la fotografía:
  revelado al hacer scroll, carrusel de galería, cifras animadas (m²,
  precio desde, unidades), franja de texto en movimiento, preguntas
  frecuentes en acordeón. Inspirada en la referencia de Jiro, **no
  copiada** (no tiene licencia conocida). Animaciones con CSS y un
  IntersectionObserver, sin librería.
- Ambas leen el mismo `site.json`, así que cualquier tenant puede pasar
  de una a otra.

### Datos de muestra

Un tenant demo ya creado («Constructora Demo») con 4–6 proyectos
inventados y fotos libres de uso (p. ej. Unsplash), para que la demo no
dependa de cargar datos en vivo. Los precios son inventados y se ven como
tales; ningún dato real de Las Galias.

## Metas, no-metas y anti-metas

**Metas:** el recorrido de la demo completo y real; el sitio publicado
rápido (Lighthouse móvil alto); el preview que cambia en vivo con el chat.

**No-metas:** CI, pruebas (más allá de lo mínimo), integraciones reales,
dominios propios reales, facturación/planes, verificación de correo,
roles, canales de chat (Slack/Teams/Telegram), sync con ERP, Postgres y
RLS, aislamiento fuerte del código del sandbox, revisión de dependencias
nuevas.

**Anti-metas (si pasa esto, falló aunque funcione):**

- La demo se cae o se queda cargando frente a Sergey. Mitigación: tenant
  demo listo y sandbox precalentado antes de la reunión.
- La IA inventa precios o rompe el sitio publicado. Mitigación: datos solo
  en `site.json`; `checkBuild` antes de publicar; si el build falla no se
  activa la versión.
- Un tenant ve datos de otro.

## Lo que queda para quien construye

Estructura interna de cada app, librería de UI del admin, formato exacto
del tar, forma de los endpoints, cómo se nombran las versiones, el texto
de la landing de registro, el diseño concreto de la plantilla «Pro»
dentro de las pautas de arriba.

## Preguntas abiertas

Ninguna. Dominio (`fachada.dev`) y plan (Workers Paid) confirmados el
2026-11-11.
