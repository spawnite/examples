The run is a timed round in the meadow. Three coins stand in a line ahead of the hero, and a tree stands beside the middle one. A ball rests on the same line past the last coin, and a spinning ring stands past the ball. The round lasts 20 seconds, and its target is the three coins.

The following table lists what stands in the run:

| Thing | What it does                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------- |
| Coin  | Spins, bobs, and adds 1 to the wallet of whoever reaches it, with a chime.                                                  |
| Ball  | Falls to the ground and rolls away when the hero walks into it. Its Roll behaviour says whether it still rests on its spot. |
| Tree  | Stops the hero at its bark and canopy, because its body is the hull of the `tree` model.                                    |
| Ring  | Spins to mark the end of the path. Reaching it ends nothing.                                                                |

The round is the engine's round machine, `RoundMachine`, in `playing` until every coin is collected before the clock runs out, which moves it to `won`, or the clock runs out, which moves it to `lost`. The round screen then shows the result. The camera follows the hero. The scene is `src/scenes/Run.tsx`.
