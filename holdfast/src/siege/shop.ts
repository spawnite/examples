import { LifeMachine } from "./life";
import { createQuery, type Entity, type World } from "koota";
import { isRunning, PhaseMachine, type Phase } from "./phase";
import { findEntity, TransformTrait } from "@spawnite/engine/core";
import { buyCard, isElementPick, readCardPrice, rerollOffer } from "./cards";
import { readLedger, spendCoins } from "./coins";
import { feedFire, feedMetres } from "./fire";
import {
    GunId,
    guns,
    holdGun,
    keepTier,
    readGun,
    readUpgradePrice,
} from "./guns";
import { LedgerTrait, SiegeStateTrait, WardenTrait } from "./traits";

//  What coins buy, and where: a reroll of the card offer on the card
//  screen, and at the fire a gun from its rack, an upgrade of the gun in
//  hand, or a bigger fire. No menu: the rack is a place, as Call of Duty
//  Zombies hangs its guns on the walls and a player walks up to one. A page
//  asks with a message that names what it wants; the room checks where she
//  stands, the phase and her wallet, and grants it or does nothing.

/** A stand of the rack: the gun it sells, and where it stands. */
export interface RackStand {
    gun: GunId;
    x: number;
    z: number;
    /** Radians about the upright that turn it to face the fire. */
    yaw: number;
}

/** Metres from the middle the rack's stands stand, north of the fire
 *  between two wardens' places, and radians between two stands. */
const rackMetres = 5.6;
const rackTurn = 0.42;

/** The rack: the scattergun, the blaster and the rail, left to right as a
 *  warden at the fire faces them. */
export const rackStands: readonly RackStand[] = [
    GunId.Scattergun,
    GunId.Blaster,
    GunId.Rail,
].map((gun, index) => {
    const angle = Math.PI + (index - 1) * rackTurn;
    return {
        gun,
        x: Math.sin(angle) * rackMetres,
        z: Math.cos(angle) * rackMetres,
        yaw: angle + Math.PI,
    };
});

/** Metres from a stand within which a warden buys at it. A page shows its
 *  prompt a little nearer, so a purchase the room lands a moment later
 *  still stands within this. */
export const standMetres = 2.2;

/** Coins a reroll costs after `rerolls` this breather: a quarter of one
 *  warden's average wave, 40 coins, and a quarter more each time. */
export function readRerollPrice(rerolls: number) {
    return 10 * (rerolls + 1);
}

export { readCardPrice };

/** Whether a run is on in `phase`, in which coins buy: a breather, a wave,
 *  or dawn. */
export function isRunOn(phase: Phase | undefined) {
    return phase === "breather" || phase === "fight" || phase === "dawn";
}

/** Whether the rack and the upgrades are open in `phase`: whenever a run
 *  is on, from the first breather. Their prices do the gating. */
export function isRackOpen(phase: Phase | undefined) {
    return isRunOn(phase);
}

const sieges = createQuery(SiegeStateTrait);

/** The siege's working record and its entity, which holds the phase
 *  machine, where the siege has begun. */
function readRun(world: World) {
    const siege = findEntity(world, sieges);
    const record = siege?.get(SiegeStateTrait);
    return siege && record ? { ...record, entity: siege } : undefined;
}

/** Metres from `warden`'s feet to the point `x`, `z` on the ground. */
function measureFrom(warden: Entity, x: number, z: number) {
    const feet = warden.get(TransformTrait);
    return feet ? Math.hypot(feet.x - x, feet.z - z) : Infinity;
}

/** Whether `warden` is on her feet within reach of the stand that sells
 *  `gun`. */
function isAtStand(warden: Entity, gun: GunId) {
    const stand = rackStands.find((each) => each.gun === gun);
    return (
        stand !== undefined &&
        !warden.has(LifeMachine.is.down) &&
        measureFrom(warden, stand.x, stand.z) <= standMetres
    );
}

/** Rerolls her card offer for a price that rises each time: in a breather
 *  or while she catches up, before or after her free card, and never her
 *  element's pick. */
export function buyReroll(world: World, warden: Entity) {
    const run = readRun(world);
    const survivor = warden.get(WardenTrait);
    if (!run || !survivor) return false;
    const picking =
        run.entity.has(PhaseMachine.is.breather) || survivor.catchUp > 0;
    if (
        !picking ||
        survivor.offer.length === 0 ||
        survivor.offer.some(({ card }) => isElementPick(card))
    )
        return false;
    if (!spendCoins(warden, readRerollPrice(survivor.rerolls))) return false;
    rerollOffer(warden, run);
    warden.set(LedgerTrait, { rerolls: readLedger(warden).rerolls + 1 });
    return true;
}

/** A card she asks to buy: whose, and which slot of her offer. */
interface CardPurchase {
    shooter: Entity;
    slot: number;
}

/** Buys a card of her offer after her free one: in a breather, or while
 *  she catches up. */
export function buyCardInBreather(
    world: World,
    { shooter, slot }: CardPurchase,
) {
    const run = readRun(world);
    const survivor = shooter.get(WardenTrait);
    if (!run || !survivor) return false;
    if (!run.entity.has(PhaseMachine.is.breather) && survivor.catchUp === 0)
        return false;
    return buyCard(shooter, slot);
}

/** Buys `gun` at its stand, keeping her tier less one: once the rack is
 *  open, a gun she does not hold, at its price. */
export function buyGun(world: World, warden: Entity, gun: GunId) {
    const run = readRun(world);
    const held = readGun(warden);
    if (!run || !isRunning(run.entity) || held.gun === gun) return false;
    if (!isAtStand(warden, gun)) return false;
    if (!spendCoins(warden, guns[gun].price)) return false;
    holdGun(warden, gun, keepTier(held.tier), held.bought + 1);
    warden.set(LedgerTrait, { guns: readLedger(warden).guns + 1 });
    return true;
}

/** Raises the gun in her hand a tier at its stand: once the rack is open,
 *  up to the top tier, at the tier's price. */
export function upgradeGun(world: World, warden: Entity) {
    const run = readRun(world);
    const { gun, tier, bought } = readGun(warden);
    const price = readUpgradePrice(tier);
    if (!run || !isRunning(run.entity) || price === undefined) return false;
    if (!isAtStand(warden, gun) || !spendCoins(warden, price)) return false;
    holdGun(warden, gun, tier + 1, bought + 1);
    warden.set(LedgerTrait, { upgrades: readLedger(warden).upgrades + 1 });
    return true;
}

/** Feeds the fire from her wallet, while a run is on and she stands by
 *  it, on her feet. */
export function buyFire(world: World, warden: Entity) {
    const run = readRun(world);
    if (!run || !isRunning(run.entity)) return false;
    if (warden.has(LifeMachine.is.down)) return false;
    if (measureFrom(warden, 0, 0) > feedMetres) return false;
    return feedFire(world, warden);
}
