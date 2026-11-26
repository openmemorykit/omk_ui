# omk_ui

The `omk_ui` FiveM resource of OMK, an open source FiveM suite written in TypeScript: the NUI kit (panels, forms, menus) that other resources call.

## Status

Version 0.1.0. Nothing is usable in game yet. The repository holds the pure logic of the three sides (protocol, shared code, domain of the page, the client and the server) and its tests. The page arrives at milestone 2, the client and server scripts at milestone 3. Until then, the delivered folder contains only its manifest.

## Server installation

1. Copy the `omk_ui/` folder of this repository into the `resources/` folder of your server.
2. Keep the folder name `omk_ui`: it is the name of the resource.
3. The minimum server artifact is 38435, the one on which the OMK probe was run.

Add `ensure omk_ui` to your `server.cfg` once the scripts exist (milestone 3). Today the resource only declares its manifest.

## Layout

- `omk_ui/`: folder delivered to servers (`fxmanifest.lua` today; the page and the scripts will be added to it)
- `src/protocol`: messages between the page and the scripts
- `src/shared`: code shared by the three sides (configuration, reports, rate limit)
- `src/{page,client,server}/domain`: pure domain of each side
- `test/`: unit tests, one folder per source folder
- `tools/`: typecheck script and check that the manifest version equals the one in `package.json`

## Commands

Node and npm are not required on the host. Run everything in Docker. npm needs `git` to fetch the OMK dependencies (tagged GitHub dependencies), so use the `node:22` image, which ships it. `--user` keeps `node_modules` owned by you instead of root:

```sh
docker run --rm --user $(id -u):$(id -g) -v "$PWD":/app -w /app -e HOME=/tmp node:22 sh -c 'npx -y npm@11.21.3 ci && npm run check'
```

`check` runs lint, typecheck, tests with a 95 % coverage threshold on the domain and application layers, and the version check.

## Dependencies on other OMK repositories

- `omk-core`, pinned to the `v0.1.0` tag (`@openmemorykit/core`).
- `omk-ui-sdk`, pinned to the `v0.1.0` tag (`@openmemorykit/ui`).

## License

MIT, see `LICENSE`. Third-party notices: `THIRD_PARTY.md`.

---

# omk_ui (français)

La ressource FiveM `omk_ui` d'OMK, une suite FiveM open source écrite en TypeScript : le kit NUI (panneaux, formulaires, menus) que les autres ressources appellent.

## État

Version 0.1.0. Rien n'est encore utilisable en jeu. Le dépôt contient la logique pure des trois côtés (protocole, code partagé, domaine de la page, du client et du serveur) et ses tests. La page arrive au jalon 2, les scripts client et serveur au jalon 3. D'ici là, le dossier livré ne contient que son manifeste.

## Installation sur un serveur

1. Copie le dossier `omk_ui/` de ce dépôt dans le dossier `resources/` de ton serveur.
2. Garde le nom de dossier `omk_ui` : c'est le nom de la ressource.
3. L'artifact serveur minimal est 38435, celui sur lequel la sonde d'OMK a tourné.

Ajoute `ensure omk_ui` à ton `server.cfg` quand les scripts existeront (jalon 3). Aujourd'hui, la ressource ne déclare que son manifeste.

## Arborescence

- `omk_ui/` : dossier livré aux serveurs (`fxmanifest.lua` aujourd'hui ; la page et les scripts y seront ajoutés)
- `src/protocol` : messages entre la page et les scripts
- `src/shared` : code commun aux trois côtés (configuration, rapports, limitation de débit)
- `src/{page,client,server}/domain` : domaine pur de chaque côté
- `test/` : tests unitaires, un dossier par dossier source
- `tools/` : script de vérification des types et contrôle que la version du manifeste égale celle de `package.json`

## Commandes

Node et npm ne sont pas nécessaires sur la machine hôte. Tout se lance dans Docker. npm a besoin de `git` pour récupérer les dépendances OMK (dépendances GitHub étiquetées), donc on utilise l'image `node:22`, qui l'inclut. `--user` laisse `node_modules` à ton utilisateur plutôt qu'à root :

```sh
docker run --rm --user $(id -u):$(id -g) -v "$PWD":/app -w /app -e HOME=/tmp node:22 sh -c 'npx -y npm@11.21.3 ci && npm run check'
```

`check` lance le lint, la vérification des types, les tests avec un seuil de couverture de 95 % sur les couches domaine et application, et le contrôle de version.

## Dépendances vers les autres dépôts OMK

- `omk-core`, figé sur l'étiquette `v0.1.0` (`@openmemorykit/core`).
- `omk-ui-sdk`, figé sur l'étiquette `v0.1.0` (`@openmemorykit/ui`).

## Licence

MIT, voir `LICENSE`. Mentions des logiciels tiers : `THIRD_PARTY.md`.
