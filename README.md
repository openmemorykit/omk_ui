# omk_ui

The `omk_ui` FiveM resource of OMK, an open source FiveM suite written in TypeScript: the NUI kit (panels, forms, menus) that other resources call.

## Status

Version 0.1.0. Nothing is usable in game yet. The repository holds the pure logic of the three sides (protocol, shared code, domain of the page, the client and the server), the page (Vue 3, built for the Chromium 103 of FiveM) and their tests. The client and server scripts arrive at milestone 3.

## Server installation

The `web/` folder of `omk_ui/` is built, not versioned: do not copy `omk_ui/` from a clone of this repository. Install from the release archive.

1. Download `omk_ui-<version>.zip` from the releases of the repository.
2. Unzip it into the `resources/` folder of your server. The archive holds one `omk_ui/` folder, with `fxmanifest.lua`, `web/`, `locales/`, `branding/`, `LICENSE` and `THIRD_PARTY.md`.
3. Keep the folder name `omk_ui`: it is the name of the resource.
4. The minimum server artifact is 38435, the one on which the OMK probe was run.
5. To update, replace everything except `locales/overrides/` and `branding/`, which hold your own changes.

Add `ensure omk_ui` to your `server.cfg` once the scripts exist (milestone 3). Until then the resource ships its manifest and its page only.

To build the archive yourself, run `npm run release` in Docker (see Commands): it runs `check`, then writes `release/omk_ui-<version>.zip`.

## Layout

- `omk_ui/`: folder delivered to servers (`fxmanifest.lua`, `locales/`, `branding/`; `web/` is produced by the build)
- `src/page`, `preview/`: the Vue page and its preview shell
- `src/protocol`: messages between the page and the scripts
- `src/shared`: code shared by the three sides (configuration, reports, rate limit)
- `src/{page,client,server}/domain`: pure domain of each side
- `test/`: unit tests, one folder per source folder
- `tools/`: typecheck, fonts copy, size budgets, CSS guard, version check (`--write` copies the `package.json` version into the manifest), zip writer and release

## Commands

Node and npm are not required on the host. Run everything in Docker. npm needs `git` to fetch the OMK dependencies (tagged GitHub dependencies), so use the `node:22` image, which ships it. `--user` keeps `node_modules` owned by you instead of root:

```sh
docker run --rm --user $(id -u):$(id -g) -v "$PWD":/app -w /app -e HOME=/tmp node:22 sh -c 'npx -y npm@11.21.3 ci && npm run check'
```

`check` runs lint, typecheck, tests with a 95 % coverage threshold on the domain and application layers, the build, the size budgets, the CSS guard and the version check. `npm run release` runs `check`, then builds `release/omk_ui-<version>.zip`.

## Budgets

`node tools/sizes.mjs omk_ui/web` fails over any of these, measured on the build (1 Ko = 1000 bytes):

- JS: 170 Ko minified and 60 Ko gzip (level 9), summed over `assets/*.js`
- CSS: 30 Ko minified
- fonts: 2 families, 150 Ko in total, licences included
- no file containing `data-omk-preview` (the preview code never ships), no file of `assets/` containing `~standard` (valibot is not in the delivered page)

`node tools/css-guard.mjs omk_ui/web/assets` rejects what Chromium 103 lacks (`:has(`, `color-mix(`, `@container`, `dvh`/`svh`/`lvh`, lone `translate`/`rotate`/`scale`, trigonometric functions, `linear(`, `oklch(`/`oklab(`, `@starting-style`, `:modal`, native nesting, `text-wrap: balance`) and what the visual rule forbids (`backdrop-filter`, `blur(`, gradients).

## Preview and screenshots

The preview runs the page outside the game, on scripted scenarios. It is built apart (`.preview-dist/`) and never reaches `omk_ui/web`.

```sh
docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v "$PWD":/w -w /w -p 127.0.0.1:5173:5173 node:22 npm run dev:preview -- --host 0.0.0.0 --port 5173
```

Open `http://127.0.0.1:5173/?scenario=radial`. Screenshots (`test/captures/`, not versioned) come from Playwright 1.56.1 in Docker: build with `npm run build:preview` in `node:22`, then:

```sh
docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp --shm-size=1g -v <path of playwright-core 1.56.1>:/pw:ro -v "$PWD":/w -w /w mcr.microsoft.com/playwright:v1.56.1-noble node tools/capture.mjs
```

It writes one PNG per scenario, resolution and variant, plus `test/captures/report.json` (automatic checks of the screenshot page, failures listed per capture). `--only=<text>` keeps the captures whose name contains the text; the exit code is 1 when a capture fails.

## Dependencies on other OMK repositories

- `omk-core`, pinned to the `v0.1.0` tag (`@openmemorykit/core`).
- `omk-ui-sdk`, pinned to the `v0.1.0` tag (`@openmemorykit/ui`).

## License

MIT, see `LICENSE`. Third-party notices: `THIRD_PARTY.md`.

---

# omk_ui (français)

La ressource FiveM `omk_ui` d'OMK, une suite FiveM open source écrite en TypeScript : le kit NUI (panneaux, formulaires, menus) que les autres ressources appellent.

## État

Version 0.1.0. Rien n'est encore utilisable en jeu. Le dépôt contient la logique pure des trois côtés (protocole, code partagé, domaine de la page, du client et du serveur), la page (Vue 3, construite pour le Chromium 103 de FiveM) et leurs tests. Les scripts client et serveur arrivent au jalon 3.

