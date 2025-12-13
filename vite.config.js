import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // En Vercel: base "/"
  // En GitHub Pages: base "/Navidad-en-la-Mesa/"
  base: process.env.VERCEL ? "/" : "/Navidad-en-la-Mesa/",
  plugins: [react()]
});
