//  Every kind of monster in the wilds, as data.

/** What a boss can do beyond its lunge. Every one is telegraphed on the
 *  ground before it lands. */
export type BossSkill =
    /** Charges along a line toward the hero. */
    | "dash"
    /** A circle under where the hero stands. */
    | "slam"
    /** A wedge before the boss, toward the hero. */
    | "cleave"
    /** A ring round the boss, safe right beside it. */
    | "ripple"
    /** Four bars out from the boss, a cross. */
    | "cross"
    /** A huge circle round the boss, below half its health. */
    | "cataclysm";

export type MonsterKind = {
    name: string;
    level: number;
    health: number;
    /** Metres a second it chases at. */
    speed: number;
    /** Health a touch takes from the hero, once a second at most. */
    damage: number;
    xp: number;
    /** Metres from its middle to its side. */
    radius: number;
    /** Metres wide a slime is drawn; metres tall a model is. */
    size: number;
    /** The slime's body colour, which its sprite is shaded from; a
     *  model's, its dot on the minimap. */
    color: string;
    /** Drawn as a rigged model rather than the creator's slime. */
    model?: MonsterModel;
    /** Aggressive: it hunts a hero who comes within `aggroRange`. Passive:
     *  it roams its area and fights only once it is hit. */
    temperament: "aggressive" | "passive";
    /** Metres at which an aggressive monster notices the hero. Either kind
     *  gives up a chase once it is twice this from where the chase began. */
    aggroRange: number;
    /** A boss's skills and what they deal: an area attack deals
     *  `damagePerSecond` for each second of its warning, so a longer warning
     *  hits harder; the dash deals `dashDamage`. */
    boss?: {
        skills: readonly BossSkill[];
        damagePerSecond: number;
        dashDamage: number;
        /** What its attacks are made of, which their particles show. */
        element: Element;
    };
};

/** A rigged model a monster is drawn as, from the platform's shared kit,
 *  scaled to the kind's `size` in height, and the clips it plays by the
 *  ends of their names. */
export type MonsterModel = {
    file: string;
    clips: {
        idle: string;
        /** Its walk as it roams, and its run as it hunts, if it has one. */
        walk: string;
        run?: string;
        attack: string;
        death: string;
        hit?: string;
    };
    /** Metres a second its walk and its run cover at their own pace. */
    walkPace: number;
    runPace?: number;
    /** Metres over the ground it flies at. */
    hover?: number;
    /** A colour its own are drawn halfway to, as a boss stands apart from
     *  its kin. */
    tint?: string;
};

/** A boss's element: the Moss King's attacks burst in spores and earth,
 *  the Ember Tyrant's in flame. */
export const elements = ["moss", "fire", "shadow", "venom", "grave"] as const;
export type Element = (typeof elements)[number];

