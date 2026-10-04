import { useWorld } from "koota/react";
import { useEffect } from "react";
import { registerWeapon } from "@spawnite/engine";
import { gunList, guns } from "../siege/guns";
import { lanceSettings, lanceWeapon } from "../siege/lance";

/** Registers the weapons the room's judge accepts shots from, on the
 *  room's world and every page's alike: each gun of the fire's rack, and
 *  the lance, which hurts nothing until a warden's card gives it
 *  damage. Which of them a warden may fire is her `HeldWeaponsTrait`. */
export function Arsenal() {
    const world = useWorld();
    useEffect(() => {
        const removals = [
            ...gunList.map((gun) =>
                registerWeapon(world, gun, guns[gun].settings),
            ),
            registerWeapon(world, lanceWeapon, lanceSettings),
        ];
        return () => {
            for (const remove of removals) remove();
        };
    }, [world]);
    return null;
}
