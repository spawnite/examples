import { LifeMachine, ReadinessMachine } from "./life";
import type { Entity, World } from "koota";
import {
    TransformTrait,
    WalletTrait,
    type BotDanger,
    type BotPoint,
    type BotSkill,
    type BotTurn,
    type SceneBot,
} from "@spawnite/engine/core";
import { isElementPick, readCard, readCardPrice } from "./cards";
import { feedCoins } from "./fire";
import { GunId, gunList, guns, readGun, readUpgradePrice } from "./guns";
import { rarityPoints } from "./elements";
import { lanceSettings, lanceWeapon } from "./lance";
import { PhaseTrait, readPhase } from "./phase";
import { isRackOpen, isRunOn, rackStands, readRerollPrice } from "./shop";
import type { Signal } from "./signals";
import { siegePlugin } from "./siege.plugin";
import {
    BoltTrait,
    type CardOffer,
    SiegeTrait,
    SlamTrait,
    WardenElementsTrait,
    WardenTrait,
} from "./traits";
import { breatherSeconds } from "./waves";
import { wardens } from "./wardens";

/** The slot a bot takes of `offer`: an element by her colour, so a room of
 *  bots holds each element, the rarest element card, which fills her
 *  line, or the first. */
export function chooseBotSlot(offer: readonly CardOffer[], hue: number) {
    if (offer.length > 0 && offer.every(({ card }) => isElementPick(card)))
        return hue % offer.length;
    return Math.max(0, findLineCard(offer));
}

/** The slot of `offer` that holds its rarest element card, which fills
 *  her line most, of those `open` allows, or -1. */
function findLineCard(
    offer: readonly CardOffer[],
    open: (card: string) => boolean = () => true,
) {
    let chosen = -1;
    let best = -1;
    offer.forEach(({ card, rarity }, slot) => {
        if (!open(card) || readCard(card)?.line === undefined) return;
        if (rarityPoints[rarity] <= best) return;
        best = rarityPoints[rarity];
        chosen = slot;
    });
    return chosen;
}

/** The gun a bot of each colour buys once the rack opens, so a room of
 *  bots fires each: the third keeps the blaster and upgrades it. */
const botGuns: readonly GunId[] = [
    GunId.Scattergun,
    GunId.Rail,
    GunId.Blaster,
    GunId.Scattergun,
];

/** Metres in front of a stand, toward the fire, a bot walks to, and from
 *  the middle she feeds the fire at. */
const standFront = 1;
const feedFront = 2.4;

/** Moves between two of a bot's words to the shop: a word waits for the
 *  room to grant the last before she asks again. */
const errandMoves = 6;

/** What a bot goes to the fire to buy, where, and the word that buys it. */
interface Errand {
    point: BotPoint;
    signal: Signal;
}

/** Where a bot stands to buy at `gun`'s stand. */
function standPoint(gun: GunId): BotPoint {
    const stand = rackStands.find((each) => each.gun === gun) ?? rackStands[0];
    const metres = Math.hypot(stand.x, stand.z);
    const scale = (metres - standFront) / metres;
    return [stand.x * scale, 0, stand.z * scale];
}

/** Where a bot of colour `hue` stands to feed the fire: on her own side of
 *  it. */
function firePoint(hue: number): BotPoint {
    const angle = (hue + 0.5) * (Math.PI / 2);
    return [Math.sin(angle) * feedFront, 0, Math.cos(angle) * feedFront];
}

/** Coins a bot keeps back from the fire for what she buys next at the
 *  rack: her gun, or her next tier. */
function readReserve(hero: Entity, want: GunId) {
    const { gun, tier } = readGun(hero);
    if (gun !== want) return guns[want].price;
    return readUpgradePrice(tier) ?? 0;
}

/** What a bot buys at the fire between waves, where she is owed one: her
 *  gun once the rack opens, then its tiers, and what her wallet holds past
 *  those, the fire. None during a wave, when she fights. */
export function chooseBotErrand({ world, hero }: BotTurn): Errand | undefined {
    const phase = readPhase(world.queryFirst(PhaseTrait));
    const warden = hero.get(WardenTrait);
    if (!warden || hero.has(LifeMachine.is.down) || !isRunOn(phase))
        return undefined;
    if (phase === "fight") return undefined;
    const coins = hero.get(WalletTrait)?.coins ?? 0;
    const want = botGuns[warden.hue % botGuns.length];
    const { gun, tier } = readGun(hero);
    if (isRackOpen(phase)) {
        if (gun !== want && coins >= guns[want].price)
            return {
                point: standPoint(want),
                signal: {
                    message: siegePlugin.messages.buyGun,
                    payload: { gun: want },
                },
            };
        const price = readUpgradePrice(tier);
        if (gun === want && price !== undefined && coins >= price)
            return {
                point: standPoint(gun),
                signal: { message: siegePlugin.messages.upgrade, payload: {} },
            };
    }
    if (coins - readReserve(hero, want) >= feedCoins)
        return {
            point: firePoint(warden.hue),
            signal: { message: siegePlugin.messages.feed, payload: {} },
        };
    return undefined;
}

