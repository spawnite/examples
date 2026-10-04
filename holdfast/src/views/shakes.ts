import type { World } from "koota";
import { shakeCamera, type CameraShakeOptions } from "@spawnite/engine";
import { StrikeKind } from "../siege/traits";

//  How Holdfast's moments shake a warden's camera together: small, brief
//  and tied to her own actions, as Halo and Deep Rock Galactic keep
//  theirs. Every moment stacks to a cap below the engine's whole shake,
//  her own shots to less, and a teammate's reaction or capstone shakes her
//  half as hard as her own. Every other moment's strength sits with the
//  view that draws it.

/** The most shake Holdfast's moments stack to, of the engine's whole
 *  shake at 1: the view turns at most 0.43° and rolls 0.86°, against 1.2°
 *  and 2.4° at a whole shake. */
export const shakeCap = 0.6;

/** The most her own shots stack to, so a held trigger shakes her no more
 *  than one heavy shot does. */
export const shotShakeCap = 0.35;

/** The share of a teammate's reaction or capstone her camera feels, of
 *  what her own shakes it. */
export const teammateShakeShare = 0.5;

/** How hard each reaction and capstone shakes the camera of the warden who
 *  set it off, where it lands: the loud ones hardest, and Thunderhead,
 *  which falls every few seconds while its warden fires, barely. An arc
 *  shakes nothing. */
const strikeShakes: Partial<Record<StrikeKind, number>> = {
    [StrikeKind.Blast]: 0.45,
    [StrikeKind.Meltdown]: 0.4,
    [StrikeKind.ChainShock]: 0.35,
    [StrikeKind.Shatter]: 0.25,
    [StrikeKind.SteamCloud]: 0.2,
    [StrikeKind.Thunderhead]: 0.15,
};

/** How hard a strike of `kind` shakes her camera: her own at its whole
 *  strength and a teammate's at a share of it, or undefined for one that
 *  shakes nothing. */
export function readStrikeShake(kind: StrikeKind, own: boolean) {
    const strength = strikeShakes[kind];
    if (strength === undefined) return undefined;
    return own ? strength : strength * teammateShakeShare;
}

/** Shakes her camera for a moment of the siege, stacked no higher than
 *  Holdfast's cap. */
export function shakeView(
    world: World,
    options: Omit<CameraShakeOptions, "cap">,
) {
    shakeCamera(world, { ...options, cap: shakeCap });
}

/** Kicks her camera for one of her own shots, stacked no higher than her
 *  shots' cap. */
export function kickView(world: World, strength: number) {
    shakeCamera(world, { strength, cap: shotShakeCap });
}
