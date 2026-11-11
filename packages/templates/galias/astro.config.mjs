// Platform file: the editing agent may not change it.
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
  output: "static",
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Public Sans",
      cssVariable: "--font-public-sans",
      weights: ["100 900"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
    },
  ],
  trailingSlash: "ignore",
  server: { host: true, port: 4321, allowedHosts: [".fachada.dev"] },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: [".fachada.dev"],
      // The preview runs behind the sandbox proxy on https/443.
      hmr: process.env.FACHADA_PREVIEW ? { protocol: "wss", clientPort: 443 } : undefined,
    },
  },
});
