import { trait } from "koota";

/** The hero's side of a fight, which the attack system adds to her. */
export const HeroCombatTrait = trait({
    /** Seconds until she can attack again. */
    cooldown: 0,
    /** Seconds since her last attack, which her sprite swings by. */
    sinceAttack: 99,
    /** The way she last attacked, level with the ground. */
    dirX: 0,
    dirZ: -1,
    /** Seconds her hurt flash has left. */
    flash: 0,
    /** Seconds her dodge has left, its way, and the seconds until she can
     *  dodge again; and her stamina, which each dodge spends. */
    dodge: 0,
    dodgeX: 0,
    dodgeZ: 1,
    dodgeRest: 0,
    stamina: 90,
    /** Seconds her Cyclone has left to spin, the seconds until she can
     *  cast it again, and until its next round of hits. */
    spin: 0,
    spinCooldown: 0,
    spinTick: 0,
    /** The hand whose turn it is with a weapon in each: 0 her right. */
    hand: 0,
    /** Her last attack's weapon, as its place in `weaponKinds`, and the
     *  hand it was made with: 0 her right. */
    attackKind: 0,
    attackHand: 0,
    /** Seconds since she last cast a tree's skill, and the move its cue
     *  plays, as its place in `cueMoves`. */
    castAge: 99,
    castMove: 0,
});

/** A sword's arc, drawn for a moment where it was swung, at the height of
 *  her middle then. */
export const SlashTrait = trait({
    x: 0,
    y: 0,
    z: 0,
    dirX: 0,
    dirZ: -1,
    age: 0,
});

/** An arrow in flight, at the height of her middle as she loosed it. */
export const ArrowTrait = trait({
    x: 0,
    y: 0,
    z: 0,
    dirX: 0,
    dirZ: -1,
    age: 0,
    damage: 0,
    /** Monsters it may still pass through, and bounce on to; and the one
     *  it last struck, which it passes rather than strikes again. */
    pierce: 0,
    ricochet: 0,
    lastHit: -1,
});

export enum FloatKind {
    /** Damage the hero dealt. */
    Hit,
    /** Damage the hero took. */
    Hurt,
    /** Experience earned. */
    Xp,
    /** Health a potion gave back. */
    Heal,
    /** Gold or an item picked up, named by its text. */
    Loot,
    /** A monster turning on the hero: a red "!". */
    Alert,
    /** A critical hit the hero dealt. */
    Crit,
    /** Poison and a burn eating at a monster. */
    Poison,
    Burn,
}

/** A number or a word that rises and fades over where it happened. */
export const FloatTextTrait = trait({
    x: 0,
    y: 0,
    z: 0,
    amount: 0,
    /** Shown in place of the amount where set. */
    text: "",
    kind: FloatKind.Hit as FloatKind,
    age: 0,
});

/** A puff where a monster fell. */
export const BurstTrait = trait({ x: 0, y: 0, z: 0, size: 1, age: 0 });

export enum HazardShape {
    /** A disc `size` metres round (x, z). */
    Circle,
    /** A ring from `inner` to `size` metres round (x, z). */
    Ring,
    /** A wedge `size` metres long, `spread` radians either side of dir. */
    Cone,
    /** A bar `size` metres long from (x, z) along dir, `inner` wide. */
    Bar,
}

/** A boss's attack on the ground: drawn as it fills over `delay` seconds,
 *  then it goes off and hurts the hero if she still stands in it. */
export const HazardTrait = trait({
    shape: HazardShape.Circle as HazardShape,
    x: 0,
    y: 0,
    z: 0,
    dirX: 0,
    dirZ: 1,
    size: 1,
    inner: 0,
    spread: 0,
    delay: 1,
    age: 0,
    damage: 0,
    /** The spawn slot of the boss that cast it. */
    owner: -1,
    /** Flame, as the Ember Tyrant's are; else moss, as the Moss King's. */
    /** Its boss's element, as its place in `elements`. */
    element: 0,
    /** Whether it has gone off; it flashes a moment after. */
    fired: false,
});
