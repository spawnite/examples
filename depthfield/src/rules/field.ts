import { createQuery, type Entity, type World } from "koota";
import { Vector3 } from "three";
import {
    emitEvent,
    findPlayerHero,
    PreviousTransformTrait,
    readEach,
    TransformTrait,
} from "@spawnite/engine/core";
import { boundary, u } from "./data";
import { findStage } from "./stages";
import {
    CuesTrait,
    EnemyTrait,
    FelledTrait,
    ShotsTrait,
    RunTrait,
    SparksTrait,
    ToastTrait,
    type Cue,
    type EnemyState,
    type Fall,
    type Shot,
    type RunState,
    type Spark,
} from "./traits";

//  What every rule reaches for: the run, the hero, the props of its stage
//  the field's bodies push against, and the enemies near a spot.

const runs = createQuery(RunTrait);

/** The run's entity, spawned on the first ask. */
export function findRunEntity(world: World): Entity {
    return world.queryFirst(runs) ?? world.spawn(RunTrait);
}

/** The run's state, written in place. */
export function readRun(world: World): RunState {
    return findRunEntity(world).get(RunTrait)!;
}

const origin = new Vector3();

/** Where the hero stands; the centre while no hero has spawned. */
export function readHeroPosition(world: World): Vector3 {
    return findPlayerHero(world)?.get(TransformTrait) ?? origin;
}

/** A place on the ground to spawn a thing at: its transform, and the one
 *  the engine blends a drawn frame from. */
export function placeOnGround({ x, z }: Spot) {
    const position = new Vector3(x, 0, z);
    return [
        TransformTrait(position),
        PreviousTransformTrait(position.clone()),
    ] as const;
}

/** The Prismatic echo's offset from the hero, in metres. */
export const echoOffsetX = u(-42);
export const echoOffsetZ = u(25);

/** The props of the run's stage, which the field's bodies push round. */
export function readProps(world: World) {
    return findStage(readRun(world).stage).props;
}

/** Keeps an enemy inside the walls and out of every prop of the run's
 *  stage, pushing it out the way it came in. */
export function collide(
    world: World,
    { enemy, position }: Pick<Placed, "enemy" | "position">,
) {
    const radius = enemy.radius;
    const edge = boundary - radius;
    position.x = Math.max(-edge, Math.min(edge, position.x));
    position.z = Math.max(-edge, Math.min(edge, position.z));
    for (const prop of readProps(world)) {
        let dx = position.x - prop.x;
        let dz = position.z - prop.z;
        let distance = Math.hypot(dx, dz);
        if (distance >= radius + prop.radius) continue;
        if (distance < 0.001) {
            dx = 1;
            dz = 0;
            distance = 1;
        }
        position.x = prop.x + (dx / distance) * (radius + prop.radius);
        position.z = prop.z + (dz / distance) * (radius + prop.radius);
    }
}

/** A spot on the ground: a Vector3's x and z, or a mark's. */
export interface Spot {
    x: number;
    z: number;
}

/** A stretch of ground from one spot to another, such as a shot's path
 *  over a step. */
export interface Segment {
    from: Spot;
    to: Spot;
}

/** A segment's box grown by `pad` metres on every side: where a search
 *  for the enemies near it looks. */
export interface Area extends Segment {
    pad: number;
}

/** The metres from `point` to the segment. */
export function measureSegmentDistance(point: Spot, { from, to }: Segment) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const t = Math.max(
        0,
        Math.min(
            1,
            ((point.x - from.x) * dx + (point.z - from.z) * dz) /
                (dx * dx + dz * dz || 1),
        ),
    );
    return Math.hypot(point.x - from.x - t * dx, point.z - from.z - t * dz);
}

/** Throws `count` sparks, seven unless named, at a spot. */
export function throwSparks(
    world: World,
    {
        x,
        z,
        color,
        count = 7,
    }: Partial<Pick<Spark, "count">> & Omit<Spark, "count">,
) {
    emitEvent(findRunEntity(world), SparksTrait, (sparks) => {
        sparks.list.push({ x, z, color, count });
        return sparks;
    });
}

