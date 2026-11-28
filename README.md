# omk_ui

The `omk_ui` FiveM resource of OMK, an open source FiveM suite written in TypeScript: the NUI kit (panels, forms, menus) that other resources call.

## Status

Version 0.2.0. The client and server scripts are in the repository, with the pure logic of the three sides (protocol, shared code, domain of the page, the client and the server), the page (Vue 3, built for the Chromium 103 of FiveM) and their tests. Verified in game on a development server (artifact 38435): see the limits below. There is no SDK for other resources yet (milestone 4); the demos of the `omk_ui demo` command show what the kit does.

## Server installation

`omk_ui/web/` and `omk_ui/dist/` are built, not versioned: do not copy `omk_ui/` from a clone of this repository as it is. Install from the release archive, or build first (see below).

1. Download `omk_ui-<version>.zip` from the releases of the repository.
2. Unzip it into the `resources/` folder of your server. The archive holds one `omk_ui/` folder, with `fxmanifest.lua`, `config.lua`, `client/`, `server/`, `dist/`, `web/`, `locales/`, `branding/`, `LICENSE` and `THIRD_PARTY.md`.
3. Keep the folder name `omk_ui`: it is the name of the resource. Under another name, the two JS scripts print "omk_ui refuses to start" and register nothing (the Lua config export is still registered).
4. The minimum server artifact is 38435, the one on which the OMK probe was run. On an older artifact the resource logs a warning and stays started.
5. Add `ensure omk_ui` to your `server.cfg`.
6. To update, replace everything except `config.lua`, `locales/overrides/` and `branding/`, which hold your own changes.

To build from a clone, run `npm run build` in Docker (see Commands): it writes `omk_ui/web/` (the page) and `omk_ui/dist/` (`client.js` and `server.js`). Copy the `omk_ui/` folder to `resources/` once it is built.

To build the archive yourself, run `npm run release` in Docker: it runs `check`, then writes `release/omk_ui-<version>.zip`. The `unzip` command must be installed: the release test reads the archive back with it (the `node:22` image has it).

## In game

The default key of the radial menu is F1. It is a key mapping: each player can change it in the key settings of GTA. The default only applies to players who never had the command (`+omk_ui_radial`): a later change of the default key does not move the key of existing players.

On a gamepad, the radial opens by holding View (control 0; Back is control 244, see the limits below). The kit reads this control directly; it is not a key mapping, so it cannot be reassigned in FiveM. The hold lasts `input.padHoldMs` (300 ms by default).

Conflicts with other resources:

- F1 already used by another resource: both commands fire. The player reassigns one of them, or you change the key of the other resource.
- Gamepad bindings on `PAD_DIGITALBUTTONANY`, in another resource, fire even while the kit has the focus and blocks the controls. The kit cannot stop them. As for F1, one of the two resources must change its binding.
- A menu on a long press of Back: the kit never reads or blocks Back (control 244, a different control from View, control 0, which opens the radial), but if your server already has a menu there, set `input.padHoldGesture = false`. Gamepad players then reach the radial through a key bound by hand.
- Another resource holds the NUI focus when the player opens the kit: the opening is refused. If it takes the focus while the kit is open, the kit pauses and keeps its state, then comes back when the focus is given back.

Voice (provisional limit). While the kit has the focus, a keyboard push-to-talk bound by a command (pma-voice and similar) does not fire. The test of the game's own push-to-talk was inconclusive, so by default the kit keeps it blocked (`omk_ui_ptt blocked`). The convar `omk_ui_ptt` is for development: `setr omk_ui_ptt reenabled` re-enables it, to try the voice. The first session in game could not judge the voice: a second player is needed to hear it. The limit stays in place until the session that judges it.

## Configuration

Settings are in `config.lua`, read at start by both scripts. An invalid value falls back to its default, with a warning in the console.