export const monsterKinds = {
    mossSlime: {
        name: "Moss Slime",
        level: 1,
        health: 24,
        speed: 1.6,
        damage: 6,
        xp: 6,
        radius: 0.4,
        size: 1,
        color: "#6cc24a",
        temperament: "passive",
        aggroRange: 5,
    },
    emberSlime: {
        name: "Ember Slime",
        level: 3,
        health: 60,
        speed: 2.1,
        damage: 11,
        xp: 16,
        radius: 0.5,
        size: 1.3,
        color: "#e8663a",
        temperament: "aggressive",
        aggroRange: 5.5,
    },
    mossKing: {
        name: "Moss King",
        level: 5,
        health: 420,
        speed: 1.8,
        damage: 14,
        xp: 120,
        radius: 1,
        size: 2.4,
        color: "#4f9a34",
        temperament: "aggressive",
        aggroRange: 7,
        boss: {
            skills: ["dash", "slam", "cleave", "ripple"],
            damagePerSecond: 10,
            dashDamage: 24,
            element: "moss",
        },
    },
    emberTyrant: {
        name: "Ember Tyrant",
        level: 9,
        health: 1100,
        speed: 2.2,
        damage: 22,
        xp: 320,
        radius: 1.2,
        size: 2.9,
        color: "#d2452a",
        temperament: "aggressive",
        aggroRange: 8,
        boss: {
            skills: ["dash", "slam", "cleave", "ripple", "cross", "cataclysm"],
            damagePerSecond: 16,
            dashDamage: 40,
            element: "fire",
        },
    },
    //  The far zones, for a hero past the slimes: drawn from the
    //  platform's kit, each tougher than the last.
    duskBat: {
        name: "Dusk Bat",
        level: 10,
        health: 380,
        speed: 3,
        damage: 26,
        xp: 40,
        radius: 0.45,
        size: 0.65,
        color: "#8a6fb8",
        temperament: "aggressive",
        aggroRange: 6,
        model: {
            file: "bat",
            clips: {
                idle: "idle",
                walk: "walk",
                attack: "attack",
                death: "dead",
            },
            walkPace: 2.5,
            hover: 0.7,
        },
    },
    caveSkitter: {
        name: "Cave Skitter",
        level: 12,
        health: 620,
        speed: 2.6,
        damage: 32,
        xp: 58,
        radius: 0.8,
        size: 0.6,
        color: "#b8433a",
        temperament: "aggressive",
        aggroRange: 6,
        model: {
            file: "skitter",
            clips: {
                idle: "Spider_Idle",
                walk: "Spider_Walk",
                attack: "Spider_Attack",
                death: "Spider_Death",
            },
            walkPace: 2.2,
        },
    },
    barrowHusk: {
        name: "Barrow Husk",
        level: 16,
        health: 1150,
        speed: 2.3,
        damage: 44,
        xp: 105,
        radius: 0.45,
        size: 1.7,
        color: "#8fa36a",
        temperament: "aggressive",
        aggroRange: 6.5,
        model: {
            file: "husk",
            clips: {
                idle: "Idle",
                walk: "Walk",
                run: "Run",
                attack: "Attack",
                death: "Death",
                hit: "HitRecieve",
            },
            walkPace: 1.2,
            runPace: 3.2,
        },
    },
    ashBrute: {
        name: "Ash Brute",
        level: 20,
        health: 2000,
        speed: 2.4,
        damage: 60,
        xp: 170,
        radius: 0.7,
        size: 2.2,
        color: "#c0392b",
        temperament: "aggressive",
        aggroRange: 7,
        model: {
            file: "brute",
            clips: {
                idle: "Idle",
                walk: "Walk",
                run: "Run",
                attack: "Punch",
                death: "Death",
                hit: "HitReact",
            },
            walkPace: 1.6,
            runPace: 4,
        },
    },
    //  The far zones' bosses, each its kin grown huge and tinted by its
    //  element, which its attacks are made of.
    duskMonarch: {
        name: "Dusk Monarch",
        level: 12,
        health: 3200,
        speed: 3.2,
        damage: 34,
        xp: 700,
        radius: 1.1,
        size: 1.5,
        color: "#a34dff",
        temperament: "aggressive",
        aggroRange: 8,
        model: {
            file: "bat",
            clips: {
                idle: "idle",
                walk: "walk",
                attack: "attack",
                death: "dead",
            },
            walkPace: 3.5,
            hover: 1,
            tint: "#8a4dff",
        },
        boss: {
            skills: ["dash", "slam", "ripple", "cross"],
            damagePerSecond: 26,
            dashDamage: 70,
            element: "shadow",
        },
    },
    broodQueen: {
        name: "Brood Queen",
        level: 14,
        health: 4500,
        speed: 2.8,
        damage: 40,
        xp: 950,
        radius: 1.7,
        size: 1.2,
        color: "#b6e62a",
        temperament: "aggressive",
        aggroRange: 8,
        model: {
            file: "skitter",
            clips: {
                idle: "Spider_Idle",
                walk: "Spider_Walk",
                attack: "Spider_Attack",
                death: "Spider_Death",
            },
            walkPace: 3.6,
            tint: "#7fd62a",
        },
        boss: {
            skills: ["dash", "slam", "cleave", "ripple", "cross"],
            damagePerSecond: 30,
            dashDamage: 85,
            element: "venom",
        },
    },
    barrowKing: {
        name: "Barrow King",
        level: 18,
        health: 8000,
        speed: 2.5,
        damage: 55,
        xp: 1600,
        radius: 1.3,
        size: 3.2,
        color: "#7fd8c8",
        temperament: "aggressive",
        aggroRange: 8.5,
        model: {
            file: "husk",
            clips: {
                idle: "Idle",
                walk: "Walk",
                run: "Run",
                attack: "Attack",
                death: "Death",
                hit: "HitRecieve",
            },
            walkPace: 2.3,
            runPace: 6,
            tint: "#9fe8dc",
        },
        boss: {
            skills: ["dash", "slam", "cleave", "ripple", "cross", "cataclysm"],
            damagePerSecond: 36,
            dashDamage: 110,
            element: "grave",
        },
    },
    ashWarlord: {
        name: "Ash Warlord",
        level: 24,
        health: 16000,
        speed: 2.6,
        damage: 80,
        xp: 2600,
        radius: 1.4,
        size: 3.8,
        color: "#e0582a",
        temperament: "aggressive",
        aggroRange: 9,
        model: {
            file: "brute",
            clips: {
                idle: "Idle",
                walk: "Walk",
                run: "Run",
                attack: "Weapon",
                death: "Death",
                hit: "HitReact",
            },
            walkPace: 2.8,
            runPace: 7,
            tint: "#ff7a2a",
        },
        boss: {
            skills: ["dash", "slam", "cleave", "ripple", "cross", "cataclysm"],
            damagePerSecond: 45,
            dashDamage: 150,
            element: "fire",
        },
    },
} satisfies Record<string, MonsterKind>;

export type MonsterKindName = keyof typeof monsterKinds;

export function kindOf(name: MonsterKindName): MonsterKind {
    return monsterKinds[name];
}
