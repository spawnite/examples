import { statNames, statTitles, type StatName } from "../hero/stats";
import { weaponKinds, type WeaponKind } from "../items/items";
import { elements, type Element } from "../monsters/kinds";

//  What a class file under src/classes holds, and the check that reads one.
//  A class is a job she takes at the trainer, or a hybrid two jobs make
//  together, and its skills are its tree. Classes are data: a new class or
//  skill is a new file or a new entry, written by hand or by the class
//  editor in the GM tools. Only a new kind of modifier, unlock, action,
//  move or sign needs code, and each has one list below to add it to.

export const classKinds = ["job", "hybrid"] as const;
export type ClassKind = (typeof classKinds)[number];

/** What a modifier can raise, as a skill's text names it, and whether its
 *  value is in per cent. Damage, the speeds, stamina recovery and leech are
 *  shares of what she has; critical rate and damage are points on theirs. */
export const modifierStats = {
    damage: { label: "damage", percent: true },
    attackSpeed: { label: "attack speed", percent: true },
    moveSpeed: { label: "move speed", percent: true },
    critChance: { label: "critical rate", percent: true },
    critDamage: { label: "critical damage", percent: true },
    maxHealth: { label: "max HP", percent: false },
    armor: { label: "defense", percent: false },
    maxStamina: { label: "stamina", percent: false },
    staminaRecovery: { label: "stamina recovery", percent: true },
    leech: { label: "leech", percent: true },
    poison: { label: "poison a second on hit", percent: false },
    burn: { label: "burn a second on hit", percent: false },
    pierce: { label: "pierce", percent: false },
    multishot: { label: "bolts each shot", percent: false },
    ricochet: { label: "ricochet", percent: false },
    ...(Object.fromEntries(
        statNames.map((stat) => [
            stat,
            { label: statTitles[stat], percent: false },
        ]),
    ) as Record<StatName, { label: string; percent: false }>),
} as const;
export type ModifierStat = keyof typeof modifierStats;
export const modifierStatNames = Object.keys(modifierStats) as ModifierStat[];

/** What knowing a skill lets her do, each worked by code, with what it
 *  says in the skill's text. */
export const unlockTexts = {
    dualWield:
        "Hold a second weapon of its kind in your off hand. Each weapon gives {share} of its stats.",
    mixedArms:
        "Hold a sword and a crossbow together: slash what is in reach, shoot what is past it. Each weapon gives {share} of its stats.",
} as const;
export type Unlock = keyof typeof unlockTexts;
export const unlockNames = Object.keys(unlockTexts) as Unlock[];

/** What a skill she casts does. An area hits everything in a shape round or
 *  ahead of her; a volley looses a fan of bolts. */
export const actionKinds = ["area", "volley"] as const;
export type ActionKind = (typeof actionKinds)[number];

/** An area's shape: a disc round her, or a wedge ahead of her. */
export const areaShapes = ["circle", "cone"] as const;
export type AreaShape = (typeof areaShapes)[number];

/** The move she makes as she casts: her slash, her parry, or her crossbow
 *  raised. */
export const cueMoves = ["none", "slash", "parry", "aim"] as const;
export type CueMove = (typeof cueMoves)[number];

/** The motes a cue bursts in: an element's colours, or none. */
export const cueElements = ["none", ...elements] as const;
export type CueElement = "none" | Element;

/** The signs a skill's picture can show, each drawn in `pictures.ts`. */
export const skillSigns = [
    "blade",
    "twinBlades",
    "whirl",
    "bolt",
    "twinBolts",
    "volley",
    "haste",
    "aim",
    "flame",
    "shield",
    "heart",
    "star",
] as const;
export type SkillSign = (typeof skillSigns)[number];

/** Which weapon a skill works with: one kind, or any. */
export type SkillWeapon = WeaponKind | "any";

/** A modifier: what it raises, and by how much each rank. */
export type Modifier = { stat: ModifierStat; perRank: number };

export type ActiveDef = {
    action: ActionKind;
    /** Seconds before she can cast it again, and the stamina it takes. */
    cooldown: number;
    stamina: number;
    /** The share of her attack each hit deals at its first rank, and how
     *  much more each rank past it. */
    damage: number;
    damagePerRank: number;
    /** An area's shape, its reach in metres, and a cone's half-width in
     *  degrees. */
    shape: AreaShape;
    reach: number;
    spread: number;
    /** A volley's bolts, and the degrees between each two. */
    count: number;
    fan: number;
};

export type CueDef = {
    move: CueMove;
    /** The element whose motes burst over what it covers. */
    element: CueElement;
    /** Sword arcs drawn round her as it goes off. */
    arcs: number;
    /** How hard the camera shakes, from 0 to about 0.3. */
    shake: number;
};

