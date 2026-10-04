Roll is a behaviour: a child of an Entity that puts the roll machine on it. The machine, `RollMachine`, is declared with `states()`, so the dump, the devtools and the AI tree show the ball as `roll: resting` or `roll: pushed`.

| Prop | Type     | Default  | What it means                                   |
| ---- | -------- | -------- | ----------------------------------------------- |
| spot | Position | required | Where the ball rests, as its Entity's position. |

## Its states

| State     | What it means                               | Moves on                                                |
| --------- | ------------------------------------------- | ------------------------------------------------------- |
| `resting` | The ball stands on its spot.                | To `pushed` once its middle is 0.1 m off the spot.      |
| `pushed`  | The hero walked into it and it rolled away. | Stays there, as the ball keeps no way back to its spot. |

The machine moves with `when`: each step it tests the ball's transform against the spot in its context, so no system sends it an event. A system finds a pushed ball with `world.query(RollMachine.is.pushed)`.

## Where it runs

Client.

```tsx
import { Entity } from "@spawnite/engine";
import { Roll } from "../behaviours/Roll";

<Entity position={[0, 0.5, -8.5]}>
    <Roll spot={[0, 0.5, -8.5]} />
</Entity>;
```