/** The wave from which a bot buys a second card a breather: the design
 *  sizes the cards for a warden who buys one or two a breather by
 *  mid-run. */
export const secondPurchaseWave = 5;

/** The cards a bot buys a breather after her free one, by the wave last
 *  held. */
function readPurchases(wave: number) {
    return wave >= secondPurchaseWave ? 2 : 1;
}

/** The slot of her offer a bot buys after her free card, or -1: one card
 *  a breather early in the night and two from mid-run, each once her
 *  wallet holds its price past what she saves for at the rack: the rarest
 *  element card she can pay for first, which fills her line, and otherwise
 *  the rarest card she can pay for. */
export function chooseBotPurchase(hero: Entity, wave: number) {
    const warden = hero.get(WardenTrait);
    if (!warden || warden.taken === "") return -1;
    if (warden.bought.length >= readPurchases(wave)) return -1;
    const coins = hero.get(WalletTrait)?.coins ?? 0;
    const want = botGuns[warden.hue % botGuns.length];
    const budget = coins - readReserve(hero, want);
    //  The offer's cards are different, so a card names its slot.
    const open = (card: string) => {
        const offered = warden.offer.find((each) => each.card === card);
        return (
            offered !== undefined &&
            card !== warden.taken &&
            !warden.bought.includes(card) &&
            !isElementPick(card) &&
            readCardPrice(offered.rarity) <= budget
        );
    };
    const line = findLineCard(warden.offer, open);
    if (line >= 0) return line;
    let chosen = -1;
    warden.offer.forEach(({ card, rarity }, slot) => {
        const price = readCardPrice(rarity);
        if (!open(card)) return;
        if (chosen < 0 || price > readCardPrice(warden.offer[chosen].rarity))
            chosen = slot;
    });
    return chosen;
}

/** How well a room bot plays: a decent player's eyes and hands, so a run
 *  of bots measures the night against a person rather than a perfect aim.
 *  The wait and the lag are a person's; the stray is the one number
 *  calibrated, so that a bot alone falls for good around wave 12 after
 *  her self-revive, as the one measured solo run did: the method and its
 *  runs are in the pull request of issue #2331. */
export const decentWarden: BotSkill = {
    reactionSeconds: 0.35,
    trackingSeconds: 0.1,
    spreadRadians: 0.05,
    backAwayMetres: 4,
};

/** Seconds a bot spends in a breather before she says she is ready, as a
 *  person reads the offer, walks to the rack and back, and heals by the
 *  fire. */
export const lingerSeconds = 10;

/** Metres past a slam's ring a bot runs to, so her body clears it. */
const slamMarginMetres = 1;

/** The rings of the slams winding up: a bot runs out of one once she has
 *  seen it, as a person does at its warning. */
export function readSlamDangers(world: World): BotDanger[] {
    const dangers: BotDanger[] = [];
    for (const colossus of world.query(SlamTrait)) {
        const slam = colossus.get(SlamTrait);
        if (!slam?.winding) continue;
        dangers.push({
            at: [slam.x, 0, slam.z],
            radius: slam.radius + slamMarginMetres,
        });
    }
    return dangers;
}

/** Metres from a bolt's path a bot steps out to: her body's and the
 *  bolt's reach, and a step to spare. */
const boltMarginMetres = 1.5;
/** Seconds ahead a bot reads a bolt's path: one that would pass her within
 *  them she sidesteps, as a person does a bolt she sees coming. */
const boltWarningSeconds = 2;

/** Where each bolt stood at a bot's last move, by the world her stream
 *  holds: one a bot. The stream carries a bolt's place, not its flight. */
const boltSightings = new WeakMap<World, Map<Entity, BotPoint>>();

/** The point of each bolt's path nearest her, where it passes her within
 *  a step in the next two seconds: running out of it is a sidestep. A bolt
 *  she first sees this move has no flight yet, so it waits for the next. */
export function readBoltDangers({
    world,
    hero,
    moveSeconds,
}: BotTurn): BotDanger[] {
    const feet = hero.get(TransformTrait);
    const before = boltSightings.get(world);
    const seen = new Map<Entity, BotPoint>();
    const dangers: BotDanger[] = [];
    for (const bolt of world.query(BoltTrait, TransformTrait)) {
        const at = bolt.get(TransformTrait);
        if (!at) continue;
        seen.set(bolt, [at.x, at.y, at.z]);
        const last = before?.get(bolt);
        if (!last || !feet) continue;
        const speedX = (at.x - last[0]) / moveSeconds;
        const speedZ = (at.z - last[2]) / moveSeconds;
        const squared = speedX * speedX + speedZ * speedZ;
        if (squared < 1e-6) continue;
        const seconds =
            ((feet.x - at.x) * speedX + (feet.z - at.z) * speedZ) / squared;
        if (seconds <= 0 || seconds > boltWarningSeconds) continue;
        const passX = at.x + speedX * seconds;
        const passZ = at.z + speedZ * seconds;
        if (Math.hypot(feet.x - passX, feet.z - passZ) > boltMarginMetres)
            continue;
        dangers.push({ at: [passX, 0, passZ], radius: boltMarginMetres });
    }
    boltSightings.set(world, seen);
    return dangers;
}

