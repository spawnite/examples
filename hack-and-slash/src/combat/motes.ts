import { elements, type Element } from "../monsters/kinds";
import { HazardShape } from "./traits";

//  The fight's motes: flame, sparks and smoke where the Ember Tyrant's
//  attacks go off, spores, earth and dust where the Moss King's do, and a
//  simmer of them over each attack as its warning fills. Kept in two pools
//  of plain numbers, one drawn glowing and one drawn solid, each a single
//  draw however many are flying; a full pool writes over its oldest. The
//  step and the views emit, and `Particles` moves and draws them.

/** One pool: each mote's place, speed, age and life, its size and colour
 *  from birth to death, and how gravity and the air take it. */
export type Pool = ReturnType<typeof makePool>;

function makePool(size: number) {
    const floats = () => new Float32Array(size);
    return {
        size,
        next: 0,
        x: floats(),
        y: floats(),
        z: floats(),
        vx: floats(),
        vy: floats(),
        vz: floats(),
        age: floats(),
        /** Seconds it lives; 0 for a free place. */
        life: floats(),
        sizeFrom: floats(),
        sizeTo: floats(),
        red: floats(),
        green: floats(),
        blue: floats(),
        redTo: floats(),
        greenTo: floats(),
        blueTo: floats(),
        alpha: floats(),
        /** Metres a second squared it falls, negative to rise. */
        gravity: floats(),
        /** The share of its speed the air takes a second. */
        drag: floats(),
    };
}

export const glowPool = makePool(1200);
export const solidPool = makePool(1800);

/** The share of the motes the graphics level draws. */
let share = 1;
export function setParticleShare(value: number) {
    share = value;
}

type Kind = {
    pool: Pool;
    life: [number, number];
    size: [number, number];
    from: [number, number, number];
    to: [number, number, number];
    alpha: number;
    gravity: number;
    drag: number;
};

//  Each kind of mote, its colours in the screen's own terms. Flame is
//  solid, so it reads as fire over bright grass, where added light only
//  whitens; its glowing core and sparks add the heat over it.
const flame: Kind = {
    pool: solidPool,
    life: [0.5, 0.95],
    size: [0.95, 0.3],
    from: [1, 0.55, 0.1],
    to: [0.85, 0.18, 0.03],
    alpha: 0.9,
    gravity: -3,
    drag: 1.6,
};
const core: Kind = {
    pool: glowPool,
    life: [0.3, 0.55],
    size: [0.6, 0.15],
    from: [1, 0.7, 0.25],
    to: [1, 0.3, 0.04],
    alpha: 0.5,
    gravity: -3.5,
    drag: 1.6,
};
const spark: Kind = {
    pool: glowPool,
    life: [0.6, 1.2],
    size: [0.13, 0.04],
    from: [1, 0.92, 0.55],
    to: [1, 0.35, 0.05],
    alpha: 1,
    gravity: 7,
    drag: 0.6,
};
const smoke: Kind = {
    pool: solidPool,
    life: [1, 1.6],
    size: [0.45, 1.3],
    from: [0.24, 0.2, 0.18],
    to: [0.35, 0.33, 0.32],
    alpha: 0.45,
    gravity: -0.8,
    drag: 1.2,
};
const spore: Kind = {
    pool: glowPool,
    life: [0.9, 1.8],
    size: [0.28, 0.08],
    from: [0.85, 1, 0.45],
    to: [0.45, 0.9, 0.2],
    alpha: 0.9,
    gravity: -0.6,
    drag: 0.8,
};
const leaf: Kind = {
    pool: solidPool,
    life: [0.8, 1.4],
    size: [0.3, 0.2],
    from: [0.18, 0.5, 0.1],
    to: [0.12, 0.32, 0.06],
    alpha: 1,
    gravity: 3,
    drag: 1.4,
};
const earth: Kind = {
    pool: solidPool,
    life: [0.7, 1.1],
    size: [0.2, 0.14],
    from: [0.32, 0.45, 0.16],
    to: [0.26, 0.2, 0.1],
    alpha: 1,
    gravity: 10,
    drag: 0.3,
};
const dust: Kind = {
    pool: solidPool,
    life: [0.7, 1.1],
    size: [0.5, 1.5],
    from: [0.55, 0.58, 0.4],
    to: [0.5, 0.52, 0.4],
    alpha: 0.4,
    gravity: 0,
    drag: 2.2,
};

