import { useFrame, useThree, type Size } from "@react-three/fiber";
import type { Entity, World } from "koota";
import { useTraitEffect, useWorld } from "koota/react";
import { useEffect, useRef } from "react";
import { Ray, Raycaster, Vector2, Vector3, type Camera } from "three";
import {
    aimShot,
    scaleZoneDamage,
    fanPellet,
    findDrawnTarget,
    findPlayerHero,
    HealthTrait,
    holdsWeapon,
    isCursorCaptured,
    measureCoverDistance,
    readWeaponNumber,
    ShotResultsTrait,
    useHeadless,
    useRoom,
    WeaponNumber,
    type CoverTest,
    type TargetSearch,
    type WeaponSettings,
} from "@spawnite/engine";
import { GunId, guns, readGun } from "../siege/guns";
import { lanceSettings, lanceWeapon } from "../siege/lance";
import { WardenTrait } from "../siege/traits";
import { playSound, Sound } from "../audio/sounds";
import {
    HitMark,
    markHit,
    settleHitMark,
    takeBackHitMark,
} from "../hud/HitMarker";
import {
    Beam,
    measureBeamSeconds,
    useBeams,
    type DrawnBeam,
} from "../views/Beam";
import { kickCamera, readShotLook } from "./looks";
import { kickView } from "../views/shakes";
import { readWardenColor } from "../views/palette";
import { findMuzzle, markShot } from "../views/warden/muzzles";
import { LifeMachine } from "../siege/life";

//  Her trigger on this page: the left button, held, fires the gun from the
//  rack she holds at her rate from her barrel toward what the crosshair
//  meets; the right fires the lance once she has taken its card.
//  Each pull goes to the room, and its lines are drawn at once, with the
//  gun's flash, its sound and the crosshair's mark, gold with a ding where
//  a pellet struck a weak spot, and a shot the room refuses takes back its
//  mark and its lines' hits. The room judges each pellet and streams where
//  it ended to everyone else, and its word on the weak spot settles the
//  mark.

/** A weapon a button fires: its name as the room knows it, and its
 *  settings. */
interface Armament {
    name: string;
    settings: WeaponSettings;
}

/** How hard a rail shot that kills through a weak spot shakes her own
 *  camera: a small kick, under a reaction's, stacked with the shot's own
 *  no higher than her shots' cap. */
const railKillShake = 0.25;

/** The mouse's left and right buttons, as a pointer event numbers them. */
enum MouseButton {
    Left = 0,
    Right = 2,
}

/** The weapon `button` fires for `hero`: her gun from the rack on the
 *  left, the lance on the right. */
function readArmament(button: MouseButton, hero: Entity): Armament | undefined {
    if (button === MouseButton.Right)
        return { name: lanceWeapon, settings: lanceSettings };
    if (button !== MouseButton.Left) return undefined;
    const { gun } = readGun(hero);
    return { name: gun, settings: guns[gun].settings };
}

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

/** The lines one shot drew, and the second on the canvas's clock the last
 *  of them goes. */
interface ShotLines {
    lines: DrawnBeam[];
    until: number;
}

/** What one pull drew: its lines, whether it hit and killed, whether a
 *  pellet struck a weak spot, and the room's number for its shot, where it
 *  is in a room. */
interface PullDrawn {
    lines: DrawnBeam[];
    killing: boolean;
    critical: boolean;
    shot: number | null;
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
    const look = readShotLook(armament.name);
    //  From her barrel, so the bolt she sees is the ray the room judges.
    const aimed = aimShot(world, {
        hero,
        pointer: ray,
        weapon: settings,
        throughCrosshair,
        muzzle: findMuzzle(hue, muzzle) ? muzzle : undefined,
    });
    if (!aimed) return null;
    const shot = useRoom.getState().sendShot({
        weapon: armament.name,
        origin: aimed.origin.toArray(),
        direction: aimed.direction.toArray(),
    });
    const range = readWeaponNumber(settings, hero, WeaponNumber.Range);
    const pellets = readWeaponNumber(settings, hero, WeaponNumber.Pellets);
    const damage = readWeaponNumber(settings, hero, WeaponNumber.Damage);
    const spread = readWeaponNumber(settings, hero, WeaponNumber.Spread);
    const zoneDamage = readWeaponNumber(
        settings,
        hero,
        WeaponNumber.ZoneDamage,
    );
    const color = readWardenColor(hue);
    const held = readGun(hero);
    let killing = false;
    let critical = false;
    const lines: DrawnBeam[] = [];
    for (let pellet = 0; pellet < pellets; pellet++) {
        const pelletRay = search.test.ray;
        pelletRay.origin.copy(aimed.origin);
        fanPellet(
            {
                direction: aimed.direction,
                pellet,
                pellets,
                spread,
            },
            pelletRay.direction,
        );
        search.test.range = range;
        search.shooter = hero;
        const { target, distance, zone } = findDrawnTarget(world, search);
        cover.range = range;
        cover.target = target;
        const coverDistance = measureCoverDistance(world, cover);
        const hit = target !== null && distance <= coverDistance;
        const dealt = scaleZoneDamage(damage, zone, zoneDamage);
        if (hit && (target.get(HealthTrait)?.current ?? Infinity) <= dealt)
            killing = true;
        if (hit && zone) critical = true;
        //  A rail or a lance passes through what it hits: its line runs on
        //  to cover or its range.
        const through = look.through ? coverDistance : distance;
        lines.push({
            id: nextId(),
            from: aimed.origin.clone(),
            to: pelletRay.at(
                Math.min(hit ? through : range, coverDistance),
                new Vector3(),
            ),
            color,
            hit,
            kind: look.beam,
            range,
            tier: armament.name === held.gun ? held.tier : 0,
            shooter: hue,
        });
    }
    return { lines, killing, critical, shot };
}

