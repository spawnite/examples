import { useFrame, useThree, type Size } from "@react-three/fiber";
import type { Entity, World } from "koota";
import { useWorld } from "koota/react";
import { useEffect, useRef, useState } from "react";
import { Ray, Raycaster, Vector2, Vector3, type Camera } from "three";
import {
    aimShot,
    fanPellet,
    findDrawnTarget,
    findPlayerHero,
    HealthTrait,
    measureCoverDistance,
    readWeaponNumber,
    useHeadless,
    useRoom,
    WeaponNumber,
    type CoverTest,
    type TargetSearch,
    type WeaponSettings,
} from "@spawnite/engine";
import { blasterSettings, blasterWeapon } from "../siege/blaster";
import { CardId } from "../siege/cards";
import { lanceSettings, lanceWeapon } from "../siege/lance";
import { WardenTrait } from "../siege/traits";
import { playSound, Sound } from "../audio/sounds";
import { HitMark, markHit } from "../hud/HitMarker";
import { Beam, measureBeamSeconds, type DrawnBeam } from "../views/Beam";
import { readWardenColor } from "../views/palette";
import { findMuzzle, markShot } from "../views/warden/muzzles";

//  Her trigger on this page: the left button, held, fires the blaster at
//  her rate from her barrel toward what the crosshair meets; the right
//  fires the Storm Lance once she has taken its card. Each pull goes to
//  the room, and its lines are drawn at once, with the gun's flash and the
//  crosshair's mark. The room judges each pellet and streams where it
//  ended to everyone else.

/** A weapon a button fires: its name as the room knows it, its settings,
 *  and whether its beam draws heavy. */
interface Armament {
    name: string;
    settings: WeaponSettings;
    heavy: boolean;
}

/** The mouse's left and right buttons, as a pointer event numbers them. */
enum MouseButton {
    Left = 0,
    Right = 2,
}

const armaments: Partial<Record<MouseButton, Armament>> = {
    [MouseButton.Left]: {
        name: blasterWeapon,
        settings: blasterSettings,
        heavy: false,
    },
    [MouseButton.Right]: {
        name: lanceWeapon,
        settings: lanceSettings,
        heavy: true,
    },
};

//  Written in place for each pull: the middle of the screen, the ray
//  through it, each pellet's test against what this page draws, and its
//  cast for cover in its way.
const middle = new Vector2(0, 0);
const pointer = new Vector2();
const raycaster = new Raycaster();
const search: TargetSearch = {
    test: {
        ray: new Ray(),
        range: 0,
        feet: new Vector3(),
        body: { radius: 0, height: 0 },
    },
    shooter: null,
};
const cover: CoverTest = { ray: search.test.ray, range: 0, target: null };
/** Her barrel's end where her gun is drawn. */
const muzzle = new Vector3();

/** One pull of a weapon from this page: her hero and her colour, the
 *  weapon, the camera's ray through the pointer, and whether that ray runs
 *  through the crosshair. */
interface Pull {
    world: World;
    hero: Entity;
    hue: number;
    armament: Armament;
    ray: Ray;
    throughCrosshair: boolean;
    nextId: () => number;
}

/** What one pull drew: its lines, and whether it hit and killed. */
interface PullDrawn {
    lines: DrawnBeam[];
    killing: boolean;
}

/** Sends the pull to the room, and returns each pellet's line as the room
 *  fans them, to what this page draws in its way; null where she has no
 *  aim. */
function firePull({
    world,
    hero,
    hue,
    armament,
    ray,
    throughCrosshair,
    nextId,
}: Pull): PullDrawn | null {
    const { settings } = armament;
    //  From her barrel, so the bolt she sees is the ray the room judges.
    const aimed = aimShot(world, {
        hero,
        pointer: ray,
        weapon: settings,
        throughCrosshair,
        muzzle: findMuzzle(hue, muzzle) ? muzzle : undefined,
    });
    if (!aimed) return null;
    useRoom.getState().sendShot({
        weapon: armament.name,
        origin: aimed.origin.toArray(),
        direction: aimed.direction.toArray(),
    });
    const range = readWeaponNumber(settings, hero, WeaponNumber.Range);
    const pellets = readWeaponNumber(settings, hero, WeaponNumber.Pellets);
    const damage = readWeaponNumber(settings, hero, WeaponNumber.Damage);
    const color = readWardenColor(hue);
    let killing = false;
    const lines: DrawnBeam[] = [];
    for (let pellet = 0; pellet < pellets; pellet++) {
        const pelletRay = search.test.ray;
        pelletRay.origin.copy(aimed.origin);
        fanPellet(
            {
                direction: aimed.direction,
                pellet,
                pellets,
                spread: settings.spread ?? 0,
            },
            pelletRay.direction,
        );
        search.test.range = range;
        search.shooter = hero;
        const { target, distance } = findDrawnTarget(world, search);
        cover.range = range;
        cover.target = target;
        const coverDistance = measureCoverDistance(world, cover);
        const hit = target !== null && distance <= coverDistance;
        if (hit && (target.get(HealthTrait)?.current ?? Infinity) <= damage)
            killing = true;
        //  A lance passes through what it hits: its beam runs on to cover
        //  or its range.
        const through = armament.heavy ? coverDistance : distance;
        lines.push({
            id: nextId(),
            from: aimed.origin.clone(),
            to: pelletRay.at(
                Math.min(hit ? through : range, coverDistance),
                new Vector3(),
            ),
            color,
            hit,
            heavy: armament.heavy,
        });
    }
    return { lines, killing };
}