- `theme`: `accent` (`#RRGGBB`), `side` (`left`, `right`), `scale` (0.9 to 1.1), `font` (`sofiaSansSemiCondensed`, `archivoNarrow`), `logo` (a png or webp file name in `branding/`, 256 x 256 at most), `monogram` (1 or 2 characters, shown without a logo)
- `input`: `padHoldMs` (200 to 800), `padHoldGesture` (`true`, `false`), `vehicleSpeedLimit` (0 to 200 km/h, drivers only; the opening is refused above it), `cameraSkippedModes` (a list among 0, 1, 2 and 4)
- `trace.onStart`: in 0.3.0 this turns the trace on for no client, because the switch is sent when the resource starts, before the client script is loaded; use `omk_ui trace on <id>` (see Console commands). `ask` turns the trace on for the targeted player if everyone is traced

Convars, in `server.cfg`:

- `setr omk_ui_locale fr`: language of the page and of the console (`fr` or `en`; `en` if the language does not exist). Without the convar, the server console is in French, while the page and the key labels are in English: set it if you want both in the same language.
- `setr omk_ui_ptt blocked|reenabled`: development, see Voice. `blocked` by default.

Languages: to add one, drop `locales/<code>.json` next to `fr.json` and `en.json`. To change a few texts, put them in `locales/overrides/<code>.json`: they are merged over the language file. Keep `locales/overrides/` when you update.

## Console commands

The `omk_ui` command works from the server console without restriction. In game, it needs the `omk_ui.admin` ACE. Add this line to `server.cfg`:

```
add_ace group.admin omk_ui.admin allow
```

| Command | Effect |
|---|---|
| `omk_ui version` | versions of the kit, of the contract and of the artifact, with the minimum required |
| `omk_ui config` | summary of the effective configuration |
| `omk_ui trace on\|off [id\|all]` | switch the trace |
| `omk_ui debug <id>` | full state of the client and of the page of this player |
| `omk_ui owners <id>` | radial entries, panels, prompts and confirmations of each resource, with the quotas used |
| `omk_ui demo <id> <demo>` | open a demo for this player: `radial`, `list`, `long-list`, `form`, `confirm`, `keyboard`, `toasts`, `prompt` |
| `omk_ui intent <id> <intent> [n]` | send an intent `n` times (1 to 50, 1 by default) as if it came from the console |
| `omk_ui notify <id\|all> <tone> <text>` | test notification |
| `omk_ui close <id>` | close everything for this player, the radial menu included |
| `omk_ui ask <id> <question>` | show a confirmation to this player; the answer goes to the trace, so the trace must be on for this player |

Intents: `up`, `down`, `left`, `right`, `confirm`, `back`, `tabNext`, `tabPrev`, `radial`, `erase`, `space`, `submit`.

The trace is off by default: no client traffic. `trace on all` targets the players connected at that moment; a player who joins later is not covered, so use `trace on <id>` for them. `trace.onStart = true` in `config.lua` does not turn the trace on for any client in 0.3.0; use `omk_ui trace on <id>`. The demos register radial entries that stay until `omk_ui close` or a restart, so F1 has something to open. The demos use the same data as the preview (below).

For developers: the calls of the kit (exports, contract) are read in `preview/scenarios/`. `src/client/application/demos/` replays these scenarios in game with `omk_ui demo`. A guide to create a menu from scratch will come with the SDK (milestone 4).

## Layout

- `omk_ui/`: folder delivered to servers (`fxmanifest.lua`, `config.lua`, `client/` and `server/` for the Lua config exports, `locales/`, `branding/`; `web/` and `dist/` are produced by the build)
- `src/page`, `preview/`: the Vue page and its preview shell
- `src/protocol`: messages between the page and the scripts
- `src/shared`: code shared by the three sides (configuration, reports, rate limit, network events)
- `src/{page,client,server}/domain`: pure domain of each side
- `src/{client,server}/application`: use cases of the scripts, without any FiveM native
- `src/{client,server}/infrastructure`: adapters to the natives and exports of FiveM
- `src/{client,server}/main.ts`: entry points, the only place where adapters are built; esbuild bundles them into `omk_ui/dist/client.js` and `omk_ui/dist/server.js`
- `test/`: unit tests, one folder per source folder
- `tools/`: typecheck, fonts copy, size budgets, CSS guard, version check (`--write` copies the `package.json` version into the manifest), zip writer and release

## Commands

