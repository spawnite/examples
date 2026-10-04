import chargedSpellCast from "@spawnite/assets/animations/charged-spell-cast.vrma?url";
import mageSpellCast6 from "@spawnite/assets/animations/mage-spell-cast-6.vrma?url";
import mageSpellCast4 from "@spawnite/assets/animations/mage-spell-cast-4.vrma?url";
import type { World } from "koota";
import {
    AbilityKind,
    defineResource,
    registerAbility,
    registerClip,
} from "@spawnite/engine";

//  The mage kit's numbers, which the room judges and every page reads:
//  source the game owns, copied from the combat design and changed here.
//  A class is starter gear and a list of abilities; the engine has none.

/** The mana every spell but the bolt costs. */
export const mana = defineResource("mana", {
    maximum: 100,
    regen: 5,
    color: "#4aa3ff",
    label: "Mana",
});

/** The spell the crescent wand grants. */
export const arcaneBolt = "arcane-bolt";
/** The two spells she holds as a mage, on keys 2 and 3. */
export const crystalLance = "crystal-lance";
export const frostNova = "frost-nova";
export const mageSpells = [crystalLance, frostNova] as const;
/** Seconds the lance winds up, which its charge at the wand fills. */
export const lanceCastSeconds = 0.8;

/** The pale blue every part of the bolt's look is tinted. */
export const arcaneColor = "#9ecbff";
/** The violet the lance's crystals glow, and the ice of the nova. */
export const lanceColor = "#c9a7ff";
export const novaColor = "#bfe9ff";

//  Meshy's casts as VRMA clips, which every avatar plays over her pose,
//  each marked where it releases, which is the spell's cast time: the
//  bolt's hands meet at 0.6 s; the lance's body turns and the arm throws
//  at 0.8 s; the nova's arms stand highest at 1.4 s, before the hands
//  come down. `spawnite play timeline` shows the frames to read one from.
registerClip("mage-spell-cast-4", mageSpellCast4, {
    marks: { release: 0.6 },
});
registerClip("mage-spell-cast-6", mageSpellCast6, {
    marks: { release: lanceCastSeconds },
});
registerClip("charged-spell-cast", chargedSpellCast, {
    marks: { release: 1.4 },
});

/** Registers the kit's abilities on `world`; the return takes them
 *  away. */
export function registerMageKit(world: World) {
    const disposers = [
        registerAbility(world, arcaneBolt, {
            kind: AbilityKind.Projectile,
            label: "Arcane Bolt",
            icon: "zap",
            clip: "mage-spell-cast-4",
            cooldownSeconds: 0,
            range: 25,
            damage: { min: 20, max: 26, stat: "spellPower" },
            projectile: { speed: 14, turnDegrees: 540 },
        }),
        registerAbility(world, crystalLance, {
            kind: AbilityKind.Projectile,
            label: "Crystal Lance",
            icon: "gem",
            clip: "mage-spell-cast-6",
            cooldownSeconds: 5,
            cost: { [mana]: 20 },
            range: 25,
            damage: { min: 60, max: 75, stat: "spellPower" },
            projectile: { speed: 22, turnDegrees: 360 },
        }),
        registerAbility(world, frostNova, {
            kind: AbilityKind.Area,
            label: "Frost Nova",
            icon: "snowflake",
            clip: "charged-spell-cast",
            cooldownSeconds: 5,
            cost: { [mana]: 25 },
            radius: 6,
            damage: { min: 25, max: 30, stat: "spellPower" },
            slow: { percent: 50, seconds: 3 },
        }),
    ];
    return () => {
        for (const dispose of disposers) dispose();
    };
}