/** Tells the view an enemy fell at `fall`. */
export function markFall(world: World, fall: Fall) {
    emitEvent(findRunEntity(world), FelledTrait, (felled) => {
        felled.list.push(fall);
        return felled;
    });
}

/** Tells the view a weapon fired. */
export function markShot(world: World, shot: Shot) {
    emitEvent(findRunEntity(world), ShotsTrait, (shots) => {
        shots.list.push({ ...shot });
        return shots;
    });
}

export function playCue(world: World, cue: Cue) {
    emitEvent(findRunEntity(world), CuesTrait, (cues) => {
        cues.list.push(cue);
        return cues;
    });
}

export function say(world: World, text: string) {
    emitEvent(findRunEntity(world), ToastTrait, { text });
}

/** An enemy on the field this step, with its state and its place. */
export interface Placed {
    entity: Entity;
    enemy: EnemyState;
    position: Vector3;
    /** The last `near` that found it, so one ask lists it once. */
    stamp: number;
}

//  Metres a cell of the grid spans: the source's 128 units.
const cellSize = u(128);

/** The enemies a step walks, kept in a list and filed by grid cell, so a
 *  shot looks at the enemies near its path alone.
 *  ponytail: rebuilt once a step from a full walk; an engine spatial index
 *  would serve the engine's chase and aim too (see the pull request's
 *  engine gaps). */
export class EnemyGrid {
    all: Placed[] = [];
    private cells = new Map<number, Placed[]>();
    private serial = 0;

    rebuild(world: World) {
        this.all.length = 0;
        this.cells.clear();
        readEach(world, placedEnemies, ([enemy, position], entity) => {
            this.all.push({ entity, enemy, position, stamp: 0 });
        });
        for (const placed of this.all) {
            const { enemy, position } = placed;
            if (enemy.flee || enemy.dying) continue;
            const radius = enemy.radius;
            for (
                let x = Math.floor((position.x - radius) / cellSize);
                x <= Math.floor((position.x + radius) / cellSize);
                x++
            )
                for (
                    let z = Math.floor((position.z - radius) / cellSize);
                    z <= Math.floor((position.z + radius) / cellSize);
                    z++
                ) {
                    const key = cellKey(x, z);
                    const cell = this.cells.get(key);
                    if (cell) cell.push(placed);
                    else this.cells.set(key, [placed]);
                }
        }
    }

    /** Fills `into` with every live enemy whose cells meet the box round
     *  the segment, grown by `pad` metres, each once, and returns it. The
     *  caller keeps `into` as its own scratch, so a search inside another's
     *  loop leaves the outer list whole. */
    near({ from, to, pad }: Area, into: Placed[]) {
        into.length = 0;
        const stamp = ++this.serial;
        const fromX = Math.floor((Math.min(from.x, to.x) - pad) / cellSize);
        const toX = Math.floor((Math.max(from.x, to.x) + pad) / cellSize);
        const fromZ = Math.floor((Math.min(from.z, to.z) - pad) / cellSize);
        const toZ = Math.floor((Math.max(from.z, to.z) + pad) / cellSize);
        for (let x = fromX; x <= toX; x++)
            for (let z = fromZ; z <= toZ; z++) {
                const cell = this.cells.get(cellKey(x, z));
                if (!cell) continue;
                for (const placed of cell) {
                    if (placed.stamp === stamp) continue;
                    placed.stamp = stamp;
                    if (!placed.entity.isAlive() || placed.enemy.flee) continue;
                    into.push(placed);
                }
            }
        return into;
    }
}

function cellKey(x: number, z: number) {
    //  Both within ±64 cells on a field of ±1050 units.
    return (x + 1024) * 4096 + (z + 1024);
}

const placedEnemies = createQuery(EnemyTrait, TransformTrait);

const grids = new WeakMap<World, EnemyGrid>();

/** The world's grid, filed as the last rebuild left it. */
export function readGrid(world: World) {
    let grid = grids.get(world);
    if (!grid) grids.set(world, (grid = new EnemyGrid()));
    return grid;
}
