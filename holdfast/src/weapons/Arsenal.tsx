import { useWorld } from "koota/react";
import { useEffect } from "react";
import { registerWeapon } from "@spawnite/engine";
import { blasterSettings, blasterWeapon } from "../siege/blaster";
import { lanceSettings, lanceWeapon } from "../siege/lance";

/** Registers the weapons the room's judge accepts shots from, on the
 *  room's world and every page's alike: the blaster, and the Storm Lance,
 *  which hurts nothing until a warden's card gives it damage. */
export function Arsenal() {
    const world = useWorld();
    useEffect(() => {
        const removals = [
            registerWeapon(world, blasterWeapon, blasterSettings),
            registerWeapon(world, lanceWeapon, lanceSettings),
        ];
        return () => {
            for (const remove of removals) remove();
        };
    }, [world]);
    return null;
}