Node and npm are not required on the host. Run everything in Docker. npm needs `git` to fetch the OMK dependencies (tagged GitHub dependencies), so use the `node:22` image, which ships it. `--user` keeps `node_modules` owned by you instead of root:

```sh
docker run --rm --user $(id -u):$(id -g) -v "$PWD":/app -w /app -e HOME=/tmp node:22 sh -c 'npx -y npm@11.21.3 ci && npm run check'
```

`check` runs lint, typecheck, tests with a 95 % coverage threshold on the domain and application layers, the build (page and scripts), the size budgets, the CSS guard and the version check. `npm run release` runs `check`, then builds `release/omk_ui-<version>.zip`.

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

- `omk-core`, pinned to the `v0.2.0` tag (`@openmemorykit/core`).
- `omk-ui-sdk`, pinned to the `v0.2.0` tag (`@openmemorykit/ui`).

## License

MIT, see `LICENSE`. Third-party notices: `THIRD_PARTY.md`.

---

# omk_ui (français)

La ressource FiveM `omk_ui` d'OMK, une suite FiveM open source écrite en TypeScript : le kit NUI (panneaux, formulaires, menus) que les autres ressources appellent.

## État

Version 0.2.0. Les scripts client et serveur sont dans le dépôt, avec la logique pure des trois côtés (protocole, code partagé, domaine de la page, du client et du serveur), la page (Vue 3, construite pour le Chromium 103 de FiveM) et leurs tests. Vérifié en jeu sur un serveur de développement (artifact 38435) : voir les limites plus bas. Il n'y a pas encore de SDK pour les autres ressources (jalon 4) ; les démos de la commande `omk_ui demo` montrent ce que fait le kit.

## Installation sur un serveur

`omk_ui/web/` et `omk_ui/dist/` sont construits, pas versionnés : ne copie pas `omk_ui/` depuis un clone du dépôt tel quel. Installe depuis l'archive de livraison, ou construis d'abord (voir plus bas).

