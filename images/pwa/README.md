# Icônes installables

Les icônes reprennent le blason existant `images/favicon.png`, sans déformation et sans remplacer le favicon du site. Leur fond opaque `#111512` correspond à l'application. Les icônes standard et Apple occupent 70 % de la hauteur ; le blason maskable occupe 62 % et tient entièrement dans le disque central de diamètre 80 %, même en tenant compte de son rectangle englobant.

- `icon-192.png` : 192×192, icône standard.
- `icon-512.png` : 512×512, icône standard.
- `apple-touch-icon.png` : 180×180, raccourci iOS.
- `icon-maskable-512.png` : 512×512, adaptation aux masques Android.

Génération reproductible via `node scripts/build-pwa-icons.cjs` avec Chromium Playwright installé. Le script vérifie les dimensions, l'opacité et la zone de sécurité du masque ; le PNG original reste intact. Le blason est réduit pour les tailles 180/192 et reste sous sa hauteur native de 361 px aux tailles 512.
