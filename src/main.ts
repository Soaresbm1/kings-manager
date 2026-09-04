import Phaser from "phaser";

// Étape 1 de la migration (voir docs/superpowers/plans/2026-09-04-phaser-ts-migration-roadmap.md) :
// vérifie seulement que la chaîne Vite/TypeScript/Phaser fonctionne et se charge APRÈS l'app
// legacy (data.js/matchengine-actions.js/engine.js/matchchoreo.js/app.js, chargés juste avant en
// tant que scripts classiques) — ne monte encore rien à l'écran, aucun changement de comportement.
console.log(`[kings-manager] pipeline Vite/TypeScript/Phaser prête (Phaser ${Phaser.VERSION})`);