//  The far bosses' elements. Shadow: purple wisps that glow and dark
//  shade that drifts up. Venom: sickly mist and green drops that fall.
//  Grave: pale bone chips and a ghostly glow, over dust.
const wisp: Kind = {
    pool: glowPool,
    life: [0.7, 1.3],
    size: [0.4, 0.1],
    from: [0.8, 0.5, 1],
    to: [0.4, 0.1, 0.7],
    alpha: 0.8,
    gravity: -1.5,
    drag: 1,
};
const shade: Kind = {
    pool: solidPool,
    life: [0.9, 1.5],
    size: [0.5, 1.2],
    from: [0.2, 0.1, 0.3],
    to: [0.3, 0.22, 0.38],
    alpha: 0.55,
    gravity: -0.9,
    drag: 1.2,
};
const mist: Kind = {
    pool: glowPool,
    life: [0.8, 1.5],
    size: [0.45, 0.15],
    from: [0.75, 1, 0.25],
    to: [0.35, 0.65, 0.1],
    alpha: 0.75,
    gravity: -0.7,
    drag: 1,
};
const drop: Kind = {
    pool: solidPool,
    life: [0.6, 1],
    size: [0.18, 0.1],
    from: [0.55, 0.85, 0.12],
    to: [0.3, 0.5, 0.08],
    alpha: 1,
    gravity: 9,
    drag: 0.4,
};
const bone: Kind = {
    pool: solidPool,
    life: [0.7, 1.1],
    size: [0.18, 0.12],
    from: [0.92, 0.9, 0.8],
    to: [0.7, 0.68, 0.6],
    alpha: 1,
    gravity: 10,
    drag: 0.3,
};
const gloom: Kind = {
    pool: glowPool,
    life: [0.8, 1.5],
    size: [0.4, 0.1],
    from: [0.6, 1, 0.9],
    to: [0.2, 0.5, 0.5],
    alpha: 0.7,
    gravity: -1.2,
    drag: 1,
};

/** What each element is made of: its burst as an attack goes off, each
 *  kind with its share and its speed out and up; what simmers on its
 *  warning; what a boss of it gathers as it winds up; and its wake. */
const recipes: Record<
    Element,
    {
        burst: [Kind, number, number, number][];
        simmer: [Kind, number, number][];
        gather: Kind[];
        trail: Kind[];
    }
> = {
    fire: {
        burst: [
            [flame, 0.5, 1.2, 3.6],
            [core, 0.2, 0.8, 3],
            [spark, 0.18, 3, 6],
            [smoke, 0.12, 0.6, 1.4],
        ],
        simmer: [
            [flame, 0.55, 1],
            [core, 0.25, 1],
            [spark, 0.2, 2.5],
        ],
        gather: [core, core, spark],
        trail: [flame, flame, core],
    },
    moss: {
        burst: [
            [leaf, 0.3, 2.2, 4],
            [spore, 0.3, 1.2, 2.4],
            [earth, 0.2, 2.5, 5],
            [dust, 0.2, 2.8, 0.3],
        ],
        simmer: [
            [spore, 0.7, 0.9],
            [leaf, 0.3, 0.9],
        ],
        gather: [spore],
        trail: [dust, earth],
    },
    shadow: {
        burst: [
            [wisp, 0.45, 1.6, 3.2],
            [shade, 0.35, 1, 1.6],
            [spark, 0.2, 2.5, 4],
        ],
        simmer: [
            [wisp, 0.6, 1],
            [shade, 0.4, 0.8],
        ],
        gather: [wisp, wisp, shade],
        trail: [shade, wisp],
    },
    venom: {
        burst: [
            [mist, 0.45, 1.4, 2.4],
            [drop, 0.35, 2.4, 5],
            [dust, 0.2, 2.4, 0.3],
        ],
        simmer: [
            [mist, 0.7, 0.8],
            [drop, 0.3, 1.8],
        ],
        gather: [mist, mist, drop],
        trail: [mist, drop],
    },
    grave: {
        burst: [
            [bone, 0.3, 2.6, 5],
            [gloom, 0.3, 1.2, 2.6],
            [dust, 0.25, 2.8, 0.3],
            [earth, 0.15, 2.4, 4],
        ],
        simmer: [
            [gloom, 0.6, 0.9],
            [dust, 0.4, 0.4],
        ],
        gather: [gloom, gloom, bone],
        trail: [dust, bone],
    },
};

