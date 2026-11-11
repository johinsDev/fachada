// Platform file: the editing agent may not change it.
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
  output: "static",
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Manrope",
      cssVariable: "--font-sans-body",
      weights: ["200 800"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
    },
    {
      provider: fontProviders.fontsource(),
      name: "Fraunces",
      cssVariable: "--font-fraunces",
      weights: ["300 700"],
      styles: ["normal", "italic"],
      subsets: ["latin"],
      fallbacks: ["Georgia", "serif"],
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