export function Trigger() {
    const world = useWorld();
    const headless = useHeadless();
    const readThree = useThree((state) => state.get);
    const heldRef = useRef(new Set<MouseButton>());
    const pointerRef = useRef(new Vector2());
    const nextShotRef = useRef(new Map<MouseButton, number>());
    const lineIdRef = useRef(0);
    const { beams: lines, showBeams, rewriteBeams } = useBeams();
    //  The lines each shot still shown drew, by the room's number for it,
    //  and the second on the canvas's clock the last of them goes.
    const shotLinesRef = useRef(new Map<number, ShotLines>());
    const refusedShot = useRoom((state) => state.refusedShot);

    //  The room's word on each of her shots' weak spots, which her mark
    //  takes: a pull is critical where any of its pellets struck one.
    useTraitEffect(world, ShotResultsTrait, (shots) => {
        const { heroId } = useRoom.getState();
        const judged = new Map<number, boolean>();
        for (const { shooter, shot, hits } of shots?.results ?? []) {
            if (shooter !== heroId || shot === undefined) continue;
            const critical = hits.some(({ zone }) => zone !== undefined);
            judged.set(shot, (judged.get(shot) ?? false) || critical);
        }
        for (const [shot, critical] of judged) settleHitMark(shot, critical);
    });

    //  A shot the room refused hit nothing: its mark comes off the
    //  crosshair and its lines end on nothing, as the engine's weapon does.
    useEffect(() => {
        if (refusedShot === null) return;
        takeBackHitMark(refusedShot.shot);
        const refused = shotLinesRef.current.get(refusedShot.shot)?.lines;
        if (!refused) return;
        rewriteBeams((line) =>
            refused.includes(line) ? { ...line, hit: false } : line,
        );
    }, [refusedShot, rewriteBeams]);

    useEffect(() => {
        if (headless) return;
        const canvas = readThree().gl.domElement;
        const press = (event: PointerEvent) => {
            if (
                event.button !== MouseButton.Left &&
                event.button !== MouseButton.Right
            )
                return;
            //  From the canvas alone, or anywhere while the browser locks
            //  the cursor to it: a press on the HUD fires nothing.
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

    useFrame(({ camera, size, gl, clock }) => {
        for (const [shot, { until }] of shotLinesRef.current)
            if (clock.elapsedTime >= until) shotLinesRef.current.delete(shot);
        if (headless || heldRef.current.size === 0) return;
        const now = performance.now();
        const hero = findPlayerHero(world);
        const survivor = hero?.get(WardenTrait);
        //  Sheltered while she takes the cards she missed, she fires
        //  nothing, as the room refuses her shots. Down, she fires at the
        //  half rate her stats then give her.
        if (!hero || !survivor || hero.has(LifeMachine.is.sheltered)) return;
        const throughCrosshair = isCursorCaptured(gl.domElement);
        const drawn: DrawnBeam[] = [];
        const shots: number[] = [];
        //  Each sound once a frame, at the tier of the gun that fired it.
        const sounds = new Map<Sound, number>();
        let hit = false;
        let killing = false;
        let critical = false;
        let railWeakSpotKill = false;
        for (const button of heldRef.current) {
            const armament = readArmament(button, hero);
            //  The lance only once her card has the room hand it to her.
            if (!armament || !holdsWeapon(hero, armament.name)) continue;
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
            kickCamera(world, armament.name);
            const { gun, tier } = readGun(hero);
            const sound = readShotLook(armament.name).sound;
            sounds.set(
                sound,
                Math.max(
                    sounds.get(sound) ?? 0,
                    armament.name === gun ? tier : 0,
                ),
            );
            drawn.push(...pull.lines);
            if (pull.shot !== null) {
                shots.push(pull.shot);
                shotLinesRef.current.set(pull.shot, {
                    lines: pull.lines,
                    until:
                        clock.elapsedTime +
                        Math.max(
                            ...pull.lines.map((line) =>
                                measureBeamSeconds(line.kind),
                            ),
                        ),
                });
            }
            hit ||= pull.lines.some((line) => line.hit);
            killing ||= pull.killing;
            critical ||= pull.critical;
            railWeakSpotKill ||=
                armament.name === GunId.Rail && pull.killing && pull.critical;
        }
        if (drawn.length === 0) return;
        for (const [sound, tier] of sounds) playSound(sound, { tier });
        markShot(survivor.hue);
        if (hit) {
            playSound(Sound.Hit);
            if (critical) playSound(Sound.Crit);
            if (killing) playSound(Sound.Kill);
            markHit(killing ? HitMark.Kill : HitMark.Hit, shots, critical);
        }
        //  The rail's payoff: a kill through a weak spot kicks her camera.
        if (railWeakSpotKill) kickView(world, railKillShake);
        showBeams(drawn);
    });

    return lines.map((line) => (
        <Beam
            key={line.id}
            from={line.from}
            to={line.to}
            color={line.color}
            hit={line.hit}
            kind={line.kind}
            range={line.range}
            tier={line.tier}
            shooter={line.shooter}
        />
    ));
}