/** One of `kinds` at random. */
const anyOf = <T>(kinds: readonly T[]) =>
    kinds[Math.floor(Math.random() * kinds.length)];

const between = ([low, high]: [number, number]) =>
    low + Math.random() * (high - low);

function emit(
    kind: Kind,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
) {
    const pool = kind.pool;
    const at = pool.next;
    pool.next = (at + 1) % pool.size;
    pool.x[at] = x;
    pool.y[at] = y;
    pool.z[at] = z;
    pool.vx[at] = vx;
    pool.vy[at] = vy;
    pool.vz[at] = vz;
    pool.age[at] = 0;
    pool.life[at] = between(kind.life);
    const grow = 0.75 + Math.random() * 0.5;
    pool.sizeFrom[at] = kind.size[0] * grow;
    pool.sizeTo[at] = kind.size[1] * grow;
    pool.red[at] = kind.from[0];
    pool.green[at] = kind.from[1];
    pool.blue[at] = kind.from[2];
    pool.redTo[at] = kind.to[0];
    pool.greenTo[at] = kind.to[1];
    pool.blueTo[at] = kind.to[2];
    pool.alpha[at] = kind.alpha;
    pool.gravity[at] = kind.gravity;
    pool.drag[at] = kind.drag;
}

/** How many of something to emit: `count` at the graphics level's share,
 *  a fraction kept as the chance of one more. */
function howMany(count: number) {
    const scaled = count * share;
    return Math.floor(scaled) + (Math.random() < scaled % 1 ? 1 : 0);
}

/** A way outward and up: `out` metres a second across, `up` upward. */
function scatter(out: number, up: number): [number, number, number] {
    const angle = Math.random() * Math.PI * 2;
    const speed = out * (0.4 + Math.random() * 0.6);
    return [
        Math.cos(angle) * speed,
        up * (0.5 + Math.random() * 0.5),
        Math.sin(angle) * speed,
    ];
}

type Area = {
    shape: HazardShape;
    x: number;
    y: number;
    z: number;
    dirX: number;
    dirZ: number;
    size: number;
    inner: number;
    spread: number;
    /** Its element, as its place in `elements`. */
    element: number;
};

const elementOf = (area: Area) => elements[area.element] ?? "moss";

/** Square metres an attack covers. */
function areaOf(area: Area) {
    switch (area.shape) {
        case HazardShape.Circle:
            return Math.PI * area.size ** 2;
        case HazardShape.Ring:
            return Math.PI * (area.size ** 2 - area.inner ** 2);
        case HazardShape.Cone:
            return area.spread * area.size ** 2;
        case HazardShape.Bar:
            return area.size * area.inner;
    }
}

//  Written in place by `pointIn`.
const point = { x: 0, z: 0 };

/** A point at random in the attack's shape, as far out as `reach` of it:
 *  its filled part, as the warning draws it. */
function pointIn(area: Area, reach: number) {
    const u = Math.random();
    const v = Math.random();
    switch (area.shape) {
        case HazardShape.Circle: {
            const r = area.size * reach * Math.sqrt(u);
            point.x = area.x + Math.cos(v * Math.PI * 2) * r;
            point.z = area.z + Math.sin(v * Math.PI * 2) * r;
            break;
        }
        case HazardShape.Ring: {
            const r = Math.sqrt(
                area.inner ** 2 + u * (area.size ** 2 - area.inner ** 2),
            );
            point.x = area.x + Math.cos(v * Math.PI * 2) * r;
            point.z = area.z + Math.sin(v * Math.PI * 2) * r;
            break;
        }
        case HazardShape.Cone: {
            const r = area.size * reach * Math.sqrt(u);
            const angle =
                Math.atan2(area.dirZ, area.dirX) + (v * 2 - 1) * area.spread;
            point.x = area.x + Math.cos(angle) * r;
            point.z = area.z + Math.sin(angle) * r;
            break;
        }
        case HazardShape.Bar: {
            const along = u * area.size * reach;
            const across = (v - 0.5) * area.inner;
            point.x = area.x + area.dirX * along - area.dirZ * across;
            point.z = area.z + area.dirZ * along + area.dirX * across;
            break;
        }
    }
    return point;
}

