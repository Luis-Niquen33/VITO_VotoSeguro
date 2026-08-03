import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/voto-seguro-eten/",
  plugins: [react()],
});
