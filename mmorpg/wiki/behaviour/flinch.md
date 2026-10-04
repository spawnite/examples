Flinch is a behaviour: a child of an Entity that adds its trait. Its character plays a hit clip once on each hit it survives. The `flinchOnHit` system of the creatures plugin in `src/creatures.plugin.ts` runs it, and a hit that takes the character to 0 plays no flinch, so its death clip plays alone.

| Prop | Type   | Default  | What it means                                            |
| ---- | ------ | -------- | -------------------------------------------------------- |
| clip | string | required | The clip its model plays on a hit, as its file names it. |

## Where it runs

Server: the room, or the page's own step in a game played alone. The creatures plugin runs it after the engine's rules, and `src/game.ts` lists that plugin.

```tsx
import { Entity, Health } from "@spawnite/engine";
import { Flinch } from "../behaviours/Flinch";

<Entity model="wolf">
    <Health maximum={60} />
    <Flinch clip="hit-left" />
</Entity>;
```
