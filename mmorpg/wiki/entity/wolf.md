The wolves stand past the well on Mira's round, at (-8, -8), where she tells a player to mind them. `src/monsters/Wolves.tsx` places three, at (-12, -12), (-14.5, -9.5) and (-10, -14.5).

Each wolf is the asset library's Quaternius wolf (CC0) and has the following:

- 60 health, and `TargetableTrait` with the hostile faction, so every ability may strike it.
- A `DisplayName` of Wolf, which the target frame shows.
- `Flinch` with the clip `hit-left` on each hit it survives.
- The engine's `Respawn` with the clip `death`, held while it is down at 0 health, and a return at full health 20 s later.

Wolves do not move or fight back yet.
