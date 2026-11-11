# Fachada POC — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una constructora se registra en `app.fachada.dev`, recibe su sitio en `<slug>.fachada.dev` y un admin (proyectos, leads, sitio, ajustes), y cambia su sitio con un chat que edita el código Astro real en un sandbox con preview en vivo.

**Architecture:** Un Worker `api` (Hono) concentra el API, el Durable Object del sandbox, el coordinador de builds y el servicio de sitios/previews por host (`*.fachada.dev`); un Worker `admin` sirve la SPA React. D1 guarda los datos con `tenant_id`; R2 guarda fotos y cada versión del sitio (`src.tar` + `dist/`). El API habla con el sandbox solo a través de la interfaz `SiteRuntime`, con una implementación real (`@cloudflare/sandbox`) y una falsa para pruebas.

**Tech Stack:** bun workspaces + turbo, TypeScript, Hono, oxlint + prettier, Cloudflare Workers / D1 / R2 / Durable Objects / Containers (`@cloudflare/sandbox`), Astro 7 + Tailwind v4, React 19 + Vite + TanStack Router + shadcn, AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/react`), valibot, vitest + `@cloudflare/vitest-pool-workers`.

**Spec:** `docs/superpowers/specs/2026-11-11-fachada-poc-design.md`

**Desviación del spec (decisión de estructura, que el spec deja al builder):** `apps/sites` no es un Worker aparte; el servicio de sitios y el proxy de previews viven en `apps/api` porque necesitan el mismo binding del Sandbox. `apps/marketing` no existe: la landing de registro es una ruta de `apps/admin`.

## Global Constraints

- Cuenta de Cloudflare `9fe45bafe8be5dd315f8164b97ff9399`, zona `fachada.dev` (`e397ccb169793b8dd4a68327ed2cf041`), Workers Paid.
- Hosts: `app.fachada.dev` (admin + registro), `api.fachada.dev` (API), `media.fachada.dev` (bucket de fotos), `*.fachada.dev` (sitios y previews). Todo a un nivel de subdominio.
- Slugs reservados: `app`, `api`, `www`, `media`.
- Código en inglés; interfaz y textos de las plantillas en español de Colombia.
- Sin CI. Calidad local: `bun run lint` (oxlint), `bun run format` (prettier), `bun run typecheck`, `bun run test` antes de cada commit.
- Toda consulta a D1 filtra por `tenant_id`; el tenant sale de la sesión o del host/`Origin`, nunca de un parámetro del cliente.
- La IA nunca escribe precios ni datos de proyectos en el código: los datos viven en `src/data/site.json`, que escribe la plataforma.
- El agente solo toca `src/` y `public/` del sitio; nunca `package.json`, `astro.config.*` ni instala paquetes.
- Una versión se activa solo si su `astro build` pasó.
- Imágenes: Cloudflare Image Transformations, calidad 75, `format=auto`.
- Modelo del agente: `claude-sonnet-5-5`, key en el secreto `ANTHROPIC_API_KEY`.
- Integraciones y dominio propio son de muestra: no llaman a servicios externos.

## Review Focus

1. **Nombres de constructora repetidos o con tildes/símbolos** («Constructora Ñandú & Cía») → slug ASCII válido para DNS y único (`-2`, `-3`); un nombre que da un slug reservado también se desambigua. Prueba en la Tarea 3.
2. **Un build que falla después de un cambio de la IA** → la versión queda `failed`, la anterior sigue en línea y el admin muestra el error. Prueba en la Tarea 9.
3. **Guardar un proyecto con el sandbox dormido** → no se despierta ni falla el guardado; solo se encola el build. Prueba en la Tarea 9.
4. **Un host sin versión activa** (el primer build aún corre) o un slug que no existe → página «Estamos creando este sitio» o 404 propio, nunca un 500. Prueba en la Tarea 10.
5. **Un lead desde un origen de preview o desconocido** → el de preview se guarda con `isTest: true` en el tenant dueño; uno desconocido recibe 403. Prueba en la Tarea 5.

---

### Task 1: Monorepo y tipos compartidos

**Files:**
- Create: `package.json`, `turbo.json`, `.oxlintrc.json`, `.prettierrc`, `tsconfig.base.json`, `.gitignore`
- Create: `packages/shared/src/site-data.ts`, `packages/shared/src/schemas.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/src/schemas.test.ts`

**Interfaces:**
- Produces (`@fachada/shared`):
  - `type TemplateId = "galias" | "pro"`
  - `type ProjectStatus = "planos" | "construccion" | "entrega"`
  - `interface SiteProject { slug: string; name: string; city: string; status: ProjectStatus; priceFromCOP: number | null; areaMin: number | null; areaMax: number | null; bedrooms: number | null; bathrooms: number | null; description: string; photos: { url: string; alt: string }[] }`
  - `interface SiteData { company: { name: string; slug: string; logoUrl: string | null; whatsapp: string | null; colors: { primary: string; accent: string } }; projects: SiteProject[]; apiBase: string; generatedAt: string }`
  - valibot: `SignupSchema` (`companyName` 2–80, `email`, `password` ≥ 8, `template: TemplateId`), `ProjectInputSchema`, `LeadInputSchema` (`name` 2–120, `phone` 7–20 dígitos, `email` opcional, `projectSlug` opcional, `message` ≤ 1000, `consent: literal(true)`), `CompanySettingsSchema`.

- [ ] **Step 1:** Root `package.json` con workspaces `apps/*`, `packages/*`, scripts `lint` (`oxlint`), `format`, `typecheck` y `test` (vía turbo), `packageManager: bun`. `bun install`.
- [ ] **Step 2: Failing test** `schemas.test.ts`: `LeadInputSchema` rechaza `consent: false` y un teléfono de 5 dígitos; acepta `{ name: "Ana", phone: "3001234567", consent: true }`. `SignupSchema` rechaza `template: "otra"`.
- [ ] **Step 3:** `bun test packages/shared` → FAIL (módulo no existe).
- [ ] **Step 4:** Implementar los tipos y esquemas.
- [ ] **Step 5:** `bun test packages/shared` → PASS; `bun run lint` sin errores.
- [ ] **Step 6:** Commit `chore: monorepo y tipos compartidos`.

### Task 2: API base, D1 y aislamiento por tenant

**Files:**
- Create: `apps/api/wrangler.jsonc`, `apps/api/src/index.ts`, `apps/api/src/env.ts`, `apps/api/migrations/0001_init.sql`, `apps/api/src/db/tenant.ts`, `apps/api/vitest.config.ts`
- Test: `apps/api/test/tenant-isolation.test.ts`

**Interfaces:**
- Produces:
  - `type Env = { DB: D1Database; MEDIA: R2Bucket; SITES: R2Bucket; SANDBOX: DurableObjectNamespace; BUILDS: DurableObjectNamespace; ANTHROPIC_API_KEY: string; ROOT_DOMAIN: "fachada.dev" }`
  - `app` (Hono) exportado por `src/index.ts`, con `app.route("/auth", …)`, `/projects`, `/leads`, `/settings`, `/site`, `/public`.
  - `scoped(db: D1Database, tenantId: string)` → helpers `all/first/run` que exigen `tenant_id = ?` (lanza si la SQL no contiene `tenant_id`).
- Tablas (`0001_init.sql`): `tenants(id, slug UNIQUE, name, template, settings_json, active_version_id, created_at)`, `users(id, tenant_id, email UNIQUE, password_hash, created_at)`, `sessions(id, user_id, tenant_id, expires_at)`, `projects(id, tenant_id, slug, name, city, status, price_from_cop, area_min, area_max, bedrooms, bathrooms, description, published, updated_at, UNIQUE(tenant_id, slug))`, `project_photos(id, tenant_id, project_id, key, alt, position)`, `leads(id, tenant_id, project_slug, name, phone, email, message, is_test, origin, created_at)`, `site_versions(id, tenant_id, template, status CHECK IN ('building','ready','failed'), reason, prompt_summary, build_log, created_at)`, `integrations(tenant_id, provider, status, config_json, PRIMARY KEY(tenant_id, provider))`, `domains(tenant_id, hostname, status)`, `chat_messages(id, tenant_id, role, content_json, created_at)`.

- [ ] **Step 1:** `wrangler.jsonc` con D1 `fachada`, R2 `fachada-media` y `fachada-sites`, `ROOT_DOMAIN`, rutas `api.fachada.dev/*` y `*.fachada.dev/*`, `compatibility_flags: ["nodejs_compat"]`. vitest con el pool de Workers y migraciones aplicadas en el setup.
- [ ] **Step 2: Failing test** `tenant-isolation.test.ts`: inserta un proyecto en el tenant A; `scoped(db, B).all("SELECT * FROM projects WHERE tenant_id = ?")` devuelve `[]`; `scoped(db, A).all("SELECT * FROM projects")` lanza `TenantScopeError`.
- [ ] **Step 3:** `bun run --cwd apps/api test` → FAIL.
- [ ] **Step 4:** Implementar `scoped`, la migración y el esqueleto de Hono.
- [ ] **Step 5:** Tests → PASS.
- [ ] **Step 6:** Commit `feat(api): base, D1 y aislamiento por tenant`.

### Task 3: Registro, login y sesión

**Files:**
- Create: `apps/api/src/auth/routes.ts`, `apps/api/src/auth/password.ts`, `apps/api/src/auth/session.ts`, `apps/api/src/tenants/slug.ts`
- Test: `apps/api/test/auth.test.ts`, `apps/api/test/slug.test.ts`

**Interfaces:**
- Consumes: `SignupSchema` (Task 1), `Env` y `scoped` (Task 2).
- Produces:
  - `POST /auth/signup` → `201 { tenant: { id, slug, name, template }, siteUrl: "https://<slug>.fachada.dev" }` + cookie `fs_session` (HttpOnly, Secure, SameSite=None, Domain=`.fachada.dev`). Llama `onTenantCreated(env, tenantId)` (Task 9).
  - `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
  - Middleware `requireSession` que pone `c.var.tenantId` y `c.var.userId`.
  - `slugify(name: string): string` y `uniqueSlug(db, name): Promise<string>`.
  - `hashPassword(pw): Promise<string>` / `verifyPassword(pw, hash): Promise<boolean>` (PBKDF2-SHA256 de WebCrypto, 100 000 iteraciones, sal aleatoria).

- [ ] **Step 1: Failing tests** `slug.test.ts`: `slugify("Constructora Ñandú & Cía")` === `"constructora-nandu-cia"`; `slugify("API")` → `uniqueSlug` devuelve `"api-2"` (reservado); dos tenants «Demo» → `"demo"` y `"demo-2"`; el resultado cumple `/^[a-z0-9](?:[a-z0-9-]{0,40}[a-z0-9])?$/`.
- [ ] **Step 2: Failing tests** `auth.test.ts`: signup → 201, cookie presente, `GET /auth/me` con la cookie → el tenant; correo repetido → 409; login con contraseña mala → 401; `GET /projects` sin cookie → 401.
- [ ] **Step 3:** Tests → FAIL.
- [ ] **Step 4:** Implementar. CORS en el API para `https://app.fachada.dev` con credenciales.
- [ ] **Step 5:** Tests → PASS.
- [ ] **Step 6:** Commit `feat(api): registro, login y sesión`.

### Task 4: Proyectos y fotos

**Files:**
- Create: `apps/api/src/projects/routes.ts`, `apps/api/src/projects/photos.ts`
- Test: `apps/api/test/projects.test.ts`

**Interfaces:**
- Consumes: `requireSession`, `ProjectInputSchema`, `scoped`.
- Produces:
  - `GET /projects`, `POST /projects`, `GET /projects/:id`, `PUT /projects/:id`, `DELETE /projects/:id`.
  - `POST /projects/:id/photos` (multipart, `image/*`, ≤ 10 MB) → guarda en `MEDIA` con key `<tenantId>/<projectId>/<uuid>.<ext>` y devuelve `{ id, url: "https://media.fachada.dev/<key>" }`; `DELETE /projects/:id/photos/:photoId`.
  - Cada escritura llama `onSiteDataChanged(env, tenantId)` (Task 9).

- [ ] **Step 1: Failing tests:** crear, listar y editar un proyecto del propio tenant; slug repetido dentro del tenant → 409, pero el mismo slug en otro tenant sí se puede; `GET /projects/:id` de otro tenant → 404; subir una foto deja el objeto en R2 bajo el prefijo del tenant; un `.pdf` → 415.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit `feat(api): proyectos y fotos`.

### Task 5: Leads públicos, lista y CSV

**Files:**
- Create: `apps/api/src/leads/public.ts`, `apps/api/src/leads/routes.ts`, `apps/api/src/hosts.ts`
- Test: `apps/api/test/leads.test.ts`, `apps/api/test/hosts.test.ts`

**Interfaces:**
- Produces:
  - `parseHost(host: string, root: "fachada.dev"): { kind: "app" | "api" | "media" } | { kind: "site"; slug: string } | { kind: "preview"; sandboxId: string } | { kind: "unknown" }`. Un preview tiene la forma `<port>-<sandboxId>-<token>.fachada.dev`; el `sandboxId` es `t-<tenantSlug>`.
  - `POST /public/leads` (sin sesión): el tenant sale de `parseHost(new URL(Origin).host)`; `site` → `is_test = 0`; `preview` → `is_test = 1`; otro → 403. CORS refleja el origen si es sitio o preview.
  - `GET /leads?project=&includeTests=` (más nuevo primero) y `GET /leads/export.csv` con los mismos filtros (BOM UTF-8, separador `,`).

- [ ] **Step 1: Failing tests** `hosts.test.ts`: `demo.fachada.dev` → site `demo`; `4321-t-demo-abc123.fachada.dev` → preview `t-demo`; `app.fachada.dev` → app; `evil.com` → unknown.
- [ ] **Step 2: Failing tests** `leads.test.ts`: un lead con `Origin: https://demo.fachada.dev` queda en el tenant demo con `is_test = 0`; uno desde el preview de demo queda con `is_test = 1`; `Origin: https://evil.com` → 403; sin `consent` → 400; un lead del tenant A no aparece en `GET /leads` de B; el CSV tiene encabezado `fecha,proyecto,nombre,telefono,email,mensaje` y respeta el filtro.
- [ ] **Step 3:** Tests → FAIL.
- [ ] **Step 4:** Implementar.
- [ ] **Step 5:** Tests → PASS.
- [ ] **Step 6:** Commit `feat(api): leads públicos, lista y CSV`.

### Task 6: Ajustes: empresa, dominio e integraciones de muestra

**Files:**
- Create: `apps/api/src/settings/routes.ts`, `apps/api/src/settings/integrations-catalog.ts`
- Test: `apps/api/test/settings.test.ts`

**Interfaces:**
- Produces:
  - `GET/PUT /settings/company` (`CompanySettingsSchema`: nombre, `logoUrl`, `whatsapp`, `colors.primary`, `colors.accent`); `POST /settings/company/logo` (sube a `MEDIA`). Una escritura llama `onSiteDataChanged`.
  - `INTEGRATIONS: { id: "hubspot" | "sinco" | "whatsapp-bot" | "meta-lead-ads" | "gtm" | "salesforce" | "zapier"; name: string; description: string; fields: { key: string; label: string; secret?: boolean }[] }[]`.
  - `GET /settings/integrations` (catálogo + estado del tenant) y `POST /settings/integrations/:id/connect` / `…/disconnect`: solo guardan el estado; un campo `secret` se guarda enmascarado (`••••` + últimos 4).
  - `GET/PUT /settings/domain`: guarda el hostname con estado `pending` y devuelve `{ hostname, status: "pending", dns: { type: "CNAME", name: "www", target: "sitios.fachada.dev" } }`.

- [ ] **Step 1: Failing tests:** conectar HubSpot deja `status: "connected"` y el token enmascarado; el catálogo trae las 7 integraciones; un dominio inválido (`"no es dominio"`) → 400; el dominio devuelve el registro CNAME esperado.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit `feat(api): ajustes de empresa, dominio e integraciones de muestra`.

### Task 7: Plantilla «Galias»

**Files:**
- Create: `packages/templates/galias/` (proyecto Astro completo: `package.json`, `astro.config.mjs`, `src/data/site.json` de ejemplo, `src/pages/index.astro`, `src/pages/proyectos/[slug].astro`, `src/lib/site.ts`, `src/lib/image.ts`, `src/islands/LeadForm.tsx`, componentes y estilos)
- Create: `packages/templates/fixtures/site.sample.json`

**Interfaces:**
- Consumes: `SiteData` (Task 1), y el contrato `POST https://api.fachada.dev/public/leads` (Task 5).
- Produces (igual para las dos plantillas):
  - `src/lib/site.ts`: `getSite(): SiteData` (lee `../data/site.json`).
  - `src/lib/image.ts`: `cfImage(url: string, width: number): string` → `https://fachada.dev/cdn-cgi/image/width=<w>,quality=75,format=auto/<url>`, y `srcset(url, widths = [400, 640, 960, 1280, 1920])`.
  - `astro.config.mjs` con `output: "static"`, `server: { host: true, port: 4321, allowedHosts: [".fachada.dev"] }`, `vite.server.hmr: { protocol: "wss", clientPort: 443 }`. Este archivo no lo puede tocar el agente.
  - Rutas: `/` (catálogo con filtro por ciudad) y `/proyectos/<slug>` (galería, datos, `LeadForm`, botón de WhatsApp).

Origen: `/Users/johan/Documents/personal-projects/las-galias/apps/web/src` — `components/ProjectCard.astro`, `ProjectsListing.astro`, `CityFilter.astro`, `ImageCarousel.astro`, `Price.astro`, `Header.astro`, `Footer.astro`, `Logo.astro`, `components/pdp/ProjectPage.astro` (+ `ProjectGallery`, `ProjectHeader`, `ProjectContent`, `ProjectSidebar`, `MobilePriceBar`), `islands/LeadForm.tsx`, `scripts/reveal.ts`, y los tokens de `packages/ui/src/styles/globals.css`. Se quita todo lo que depende de Strapi (simuladores, lanzamientos, footer del CMS, FAQ bot, blog, legales) y `CmsImage` pasa a usar `cfImage`. El nombre, el logo y los colores salen de `site.json`, no del código.

- [ ] **Step 1:** Copiar y adaptar. Sin dependencias fuera de: `astro`, `@astrojs/react`, `react`, `react-dom`, `tailwindcss`, `@tailwindcss/vite`, `valibot`.
- [ ] **Step 2:** `cp packages/templates/fixtures/site.sample.json packages/templates/galias/src/data/site.json && bun run --cwd packages/templates/galias build` → build OK, `dist/index.html` y `dist/proyectos/<slug>/index.html` para cada proyecto de la muestra.
- [ ] **Step 3:** Grep de control: `grep -rE "\\$ ?[0-9]{2,}|millones" packages/templates/galias/src --include=*.astro` → nada (ningún precio en el código).
- [ ] **Step 4:** `bunx astro preview` y revisión visual del catálogo y de una ficha; el formulario hace `POST` al API.
- [ ] **Step 5:** Commit `feat(templates): plantilla Galias`.

### Task 8: Plantilla «Pro»

**Files:**
- Create: `packages/templates/pro/` con la misma forma que Galias (mismos `src/lib/site.ts`, `src/lib/image.ts`, `astro.config.mjs` e `islands/LeadForm.tsx`, copiados), más `src/scripts/reveal.ts`, `src/scripts/count-up.ts`, `src/components/{Hero,Marquee,Gallery,Stats,Faq,ProjectGrid}.astro`.

**Interfaces:**
- Consumes y produce lo mismo que la Task 7 (mismas rutas y mismo `site.json`).

Diseño propio, claro y elegante, centrado en la foto (spec, «Las plantillas»): revelado al hacer scroll (IntersectionObserver + transiciones CSS, respetando `prefers-reduced-motion`), carrusel de galería con CSS scroll-snap, cifras animadas (m² desde, precio desde, número de proyectos) que leen los datos, franja de texto en movimiento con keyframes CSS y preguntas frecuentes con `<details>`. Sin librerías de animación. Tipografía y paleta distintas a las de Galias; nada copiado de la referencia de Jiro.

- [ ] **Step 1:** Construir la plantilla.
- [ ] **Step 2:** Build con `site.sample.json` → OK, las mismas rutas que Galias.
- [ ] **Step 3:** El mismo grep de precios → nada.
- [ ] **Step 4:** Revisión visual en `astro preview`, en móvil y en escritorio, y con `prefers-reduced-motion` activo (todo se ve sin animar).
- [ ] **Step 5:** Commit `feat(templates): plantilla Pro`.

### Task 9: Sandbox, versiones y builds

**Files:**
- Create: `sandbox/Dockerfile`, `apps/api/src/runtime/site-runtime.ts` (interfaz), `apps/api/src/runtime/cloudflare-runtime.ts`, `apps/api/src/runtime/fake-runtime.ts`, `apps/api/src/site/site-data.ts`, `apps/api/src/site/build-coordinator.ts` (Durable Object), `apps/api/src/site/versions.ts`, `apps/api/src/site/routes.ts`, `apps/api/src/site/hooks.ts`
- Test: `apps/api/test/site-data.test.ts`, `apps/api/test/builds.test.ts`

**Interfaces:**
- Consumes: las plantillas (Tasks 7–8), copiadas en la imagen a `/opt/templates/<id>` con `node_modules` ya instalados.
- Produces:
  ```ts
  interface SiteRuntime {
    isAwake(tenantSlug: string): Promise<boolean>;
    load(tenantSlug: string, src: { kind: "tar"; bytes: Uint8Array } | { kind: "seed"; template: TemplateId }): Promise<void>;
    writeSiteData(tenantSlug: string, data: SiteData): Promise<void>;
    startPreview(tenantSlug: string): Promise<{ url: string }>;
    listFiles(tenantSlug: string, dir: string): Promise<string[]>;
    readFile(tenantSlug: string, path: string): Promise<string>;
    writeFile(tenantSlug: string, path: string, content: string): Promise<void>;
    deleteFile(tenantSlug: string, path: string): Promise<void>;
    check(tenantSlug: string): Promise<{ ok: boolean; output: string }>;
    build(tenantSlug: string): Promise<{ ok: true; files: { path: string; bytes: Uint8Array }[] } | { ok: false; output: string }>;
    snapshot(tenantSlug: string): Promise<Uint8Array>; // tar del sitio sin node_modules, dist ni .astro
  }
  ```
  - El sandbox de cada tenant es `getSandbox(env.SANDBOX, "t-" + slug)`, con el sitio en `/workspace/site` y `node_modules` enlazado a `/opt/templates/<id>/node_modules`. `sleepAfter: "30m"`.
  - `buildSiteData(db, tenantId): Promise<SiteData>` (solo proyectos publicados, fotos como URLs de `media.fachada.dev`, `apiBase: "https://api.fachada.dev"`).
  - Claves en R2 `SITES`: `sites/<tenantId>/<versionId>/src.tar`, `sites/<tenantId>/<versionId>/dist/<path>`, `sites/<tenantId>/draft/src.tar`.
  - `BuildCoordinator` (un DO por tenant): `enqueue(reason: "signup" | "data" | "publish" | "template")`, que agrupa los pedidos con 5 s de espera y corre un solo build a la vez. Por build: carga la fuente (el borrador si `reason = "publish"`; si no, el `src.tar` activo, o la semilla en el registro y en el cambio de plantilla), escribe `site.json`, ejecuta `build`, sube `src.tar` y `dist/`, inserta `site_versions` con `ready`/`failed` y solo con `ready` actualiza `tenants.active_version_id`.
  - `onTenantCreated(env, tenantId)` → `enqueue("signup")`. `onSiteDataChanged(env, tenantId)` → si `isAwake`, `writeSiteData` en el sandbox (preview instantáneo); siempre `enqueue("data")`.
  - Rutas: `GET /site` (versión activa, la última versión y su estado, `hasDraft`), `GET /site/versions`, `POST /site/versions/:id/activate` (rollback, solo a `ready`), `POST /site/publish`, `POST /site/template { template }` (borra el borrador y encola `template`), `POST /site/preview/start` → `{ url }` (restaura el borrador o la versión activa, escribe `site.json` y arranca `astro dev`), `POST /site/preview/heartbeat`.

- [ ] **Step 1: Failing test** `site-data.test.ts`: un proyecto no publicado no aparece; las fotos salen en orden de `position` con la URL de `media.fachada.dev`; los datos de otro tenant no aparecen.
- [ ] **Step 2: Failing tests** `builds.test.ts` (con `FakeRuntime`): el registro produce una versión `ready` que queda activa y `dist/index.html` en R2; un build que falla deja la versión `failed`, mantiene la versión activa anterior y guarda `build_log`; tres `onSiteDataChanged` seguidos producen un solo build; `onSiteDataChanged` con el sandbox dormido no llama `writeSiteData` y aun así encola el build; el rollback a una versión `failed` → 409; el cambio de plantilla borra `draft/src.tar`.
- [ ] **Step 3:** Tests → FAIL.
- [ ] **Step 4:** Implementar la interfaz, el `FakeRuntime`, el DO, las versiones y las rutas.
- [ ] **Step 5:** Tests → PASS.
- [ ] **Step 6:** `CloudflareRuntime` sobre `@cloudflare/sandbox` y el `Dockerfile` (`FROM docker.io/cloudflare/sandbox:<versión del SDK>`; copia `packages/templates/{galias,pro}` a `/opt/templates/` y corre `npm ci` en cada una). Prueba manual con `wrangler dev`: `POST /site/preview/start` devuelve una URL que carga el sitio.
- [ ] **Step 7:** Commit `feat(api): sandbox, versiones y builds`.

### Task 10: Servir sitios y previews por host

**Files:**
- Create: `apps/api/src/serve/site.ts`, `apps/api/src/serve/pages.ts` (HTML de «Estamos creando este sitio» y del 404)
- Modify: `apps/api/src/index.ts` (antes de Hono: `proxyToSandbox(request, env)`; si responde, se devuelve esa respuesta. Si no, `parseHost` decide: `site` → `serveSite`, y `api` → Hono)
- Test: `apps/api/test/serve.test.ts`

**Interfaces:**
- Produces: `serveSite(env, slug, pathname): Promise<Response>`. Resuelve `/` → `index.html`, `/x` → `x/index.html` o `x.html`, y pone el `content-type` según la extensión. HTML con `cache-control: no-cache`; `/_astro/*` con `immutable`.

- [ ] **Step 1: Failing tests:** `demo.fachada.dev/` sirve el `index.html` de la versión activa; `/proyectos/torre-norte` sirve `proyectos/torre-norte/index.html`; un tenant sin versión activa → 200 con la página «Estamos creando este sitio»; un slug inexistente → 404 con la página propia; un archivo inexistente → el `404.html` del sitio si existe y, si no, el propio. Ninguno de estos casos da 500.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit `feat(api): servir sitios y previews por host`.

### Task 11: Agente de edición

**Files:**
- Create: `apps/api/src/agent/paths.ts`, `apps/api/src/agent/tools.ts`, `apps/api/src/agent/system-prompt.ts`, `apps/api/src/agent/routes.ts`
- Test: `apps/api/test/agent-paths.test.ts`, `apps/api/test/agent-tools.test.ts`

**Interfaces:**
- Consumes: `SiteRuntime` (Task 9).
- Produces:
  - `resolveSitePath(input: string): string`, que lanza `PathNotAllowedError`. Solo se aceptan rutas relativas bajo `src/` o `public/`, normalizadas.
  - `siteTools(runtime, tenantSlug)` → herramientas de AI SDK `listFiles`, `readFile`, `writeFile`, `deleteFile`, `checkBuild` (llama `runtime.check` y luego `runtime.build`, y devuelve `{ ok, output }` sin publicar).
  - `POST /site/chat`, con el cuerpo de `useChat`. Usa `streamText` con `anthropic("claude-sonnet-5-5")`, `stopWhen: stepCountIs(25)` y devuelve el stream UI. Al terminar guarda los mensajes en `chat_messages` y `snapshot` → `sites/<tenantId>/draft/src.tar`. `GET /site/chat` devuelve el historial.
  - System prompt (español): rol, reglas del spec («El agente») y estas reglas fijas:
    - todo dato o precio sale de `getSite()`;
    - no tocar `package.json`, `astro.config.*` ni agregar paquetes;
    - imágenes con `cfImage`/`srcset` y `sizes`;
    - islas solo si son necesarias, con `client:visible`;
    - sin preload de fuentes;
    - contraste 4,5:1;
    - copy en español de Colombia;
    - correr `checkBuild` antes de terminar y corregir hasta que pase.

- [ ] **Step 1: Failing tests** `agent-paths.test.ts`: `src/pages/index.astro` pasa; `public/fonts/x.woff2` pasa; `../secret`, `/etc/passwd`, `package.json`, `astro.config.mjs`, `src/../package.json` y `node_modules/x` lanzan.
- [ ] **Step 2: Failing test** `agent-tools.test.ts` (`FakeRuntime`): `writeFile("package.json")` devuelve un error al modelo sin escribir; `checkBuild` con un build que falla devuelve `ok: false` y el log.
- [ ] **Step 3:** Tests → FAIL.
- [ ] **Step 4:** Implementar.
- [ ] **Step 5:** Tests → PASS.
- [ ] **Step 6:** Prueba manual con `wrangler dev` y la key real: «pon el fondo del hero oscuro» → cambia un archivo de `src/` y el preview se actualiza.
- [ ] **Step 7:** Commit `feat(api): agente de edición`.

### Task 12: Admin — registro, sesión y estructura

**Files:**
- Create: `apps/admin/` (Vite + React + TanStack Router + Tailwind v4 + shadcn), `apps/admin/wrangler.jsonc` (static assets con `not_found_handling: "single-page-application"`, ruta `app.fachada.dev/*`), `apps/admin/src/lib/api.ts` (cliente `hc<AppType>` de Hono con `credentials: "include"`), rutas `/` (landing de Fachada con el formulario de registro), `/entrar`, y el layout autenticado con la navegación: Proyectos, Leads, Sitio, Ajustes.

**Interfaces:**
- Consumes: `AppType` exportado por `apps/api/src/index.ts`; `/auth/*` (Task 3).
- Produces: `useSession()` y el layout `AppShell` con la navegación, usados por las Tasks 13 y 14.

- [ ] **Step 1:** Construir. La landing explica Fachada en una pantalla y el formulario pide nombre de la constructora, correo, contraseña y una de las dos plantillas (con miniatura). Al registrarse, lleva a `/sitio` con el estado «Creando tu sitio…».
- [ ] **Step 2:** `bun run --cwd apps/admin build` y `typecheck` → OK.
- [ ] **Step 3:** Prueba manual contra el API local: registro → sesión → layout; cerrar sesión → `/entrar`.
- [ ] **Step 4:** Commit `feat(admin): registro, sesión y estructura`.

### Task 13: Admin — proyectos, leads y ajustes

**Files:**
- Create: `apps/admin/src/routes/proyectos/*`, `leads.tsx`, `ajustes/{empresa,dominio,integraciones}.tsx`

**Interfaces:**
- Consumes: `/projects`, `/leads`, `/settings/*` (Tasks 4–6), `AppShell` (Task 12).

- [ ] **Step 1:** Proyectos:
  - lista con estado de publicación;
  - formulario con todos los campos del spec;
  - fotos con subida, orden y alt.

  Al guardar, avisa «Guardado · el preview ya lo muestra, publicando…».
- [ ] **Step 2:** Leads:
  - tabla, la más nueva primero;
  - filtro por proyecto;
  - interruptor «Incluir pruebas»;
  - botón «Exportar CSV».
- [ ] **Step 3:** Ajustes:
  - **Empresa:** nombre, logo, WhatsApp y dos colores.
  - **Dominio:** campo, registro CNAME para copiar y estado «Pendiente de verificación».
  - **Integraciones:** tarjetas del catálogo con «Conectar», un diálogo con sus campos y el estado «Conectada».
- [ ] **Step 4:** Build y typecheck → OK. Recorrido manual: crear un proyecto con foto, ver un lead enviado desde el sitio y conectar HubSpot.
- [ ] **Step 5:** Commit `feat(admin): proyectos, leads y ajustes`.

### Task 14: Admin — Sitio (preview, chat, versiones y plantilla)

**Files:**
- Create: `apps/admin/src/routes/sitio.tsx`, `apps/admin/src/features/site/{Preview,Chat,Versions,TemplateSwitch}.tsx`

**Interfaces:**
- Consumes: `/site/*` (Tasks 9 y 11). `useChat` de `@ai-sdk/react` contra `https://api.fachada.dev/site/chat`.

- [ ] **Step 1:** Pantalla dividida, con el chat a la izquierda y el preview a la derecha.
  - **Preview:** iframe de la URL de `POST /site/preview/start`, con «Encendiendo preview…» mientras arranca.
  - **Latido:** `POST /site/preview/heartbeat` cada 60 s mientras la pestaña está visible.
  - **Barra superior:**
    - enlace al sitio publicado;
    - estado de la última versión (`building` / `ready` / `failed`, con el log si falló);
    - «Publicar»;
    - «Cambiar de plantilla», con una confirmación que avisa que se descartan los cambios hechos con IA;
    - historial de versiones con «Volver a esta».
- [ ] **Step 2:** El chat muestra qué archivos tocó el agente en cada turno, a partir de las llamadas a herramientas.
- [ ] **Step 3:** Build y typecheck → OK.
- [ ] **Step 4:** Recorrido manual completo del spec: registro, el sitio aparece, se crea un proyecto y el preview lo muestra al instante, se pide un cambio por chat y el preview cambia, se publica y el sitio público cambia, se cambia de plantilla y se vuelve a una versión anterior.
- [ ] **Step 5:** Commit `feat(admin): editor del sitio con IA`.

### Task 15: Despliegue, datos demo y ensayo

**Files:**
- Create: `scripts/seed-demo.ts`, `docs/demo.md`

- [ ] **Step 1:** Recursos en la cuenta:
  - `wrangler d1 create fachada` y aplicar las migraciones;
  - `wrangler r2 bucket create fachada-media` y `fachada-sites`;
  - dominio propio `media.fachada.dev` en `fachada-media`;
  - activar Image Transformations en la zona;
  - `wrangler secret put ANTHROPIC_API_KEY` (lo pega Johan).
- [ ] **Step 2:** DNS: un registro comodín `*` y `app`/`api` con proxy (AAAA `100::`), para que las rutas de Workers los atiendan.
- [ ] **Step 3:** `wrangler deploy` del API (con el contenedor) y del admin.
- [ ] **Step 4:** `scripts/seed-demo.ts` registra «Constructora Demo» (`demo`) con la plantilla Pro y crea 5 proyectos inventados en 3 ciudades, con fotos de Unsplash subidas por el API y precios evidentemente de muestra. Se espera el primer build.
- [ ] **Step 5:** Verificación:
  - `curl -sI https://demo.fachada.dev/` → 200 `text/html`;
  - `curl -sI https://app.fachada.dev/` → 200;
  - un lead desde el sitio aparece en el admin.
- [ ] **Step 6:** `docs/demo.md` con el guion de la demo y la preparación: entrar al admin de `demo` cinco minutos antes, para que el sandbox despierte, y tener una segunda pestaña lista para registrar una constructora nueva en vivo.
- [ ] **Step 7:** Commit `chore: despliegue, datos demo y guion`.
