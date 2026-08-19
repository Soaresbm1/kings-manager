# Kings Manager 7v7

Jeu de simulation de football manager inspiré du format 7v7 de la Kings League (France & Brésil).

## Lancer le jeu

Aucune installation requise. Ouvre simplement `index.html` dans ton navigateur (Chrome, Firefox, Edge...).

Pour éviter d'éventuels soucis de chargement de fichiers locaux, tu peux aussi lancer un petit serveur local :

```
# avec Python
python -m http.server 8000
```

puis ouvre `http://localhost:8000` dans ton navigateur.

## Comment jouer

1. **Accueil** : choisis ta ligue (France ou Brésil) puis ton équipe.
2. **Calendrier** : consulte le calendrier complet aller-retour, prépare ton prochain match.
3. **Avant le match** : sélectionne ton XI (7 joueurs dont 1 gardien), une formation (1-2-2-2, 1-3-2-1 ou 1-2-3-1), un plan offensif et un plan défensif.
4. **Simulation** : le match se déroule minute par minute avec des commentaires (buts, arrêts, cartons, pénaltys...). Utilise "Avancer rapidement" pour passer directement au résumé.
5. **Résumé** : score final, possession, tirs, notes des joueurs.
6. **Classement** : suis ta progression et celle des autres équipes.
7. **Effectif** : consulte les statistiques et la forme de tes joueurs.
8. **Mercato** : fenêtres ouvertes à la mi-saison et en fin de saison. Achète des joueurs (offres négociables) et vends les tiens pour financer ton effectif.

## Structure des fichiers

- `index.html` — interface du jeu
- `style.css` — mise en forme
- `data.js` — données des ligues, équipes, joueurs, formations et plans tactiques
- `engine.js` — moteur de simulation (calendrier, matchs, classement, IA)
- `app.js` — logique de l'interface et gestion de l'état du jeu

## Notes

- Le budget de départ est de 500 000 € par équipe.
- La forme des joueurs évolue selon leurs performances et résultats.
- Les autres équipes de la ligue jouent et font des transferts automatiquement (IA basique).