/** Whether she may fire what `button` names: the lance only once she has
 *  taken its card. */
function isArmed(button: MouseButton, cards: string[]) {
    return button !== MouseButton.Right || cards.includes(CardId.StormLance);
}

export function Trigger() {
    const world = useWorld();
    const headless = useHeadless();
    const readThree = useThree((state) => state.get);
    const heldRef = useRef(new Set<MouseButton>());
    const pointerRef = useRef(new Vector2());
    const nextShotRef = useRef(new Map<MouseButton, number>());
    const lineIdRef = useRef(0);
    const [lines, setLines] = useState<DrawnBeam[]>([]);

    useEffect(() => {
        if (headless) return;
        const canvas = readThree().gl.domElement;
        const press = (event: PointerEvent) => {
            if (
                event.button !== MouseButton.Left &&
                event.button !== MouseButton.Right
            )
                return;
            //  From the canvas alone, or anywhere while it holds the cursor:
            //  a press on the HUD fires nothing.
            const locked = canvas.ownerDocument.pointerLockElement === canvas;
            if (!locked && event.target !== canvas) return;
            heldRef.current.add(event.button);
            pointerRef.current.set(event.clientX, event.clientY);
        };
        const move = (event: PointerEvent) =>
            pointerRef.current.set(event.clientX, event.clientY);
        const release = (event: PointerEvent) => {
            heldRef.current.delete(event.button);
        };
        const letGo = () => {
            heldRef.current.clear();
        };
        //  The right button fires the lance, not the page's menu.
        const keepMenu = (event: MouseEvent) => event.preventDefault();
        window.addEventListener("pointerdown", press);
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", release);
        window.addEventListener("blur", letGo);
        canvas.addEventListener("contextmenu", keepMenu);
        canvas.ownerDocument.addEventListener("pointerlockchange", letGo);
        return () => {
            window.removeEventListener("pointerdown", press);
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", release);
            window.removeEventListener("blur", letGo);
            canvas.removeEventListener("contextmenu", keepMenu);
            canvas.ownerDocument.removeEventListener(
                "pointerlockchange",
                letGo,
            );
        };
    }, [headless, readThree]);

    /** The camera's ray through the crosshair, or through a free cursor. */
    function aimRay(camera: Camera, size: Size, throughCrosshair: boolean) {
        if (throughCrosshair) pointer.copy(middle);
        else
            pointer.set(
                ((pointerRef.current.x - size.left) / size.width) * 2 - 1,
                -((pointerRef.current.y - size.top) / size.height) * 2 + 1,
            );
        raycaster.setFromCamera(pointer, camera);
        return raycaster.ray;
    }

    useFrame(({ camera, size, gl }) => {
        if (headless || heldRef.current.size === 0) return;
        const now = performance.now();
        const hero = findPlayerHero(world);
        const survivor = hero?.get(WardenTrait);
        if (!hero || !survivor || survivor.down) return;
        const throughCrosshair =
            gl.domElement.ownerDocument.pointerLockElement === gl.domElement;
        const drawn: DrawnBeam[] = [];
        let hit = false;
        let killing = false;
        for (const button of heldRef.current) {
            const armament = armaments[button];
            if (!armament || !isArmed(button, survivor.cards)) continue;
            if (now < (nextShotRef.current.get(button) ?? 0)) continue;
            nextShotRef.current.set(
                button,
                now +
                    1000 /
                        readWeaponNumber(
                            armament.settings,
                            hero,
                            WeaponNumber.ShotsPerSecond,
                        ),
            );
            const pull = firePull({
                world,
                hero,
                hue: survivor.hue,
                armament,
                ray: aimRay(camera, size, throughCrosshair),
                throughCrosshair,
                nextId: () => lineIdRef.current++,
            });
            if (!pull) continue;
            drawn.push(...pull.lines);
            hit ||= pull.lines.some((line) => line.hit);
            killing ||= pull.killing;
        }
        if (drawn.length === 0) return;
        playSound(Sound.Shot);
        markShot(survivor.hue);
        if (hit) {
            playSound(Sound.Hit);
            markHit(killing ? HitMark.Kill : HitMark.Hit);
        }
        setLines((shown) => [...shown, ...drawn]);
        setTimeout(
            () =>
                setLines((shown) =>
                    shown.filter((line) => !drawn.includes(line)),
                ),
            measureBeamSeconds(drawn.some((line) => line.heavy)) * 1000,
        );
    });

    return lines.map((line) => (
        <Beam
            key={line.id}
            from={line.from}
            to={line.to}
            color={line.color}
            hit={line.hit}
            heavy={line.heavy}
        />
    ));
}
