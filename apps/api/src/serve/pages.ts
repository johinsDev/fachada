const escape = (s: string) =>
  s
    .replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
    .replace(/&#60;/g, "&lt;")
    .replace(/&#62;/g, "&gt;");

const page = (title: string, body: string) => `<!doctype html>
<html lang="es-CO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#f7f4ef;color:#16140f}
main{max-width:32rem;padding:2rem;text-align:center}h1{font-size:1.75rem;margin:0 0 .5rem}p{color:#5b564d}</style></head>
<body><main>${body}</main></body></html>`;

export const buildingPage = (rawName: string) => {
  const name = escape(rawName);
  return page(
    `${name} · Fachada`,
    `<h1>Estamos creando este sitio</h1><p>${name} estará listo en unos segundos. Esta página se recarga sola.</p>
<script>setTimeout(()=>location.reload(),5000)</script>`,
  );
};

export const unknownSitePage = () =>
  page("Sitio no encontrado · Fachada", `<h1>Este sitio no existe</h1><p>Revisa la dirección.</p>`);

export const notFoundPage = () =>
  page(
    "Página no encontrada",
    `<h1>Página no encontrada</h1><p>La página que buscas no existe.</p>`,
  );
