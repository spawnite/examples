# Classes and skills

This page describes how Bladebound's classes work: the base class, the two job changes, the hybrid a pair of jobs makes, and the skill trees. It also shows how to add a class, a skill or a skill's look, with the class editor or by hand. [stats.md](stats.md) lists each tree's numbers.

## How a hero gets her class

Every hero starts as an **Adventurer**. She holds any weapon, one at a time, with a shield in her off hand. Each level past the first gives her a skill point, and the points save up until she has a tree to spend them in.

Instructor Vale, the class trainer by the road in from the south of town, teaches the jobs:

1. At level 10 she takes her **first job**, Swordsman or Bowgunner, and its tree opens.
2. At level 20 she takes a **second job**, any job but her first, and its tree opens beside the first.
3. When a class file names her two jobs as a pair, she becomes that **hybrid** and its tree opens too: a Swordsman and a Bowgunner make a Duelist. Without such a file she goes by both jobs' names, joined by a slash.

Changing either job is free, at any time, at the trainer. A job she leaves gives back every point spent in its tree, and in the hybrid it made. The trainer also unlearns every skill for free.

She wears any weapon whatever her job, but each skill works with one weapon kind, or with any. A sword skill does nothing for a crossbow shot, and a crossbow's skill cannot be cast with a sword in hand.

### Weapons in both hands

A second weapon in her off hand takes a skill:

| Skill          | Tree      | What she may hold       |
| -------------- | --------- | ----------------------- |
| Twin Blades    | Swordsman | A sword in each hand    |
| Twin Crossbows | Bowgunner | A crossbow in each hand |
| Mixed Arms     | Duelist   | A sword and a crossbow  |

With a weapon in each hand, each weapon gives 60% of its stats: its damage, attribute bonuses, health, bolt stats and effects. Two of a kind strike in turn, 1.25 times as often. With Mixed Arms she slashes the nearest monster within a sword's reach (2.1 m past her middle, the monster's body counted), and otherwise shoots toward the pointer. Each attack uses the numbers of its own weapon: a slash uses her sword skills, and a bolt her crossbow skills.

An off-hand weapon she has no skill to hold goes back to her bag when she changes job. A save from before the jobs does the same on its first load.

## Where the data lives

Each class is one JSON file in [src/classes/](../src/classes/), named for its id: `swordsman.json` is the class `swordsman`. The game reads every file there as it starts. The following modules work with the files:

| File                                      | What it does                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [schema.ts](../src/classes/schema.ts)     | Declares a class file's fields and checks each file, naming the file, the field and what it must be |
| [catalog.ts](../src/classes/catalog.ts)   | Loads the files, lays the class editor's unsaved changes over them, and holds `jobRules`            |
| [describe.ts](../src/classes/describe.ts) | Writes a skill's text from its numbers                                                              |
| [save.ts](../src/classes/save.ts)         | Writes a class back in its file's shape, for the editor                                             |
| [classFiles.mts](../classFiles.mts)       | The dev server's route that saves and removes a class file                                          |

`jobRules` in `catalog.ts` holds the numbers a creator tunes for every class: the level of each job change (10 and 20), the skill points each level gives (1), and each weapon's share with one in each hand (0.6).

A file with a mistake does not stop the game. The game skips it, writes what is wrong to the console, and the class editor shows the same lines in red.

## A class file

| Field         | What it is                                                    | When left out         |
| ------------- | ------------------------------------------------------------- | --------------------- |
| `name`        | The name the trainer and the skills window show               | Required              |
| `kind`        | `job`, taken at the trainer, or `hybrid`, which two jobs make | `job`                 |
| `weapon`      | The weapon its skills work with, unless a skill names another | Required              |
| `pair`        | A hybrid's two jobs, by id, in any order                      | Required for a hybrid |
| `description` | One line on what the class is                                 | Empty                 |
| `color`       | Its tree's colour                                             | Gold                  |
| `skills`      | Its tree's skills                                             | No skills             |

## A skill