export type SkillDef = {
    /** Unique across every class: what her save and the paw keep. */
    id: string;
    name: string;
    /** What the skill is, in a line; its numbers are written from its
     *  modifiers, unlocks and action. */
    description: string;
    sign: SkillSign;
    color: string;
    /** Its place in the tree: the row from the top, and the column. */
    row: number;
    column: number;
    ranks: number;
    /** Points she must have spent in its class's tree before she can
     *  learn it. */
    needsPoints: number;
    /** A skill of the same tree she must know first, at `needsRank`; empty
     *  for none. */
    needsSkill: string;
    needsRank: number;
    weapon: SkillWeapon;
    modifiers: Modifier[];
    unlocks: Unlock[];
    /** What casting it does, for a skill she casts; null for a passive. */
    active: ActiveDef | null;
    /** How it looks as it is cast. */
    cue: CueDef | null;
};

export type ClassDef = {
    /** Its file's name, without `.json`. */
    id: string;
    name: string;
    kind: ClassKind;
    /** The weapon its skills work with unless one names another. */
    weapon: WeaponKind;
    /** A hybrid's two jobs, in any order; empty for a job. */
    pair: string[];
    description: string;
    /** Its tree's colour. */
    color: string;
    skills: SkillDef[];
};

/** The defaults a new active skill and its cue start from, and that a
 *  file may leave out. */
export const defaultActive: ActiveDef = {
    action: "area",
    cooldown: 8,
    stamina: 20,
    damage: 1.5,
    damagePerRank: 0.15,
    shape: "circle",
    reach: 2.6,
    spread: 60,
    count: 5,
    fan: 9,
};
export const defaultCue: CueDef = {
    move: "slash",
    element: "none",
    arcs: 0,
    shake: 0.08,
};

/** A class's id, a skill's id: a letter, then letters and digits, as a
 *  file name and a save key both take. */
export const idPattern = /^[a-z][a-zA-Z0-9]*$/;

/** What reading a class file gave: the class, or what was wrong with it. */
export type ReadClass =
    { def: ClassDef; errors: [] } | { def: null; errors: string[] };

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads the fields of one object of a class file, filling what it leaves
 *  out and noting each field that is wrong, by its path in the file. */
function fieldReader(path: string, raw: unknown, errors: string[]) {
    const fields: Fields = isFields(raw) ? raw : {};
    if (!isFields(raw)) errors.push(`${path} must be an object.`);
    const wrong = (key: string, should: string) =>
        errors.push(
            `${path}.${key} must be ${should}, not ${JSON.stringify(fields[key])}.`,
        );
    return {
        text(key: string, fallback?: string): string {
            const value = fields[key] ?? fallback;
            if (typeof value === "string") return value;
            wrong(key, "text");
            return "";
        },
        number(
            key: string,
            { least = -Infinity, most = Infinity, whole = false } = {},
            fallback?: number,
        ): number {
            const value = fields[key] ?? fallback;
            if (
                typeof value === "number" &&
                Number.isFinite(value) &&
                value >= least &&
                value <= most &&
                (!whole || Number.isInteger(value))
            )
                return value;
            wrong(
                key,
                `${whole ? "a whole number" : "a number"}${least > -Infinity ? ` from ${least}` : ""}${most < Infinity ? ` to ${most}` : ""}`,
            );
            return least > -Infinity ? least : 0;
        },
        oneOf<Option extends string>(
            key: string,
            options: readonly Option[],
            fallback?: Option,
        ): Option {
            const value = fields[key] ?? fallback;
            if (
                typeof value === "string" &&
                (options as readonly string[]).includes(value)
            )
                return value as Option;
            wrong(key, `one of ${options.join(", ")}`);
            return options[0];
        },
        list(key: string): unknown[] {
            const value = fields[key] ?? [];
            if (Array.isArray(value)) return value;
            wrong(key, "a list");
            return [];
        },
        record(key: string): unknown {
            return fields[key];
        },
    };
}

function readActive(path: string, raw: unknown, errors: string[]): ActiveDef {
    const field = fieldReader(path, raw, errors);
    const fallback = defaultActive;
    return {
        action: field.oneOf("action", actionKinds, fallback.action),
        cooldown: field.number(
            "cooldown",
            { least: 0, most: 600 },
            fallback.cooldown,
        ),
        stamina: field.number(
            "stamina",
            { least: 0, most: 1000 },
            fallback.stamina,
        ),
        damage: field.number(
            "damage",
            { least: 0, most: 100 },
            fallback.damage,
        ),
        damagePerRank: field.number(
            "damagePerRank",
            { least: 0, most: 100 },
            fallback.damagePerRank,
        ),
        shape: field.oneOf("shape", areaShapes, fallback.shape),
        reach: field.number("reach", { least: 0.5, most: 30 }, fallback.reach),
        spread: field.number(
            "spread",
            { least: 1, most: 180 },
            fallback.spread,
        ),
        count: field.number(
            "count",
            { least: 1, most: 30, whole: true },
            fallback.count,
        ),
        fan: field.number("fan", { least: 0, most: 60 }, fallback.fan),
    };
}

