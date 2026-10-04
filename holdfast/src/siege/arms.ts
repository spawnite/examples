import type { World } from "koota";
import { HeldWeaponsTrait } from "@spawnite/engine/core";
import { CardId } from "./cards";
import { readGun } from "./guns";
import { lanceWeapon } from "./lance";
import { WardenTrait } from "./traits";
import { queryWardens } from "./wardens";

//  The weapons each warden holds: the room refuses a shot from any other,
//  and her trigger fires none. The gun from the fire's rack in her hand,
//  the blaster until she buys another, and the lance once she takes
//  its card. Read off her gun and her cards on every step, so a purchase,
//  a pick, a late joiner's catch-up and a new run's drop each move the
//  list with them. The scene's Player hands her the blaster as she spawns,
//  before this first runs.

/** Whether `held` names `gun`, and the lance where `lance` says. */
function isHeld(held: readonly string[], gun: string, lance: boolean) {
    return (
        held.length === (lance ? 2 : 1) &&
        held[0] === gun &&
        (!lance || held[1] === lanceWeapon)
    );
}

/** Sets each warden's held weapons from her gun and her cards, where they
 *  changed. */
export function holdWardenWeapons(world: World) {
    for (const warden of queryWardens(world)) {
        const { gun } = readGun(warden);
        const cards = warden.get(WardenTrait)?.cards ?? [];
        const lance = cards.includes(CardId.StormLance);
        const held = warden.get(HeldWeaponsTrait);
        if (held && isHeld(held, gun, lance)) continue;
        const weapons = lance ? [gun, lanceWeapon] : [gun];
        if (held) warden.set(HeldWeaponsTrait, weapons);
        else warden.add(HeldWeaponsTrait(weapons));
    }
}
