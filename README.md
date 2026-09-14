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
js/main.js        horloge, défilement lissé, clic sur une ligne du sommaire, lecture des vidéos
js/vendor/        Lenis (défilement lissé) et sa licence
js/motion.js      apparitions au défilement, aperçu des chapitres, inclinaison des cartes
js/horizontal.js  prototype « défilement horizontal » des chapitres (branche prototype-horizontal)
js/story.js       repère de chapitre, citations, carte → terrain, photos plein écran, son
js/ambience.js    ambiance sonore de forêt (Web Audio)
js/sketch.js      croquis de l'aménagement qui se dessine au survol
assets/img        photos, variantes srcset identiques à celles servies par Figma (AVIF/WebP)
assets/svg        pictogrammes, couleurs intégrées
assets/fonts      Chillon, Mortega, GT Kotoheim Mono, Poppins
assets/video      les 3 vidéos du récit
assets/data       traits du croquis (relevés sur l'image, voir js/sketch.js)
tools/            extraction depuis le site publié et outils de comparaison
```

## Modifier le site

`index.html` est le fichier à éditer.

Après toute modification de la CSS ou d'un fichier JS, lancer `python3 tools/version.py` :
il met à jour le numéro de version (`?v=…`) dans `index.html`. Sans lui, un navigateur peut
garder l'ancienne feuille de style en cache (c'est ce qui masquait le parallax).

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

Le site Figma a été dépublié le 14/09/2026 : `compare.py` ne peut plus s'y comparer, les
captures de référence restent dans `refs/` (non versionné).

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
- **Parallax sur la photo du héros** : elle défile à 50 % de la vitesse de la page
  (`animation-timeline`, calculé par le compositeur). Sans prise en charge (Firefox) ou avec
  « réduire les animations », la photo reste fixe comme sur l'original.
- **Vidéos** : mises en pause quand elles sont hors écran, pour ne pas alourdir le défilement.
- **Animations** (`js/motion.js`, fin de `css/style.css`) : apparitions au défilement (textes,
  titres, photos, filets, rayures), photos qui glissent dans leur cadre, aperçu des chapitres
  au curseur dans le sommaire, cartes du journal qui s'inclinent, pulsation du repère de la carte,
  horloge qui bat la seconde. L'état final de chaque apparition est celui de la maquette.
- **Défilement lissé** (Lenis, `js/vendor/lenis.min.js`, licence MIT) : avec une souris ou un
  trackpad, la position de défilement est interpolée à chaque image (les à-coups de la molette
  et de la Magic Mouse ne se voient plus). Le tactile garde le défilement natif.
- **Vidéos** : rien n'est téléchargé à l'ouverture (`preload="none"`) ; chaque vidéo se charge et
  se lance à l'approche de l'écran (600 px avant).
- **Récit** (`js/story.js`, section « Récit » de `css/style.css`) :
  - bouton « Commencer le récit » fixé en bas de l'écran à l'arrivée (style des boutons du menu),
    masqué dès qu'on défile ;
  - repère fixe en bas d'écran pendant les chapitres : numéro, titre, date, trait de progression,
    menu pour sauter d'un chapitre à l'autre ;
  - les trois citations s'éclairent mot à mot au défilement ;
  - sur la vue drone du chapitre 01, la carte de l'Oise zoome jusqu'à la cabane puis s'efface ;
  - clic sur une photo : plein écran avec légende, photo précédente / suivante de la même partie
    (flèches, clavier, balayage), Échap pour fermer ;
  - ambiance sonore de forêt (`js/ambience.js`, synthétisée avec Web Audio, aucun fichier audio) :
    ambiance calme : léger bruissement de feuilles, murmure de la rivière, oiseaux au loin ;
    coupée par défaut, icône son dans le repère.
  Avec « réduire les animations », citations et zoom de la carte sont désactivés ; le repère,
  le plein écran et le son restent. Positions et hauteurs de page inchangées (`tools/story_check.py`
  vérifie le comportement).
- **Croquis de l'aménagement** (chapitre 05, `js/sketch.js`) : affiché terminé ; au survol, il
  repart d'une page vierge et se redessine trait par trait (lignes de construction, structure,
  hachures), puis l'image d'origine reprend sa place. Sur écran tactile, il se dessine une fois en
  arrivant à l'écran. Les 629 traits de `assets/data/sketch-interieur.json` ont été relevés sur
  l'image (squelette + transformée de Hough).
- **Badge « Frame Oise »** (chapitre 04, fin de `js/motion.js`) : objet en relief (épaisseur,
  reflet), qui flotte et se tourne vers le curseur ; il n'a plus d'apparition au défilement.
  Position identique à la maquette.
- **Photos agrandissables** : au survol, les coins du compteur (« 01/06 ») se resserrent sur la
  photo, qui s'approche doucement ; une étiquette « Agrandir » remplace le curseur et le suit.
- **Cercles du badge « 1,45 ha »** (chapitre 01) : une onde se propage en continu depuis le centre ;
  à chaque quart de cycle, les anneaux sont exactement aux positions de la maquette.
- Tout le reste est désactivé si le système demande de réduire les animations ; sans JavaScript, le
  contenu reste visible (les vidéos ne se lancent alors pas).
- Images décodées en asynchrone (`decoding="async"`), sans effet sur le rendu.

## Prototype « défilement horizontal » (branche `prototype-horizontal`)

Sur les écrans d'au moins 1440 × 720 (`js/horizontal.js`, fin de `css/style.css`) :

- héros, prologue et sommaire se lisent verticalement ; arrivé aux chapitres, l'écran se fige et
  la lecture part vers la droite ; après le chapitre 06, la page reprend verticalement ;
- chaque chapitre est une page de 900 px de haut composée dans Figma (fichier « Tests », page
  Test 04) : positions et tailles reprises dans `PAGES` (`js/horizontal.js`), la page entière étant
  mise à l'échelle de la hauteur de l'écran (`zoom`) ; les textes courants et légendes gardent
  leur taille Figma (jamais agrandis), titres et citations grandissent de moitié moins que les
  photos ; tout contenu non prévu est ajouté à droite ;
- molette et trackpad dans les deux sens, flèches ← → (un écran), sommaire, menu du repère et
  flèches ‹ › du repère (chapitre précédent / suivant) ;
- le repère garde la même largeur d'un chapitre à l'autre (titres et dates empilés, invisibles) ;
- le repère, les citations mot à mot et le zoom de la carte suivent l'axe horizontal ;
- en dessous de 1440 × 720, la mise en page tablette empile les colonnes (panneaux réduits
  jusqu'à 36 %) : lecture verticale habituelle.

Vérification : `python3 tools/horizontal_check.py 1440 900`.

## Publication

Le site est déployé par **Cloudflare Workers Builds** (Worker `a-frame`), relié au dépôt
GitHub `erwan-design/A-frame` : **chaque push sur `main` redéploie le site** avec
`npx wrangler deploy`, sans commande de build.

- `wrangler.toml` publie le dépôt tel quel en fichiers statiques (`[assets] directory = "."`).
- `worker/index.js` ne s'exécute que pour `/assets/video/*` : les fichiers statiques de
  Cloudflare ignorent les requêtes `Range`, or Safari (iPhone) en a besoin pour lire une vidéo.
  Le Worker charge la vidéo une fois en mémoire et renvoie la tranche demandée (`206`).
  Tester localement : `npx wrangler dev` (attention, `wrangler dev` tronque les gros fichiers
  téléchargés en parallèle, même sans Worker : ce n'est pas le cas en production).
- `.assetsignore` exclut ce qui n'est pas le site : `.git`, `tools/`, `spec/`, README, config.
- Aucun fichier ne doit dépasser 25 Mo (limite Cloudflare) ; la plus grosse vidéo fait 12,6 Mo.

`python3 tools/dist.py` reste utile pour un envoi manuel : il produit `dist/` et `dist.zip`
avec seulement les fichiers cités par la page (~46 Mo).

## Polices

GT Kotoheim Mono, Chillon et Mortega sont des fontes commerciales, auto-hébergées dans
`assets/fonts` ; licence web confirmée par Erwan le 14/09/2026. Poppins est sous licence OFL.