/** The nearest downed teammate a standing bot walks to during a wave, to
 *  get her up as a person would, or none. */
export function findDownedTeammate({ world, hero }: BotTurn) {
    if (hero.has(LifeMachine.is.down)) return undefined;
    if (readPhase(world.queryFirst(PhaseTrait)) !== "fight") return undefined;
    const feet = hero.get(TransformTrait);
    if (!feet) return undefined;
    let nearest: BotPoint | undefined;
    let closest = Infinity;
    for (const warden of world.query(wardens)) {
        if (warden === hero || !warden.has(LifeMachine.is.down)) continue;
        const at = warden.get(TransformTrait);
        if (!at) continue;
        const metres = Math.hypot(at.x - feet.x, at.z - feet.z);
        if (metres < closest) {
            closest = metres;
            nearest = [at.x, at.y, at.z];
        }
    }
    return nearest;
}

/** Each bot's moves since her last word to the shop, by the world her
 *  stream holds: one a bot. */
const errandClocks = new WeakMap<World, number>();

/** Whether a bot's next word to the shop is due, counting this move. */
function isErrandDue(world: World) {
    const moves = (errandClocks.get(world) ?? errandMoves) + 1;
    errandClocks.set(world, moves);
    if (moves < errandMoves) return false;
    errandClocks.set(world, 0);
    return true;
}

/** How a room bot plays the siege with no page: the gun from the rack she
 *  holds, or the lance, at whatever is nearest, and the words a player's
 *  page sends from its keys and menus. It picks its element by its colour
 *  as the wardens gather, and says it is ready while they gather and at
 *  dawn, as the ready key and "go again" do, so its walk through the ring
 *  cancels no countdown. It takes a card of each offer, the rarest element
 *  card where one is offered, after one reroll of an offer with none, and
 *  buys one more, two from mid-run, once its coins run past its savings;
 *  and
 *  between waves walks to the fire to buy its gun, its tiers and a bigger
 *  fire, then says it is ready. */
export const bot: SceneBot = {
    weapons: [
        ...gunList.map((gun) => ({ name: gun, settings: guns[gun].settings })),
        { name: lanceWeapon, settings: lanceSettings },
    ],
    play(turn) {
        const { world, hero, send } = turn;
        const { messages } = siegePlugin;
        const siege = world.queryFirst(SiegeTrait)?.get(SiegeTrait);
        const phase = readPhase(world.queryFirst(PhaseTrait));
        const warden = hero.get(WardenTrait);
        if (!warden) return;
        const gathering = phase === "waiting" || phase === "over";
        const picking = phase === "breather" || warden.catchUp > 0;
        const unpicked = warden.taken === "" && warden.offer.length > 0;
        const chosen = (hero.get(WardenElementsTrait)?.first ?? "") !== "";
        const coins = hero.get(WalletTrait)?.coins ?? 0;
        const rerolling =
            picking &&
            unpicked &&
            warden.rerolls === 0 &&
            !warden.offer.some(({ card }) => isElementPick(card)) &&
            findLineCard(warden.offer) < 0 &&
            coins >= readRerollPrice(0);
        if (rerolling) {
            if (isErrandDue(world)) send(messages.reroll.name);
        } else if ((picking || (gathering && !chosen)) && unpicked)
            send(messages.pick.name, {
                slot: chooseBotSlot(warden.offer, warden.hue),
            });
        //  A card comes out of what she holds past her savings before the
        //  fire takes the rest.
        const slot =
            phase === "breather" && !rerolling
                ? chooseBotPurchase(hero, siege?.wave ?? 0)
                : -1;
        const errand = chooseBotErrand(turn);
        if (slot >= 0) {
            if (isErrandDue(world)) send(messages.buyCard.name, { slot });
        } else if (errand && isErrandDue(world))
            send(errand.signal.message.name, errand.signal.payload);
        const waiting = gathering || (phase === "dawn" && !errand);
        const lingered =
            (siege?.secondsLeft ?? 0) <= breatherSeconds - lingerSeconds;
        const resting =
            phase === "breather" &&
            lingered &&
            !unpicked &&
            !errand &&
            slot < 0;
        if ((waiting || resting) && !hero.has(ReadinessMachine.is.ready))
            send(messages.ready.name);
    },
    destination: (turn) =>
        findDownedTeammate(turn) ?? chooseBotErrand(turn)?.point,
    dangers: (turn) => [
        ...readSlamDangers(turn.world),
        ...readBoltDangers(turn),
    ],
    skill: decentWarden,
};