/** An attack going off: its whole shape erupts in its element. */
export function burstHazard(area: Area) {
    const count = Math.min(520, Math.max(30, areaOf(area) * 6));
    for (const [kind, part, out, up] of recipes[elementOf(area)].burst)
        for (let each = howMany(count * part); each > 0; each--) {
            const at = pointIn(area, 1);
            emit(kind, at.x, area.y + 0.1, at.z, ...scatter(out, up));
        }
}

/** An attack's warning, simmering over the part of it filled so far. */
export function simmerHazard(area: Area, filled: number, seconds: number) {
    const rate = Math.min(180, areaOf(area) * 2.6) * (0.3 + 0.7 * filled);
    const reach = area.shape === HazardShape.Ring ? 1 : Math.max(0.05, filled);
    const simmer = recipes[elementOf(area)].simmer;
    for (let each = howMany(rate * seconds); each > 0; each--) {
        const at = pointIn(area, reach);
        let roll = Math.random();
        const [kind, , up] =
            simmer.find(([, part]) => (roll -= part) < 0) ?? simmer[0];
        emit(kind, at.x, area.y + 0.05, at.z, ...scatter(0.35, up));
    }
}

/** A boss gathering itself to strike: its element drawn in toward it and
 *  up, the more the nearer the strike. */
export function gatherAround(
    x: number,
    y: number,
    z: number,
    radius: number,
    element: Element,
    strength: number,
    seconds: number,
) {
    const gather = recipes[element].gather;
    for (let each = howMany(70 * strength * seconds); each > 0; each--) {
        const angle = Math.random() * Math.PI * 2;
        const out = radius * (1.3 + Math.random() * 0.8);
        const px = x + Math.cos(angle) * out;
        const pz = z + Math.sin(angle) * out;
        const inward = 1.6 + strength * 1.5;
        emit(
            anyOf(gather),
            px,
            y + Math.random() * radius,
            pz,
            -Math.cos(angle) * inward,
            1 + Math.random(),
            -Math.sin(angle) * inward,
        );
    }
}

/** A dashing boss's wake along the ground behind it. */
export function trailBehind(
    x: number,
    y: number,
    z: number,
    radius: number,
    element: Element,
    seconds: number,
) {
    const trail = recipes[element].trail;
    for (let each = howMany(70 * seconds); each > 0; each--) {
        const px = x + (Math.random() - 0.5) * radius * 1.6;
        const pz = z + (Math.random() - 0.5) * radius * 1.6;
        emit(anyOf(trail), px, y + 0.1, pz, ...scatter(0.7, 1.6));
    }
}

/** A poisoned monster's mist, or a burning one's flames, about it. */
export function smolder(
    x: number,
    y: number,
    z: number,
    radius: number,
    burning: boolean,
    seconds: number,
) {
    for (let each = howMany(30 * seconds); each > 0; each--) {
        const px = x + (Math.random() - 0.5) * radius * 1.4;
        const pz = z + (Math.random() - 0.5) * radius * 1.4;
        const py = y + 0.2 + Math.random() * radius;
        if (burning)
            emit(
                Math.random() < 0.6 ? flame : core,
                px,
                py,
                pz,
                ...scatter(0.2, 1.2),
            );
        else
            emit(
                Math.random() < 0.7 ? mist : drop,
                px,
                py,
                pz,
                ...scatter(0.25, 0.6),
            );
    }
}

