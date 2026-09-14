# Frame — chronique d'une cabane en bord d'étang

Recréation en HTML/CSS statique du site Figma Sites « A-Frame »
(publié sur frame-cabin.figma.site), au pixel près, sans dépendance ni étape de build.

## Lancer en local

```bash
python3 tools/serve.py 4560 .
```

Puis ouvrir http://localhost:4560. Le serveur imite un CDN : cache long sur `assets/`
(influence la variante d'image choisie par Chrome) et requêtes `Range` pour les vidéos.
`python3 -m http.server` ne les gère pas : les vidéos sont alors retéléchargées en boucle
et le défilement saccade.

## Structure

```
index.html        page unique (textes, images, SVG colorés insérés en ligne)
css/style.css     variables Figma, mise en page desktop ≥ 1440, tablette 800–1439, mobile < 800
js/main.js        horloge « HH:MM UTC+2 », clic sur une ligne du sommaire → défilement fluide
assets/img        photos, variantes srcset identiques à celles servies par Figma (AVIF/WebP)
assets/svg        pictogrammes, couleurs intégrées
assets/fonts      Chillon, Mortega, GT Kotoheim Mono, Poppins
assets/video      les 3 vidéos du récit
tools/            extraction depuis le site publié et outils de comparaison
```

## Modifier le site

`index.html` est le fichier à éditer.

`tools/fill.py` a servi à la génération initiale : il reconstruit `index.html` depuis
`tools/index.template.html` avec les textes extraits du site publié. **Le relancer écrase
toute modification faite directement dans `index.html`.**

## Vérification

`tools/compare.py` capture le site publié et la recréation dans Chrome headless, dans les
mêmes conditions (heure figée, vidéos à 0 s), puis compare la position de chaque texte et
de chaque image, et les pixels par bandes de 100 px.

```bash
python3 tools/compare.py 1440,800,375 --shots --threshold 8 --tol 0.2
```

Résultat au 14/09/2026 : hauteurs et positions identiques à 1440, 1280, 1100, 1024, 800,
600, 414 et 375 px ; aucun écart de pixel à 1440. À 800, une vignette du sommaire diffère
parce que le site publié réutilise une image déjà en cache (course de chargement du
navigateur) ; à 375, bruit de 0,1 % sur l'ombre de la carte.

## Comportements repris tels quels de l'original

- Les boutons « Prologue », « Chapitres » et « Aujourd'hui » ont un survol mais pas d'action au clic.
- L'horloge affiche l'heure UTC+2 en décalage fixe (pas d'heure d'hiver), et sa couleur suit le
  thème clair/sombre du système, comme sur Figma.

## Écarts volontaires avec l'original

- **Titre du héros en mobile** : sur le site Figma, entre 380 et 800 px, le titre se tasse à
  côté de la carte (une lettre par ligne sur iPhone 390/414). Ici il prend toute la largeur,
  comme sur la maquette mobile à 375 px (identique au pixel à cette largeur).
- **Vidéos** : mises en pause quand elles sont hors écran, pour ne pas alourdir le défilement.
- Images décodées en asynchrone (`decoding="async"`), sans effet sur le rendu.

## Publication

```bash
python3 tools/dist.py
```

Produit `dist/` (et `dist.zip`) : `index.html`, `css/`, `js/`, `robots.txt`, `sitemap.xml` et
les seuls fichiers de `assets/` cités par la page, soit environ 46 Mo. C'est ce dossier qu'on met
en ligne, à la racine de https://www.aframe.erwanguillou.me/ (adresse inscrite dans les
métadonnées de partage, `robots.txt` et `sitemap.xml`). Relancer le script après chaque retouche
de `index.html`, de la CSS ou du JS.

## Polices

GT Kotoheim Mono, Chillon et Mortega sont des fontes commerciales, auto-hébergées dans
`assets/fonts` ; licence web confirmée par Erwan le 14/09/2026. Poppins est sous licence OFL.
