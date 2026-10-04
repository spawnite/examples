# Stats

Every stat in Bladebound, for reference: what raises it and what it does. The numbers are the game's as of 27 September 2026. Update this page when a stat is added or retuned.

## Attributes

Her five attributes. Each starts at 5, and a level up gives 5 points to spend in the character window (C). Gear can add to them.

| Attribute | Short | What it raises                                      |
| --------- | ----- | --------------------------------------------------- |
| Strength  | STR   | Sword damage: +1.5 per hit per point                |
| Dexterity | DEX   | Crossbow damage: +1.5 per bolt per point            |
| Vitality  | VIT   | Max HP: +10 per point                               |
| Agility   | AGI   | Attack speed +3% and move speed +1% per point       |
| Critical  | CRI   | Critical rate +1% and critical damage +3% per point |

## Combat numbers

Worked out from her attributes, her level and her gear. The character window shows them.

| Stat             | How it is worked out                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attack           | Sword: (6 + 1.5 × STR + weapon damage) × 1.43 per swing. Crossbow: 5 + 1.5 × DEX + weapon damage per bolt. With a weapon in each hand, the weapon damage is 60% of each weapon's. Then × (1 + her skills' damage %) for that weapon       |
| Defense          | The sum of her gear's armor. Each hit she takes is reduced by it, never below 1                                                                                                                                                           |
| Max HP           | 50 + 10 × VIT + 5 × level + gear's health                                                                                                                                                                                                 |
| Critical rate    | 5% + 1% × CRI, at most 60%                                                                                                                                                                                                                |
| Critical damage  | 150% + 3% × CRI                                                                                                                                                                                                                           |
| Attack speed     | Sword 1.4, crossbow 1.6 attacks a second, 1.25 times as many with two of a kind, × (1 + 3% × AGI) × (1 + gear's frenzy %) × (1 + her skills' attack speed % for that weapon); past 4 a second each gain counts for less, toward at most 8 |
| Move speed       | 3.6 m/s × (1 + 1% × AGI); past 6 m/s each gain counts for less, toward at most 9                                                                                                                                                          |
| Stamina          | 90 + gear's stamina. A dodge takes 30, so 90 holds three dodges                                                                                                                                                                           |
| Stamina recovery | 20 a second × (1 + gear's stamina recovery %). It recovers only while she isn't dodging or spinning                                                                                                                                       |
| Poison           | Gear's poison, summed: each hit poisons the monster for that much a second over 4 s                                                                                                                                                       |
| Burn             | Gear's burn, summed: each hit burns the monster for that much a second over 2 s                                                                                                                                                           |
| Leech            | Gear's leech %, summed: she heals that share of the damage she deals                                                                                                                                                                      |

## Weapons and hands

- **Main hand:** a sword or a crossbow.
- **Off hand:** a shield, or a second weapon once she knows the skill for it: a second sword with Twin Blades, a second crossbow with Twin Crossbows, or one of each with Mixed Arms ([classes.md](classes.md)). The shield slot in the bag is the off hand; a weapon's tooltip has Main hand and Off-hand, and names the skill an off hand needs. Changing the main hand so the off-hand weapon no longer fits puts that weapon back in the bag.
- **Two weapons:** each weapon gives 60% of its stats: damage, attribute bonuses, health, bolt stats and effects, attributes rounded. Two of a kind strike with each hand in turn, 1.25 times as often. With a sword and a crossbow she slashes the nearest monster within 2.1 m (its body counted) and otherwise shoots, each attack with its own weapon's numbers.
- **Crossbows:** one-handed. A bolt flies 20 m a second for 11 m, then drops. Its stats:

| Bolt stat | What it does                                                                                                              | Most that counts |
| --------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Pierce    | Passes through that many more monsters                                                                                    | 6                |
| Multishot | That many more bolts each shot, fanned 8° apart                                                                           | 6                |
| Ricochet  | After its last monster, bounces on to the nearest other within 7 m that many times, keeping 80% of its damage each bounce | 6                |

## Rarity

Rarity is rolled when an item drops. Every item has a least rarity, shown in the item table below, and can drop at that rarity or better. A higher rarity multiplies the item's stats and rolls extra bonus stats on top of its own, each on a random attribute.

| Rarity    | Colour | Stats × (against common) | Extra bonus stats | Chance from a monster      | Chance from a boss |
| --------- | ------ | ------------------------ | ----------------- | -------------------------- | ------------------ |
| Common    | White  | 1                        | 0                 | 62% stay at the item's own | 40%                |
| Uncommon  | Green  | 1.15                     | 1                 | 25% one tier up            | 35%                |
| Rare      | Blue   | 1.3                      | 2                 | 9% two tiers up            | 15%                |
| Epic      | Purple | 1.5                      | 3                 | 3% three tiers up          | 7%                 |
| Legendary | Orange | 1.8                      | 4                 | 1% four tiers up           | 3%                 |

- **Multiplier:** it is measured against the item's own rarity. An uncommon Katana dropping as legendary has 1.8 ÷ 1.15 of its stats.
- **Extra bonus stats:** each one is worth 1–2 plus the rarity's tier. A tier above the item's own adds one; the item's own bonuses stay.
- **Unique items:** these will come later, with built-in skills or special effects.

## Merging at the smith

Brom the smith merges two copies of the same item. He keeps the better copy (by rarity, then merges) and uses up the least carried copy. There is no cap.

|                | Rule                                                                                                                                                                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Result         | +1 past the more merged of the two, with the kept copy's rarity and bonus stats, and the effects of whichever copy has more                                                                                                                                                                         |
| Stats          | Each merge multiplies every stat again, by 15% at +1, then 15% ÷ √(merge number): +10 ≈ 2.1×, +20 ≈ 3×, +30 ≈ 4×                                                                                                                                                                                    |
| Main stat      | A weapon's damage or a piece's armor gains at least +1 per merge                                                                                                                                                                                                                                    |
| Chance         | 95% at +0, 4% less per merge, never below 10%. A failed merge still takes the gold and the spare copy; the kept piece stays as it was                                                                                                                                                               |
| Cost           | Base × (1 + current merges)^1.5, base by rarity: common 40, uncommon 100, rare 250, epic 500, legendary 1,000 gold                                                                                                                                                                                  |
| Glow and motes | From +7 the piece glows pale blue on her; from its first effect, at +10, it gives off its effects' motes instead (embers for a burn, green droplets for poison, a red drift for leech, gold flecks for frenzy, a pale blue wind for the Cyclone). In the bag it glows in its latest effect's colour |
| Effects        | Every tenth merge (+10, +20…) rolls one effect, stronger each tier (tier = merges ÷ 10)                                                                                                                                                                                                             |

| Effect                      | Value per tier                | What it does                                                                                                                                                                                               |
| --------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Poison                      | 15–30                         | Poisons for that much a second over 4 s                                                                                                                                                                    |
| Burn                        | 35–60                         | Burns for that much a second over 2 s                                                                                                                                                                      |
| Leech                       | 2–4%                          | Heals that share of the damage she deals                                                                                                                                                                   |
| Frenzy                      | 5–10%                         | Attack speed                                                                                                                                                                                               |
| Pierce, Multishot, Ricochet | +1 (+1 more every third tier) | A crossbow only, adding to its bolt stats                                                                                                                                                                  |
| Cyclone (skill)             | —                             | Once per item. She spins, hitting everything within 2.3 m four times a second for 60% of her attack, as long as her stamina lasts (45 a second, at least 15 to start). Uses all her stamina; 15 s cooldown |

## Item stats

What a piece of gear or a potion can carry (`src/items/items.ts`).

| Item stat        | What it does                       | On today's items                                                       |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| Damage           | Added to each hit of a weapon      | Weapons                                                                |
| Armor            | Added to Defense                   | Shields, helmets, armor                                                |
| Health           | Added to Max HP                    | Some armor                                                             |
| Attribute bonus  | Added to STR, DEX, VIT, AGI or CRI | Uncommon and rare gear, and every rarity above an item's own           |
| Stamina          | Added to Stamina                   | Rare only: Berserker Boots +30, Cat-Ear Headset +15, Scout's Boots +15 |
| Stamina recovery | Per cent faster stamina comes back | None yet; kept for future items                                        |
| Heal             | HP a potion restores               | Red Potion, 50                                                         |

## Every item

Stats at the item's own rarity, before merges. A new hero starts with the Basic Sword, the Wooden Buckler and the beginner's armor (the Knight's Plate, Gauntlets and Greaves), with a Light Crossbow, a Leather Cap, three Red Potions and a Cat-Ear Headset in her bag.

| Item                | Least rarity | Slot   | Stats                                 |
| ------------------- | ------------ | ------ | ------------------------------------- |
| Red Potion          | common       | potion | heals 50                              |
| Basic Sword         | common       | weapon | —                                     |
| Katana              | uncommon     | weapon | +5 damage                             |
| Moss Sword          | uncommon     | weapon | +7 damage, +15 HP, +1 VIT             |
| Ember Sword         | rare         | weapon | +10 damage, +3 STR                    |
| Light Crossbow      | common       | weapon | —                                     |
| Hunter's Crossbow   | uncommon     | weapon | +5 damage, pierce 1                   |
| Ember Crossbow      | rare         | weapon | +10 damage, +1 bolt, +3 DEX           |
| Wooden Buckler      | common       | shield | +1 armor, +10 HP                      |
| Iron Kite Shield    | uncommon     | shield | +3 armor, +25 HP, +1 VIT              |
| Cat-Ear Headset     | rare         | head   | +1 armor, +2 AGI, +2 CRI, +15 stamina |
| Leather Cap         | common       | head   | +1 armor, +10 HP                      |
| Iron Helm           | uncommon     | head   | +2 armor, +20 HP, +1 VIT              |
| Feathered Hat       | uncommon     | head   | +2 DEX, +2 AGI                        |
| Arcane Robes        | uncommon     | body   | +1 armor, +25 HP, +2 AGI              |
| Arcane Gloves       | uncommon     | hands  | +2 DEX, +1 AGI                        |
| Arcane Boots        | uncommon     | feet   | +3 AGI                                |
| Battle Mage Coat    | uncommon     | body   | +2 armor, +15 HP, +2 DEX, +1 AGI      |
| Battle Mage Gloves  | uncommon     | hands  | +1 armor, +2 DEX, +1 CRI              |
| Battle Mage Boots   | uncommon     | feet   | +1 armor, +2 AGI                      |
| Berserker Harness   | rare         | body   | +2 armor, +20 HP, +3 STR              |
| Berserker Gauntlets | rare         | hands  | +1 armor, +2 STR, +2 CRI              |
| Berserker Boots     | rare         | feet   | +1 armor, +1 STR, +2 AGI, +30 stamina |
| Ranger's Tunic      | uncommon     | body   | +1 armor, +15 HP, +2 DEX, +1 AGI      |
| Ranger's Bracers    | uncommon     | hands  | +2 DEX, +1 CRI                        |
| Ranger's Boots      | uncommon     | feet   | +1 armor, +2 AGI                      |
| Scout's Jacket      | rare         | body   | +2 armor, +20 HP, +3 AGI, +1 DEX      |
| Scout's Bracers     | rare         | hands  | +1 armor, +2 DEX, +2 CRI              |
| Scout's Boots       | rare         | feet   | +1 armor, +3 AGI, +15 stamina         |
| Knight's Plate      | common       | body   | +2 armor, +15 HP                      |
| Knight's Gauntlets  | common       | hands  | +1 armor                              |
| Knight's Greaves    | common       | feet   | +1 armor, +5 HP                       |

## Trading

|                     | Price                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Buy at Mira's store | Red Potion 25 gold                                                                                                                   |
| Sell to Mira        | A potion 8 gold. Gear by its rarity: common 10, uncommon 30, rare 80, epic 200, legendary 500, and half as much again for each merge |

## Levels

- **Experience to the next level:** 20 × level^1.5, rounded (level 1 → 20, level 5 → 224, level 10 → 632).
- **Each level up:** 5 attribute points, 1 skill point and +5 max HP. Skill points save up until her first job.
- **A defeat:** costs 10% of the current level's experience, never going below zero.

## Monsters

| Monster                     | Level | Health | Damage | XP    | Where                                                        |
| --------------------------- | ----- | ------ | ------ | ----- | ------------------------------------------------------------ |
| Moss Slime                  | 1     | 24     | 6      | 6     | East, West and North-west moss, beside the arrival (passive) |
| Ember Slime                 | 3     | 60     | 11     | 16    | The ember patch and the ember rise, north of the meadow      |
| Moss King (boss)            | 5     | 420    | 14     | 120   | Wakes in either moss after 12 kills                          |
| Ember Tyrant (boss)         | 9     | 1,100  | 22     | 320   | Wakes in the ember patch after 10 kills                      |
| Dusk Bat                    | 10    | 380    | 26     | 40    | Dusk hollow, down the east path                              |
| Cave Skitter                | 12    | 620    | 32     | 58    | Skitter hollow, past the bats                                |
| Dusk Monarch (boss, shadow) | 12    | 3,200  | 34     | 700   | Wakes in the dusk hollow after 10 kills                      |
| Brood Queen (boss, venom)   | 14    | 4,500  | 40     | 950   | Wakes in the skitter hollow after 10 kills                   |
| Barrow Husk                 | 16    | 1,150  | 44     | 105   | The barrow, down the west path                               |
| Barrow King (boss, grave)   | 18    | 8,000  | 55     | 1,600 | Wakes in the barrow after 12 kills                           |
| Ash Brute                   | 20    | 2,000  | 60     | 170   | Ashen flats, up the north path                               |
| Ash Warlord (boss, fire)    | 24    | 16,000 | 80     | 2,600 | Wakes on the ashen flats after 10 kills                      |

## Monster stats

Each monster kind has these (`src/monsters/kinds.ts`).

| Stat        | What it does                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Level       | Shown on its nameplate                                                                          |
| Health      | Hits it takes to fall                                                                           |
| Speed       | Metres a second it chases at                                                                    |
| Damage      | What a touch takes from her, at most once a second (less her Defense)                           |
| XP          | Experience it gives when it falls                                                               |
| Aggro range | Metres at which an aggressive monster notices her. A passive one fights only once hit           |
| Boss damage | A boss's area attacks deal damage per second while she stands in them, and its dash deals a hit |

## Jobs and skill trees

She takes a first job at level 10 and a second at level 20, from Instructor Vale in town; a pair of jobs with a hybrid file makes that hybrid. Each skill works with its weapon only. [classes.md](classes.md) says how the classes work and how to add one; the files in `src/classes` hold every number below.

| Tree      | Skill              | Ranks | Needs                 | Each rank, or what it does                                                                            |
| --------- | ------------------ | ----- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| Swordsman | Keen Edge          | 5     | —                     | +5% sword damage                                                                                      |
| Swordsman | Swift Strikes      | 5     | —                     | +4% sword attack speed                                                                                |
| Swordsman | Whirlwind (cast)   | 3     | Keen Edge             | 150% of her attack, +25% a rank past the first, to everything within 2.8 m; 8 s cooldown, 20 stamina  |
| Swordsman | Twin Blades        | 1     | 3 points in Swordsman | A sword in each hand                                                                                  |
| Bowgunner | Steady Aim         | 5     | —                     | +5% crossbow damage                                                                                   |
| Bowgunner | Quick Reload       | 5     | —                     | +4% crossbow attack speed                                                                             |
| Bowgunner | Bolt Volley (cast) | 3     | Steady Aim            | 7 bolts fanned 9° apart, each 80% of her attack, +15% a rank past the first; 8 s cooldown, 20 stamina |
| Bowgunner | Twin Crossbows     | 1     | 3 points in Bowgunner | A crossbow in each hand                                                                               |
| Duelist   | Mixed Arms         | 1     | —                     | A sword and a crossbow together                                                                       |
| Duelist   | Quickdraw          | 3     | Mixed Arms            | +5% attack speed, any weapon                                                                          |
| Duelist   | Fencer's Eye       | 3     | Mixed Arms            | +3% critical rate, any weapon                                                                         |