## Installation sur un serveur

Le dossier `web/` de `omk_ui/` est construit, pas versionné : ne copie pas `omk_ui/` depuis un clone du dépôt. Installe depuis l'archive de livraison.

1. Télécharge `omk_ui-<version>.zip` dans les versions publiées du dépôt.
2. Décompresse-la dans le dossier `resources/` de ton serveur. L'archive contient un dossier `omk_ui/`, avec `fxmanifest.lua`, `web/`, `locales/`, `branding/`, `LICENSE` et `THIRD_PARTY.md`.
3. Garde le nom de dossier `omk_ui` : c'est le nom de la ressource.
4. L'artifact serveur minimal est 38435, celui sur lequel la sonde d'OMK a tourné.
5. Pour mettre à jour, remplace tout sauf `locales/overrides/` et `branding/`, qui portent tes changements.

Ajoute `ensure omk_ui` à ton `server.cfg` quand les scripts existeront (jalon 3). D'ici là, la ressource ne livre que son manifeste et sa page.

Pour construire l'archive toi-même, lance `npm run release` dans Docker (voir Commandes) : il lance `check`, puis écrit `release/omk_ui-<version>.zip`.

## Arborescence

- `omk_ui/` : dossier livré aux serveurs (`fxmanifest.lua`, `locales/`, `branding/` ; `web/` est produit par le build)
- `src/page`, `preview/` : la page Vue et sa coque d'aperçu
- `src/protocol` : messages entre la page et les scripts
- `src/shared` : code commun aux trois côtés (configuration, rapports, limitation de débit)
- `src/{page,client,server}/domain` : domaine pur de chaque côté
- `test/` : tests unitaires, un dossier par dossier source
- `tools/` : types, copie des polices, budgets de taille, garde CSS, contrôle de version (`--write` recopie la version de `package.json` dans le manifeste), écrivain zip et livraison

## Commandes

Node et npm ne sont pas nécessaires sur la machine hôte. Tout se lance dans Docker. npm a besoin de `git` pour récupérer les dépendances OMK (dépendances GitHub étiquetées), donc on utilise l'image `node:22`, qui l'inclut. `--user` laisse `node_modules` à ton utilisateur plutôt qu'à root :

```sh
docker run --rm --user $(id -u):$(id -g) -v "$PWD":/app -w /app -e HOME=/tmp node:22 sh -c 'npx -y npm@11.21.3 ci && npm run check'
```

`check` lance le lint, la vérification des types, les tests avec un seuil de couverture de 95 % sur les couches domaine et application, le build, les budgets de taille, la garde CSS et le contrôle de version. `npm run release` lance `check`, puis construit `release/omk_ui-<version>.zip`.

## Budgets

`node tools/sizes.mjs omk_ui/web` échoue au-delà de l'un de ces seuils, mesurés sur le build (1 Ko = 1000 octets) :

- JS : 170 Ko minifié et 60 Ko gzip (niveau 9), somme de `assets/*.js`
- CSS : 30 Ko minifié
- polices : 2 familles, 150 Ko en tout, licences comprises
- aucun fichier contenant `data-omk-preview` (le code d'aperçu n'est jamais livré), aucun fichier de `assets/` contenant `~standard` (valibot n'est pas dans la page livrée)

`node tools/css-guard.mjs omk_ui/web/assets` refuse ce qui manque à Chromium 103 (`:has(`, `color-mix(`, `@container`, `dvh`/`svh`/`lvh`, `translate`/`rotate`/`scale` seuls, fonctions trigonométriques, `linear(`, `oklch(`/`oklab(`, `@starting-style`, `:modal`, imbrication native, `text-wrap: balance`) et ce que la règle visuelle interdit (`backdrop-filter`, `blur(`, dégradés).

## Aperçu et captures

L'aperçu fait tourner la page hors du jeu, sur des scénarios écrits d'avance. Il est construit à part (`.preview-dist/`) et n'atteint jamais `omk_ui/web`.

```sh
docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v "$PWD":/w -w /w -p 127.0.0.1:5173:5173 node:22 npm run dev:preview -- --host 0.0.0.0 --port 5173
```

Ouvre `http://127.0.0.1:5173/?scenario=radial`. Les captures (`test/captures/`, non versionnées) viennent de Playwright 1.56.1 dans Docker : construis avec `npm run build:preview` dans `node:22`, puis :

```sh
docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp --shm-size=1g -v <chemin de playwright-core 1.56.1>:/pw:ro -v "$PWD":/w -w /w mcr.microsoft.com/playwright:v1.56.1-noble node tools/capture.mjs
```

Elle écrit un PNG par scénario, résolution et variante, plus `test/captures/report.json` (contrôles automatiques de la page, échecs listés par capture). `--only=<texte>` garde les captures dont le nom contient le texte ; le code de sortie vaut 1 si une capture échoue.

## Dépendances vers les autres dépôts OMK

- `omk-core`, figé sur l'étiquette `v0.1.0` (`@openmemorykit/core`).
- `omk-ui-sdk`, figé sur l'étiquette `v0.1.0` (`@openmemorykit/ui`).

## Licence

MIT, voir `LICENSE`. Mentions des logiciels tiers : `THIRD_PARTY.md`.
