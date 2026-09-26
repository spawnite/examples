# Spawnite examples

Spawnite is a game platform built for coding agents. Your agent writes the game in TypeScript and React on the Spawnite engine, then runs it headless, steps it, screenshots it and tests it from the command line, with no browser window. You publish the game to players on the web, the phone and the desktop. Multiplayer is built in: a game with more than one player runs in a server-authoritative room, and a single-player game needs none.

This repository holds projects you can copy: the example game, and each template the scaffold tools write. Every release of the `@spawnite` packages regenerates them, so they match the packages you install.

## Install

The packages reach npm with their first release; until then, the following commands find nothing to install.

To start a game from the example, run the following:

```sh
npx @spawnite/cli create my-game --template example
cd my-game
pnpm install
pnpm dev
```

To add the engine to a project you already have, run the following:

```sh
pnpm add @spawnite/engine
```

The engine needs React, React Three Fiber and a few other peers beside it. [Install](https://create.spawnite.com/learn/install/#install-the-packages-from-npm) lists them.

## What this repository holds

Each folder is exactly what a command of the `game` CLI writes:

| Folder                | What it holds                                             | Written by                               |
| --------------------- | --------------------------------------------------------- | ---------------------------------------- |
| `games/example`       | The example game: a lobby, then a run through three coins | `game create my-game --template example` |
| `templates/behaviour` | A behaviour and its wiki page stub                        | `game add behaviour`                     |
| `templates/entity`    | An entity and its wiki page stub                          | `game add entity`                        |
| `templates/scene`     | A scene and its wiki page stub                            | `game add scene`                         |
| `templates/panel`     | A devtools panel and its wiki page stub                   | `game add panel`                         |
| `templates/shader`    | A shader material and its wiki page stub                  | `game add shader`                        |
| `templates/map`       | A blank map                                               | `game add map feature`                   |

The templates keep `Feature` as their placeholder. Inside your project, `pnpm exec game add entity Crate` writes the entity with `Feature` renamed to `Crate`, and `feature` to `crate`.

Each release replaces `games/` and `templates/` whole, so a change made to them here does not last.

## Links

- [Wiki](https://create.spawnite.com): how the engine works, and how to build a game with your agent.
- [Marketplace](https://spawnite.com): the published games, to play in the browser.

## License

The code in this repository is MIT, as [LICENSE](LICENSE) says: copy it, change it and ship it. The `@spawnite` packages that the projects install from npm have a licence of their own: PolyForm Shield 1.0.0, with two added permissions.
