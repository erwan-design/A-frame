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

- L'horloge affiche l'heure UTC+2 en décalage fixe (pas d'heure d'hiver), et sa couleur suit le
  thème clair/sombre du système, comme sur Figma.

## Écarts volontaires avec l'original

- **Navigation** : « Prologue », « Chapitres » et « Aujourd'hui » mènent au prologue, au sommaire et
  au journal (sans action sur le site Figma).

- **En-tête en diptyque** (variante B du fichier Figma « Tests », page Test 04) : le récit à gauche
  sur le vert du site (surtitre, titre, introduction, chiffres en cases, bouton « Commencer le
  récit » en lien discret en bas du panneau), la photo à droite avec la navigation en haut et le lieu
  en bas à droite (horloge, carte, région, en colonne) ; la carte n'est en relief qu'au survol ;
  espacements verticaux proportionnels à la hauteur de l'écran ;
  sur grand écran le panneau de texte reste à 740 px (× facteur de texte) et la photo prend la
  place ; sous 1100 px, le récit vient d'abord et la photo en bandeau dessous ; 

- **Parallax sur la photo du héros** : pendant que l'en-tête sort de l'écran, elle descend moins vite
  que la page et s'approche (zoom jusqu'à 1,22×)
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
  Les cartes du journal ne s'inclinent plus au survol.
  Position identique à la maquette.
- **Écriture à la main** (`js/motion.js`) : la carte « Prochaine aventure à venir » du journal et les
  annotations manuscrites de la planche du chapitre 03 sont vides au départ, s'écrivent à l'arrivée à
  l'écran, puis se réécrivent au survol.
- **Heure locale du terrain** : à côté du logo, dans l'en-tête.
- **Carte de l'Oise en relief** (chapitre 01, à la place du badge « 1,45 ha de superficie », dont
  l'information passe dans la description) : à plat au repos ; au survol, elle se soulève, s'oriente vers la souris et reçoit un reflet.
- **Photos agrandissables** : au survol, les coins du compteur (« 01/06 ») se resserrent sur la
  photo, qui s'approche doucement ; une étiquette « Agrandir » remplace le curseur et le suit.
- **Cercles du badge « 1,45 ha »** (chapitre 01) : une onde se propage en continu depuis le centre ;
  à chaque quart de cycle, les anneaux sont exactement aux positions de la maquette.
- Tout le reste est désactivé si le système demande de réduire les animations ; sans JavaScript, le
  contenu reste visible (les vidéos ne se lancent alors pas).
- Images décodées en asynchrone (`decoding="async"`), sans effet sur le rendu.

## Prototype « défilement horizontal » (branche `prototype-horizontal`)

Sur les écrans d'au moins 1280 × 780 (MacBook 13" compris) (`js/horizontal.js`, fin de `css/style.css`) :

- héros, prologue et sommaire se lisent verticalement ; arrivé aux chapitres, l'écran se fige et
  la lecture part vers la droite ; après le chapitre 06, la page reprend verticalement ;
- chaque chapitre est une page de 900 px de haut composée dans Figma (fichier « Tests », page
  Test 04) : positions et tailles reprises dans `PAGES` (`js/horizontal.js`), la page entière étant
  mise à l'échelle de la hauteur de l'écran (`zoom`) ; les textes gardent les tailles de la version
  verticale et du reste du site (zoom inverse) ; la page grandit au plus de 1,25× : au-delà, elle
  reste centrée verticalement ; tout contenu non prévu est ajouté à droite ;
- molette et trackpad dans les deux sens, flèches ← → (un écran), sommaire, menu du repère et
  flèches ‹ › du repère (chapitre précédent / suivant) ;
- le repère garde la même largeur d'un chapitre à l'autre (titres et dates empilés, invisibles) ;
- le repère, les citations mot à mot et le zoom de la carte suivent l'axe horizontal ;
- sous 900 px de haut, la page rétrécit mais pas les textes : un bloc qui en chevaucherait un autre
  est descendu juste en dessous, une image poussée sous le bas est réduite ; en dessous de
  1280 × 780 : lecture verticale habituelle.

Vérification : `python3 tools/horizontal_check.py 1440 900`.

Photo de l'en-tête : `assets/img/hero-cabane-w*.avif` (IMG_3462.HEIC, 3024 × 4032, profil Display P3 conservé),
encodée en AVIF qualité 90 en 4:4:4 (sans sous-échantillonnage des couleurs) en 5 tailles, et
`hero-cabane.jpg` (1800 × 2400, qualité 92) en secours ; la photo « Ossature » reste au chapitre 03.

## Tailles de texte (harmonisées et fluides)

Un type de texte = une taille, sur tout le site. Les tailles ci-dessous sont celles d'un écran de
1440 × 900 ou moins ; au-delà, un facteur commun `--t` (calculé dans le `<head>`) les multiplie
toutes : il grandit de moitié moins vite que l'écran et plafonne à 1,25 (≈ 1,1 en 1920 × 1080,
1,24 en 3440 × 1340). Les largeurs maximales des sections (1440 px) et les marges latérales
suivent le même facteur, pour que les textes gardent la même mise en ligne.

| Type | Police | Taille / interligne |
|---|---|---|
| Titre principal (journal) | Chillon | 110 px (56 px sur mobile) |
| Titre de section (héros, prologue, chapitres) | Chillon | 86 px (héros 56 px, autres 42 px sur mobile) |
| Titre de niveau 3 (sommaire, pied de page) | Chillon | 36 px / 1,2 |
| Citation | Chillon | 30 px / 1,4 |
| Chapeau | Chillon | 24 px / 1,4 |
| Valeur (tableaux, chiffres) | Chillon | 18 px |
| Paragraphe (héros, prologue, chapitres, épilogue, journal, pied) | Poppins Light | 16 px / 1,6 |
| Petit texte (légendes, cartes du journal, crédit) | Poppins Light | 16 px / 1,4 |
| Label en capitales (dates, légendes, tableaux, horloge) | GT Kotoheim Mono | 14 px |
| Bouton | GT Kotoheim Mono | 12 px |

Écarts avec la maquette Figma d'origine : paragraphes du héros, du prologue et du journal
18 → 16, épilogue 18 → 16, citation du résultat 28 → 30, titre du pied de page 32 → 36, badge et
versions 16 → 14, horloge (police système 15 px) → GT Kotoheim Mono 14, interligne des légendes
1,2 → 1,4, crédit du pied de page Regular → Light.

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
