# Spawnite examples

This repository holds the Spawnite platform's own games, one project per folder, for you or your agent to read, copy and start from. Each release of the `@spawnite` packages rewrites every folder, so the code always matches the packages you install.

Spawnite is a game platform built for coding agents. Your agent writes the game in TypeScript and React on the Spawnite engine. It runs the game headless from the command line to step it, take screenshots and test it, with no browser window. You publish the game to players on the web, on phones and on desktops. Multiplayer is built in: a game for several players runs in a server-authoritative room, and a single-player game needs no room.

For the files that `spawnite add` writes into a game, one folder per item, see [spawnite/templates](https://github.com/spawnite/templates).

## Start a game

The `@spawnite` packages are not on npm yet. Until their first release, the following commands find nothing to install.

To start a new game from one of these folders, run the following commands:

```sh
npx @spawnite/cli create my-game --template example
cd my-game
pnpm install
pnpm dev
```

Replace `example` with any folder name from the table in the next section.

To add the engine to a project you already have, run the following command:

```sh
pnpm add @spawnite/engine
```

The engine also needs React, React Three Fiber and a few other peer packages. [Install the packages from npm](https://wiki.spawnite.com/learn/install/#install-the-packages-from-npm) lists them.

## The games

Each folder is the project that `spawnite create my-game --template <folder>` writes:

| Folder           | Game                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `example`        | A lobby, then a run through three coins to a goal ring.                                                     |
| `sled`           | A sled launched from a slingshot down a snowy track to the finish gate.                                     |
| `mmorpg`         | An avatar in an open meadow, with a bag of items and a save.                                                |
| `hack-and-slash` | Bladebound: a 2D hack and slash where a character you dress hunts monsters, levels up and spends stat points. |
| `depthfield`     | A survivor arena: last three minutes against the swarm on an angled neon field, then beat the boss.         |
| `arena`          | Players in one room, with monsters that chase them and coins to race for.                                   |
| `holdfast`       | Co-op wave survival: hold the stone circle against the Hollow, one wave and one upgrade card at a time.     |

Some games have limits outside Spawnite:

- `sled`, `mmorpg`, `depthfield`, `arena` and `holdfast` import files from the platform's asset kit, which is not on npm. Their imports of it don't resolve after an install, so read and copy from these games rather than install them.
- `arena` and `holdfast` play in a room, and rooms run only on Spawnite.

Don't send changes to the game folders here: the next release replaces every folder whole.

## Learn more

- [Wiki](https://wiki.spawnite.com): how the engine works, and how to build a game with your agent.
- [Spawnite](https://spawnite.com): the published games, to play in your browser.

## License

The code in this repository is under the MIT No Attribution License (MIT-0), as [LICENSE](LICENSE) says. You can copy it, change it and ship it, with no credit required.

The following files are outside that license:

- The files under each game's `public/assets` folder. Each file keeps its own license, which `packages/assets/SOURCES.md` in the Spawnite engine's repository, daniel-zarinski/game-platform, records. daniel-zarinski/game-platform#1663 tracks the rows it is missing.
- The `@spawnite` packages that each project installs from npm. They are under the Spawnite License 1.0.
