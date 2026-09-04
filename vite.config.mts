import { defineConfig, type Plugin } from "vite";
import { cpSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// L'app legacy (data.js/matchengine-actions.js/engine.js/matchchoreo.js/app.js, chargés en
// balises <script> classiques, voir CLAUDE.md) et images/ (photos référencées dynamiquement par
// app.js, ex. playerPhotoUrl — jamais présentes littéralement dans le HTML/CSS, donc invisibles au
// graphe de modules de Vite) doivent être copiées telles quelles dans dist/ : `vite dev` les sert
// déjà directement depuis la racine du projet, mais `vite build` ignore silencieusement tout
// <script src> non "module" et tout fichier jamais référencé littéralement — sans cette copie
// explicite, le build de production charge un jeu cassé (404 sur data.js et sur chaque photo).
const LEGACY_STATIC_FILES = ["data.js", "matchengine-actions.js", "engine.js", "matchchoreo.js", "app.js"];
const LEGACY_STATIC_DIRS = ["images"];

function copyLegacyStaticAssets(): Plugin {
  return {
    name: "copy-legacy-static-assets",
    apply: "build",
    closeBundle() {
      const outDir = resolve(__dirname, "dist");
      for (const file of LEGACY_STATIC_FILES) {
        cpSync(resolve(__dirname, file), resolve(outDir, file));
      }
      for (const dir of LEGACY_STATIC_DIRS) {
        cpSync(resolve(__dirname, dir), resolve(outDir, dir), { recursive: true });
      }
    }
  };
}

export default defineConfig({
  plugins: [copyLegacyStaticAssets()],
  build: {
    target: "es2020",
    outDir: "dist"
  }
});
