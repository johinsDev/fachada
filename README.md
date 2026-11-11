# Fachada

Prueba de concepto de una plataforma para constructoras: una constructora se registra,
recibe al instante un sitio de proyectos de vivienda en `<slug>.fachada.dev` y un admin
para sus proyectos y leads, y cambia su sitio pidiéndoselo a una IA, que edita el código
Astro real en un sandbox con preview en vivo.

Todo corre en Cloudflare: Workers, D1, R2, Durable Objects y Containers.

## Estructura

```
apps/api         Worker (Hono): API, sitios publicados, previews, builds y agente
apps/admin       SPA (React + Vite + TanStack Router + shadcn/ui): landing y admin
packages/shared  Tipos y esquemas (valibot)
packages/templates/{galias,pro}  Plantillas Astro, la semilla de cada sitio
sandbox/         Imagen del contenedor donde corren astro dev y astro build
docs/            Diseño, plan y guion de la demo
```

## Desarrollo local

```
bun install
bun run --cwd apps/api dev:local     # API en :8787 con el runtime falso (sin contenedores)
bun run --cwd apps/admin dev         # admin en :5173
bun run --cwd apps/api test          # pruebas del API
```

El diseño está en `docs/superpowers/specs/2026-11-11-fachada-poc-design.md` y el guion de
la demo en `docs/demo.md`.