function readCue(path: string, raw: unknown, errors: string[]): CueDef {
    const field = fieldReader(path, raw, errors);
    return {
        move: field.oneOf("move", cueMoves, defaultCue.move),
        element: field.oneOf("element", cueElements, defaultCue.element),
        arcs: field.number(
            "arcs",
            { least: 0, most: 12, whole: true },
            defaultCue.arcs,
        ),
        shake: field.number("shake", { least: 0, most: 1 }, defaultCue.shake),
    };
}

function readSkill(
    path: string,
    raw: unknown,
    weapon: WeaponKind,
    errors: string[],
): SkillDef {
    const field = fieldReader(path, raw, errors);
    const id = field.text("id");
    if (id && !idPattern.test(id))
        errors.push(
            `${path}.id "${id}" must start with a lowercase letter and hold only letters and digits, such as "keenEdge".`,
        );
    const modifiers = field.list("modifiers").map((each, index) => {
        const modifier = fieldReader(
            `${path}.modifiers[${index}]`,
            each,
            errors,
        );
        return {
            stat: modifier.oneOf("stat", modifierStatNames),
            perRank: modifier.number("perRank", { least: -1000, most: 1000 }),
        };
    });
    const unlocks = field
        .list("unlocks")
        .filter((each, index): each is Unlock => {
            if (typeof each === "string" && each in unlockTexts) return true;
            errors.push(
                `${path}.unlocks[${index}] must be one of ${unlockNames.join(", ")}, not ${JSON.stringify(each)}.`,
            );
            return false;
        });
    const active = field.record("active");
    const cue = field.record("cue");
    return {
        id,
        name: field.text("name"),
        description: field.text("description", ""),
        sign: field.oneOf("sign", skillSigns, "star"),
        color: field.text("color", "#ffd24a"),
        row: field.number("row", { least: 0, most: 20, whole: true }),
        column: field.number("column", { least: 0, most: 5, whole: true }),
        ranks: field.number("ranks", { least: 1, most: 20, whole: true }, 1),
        needsPoints: field.number(
            "needsPoints",
            { least: 0, most: 200, whole: true },
            0,
        ),
        needsSkill: field.text("needsSkill", ""),
        needsRank: field.number(
            "needsRank",
            { least: 0, most: 20, whole: true },
            1,
        ),
        weapon: field.oneOf<SkillWeapon>(
            "weapon",
            [...weaponKinds, "any"],
            weapon,
        ),
        modifiers,
        unlocks,
        active:
            active === undefined || active === null
                ? null
                : readActive(`${path}.active`, active, errors),
        cue:
            cue === undefined || cue === null
                ? null
                : readCue(`${path}.cue`, cue, errors),
    };
}

/** Reads the class file `<id>.json`: the class, with every field it left
 *  out filled; or each thing wrong with it, saying where and what it
 *  must be. */
export function readClass(id: string, raw: unknown): ReadClass {
    const errors: string[] = [];
    const file = `${id}.json`;
    if (!idPattern.test(id))
        errors.push(
            `${file}: a class file's name must start with a lowercase letter and hold only letters and digits, such as "swordsman.json".`,
        );
    const field = fieldReader(file, raw, errors);
    const kind = field.oneOf("kind", classKinds, "job");
    const weapon = field.oneOf("weapon", weaponKinds);
    const pair = field.list("pair").map(String);
    if (kind === "hybrid" && pair.length !== 2)
        errors.push(
            `${file}.pair must name the two jobs a hybrid is made of, such as ["pyromancer", "swordsman"].`,
        );
    const skills = field
        .list("skills")
        .map((each, index) =>
            readSkill(`${file}.skills[${index}]`, each, weapon, errors),
        );
    const def: ClassDef = {
        id,
        name: field.text("name"),
        kind,
        weapon,
        pair: kind === "hybrid" ? pair : [],
        description: field.text("description", ""),
        color: field.text("color", "#ffd24a"),
        skills,
    };
    const ids = new Set<string>();
    for (const skill of skills) {
        if (ids.has(skill.id))
            errors.push(
                `${file}: two skills have the id "${skill.id}"; give each its own.`,
            );
        ids.add(skill.id);
    }
    for (const skill of skills)
        if (skill.needsSkill && !ids.has(skill.needsSkill))
            errors.push(
                `${file}: "${skill.id}" needs "${skill.needsSkill}", which is not a skill of this tree. Name one of ${[...ids].join(", ")}, or leave it empty.`,
            );
    return errors.length ? { def: null, errors } : { def, errors: [] };
}