//  Her gear's effects, rising off what carries them from +10: fine motes,
//  a tenth the size of an attack's, so they trace the gear rather than
//  hide her. Embers and small flames for a burn, green droplets for
//  poison, a red drift for the leech, gold flecks for frenzy, and a pale
//  blue wind for the Cyclone.
const gearKind = (
    from: [number, number, number],
    to: [number, number, number],
    size: [number, number],
    gravity: number,
    pool = glowPool,
): Kind => ({
    pool,
    life: [0.45, 0.9],
    size,
    from,
    to,
    alpha: 0.9,
    gravity,
    drag: 1.1,
});
const ember = gearKind([1, 0.85, 0.35], [1, 0.3, 0.05], [0.1, 0.03], -1.6);
const lick = gearKind(
    [1, 0.6, 0.15],
    [0.9, 0.2, 0.03],
    [0.2, 0.06],
    -2.2,
    solidPool,
);
const venom = gearKind([0.7, 1, 0.3], [0.3, 0.6, 0.1], [0.1, 0.04], -0.5);
const venomDrop = gearKind(
    [0.55, 0.9, 0.15],
    [0.3, 0.55, 0.08],
    [0.07, 0.05],
    5,
    solidPool,
);
const blood = gearKind([1, 0.3, 0.35], [0.6, 0.05, 0.12], [0.09, 0.03], -0.9);
const fleck = gearKind([1, 0.95, 0.5], [1, 0.7, 0.1], [0.06, 0.02], -1.4);
const gust = gearKind([0.75, 0.97, 1], [0.3, 0.7, 0.95], [0.08, 0.02], -0.4);
const shard = gearKind([0.95, 0.97, 1], [0.6, 0.7, 0.8], [0.06, 0.02], -0.8);

/** The effects gear can carry, as `ItemEffect` names them. */
export type GearEffect =
    | "burn"
    | "poison"
    | "leech"
    | "frenzy"
    | "cyclone"
    | "pierce"
    | "multishot"
    | "ricochet";

/** What rises off a piece of gear with each effect, and how quickly. */
const gearKinds: Record<GearEffect, { kinds: Kind[]; up: number }> = {
    burn: { kinds: [ember, ember, lick], up: 0.8 },
    poison: { kinds: [venom, venom, venomDrop], up: 0.3 },
    leech: { kinds: [blood], up: 0.4 },
    frenzy: { kinds: [fleck, fleck, ember], up: 1 },
    cyclone: { kinds: [gust], up: 0.3 },
    pierce: { kinds: [shard], up: 0.2 },
    multishot: { kinds: [fleck, shard], up: 0.6 },
    ricochet: { kinds: [gust, shard], up: 0.4 },
};

/** Motes of `effect` rising off gear at (x, y, z), within `spread`
 *  metres, `rate` a second. The Cyclone's wind circles as it rises. */
export function gearMotes(
    effect: GearEffect,
    x: number,
    y: number,
    z: number,
    spread: number,
    rate: number,
    seconds: number,
) {
    const { kinds, up } = gearKinds[effect];
    for (let each = howMany(rate * seconds); each > 0; each--) {
        const px = x + (Math.random() - 0.5) * spread;
        const py = y + (Math.random() - 0.5) * spread;
        const pz = z + (Math.random() - 0.5) * spread;
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        if (effect === "cyclone") {
            const angle = Math.random() * Math.PI * 2;
            emit(
                kind,
                px,
                py,
                pz,
                Math.cos(angle) * 1.2,
                up,
                Math.sin(angle) * 1.2,
            );
        } else emit(kind, px, py, pz, ...scatter(0.15, up));
    }
}

/** Dust kicked up at the hero's feet as she dodges. */
export function kickDust(x: number, y: number, z: number, seconds: number) {
    for (let each = howMany(60 * seconds); each > 0; each--)
        emit(
            dust,
            x + (Math.random() - 0.5) * 0.4,
            y + 0.05,
            z + (Math.random() - 0.5) * 0.4,
            ...scatter(0.8, 0.6),
        );
}

/** Moves a pool on by `seconds`: gravity, the air, and age. */
export function stepPool(pool: Pool, seconds: number) {
    for (let at = 0; at < pool.size; at++) {
        if (pool.life[at] === 0) continue;
        const age = pool.age[at] + seconds;
        if (age >= pool.life[at]) {
            pool.life[at] = 0;
            continue;
        }
        pool.age[at] = age;
        const keep = Math.max(0, 1 - pool.drag[at] * seconds);
        pool.vx[at] *= keep;
        pool.vz[at] *= keep;
        pool.vy[at] = pool.vy[at] * keep - pool.gravity[at] * seconds;
        pool.x[at] += pool.vx[at] * seconds;
        pool.y[at] += pool.vy[at] * seconds;
        pool.z[at] += pool.vz[at] * seconds;
        //  Nothing sinks through the ground: it rests on it.
        if (pool.y[at] < 0.02) {
            pool.y[at] = 0.02;
            pool.vy[at] = 0;
        }
    }
}

/** Empties both pools, as the wilds are left. */
export function clearParticles() {
    glowPool.life.fill(0);
    solidPool.life.fill(0);
}
