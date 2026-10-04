# Spawnite examples

Spawnite is a game platform built for coding agents. Your agent writes the game in TypeScript and React on the Spawnite engine, then runs it headless, steps it, screenshots it and tests it from the command line, with no browser window. You publish the game to players on the web, the phone and the desktop. Multiplayer is built in: a game with more than one player runs in a server-authoritative room, and a single-player game needs none.

This repository holds the platform's games as projects you can copy, one folder each. Every release of the `@spawnite` packages writes them again, so they match the packages you install. The files `spawnite add` writes, one folder per template, are in [spawnite/templates](https://github.com/spawnite/templates).

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

Each folder is what `spawnite create my-game --template <folder>` writes:

| Folder           | What it holds                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `example`        | A lobby, then a run through three coins to a goal ring                                                  |
| `sled`           | A sled launched from a slingshot, down a snowy track to the finish gate                                 |
| `mmorpg`         | An avatar in an open meadow, with a bag of items and a save                                             |
| `hack-and-slash` | Bladebound: a 2D hack and slash where a hero you dress hunts monsters, levels up and spends stat points |
| `depthfield`     | A survivor arena: hold three minutes against the swarm on an angled neon field, then beat the boss      |
| `arena`          | Players in one room, monsters that chase them and coins to race for                                     |
| `holdfast`       | Co-op wave survival: hold the stone circle against the Hollow, one wave and one upgrade card at a time  |

`sled`, `mmorpg`, `depthfield`, `arena` and `holdfast` also import files from the platform's asset kit, which is not on npm, so their imports of it do not resolve after an install: read and copy from them rather than install them. `arena` and `holdfast` play in a room, which runs only on Spawnite.

Each release replaces every folder here whole, so a change made to them in this repository does not last.

## Links

- [Wiki](https://create.spawnite.com): how the engine works, and how to build a game with your agent.
- [Marketplace](https://spawnite.com): the published games, to play in the browser.

## License

The code in this repository is MIT-0, as [LICENSE](LICENSE) says: copy it, change it and ship it, with no credit asked. The `@spawnite` packages that the projects install from npm have a licence of their own: the Spawnite License 1.0.

The files under each game's `public/assets` are outside that grant. Each keeps its own licence, which `packages/assets/SOURCES.md` in the Spawnite engine's repository, daniel-zarinski/game-platform, records; daniel-zarinski/game-platform#1663 fills the rows it is missing.
