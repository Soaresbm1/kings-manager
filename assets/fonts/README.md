# Polices locales

Poppins (400, 600, 700, 800) et Rajdhani (500, 600, 700) sont distribuées sous SIL Open Font License 1.1. Les fichiers `poppins-OFL.txt` et `rajdhani-OFL.txt` contiennent les avis et licences complets.

Les sous-ensembles WOFF2 latin et latin étendu fournis par Google Fonts préservent les caractères français et les noms européens. Les autres écritures utilisent les polices de secours du système. `font-display: swap` conserve un affichage immédiat.

L'application charge uniquement les fichiers locaux de `fonts.css`. Elle ne dépend donc pas de Google Fonts en ligne. Le cache hors ligne conserve les quatorze fichiers WOFF2.

`sources.json` documente chaque URL officielle, taille et empreinte SHA-256. Pour mettre à jour volontairement ces fichiers : `node scripts/sync-pwa-fonts.cjs`, puis régénérer la liste des ressources PWA et vérifier les rendus. La maintenance utilise le réseau ; le jeu ne l'utilise pas pour ses polices.