1. Télécharge `omk_ui-<version>.zip` dans les versions publiées du dépôt.
2. Décompresse-la dans le dossier `resources/` de ton serveur. L'archive contient un dossier `omk_ui/`, avec `fxmanifest.lua`, `config.lua`, `client/`, `server/`, `dist/`, `web/`, `locales/`, `branding/`, `LICENSE` et `THIRD_PARTY.md`.
3. Garde le nom de dossier `omk_ui` : c'est le nom de la ressource. Sous un autre nom, les deux scripts JS écrivent « omk_ui refuses to start » et n'enregistrent rien (l'export Lua de la configuration reste enregistré).
4. L'artifact serveur minimal est 38435, celui sur lequel la sonde d'OMK a tourné. Sur un artifact plus ancien, la ressource journalise un avertissement et reste démarrée.
5. Ajoute `ensure omk_ui` à ton `server.cfg`.
6. Pour mettre à jour, remplace tout sauf `config.lua`, `locales/overrides/` et `branding/`, qui portent tes changements.

Pour construire depuis un clone, lance `npm run build` dans Docker (voir Commandes) : il écrit `omk_ui/web/` (la page) et `omk_ui/dist/` (`client.js` et `server.js`). Copie le dossier `omk_ui/` dans `resources/` une fois construit.

Pour construire l'archive toi-même, lance `npm run release` dans Docker : il lance `check`, puis écrit `release/omk_ui-<version>.zip`. La commande `unzip` doit être installée : le test de livraison relit l'archive avec elle (l'image `node:22` l'a).

## En jeu

La touche par défaut du menu radial est F1. C'est une liaison de touche : chaque joueur peut la changer dans les réglages de touches de GTA. La valeur par défaut ne s'applique qu'aux joueurs qui n'ont encore jamais eu la commande (`+omk_ui_radial`) : un changement ultérieur de la touche par défaut ne déplace pas la touche des joueurs existants.

À la manette, le radial s'ouvre en maintenant View (contrôle 0 ; Back est le contrôle 244, voir les limites plus bas). Le kit lit ce contrôle directement ; ce n'est pas une liaison de touche, donc elle ne se réassigne pas dans FiveM. Le maintien dure `input.padHoldMs` (300 ms par défaut).

Conflits avec d'autres ressources :

- F1 déjà utilisé par une autre ressource : les deux commandes se déclenchent. Le joueur réassigne l'une des deux, ou tu changes la touche de l'autre ressource.
- Les liaisons manette sur `PAD_DIGITALBUTTONANY`, dans une autre ressource, se déclenchent même quand le kit a le focus et bloque les contrôles. Le kit ne peut pas les arrêter. Comme pour F1, l'une des deux ressources doit changer sa liaison.
- Un menu sur l'appui long de Back : le kit ne lit ni ne bloque jamais Back (contrôle 244, un autre contrôle que View, contrôle 0, qui ouvre le radial), mais si ton serveur a déjà un menu à cet endroit, mets `input.padHoldGesture = false`. Les joueurs manette passent alors par une touche liée à la main.
- Une autre ressource a le focus NUI quand le joueur ouvre le kit : l'ouverture est refusée. Si elle prend le focus pendant que le kit est ouvert, le kit se met en pause et garde son état, puis revient quand le focus est rendu.

Voix (limite provisoire). Tant que le kit a le focus, un push-to-talk au clavier lié par une commande (pma-voice et semblables) ne part pas. L'essai du push-to-talk du jeu lui-même n'a pas été concluant : par défaut, le kit le garde bloqué (`omk_ui_ptt blocked`). La convar `omk_ui_ptt` sert au développement : `setr omk_ui_ptt reenabled` le réactive, pour essayer la voix. La première session en jeu n'a pas pu juger la voix : il faut un second joueur pour l'entendre. La limite reste en place jusqu'à la session qui la jugera.

## Configuration

Les réglages sont dans `config.lua`, lu au démarrage par les deux scripts. Une valeur invalide revient à sa valeur par défaut, avec un avertissement dans la console.

- `theme` : `accent` (`#RRGGBB`), `side` (`left`, `right`), `scale` (0,9 à 1,1), `font` (`sofiaSansSemiCondensed`, `archivoNarrow`), `logo` (un nom de fichier png ou webp dans `branding/`, 256 x 256 au plus), `monogram` (1 ou 2 caractères, affiché sans logo)
- `input` : `padHoldMs` (200 à 800), `padHoldGesture` (`true`, `false`), `vehicleSpeedLimit` (0 à 200 km/h, conducteurs seulement ; l'ouverture est refusée au-delà), `cameraSkippedModes` (une liste parmi 0, 1, 2 et 4)
- `trace.onStart` : en 0.3.0, cette option n'active le journal d'aucun client, car l'activation part au démarrage de la ressource, avant le chargement du script client ; utilise `omk_ui trace on <id>` (voir Commandes console). `ask` active le journal du joueur visé si tout le monde est tracé

Convars, dans `server.cfg` :

- `setr omk_ui_locale fr` : langue de la page et de la console (`fr` ou `en` ; `en` si la langue n'existe pas). Sans la convar, la console du serveur est en français, alors que la page et les libellés de touches sont en anglais : pose-la si tu veux la même langue partout.
- `setr omk_ui_ptt blocked|reenabled` : développement, voir Voix. `blocked` par défaut.

Langues : pour en ajouter une, dépose `locales/<code>.json` à côté de `fr.json` et `en.json`. Pour changer quelques textes, mets-les dans `locales/overrides/<code>.json` : ils sont fusionnés par-dessus le fichier de langue. Conserve `locales/overrides/` à chaque mise à jour.

## Commandes console

La commande `omk_ui` marche depuis la console du serveur sans restriction. En jeu, elle demande l'ACE `omk_ui.admin`. Ajoute cette ligne à `server.cfg` :

```
add_ace group.admin omk_ui.admin allow
```

| Commande | Effet |
|---|---|
| `omk_ui version` | versions du kit, du contrat et de l'artifact, avec le minimum exigé |
| `omk_ui config` | résumé de la configuration effective |
| `omk_ui trace on\|off [id\|all]` | active ou coupe le journal |
| `omk_ui debug <id>` | état complet du client et de la page de ce joueur |
| `omk_ui owners <id>` | entrées radiales, panneaux, invites et confirmations de chaque ressource, avec les quotas consommés |
| `omk_ui demo <id> <démo>` | ouvre une démonstration chez ce joueur : `radial`, `list`, `long-list`, `form`, `confirm`, `keyboard`, `toasts`, `prompt` |
| `omk_ui intent <id> <intention> [n]` | envoie une intention `n` fois (1 à 50, 1 par défaut), comme si elle venait de la console |
| `omk_ui notify <id\|all> <ton> <texte>` | notification de test |
| `omk_ui close <id>` | ferme tout chez ce joueur, le menu radial compris |
| `omk_ui ask <id> <question>` | montre une confirmation à ce joueur ; la réponse part dans le journal, qui doit donc être actif pour ce joueur |

Intentions : `up`, `down`, `left`, `right`, `confirm`, `back`, `tabNext`, `tabPrev`, `radial`, `erase`, `space`, `submit`.

Le journal est coupé par défaut : aucun trafic client. `trace on all` vise les joueurs connectés à ce moment ; un joueur qui arrive ensuite n'est pas couvert, donc utilise `trace on <id>` pour lui. `trace.onStart = true` dans `config.lua` n'active le journal d'aucun client en 0.3.0 ; utilise `omk_ui trace on <id>`. Les démos enregistrent des entrées radiales qui restent jusqu'à `omk_ui close` ou un redémarrage, pour que F1 ait quelque chose à ouvrir. Elles utilisent les mêmes données que l'aperçu (plus bas).

Pour les développeurs : les appels du kit (exports, contrat) se lisent dans `preview/scenarios/`. `src/client/application/demos/` rejoue ces scénarios en jeu par `omk_ui demo`. Un guide pour créer un menu de zéro viendra avec le SDK (jalon 4).

## Arborescence

- `omk_ui/` : dossier livré aux serveurs (`fxmanifest.lua`, `config.lua`, `client/` et `server/` pour les exports de config en Lua, `locales/`, `branding/` ; `web/` et `dist/` sont produits par le build)
- `src/page`, `preview/` : la page Vue et sa coque d'aperçu
- `src/protocol` : messages entre la page et les scripts
- `src/shared` : code commun aux trois côtés (configuration, rapports, limitation de débit, évènements réseau)
- `src/{page,client,server}/domain` : domaine pur de chaque côté
- `src/{client,server}/application` : cas d'usage des scripts, sans aucune native FiveM
- `src/{client,server}/infrastructure` : adaptateurs vers les natives et les exports de FiveM
- `src/{client,server}/main.ts` : points d'entrée, seul endroit où les adaptateurs sont construits ; esbuild les assemble dans `omk_ui/dist/client.js` et `omk_ui/dist/server.js`
- `test/` : tests unitaires, un dossier par dossier source
- `tools/` : types, copie des polices, budgets de taille, garde CSS, contrôle de version (`--write` recopie la version de `package.json` dans le manifeste), écrivain zip et livraison

## Commandes

Node et npm ne sont pas nécessaires sur la machine hôte. Tout se lance dans Docker. npm a besoin de `git` pour récupérer les dépendances OMK (dépendances GitHub étiquetées), donc on utilise l'image `node:22`, qui l'inclut. `--user` laisse `node_modules` à ton utilisateur plutôt qu'à root :

```sh
docker run --rm --user $(id -u):$(id -g) -v "$PWD":/app -w /app -e HOME=/tmp node:22 sh -c 'npx -y npm@11.21.3 ci && npm run check'
```

`check` lance le lint, la vérification des types, les tests avec un seuil de couverture de 95 % sur les couches domaine et application, le build (page et scripts), les budgets de taille, la garde CSS et le contrôle de version. `npm run release` lance `check`, puis construit `release/omk_ui-<version>.zip`.

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

- `omk-core`, figé sur l'étiquette `v0.2.0` (`@openmemorykit/core`).
- `omk-ui-sdk`, figé sur l'étiquette `v0.2.0` (`@openmemorykit/ui`).

## Licence

MIT, voir `LICENSE`. Mentions des logiciels tiers : `THIRD_PARTY.md`.
