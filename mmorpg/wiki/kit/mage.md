The mage is a kit: source the game owns under `src/mage/`, copied from the [combat design](https://github.com/daniel-zarinski/game-platform/blob/main/apps/wiki/src/content/docs/internal/planning/combat.md) and changed here. The engine judges each cast; the kit says what the mage casts and how it looks.

## What the kit holds

The kit holds the following files:

- `abilities.ts` registers the three spells and mana on the world, and each spell's cast clip for every avatar.
- `MageKit.tsx` mounts the kit in a scene: the targeting, each spell's look as a `SpellLook` composed from the engine's parts, and the crescent wand fixed in her hand from the first second. Each spell's charge plays at the wand's orb from the press, through `SpellLook`'s `charge`, which the engine draws from her `CastingTrait`, which her page starts on the press: the bolt's runes, and the lance's `SpellSwirl`. The lance flies as a `SpellSpear`; the nova is a `SpellRing` racing out to 6 m, `SpellRunes` on the ground and `SpellShards` standing up round her, under `area`. The wand's `forward` is its y, pommel to orb, so the engine's hand turn points the orb at the wolf as each spell releases.
- `CrescentWand.tsx` draws the wand: its crescent lit for the bloom, brighter while a charge plays, and a glowing orb.
- `CrystalBolt.tsx` is the bolt drawn in flight: a bright core, three orbiting runes and a trail of crystal shards, with the engine's `createGlowMaterial`.

## The spells

The crescent wand grants Arcane Bolt while she wears it, on key 1 and the bar's large button. She holds the other two as a mage, on keys 2 and 3, whatever she wears. Each cast time is where its Meshy clip releases: the bolt's hands meet, the lance's body turns into a throw, the nova's arms stand highest, before the hands come down. No cooldown runs past 5 s. Moonbeam, the chain, left the kit for a lightning caster to come; the engine keeps the chain kind and its strike events.

| Spell         | Cast  | Cooldown | Mana | What it does                                                          |
| ------------- | ----- | -------- | ---- | --------------------------------------------------------------------- |
| Arcane Bolt   | 0.6 s | none     | 0    | 20 to 26 to the target, a homing bolt                                 |
| Crystal Lance | 0.8 s | 5 s      | 20   | 60 to 75 to the target, a crystal spear at 22 m/s                     |
| Frost Nova    | 1.4 s | 5 s      | 25   | 25 to 30 to every wolf within 6 m of her, each slowed by half for 3 s |

Every hit scales by `spellPower` and crits 5% of the time for 1.5. The global cooldown after any release is 1 s. Arcane Bolt in detail:

| Setting    | Value                                             |
| ---------- | ------------------------------------------------- |
| Cast       | 0.6 s, rooted: a move or a jump cancels it        |
| Cooldown   | none, and the 1 s global cooldown after a release |
| Mana       | 0                                                 |
| Range      | 25 m                                              |
| Damage     | 20 to 26, scaled by `spellPower`, 5% crit for 1.5 |
| Projectile | 14 m/s, homing at 540 degrees a second            |

A wolf has 60 health, so it takes three bolts, or two with crits, or one Crystal Lance.

## Casting

A press of 1 to 3, or a tap on the bar's slot, casts at the target `<Targeting />` chose, or, for Frost Nova, round her with no target: the nearest hostile within 8 m and 60 degrees of her facing, or the one she clicked or picked with Tab. The bar is the engine's [`AbilityBar`](https://github.com/daniel-zarinski/game-platform/blob/main/apps/wiki/src/content/docs/engine/ui/action-bar.md), mounted in the meadow with Arcane Bolt as its primary and the three spells in key order, so a spell keeps its key while the wand is off. The press plays the cast clip and starts the charge at once, which the engine's `useCast` predicts. When the step refuses the cast, both stop, and the reason shows above the bar, such as "Not ready yet" or "Out of range". A press the page already knows the step refuses, during a cooldown or a running cast, plays nothing and still shows the reason.

## The HUD

The HUD shows the following:

- The action bar, bottom right, with Arcane Bolt on the large button at its centre and each slot's cooldown. A slot answers as its key or the pointer goes down. While a cast winds up, its rim fills gold from the press and the other slots dim. A slot's icon tints red while the target stands beyond its range, and blue, with the cost, while she cannot pay the mana.
- The bag up the right edge, clear of the action bar.
- The target's frame at the top: its name and health.
- Her mana under the health bar over her head.
- Each hit's damage over its target: white, and larger and gold with a `!` on a crit.
