import { useFrame } from "@react-three/fiber";
import type { World } from "koota";
import { useWorld } from "koota/react";
import { useRef } from "react";
import { Matrix4, type Group } from "three";
import { NetworkEntitiesTrait, WelcomesTrait } from "@spawnite/engine";
import { disposeMonsterRig, type MonsterRig } from "./rig";
import { MonsterClip } from "./models";
import { flashSeconds, measureProgress } from "./motion";
import { paintSkin, type SkinLight } from "./skin";

//  What a monster leaves when the room takes it away: its body blending
//  from the pose it died in into its fall where it stood, then sinking into
//  the ground with its shadow. The room forgets a monster the step it dies,
//  so the page keeps the body for the show. One the room recalled, to rise
//  again with the wave's next batch, did not die: it sinks at once into
//  the rift the room opens under it, in the pose it stood in: the rift
//  names the monster by the id the stream gave it.

/** Seconds a body lies before it sinks, and takes to sink. */
const lieSeconds = 1.1;
const sinkSeconds = 0.8;
/** Metres a body sinks: through the ground, whatever its size. */
const sinkMetres = 2.5;
/** Seconds the fall takes to take over from the pose it died in. */
const blendSeconds = 0.2;
/** Seconds a recalled body takes to sink. */
const recallSinkSeconds = 0.6;
/** Seconds a recall's rift and the body it takes wait for each other: the
 *  stream brings both in one send, in either order. */
const recallWaitSeconds = 0.5;

interface Corpse {
    rig: MonsterRig;
    /** The id the stream named the monster by, where a room streamed it. */
    id: string | undefined;
    seconds: number;
    /** Where it sank from. */
    y: number;
    /** The welcomes the page had taken as it fell: a welcome since, as a
     *  seek makes, shows a moment it did not fall in. */
    welcomes: number;
    /** Whether the room recalled it rather than killed it. */
    recalled: boolean;
    /** The corpses' clock as it fell. */
    born: number;
}

/** A recall's rift that no body has come to yet: the id of the monster
 *  it takes, and when the page heard it. */
interface Recall {
    id: string;
    at: number;
}

const corpses = new Set<Corpse>();
const recalls: Recall[] = [];
/** Seconds the corpses have advanced: the clock a rift and a body meet
 *  on. */
let clock = 0;
//  Written in place each frame.
const light: SkinLight = { flash: 0, wash: 1, threat: 0 };
let holder: Group | null = null;

/** The welcomes the page's world has taken, as a view reads it when its
 *  monster mounts. */
export function readWelcomes(world: World) {
    return world.get(WelcomesTrait)?.count ?? 0;
}

/** Whether the room took the monster it streams as `id` away in play, a
 *  death, where the page's world has taken no welcome since `welcomes`. A
 *  welcome, a rejoin's or a replay's seek, takes the whole stream down: a
 *  monster it brings straight back under its id stands, and one it leaves
 *  out was gone before the moment the page now shows, so neither falls. */
export function isTakenAway(
    world: World,
    id: string | undefined,
    welcomes: number,
) {
    if (readWelcomes(world) !== welcomes) return false;
    return (
        id === undefined ||
        world.get(NetworkEntitiesTrait)?.get(id)?.isAlive() !== true
    );
}

/** The group the bodies lie in, the Corpses view's own. */
export function setCorpseGroup(group: Group | null) {
    holder = group;
}

interface DropCorpseOptions {
    /** The id the stream named the monster by, where a room streamed it. */
    id: string | undefined;
    /** Where its body stood in the world as it died. */
    placement: Matrix4;
    /** The welcomes the page had taken as it died. */
    welcomes: number;
}

/** Hands a monster's body to the ground to fall and sink where it stood. */
export function dropCorpse(
    rig: MonsterRig,
    { id, placement, welcomes }: DropCorpseOptions,
) {
    const fall = rig.actions[MonsterClip.Fall];
    if (!holder || !fall) {
        disposeMonsterRig(rig);
        return;
    }
    placement.decompose(
        rig.object.position,
        rig.object.quaternion,
        rig.object.scale,
    );
    for (const action of Object.values(rig.actions))
        if (action !== fall && action.isRunning()) action.fadeOut(blendSeconds);
    fall.reset().fadeIn(blendSeconds).play();
    light.flash = rig.skin.flash;
    light.wash = rig.skin.wash;
    light.threat = 0;
    paintSkin(rig.skin, light);
    holder.add(rig.object);
    //  Its shadow stays where it stood, on the ground.
    rig.shadow.getWorldPosition(rig.shadow.position);
    holder.add(rig.shadow);
    corpses.add({
        rig,
        id,
        seconds: 0,
        y: rig.object.position.y,
        welcomes,
        recalled: false,
        born: clock,
    });
}

/** Sinks the body of the monster the stream named `id` into the rift the
 *  room recalled it into, as the corpses next move on, whether the body
 *  came before the rift or comes within a moment after. */
export function recallCorpse(id: string) {
    recalls.push({ id, at: clock });
}

/** The body `rift` takes: its monster's, fallen within a moment of it and
 *  taken by no rift yet. */
function findRecalled(rift: Recall) {
    for (const corpse of corpses)
        if (
            !corpse.recalled &&
            corpse.id === rift.id &&
            Math.abs(corpse.born - rift.at) <= recallWaitSeconds
        )
            return corpse;
    return undefined;
}

/** Gives each rift waiting its body, before any body moves on, so a body a
 *  rift takes still holds the pose it stood in. */
function takeRecalled() {
    for (let index = recalls.length - 1; index >= 0; index--) {
        const body = findRecalled(recalls[index]);
        if (!body) continue;
        body.recalled = true;
        body.seconds = 0;
        recalls.splice(index, 1);
    }
}

/** Moves each body on by `delta` seconds of its fall and sink, and takes
 *  away one that has sunk, or that fell before a welcome the page has
 *  taken since. */
export function advanceCorpses(world: World, delta: number) {
    const welcomes = readWelcomes(world);
    takeRecalled();
    clock += delta;
    while (recalls.length > 0 && clock - recalls[0].at > recallWaitSeconds)
        recalls.shift();
    for (const corpse of corpses) {
        corpse.seconds += delta;
        //  A recalled body holds the pose it stood in as it sinks.
        if (!corpse.recalled) corpse.rig.mixer.update(delta);
        const { rig } = corpse;
        //  The hit that killed it still fades.
        if (rig.skin.flash > 0) {
            light.flash = Math.max(0, rig.skin.flash - delta / flashSeconds);
            light.wash = rig.skin.wash;
            light.threat = 0;
            paintSkin(rig.skin, light);
        }
        const lies = corpse.recalled ? 0 : lieSeconds;
        const sinks = corpse.recalled ? recallSinkSeconds : sinkSeconds;
        const sinking = Math.max(0, corpse.seconds - lies);
        rig.object.position.y = corpse.y - (sinking / sinks) * sinkMetres;
        rig.shadow.scale.setScalar(
            rig.shadowMetres *
                Math.max(0.001, 1 - measureProgress(sinking, sinks)),
        );
        if (sinking < sinks && corpse.welcomes === welcomes) continue;
        holder?.remove(corpse.rig.object);
        disposeMonsterRig(corpse.rig);
        corpses.delete(corpse);
    }
}

export function Corpses() {
    const world = useWorld();
    const groupRef = useRef<Group>(null);
    useFrame((_state, delta) => {
        setCorpseGroup(groupRef.current);
        advanceCorpses(world, delta);
    });
    return <group ref={groupRef} />;
}
