/**
 * Loads the demo tenant ("Constructora Demo", slug constructora-demo) through the public API, so it
 * goes through the same signup, project and photo paths a real tenant uses.
 *
 *   bun scripts/seed-demo.ts [https://api.fachada.dev]
 *
 * Demo-only credentials: they open the demo admin and nothing else.
 */
const API = process.argv[2] ?? "https://api.fachada.dev";
const DEMO = {
  companyName: "Constructora Demo",
  email: "demo@fachada.dev",
  password: "fachada-demo-2026",
  template: "pro",
};

// Invented projects; prices and areas are sample values.
const PROJECTS = [
  {
    name: "Torre Norte",
    city: "Cali",
    status: "planos",
    priceFromCOP: 298_000_000,
    areaMin: 54,
    areaMax: 82,
    bedrooms: 3,
    bathrooms: 2,
    description:
      "Apartamentos de 2 y 3 alcobas al norte de la ciudad, a pasos del parque lineal. Piscina, gimnasio y zonas de coworking.\n\nEntrega proyectada para 2028.",
    photos: [
      "photo-1545324418-cc1a3fa10c00",
      "photo-1502672260266-1c1ef2d93688",
      "photo-1484154218962-a197022b5858",
    ],
  },
  {
    name: "Parque del Río",
    city: "Medellín",
    status: "construccion",
    priceFromCOP: 415_000_000,
    areaMin: 68,
    areaMax: 104,
    bedrooms: 3,
    bathrooms: 2,
    description:
      "Vivienda frente al río con balcones amplios, zonas húmedas y parqueadero cubierto.",
    photos: ["photo-1512917774080-9991f1c4c750", "photo-1600585154340-be6161a56a0c"],
  },
  {
    name: "Mirador 60",
    city: "Bogotá",
    status: "entrega",
    priceFromCOP: 520_000_000,
    areaMin: 72,
    areaMax: 120,
    bedrooms: 3,
    bathrooms: 3,
    description: "Apartamentos listos para entrega inmediata con vista a los cerros orientales.",
    photos: ["photo-1600596542815-ffad4c1539a9", "photo-1600607687939-ce8a6c25118c"],
  },
  {
    name: "Brisas del Valle",
    city: "Cali",
    status: "planos",
    priceFromCOP: 189_000_000,
    areaMin: 48,
    areaMax: 63,
    bedrooms: 2,
    bathrooms: 2,
    description:
      "Vivienda de interés social con acceso a subsidio, cerca de colegios y transporte.",
    photos: ["photo-1560448204-e02f11c3d0e2", "photo-1493809842364-78817add7ffb"],
  },
  {
    name: "Altos de la Sabana",
    city: "Bogotá",
    status: "construccion",
    priceFromCOP: 365_000_000,
    areaMin: 60,
    areaMax: 95,
    bedrooms: 3,
    bathrooms: 2,
    description:
      "Conjunto cerrado con amplias zonas verdes, salón comunal y senderos para caminar.",
    photos: ["photo-1580587771525-78b9dba3b914", "photo-1600566753086-00f18fb6b3ea"],
  },
];

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

let cookie = "";
async function call(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  if (typeof init.body === "string") headers.set("content-type", "application/json");
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0]!;
  return res;
}

async function main() {
  let res = await call("/auth/signup", { method: "POST", body: JSON.stringify(DEMO) });
  if (res.status === 409) {
    res = await call("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: DEMO.email, password: DEMO.password }),
    });
  }
  if (!res.ok) throw new Error(`auth failed: ${res.status} ${await res.text()}`);
  const { tenant } = (await res.json()) as { tenant: { slug: string } };
  console.log("tenant:", tenant.slug);

  const existing = (await (await call("/projects")).json()) as { slug: string }[];
  await call("/settings/company", {
    method: "PUT",
    body: JSON.stringify({
      name: DEMO.companyName,
      logoUrl: null,
      whatsapp: "+57 300 000 0000",
      colors: { primary: "#b0894f", accent: "#16140f" },
    }),
  });

  for (const project of PROJECTS) {
    const slug = slugify(project.name);
    if (existing.some((p) => p.slug === slug)) {
      console.log("skip", slug);
      continue;
    }
    const { photos, ...data } = project;
    const created = await call("/projects", {
      method: "POST",
      body: JSON.stringify({ ...data, slug, published: true }),
    });
    if (!created.ok) throw new Error(`project ${slug}: ${created.status} ${await created.text()}`);
    const { id } = (await created.json()) as { id: string };
    for (const photo of photos) {
      const image = await fetch(`https://images.unsplash.com/${photo}?w=1920&q=80&fm=jpg`);
      if (!image.ok) {
        console.warn("photo not found", photo);
        continue;
      }
      const form = new FormData();
      form.append(
        "file",
        new File([await image.arrayBuffer()], `${photo}.jpg`, { type: "image/jpeg" }),
      );
      form.append("alt", project.name);
      const up = await call(`/projects/${id}/photos`, { method: "POST", body: form });
      if (!up.ok) console.warn("upload failed", photo, up.status);
    }
    console.log("created", slug);
  }
  console.log(`done; the site rebuilds in the background: https://${tenant.slug}.fachada.dev`);
}

await main();