| Field                     | What it is                                                                                     | When left out      |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ------------------ |
| `id`                      | Unique across every class. A save keeps her ranks by it, so a saved skill keeps its id         | Required           |
| `name`, `description`     | Its name, and one line on what it is. Its numbers are written from its fields                  | Required, empty    |
| `sign`, `color`           | Its picture: one of the signs in `skillSigns`, in a colour                                     | `star`, gold       |
| `row`, `column`           | Its place in the tree, from the top left                                                       | Required           |
| `ranks`                   | How many times she can learn it                                                                | 1                  |
| `weapon`                  | `sword`, `crossbow` or `any`                                                                   | Its class's weapon |
| `needsPoints`             | Points she must have spent in its tree first                                                   | 0                  |
| `needsSkill`, `needsRank` | A skill of the same tree she must know first, and its rank. The tree draws a line between them | None, 1            |
| `modifiers`               | What each rank raises: `{ "stat": "damage", "perRank": 5 }`                                    | None               |
| `unlocks`                 | What knowing it lets her do: `dualWield` or `mixedArms`                                        | None               |
| `active`                  | What casting it from the paw does. A skill with none is always on                              | None               |
| `cue`                     | Her move and its effects as she casts it                                                       | None               |

A modifier's `stat` is one of the names in `modifierStats`. Damage, attack speed, move speed, stamina recovery and leech are per cent of what she has. Critical rate and critical damage are points added to hers. Max HP, defense, stamina, poison, burn, the bolt stats and the five attributes are flat amounts.

### What casting a skill does

| Field                      | What it is                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `action`                   | `area` hits everything in a shape; `volley` looses a fan of bolts                                               |
| `cooldown`, `stamina`      | Seconds before it can be cast again, and the stamina it takes                                                   |
| `damage`, `damagePerRank`  | The share of her attack each hit deals at rank 1, and how much more each rank after                             |
| `shape`, `reach`, `spread` | An area: a `circle` round her or a `cone` ahead of her, its reach in metres, and a cone's half-width in degrees |
| `count`, `fan`             | A volley: its bolts, and the degrees between each two                                                           |

A cast aims as her attack does: toward the pointer, or at the nearest monster for a tap.

### A skill's cue

| Field     | What it is                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------- |
| `move`    | Her move: `slash`, `parry`, `aim` (her crossbow raised) or `none`                                    |
| `element` | The motes that burst over what the cast covers: `fire`, `moss`, `shadow`, `venom`, `grave` or `none` |
| `arcs`    | Sword arcs drawn round her as it goes off                                                            |
| `shake`   | How hard the camera shakes, from 0 to about 0.3                                                      |

## Adding a class or a skill

The class editor is the quickest way. It changes the classes in the running game, so each change plays at once.

1. Run the game on the dev server and open the GM tools (G).
2. Press **Class editor**.
3. Pick a class, or press **+ Job** or **+ Hybrid** to make one.
4. Press **+ Skill**, or pick a skill in the tree, and change its fields.
5. For a skill she casts, press **Cast it now** to see its move and effects on her, whether or not she knows it.
6. Press **Save** to write `src/classes/<id>.json`.

A class with unsaved changes shows a dot after its name. **Discard changes** puts the saved file back, and **Copy JSON** copies the file's text, which is how a built copy of the game, with no dev server, hands it over.

To add a class by hand, write a new file in `src/classes/` in the shape of [swordsman.json](../src/classes/swordsman.json). The dev server picks it up as you save it.

## What takes code

A class, a skill, its numbers, its place, its cue and a hybrid are all data. A new kind of each of the following takes code, and each has one list in `schema.ts` that the editor offers as it stands:

| A new…                 | Its list                                           | Where it works                                                          |
| ---------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| Stat a modifier raises | `modifierStats`                                    | `computeHero` in [progress.ts](../src/hero/progress.ts)                 |
| Unlock                 | `unlockTexts`                                      | `offHandOf` and `holdsBeside` in `progress.ts`                          |
| Action                 | `actionKinds`, with its fields in `ActiveDef`      | `castSkills` in [systems.ts](../src/combat/systems.ts)                  |
| Move                   | `cueMoves`                                         | `move` and `poseCrossbow` in [HeroModel.tsx](../src/hero/HeroModel.tsx) |
| Element                | `elements` in [kinds.ts](../src/monsters/kinds.ts) | Its recipe in [motes.ts](../src/combat/motes.ts)                        |
| Sign                   | `skillSigns`                                       | `signShapes` in [pictures.ts](../src/hud/pictures.ts)                   |
