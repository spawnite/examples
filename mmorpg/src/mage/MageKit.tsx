import type { Entity } from "koota";
import { useTrait, useWorld } from "koota/react";
import { useEffect, useLayoutEffect } from "react";
import { Euler, Vector3 } from "three";
import boltBurst from "@spawnite/assets/particles/bolt-burst.json";
import boltRunes from "@spawnite/assets/particles/bolt-runes.json";
import {
    addItem,
    CastingTrait,
    countItem,
    equipItem,
    EquipmentSlot,
    EquipmentTrait,
    HeldItem,
    InventoryTrait,
    Particles,
    SpellLook,
    SpellRing,
    SpellRunes,
    SpellShards,
    SpellSpear,
    SpellSwirl,
    Targeting,
    useInspect,
    usePlayer,
    type HeldItemRotation,
    type Position,
} from "@spawnite/engine";
import {
    arcaneBolt,
    arcaneColor,
    crystalLance,
    frostNova,
    lanceCastSeconds,
    lanceColor,
    novaColor,
    registerMageKit,
} from "./abilities";
import { CrescentWand, wandOrb } from "./CrescentWand";
import { CrystalBolt } from "./CrystalBolt";

/** The item the mage starts with in her main hand. */
export const crescentWand = "crescent-wand";

//  The wand is fixed in her right hand, so every turn of her wrist turns
//  it: its tip sweeps with the cast and swings with the run. Her hand's
//  axes are her rest pose's, where her fingers point along +x, her palm
//  faces -y and her thumb lies toward -z; the wand's own +y, pommel to
//  orb, runs across her palm through the hole her fist closes round, the
//  orb out past her thumb, as a sword's blade leaves a fist.
const wandTurn: HeldItemRotation = [-Math.PI / 2, 0, 0];
//  Where the middle of the leather grip sits: the hole of the engine's
//  grip, 5.5 cm down her fingers and 2.5 cm under her palm, in the
//  hand's axes.
const wandGrip: Position = [0.055, -0.025, 0];
//  Metres up the wand from its pommel to the middle of its grip.
const gripHeight = 0.075;
//  The wand's orb in the hand's axes, where each spell's charge plays:
//  up the wand from the grip, turned as the wand is, from where it is
//  held.
const orbInHand = new Vector3(...wandOrb)
    .add(new Vector3(0, -gripHeight, 0))
    .applyEuler(new Euler(...wandTurn))
    .add(new Vector3(...wandGrip))
    .toArray();
/** Seconds the nova's parts stay: its rune circle's fade. */
const novaSeconds = 1.6;
/** Metres the nova's ring races out to: the ability's radius. */
const novaRadius = 6;

/** The mage kit in a scene: its ability and mana registered on the world,
 *  the player's targeting, each spell's look from the engine's parts, and
 *  the wand in her hand from the first second. Mount it inside the World,
 *  after the Player. */
export function MageKit() {
    const world = useWorld();
    //  Before the Player's spawn, an effect, gives her mana.
    useLayoutEffect(() => registerMageKit(world), [world]);
    return (
        <>
            <Targeting />
            <Particles effects={[boltBurst, boltRunes]} />
            {/*  Each charge plays at the wand's orb from the press, as
            the engine predicts the cast. */}
            <SpellLook
                ability={arcaneBolt}
                color={arcaneColor}
                charge={boltRunes}
                chargePosition={orbInHand}
                chargeRotation={wandTurn}
                projectile={<CrystalBolt color={arcaneColor} />}
                impact={boltBurst}
            />
            <SpellLook
                ability={crystalLance}
                color={lanceColor}
                charge={
                    <SpellSwirl color={lanceColor} seconds={lanceCastSeconds} />
                }
                chargePosition={orbInHand}
                chargeRotation={wandTurn}
                projectile={<SpellSpear color={lanceColor} />}
                impact={boltBurst}
            />
            {/*  Frost Nova, as the concept sheet's b variant drew it: a
            ring of frost racing out to the spell's radius, a rune circle
            left glowing under her, and ice shards standing up round her. */}
            <SpellLook
                ability={frostNova}
                color={novaColor}
                strike={boltBurst}
                area={[
                    <SpellRing
                        key="ring"
                        color={novaColor}
                        radius={novaRadius}
                    />,
                    <SpellRunes key="runes" color={novaColor} />,
                    <SpellShards key="shards" color={novaColor} />,
                ]}
                areaSeconds={novaSeconds}
            />
            <StarterGear />
        </>
    );
}

/** Puts the crescent wand in her main hand where she holds it nowhere,
 *  worn or in her bag: a new game, and a save from before the wand. A
 *  wand she took off stays in her bag.
 *  ponytail: the page's one player, as the mmorpg plays alone; a system
 *  that gears each hero a room spawns once the game names a room. */
function StarterGear() {
    const hero = usePlayer().entity;
    useEffect(() => {
        if (!hero || countItem(hero, crescentWand) > 0) return;
        if (
            hero.get(EquipmentTrait)?.[EquipmentSlot.MainHand]?.item ===
            crescentWand
        )
            return;
        if (addItem(hero, { item: crescentWand, count: 1 }) === 0) return;
        const slot = (hero.get(InventoryTrait) ?? []).findIndex(
            (stack) => stack?.item === crescentWand,
        );
        equipItem(hero, slot);
    }, [hero]);
    return null;
}

/** The crescent wand in her right hand while she wears it: its leather
 *  grip in the hole her fist closes round, fixed in the hand, as Unreal
 *  attaches a weapon to a hand socket and Unity parents it to the hand
 *  bone. The engine's grip closes her fingers round it. Its crescent
 *  brightens while a charge plays at its orb, which `SpellLook` draws. */
export function Wand({ entity }: { entity: Entity }) {
    const worn = useTrait(entity, EquipmentTrait);
    //  Her page starts her cast on the press, so the charge shows at once.
    const casting = useTrait(entity, CastingTrait);
    const charging = casting?.ability === arcaneBolt;
    const lancing = casting?.ability === crystalLance;
    //  What `spawnite play eval` reads as `views`: whether the charge is
    //  drawn, and the cast it draws.
    useInspect(
        "spell charge",
        () => ({ charging, casting: casting?.ability ?? null }),
        entity,
    );
    if (worn?.[EquipmentSlot.MainHand]?.item !== crescentWand) return null;
    return (
        <HeldItem position={wandGrip} rotation={wandTurn} forward={[0, 1, 0]}>
            <group position={[0, -gripHeight, 0]}>
                <CrescentWand charging={charging || lancing} />
            </group>
        </HeldItem>
    );
}
