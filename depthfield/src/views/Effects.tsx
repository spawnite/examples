import { useFrame } from "@react-three/fiber";
import { createQuery, type World } from "koota";
import { useWorld } from "koota/react";
import { useMemo } from "react";
import { Vector3 } from "three";
import { readEach, TransformTrait } from "@spawnite/engine";
import { EnemyKind, heroRadius, u } from "../rules/data";
import { readHeroPosition, type Spot } from "../rules/field";
import { findStage } from "../rules/stages";
import { useChoice } from "../store/choice";
import { triadTimes } from "../rules/enemies";
import {
    BlastTrait,
    BoltKind,
    BoltTrait,
    BoomerangTrait,
    EnemyTrait,
    EnemyPhase,
    EnemyShotTrait,
    LaserTrait,
    MineTrait,
    NovaTrait,
    StompTrait,
    type EnemyState,
} from "../rules/traits";
import { findRun } from "./findRun";
import { blendPosition, readStepFraction } from "./instances";
import { paintHazards } from "./paintHazards";
import { Painter } from "./painter";

//  Everything the source drew on its canvas beside the bodies: the stage's
//  hazard, the elites' and the boss's telegraphs and strikes, the tanks' lanes and stomps, the
//  blast rings, and the weapons' shots, beams, rings, mines and boomerangs.
//  One painter, filled from the world each frame.

const enemies = createQuery(EnemyTrait, TransformTrait);
const blasts = createQuery(BlastTrait, TransformTrait);
const stomps = createQuery(StompTrait, TransformTrait);
const lasers = createQuery(LaserTrait);
const novas = createQuery(NovaTrait, TransformTrait);
const mines = createQuery(MineTrait, TransformTrait);
const boomerangs = createQuery(BoomerangTrait, TransformTrait);
const bolts = createQuery(BoltTrait, TransformTrait);
const enemyShots = createQuery(EnemyShotTrait, TransformTrait);

const tints: Partial<Record<EnemyKind, string>> = {
    [EnemyKind.Elite]: "#ffe27a",
    [EnemyKind.CrimsonElite]: "#ff8a78",
    [EnemyKind.Boss]: "#ff5a4a",
};

const tellPhases = new Set([
    EnemyPhase.JavelinTell,
    EnemyPhase.RiftTell,
    EnemyPhase.ShearTell,
    EnemyPhase.Land,
    EnemyPhase.RingTell,
    EnemyPhase.RushTell,
    EnemyPhase.Triad,
]);

//  Written in place each frame.
const at = new Vector3();
const from = { x: 0, z: 0 };
const to = { x: 0, z: 0 };
const side = { x: 0, z: 0 };

/** The lane a dash will run along, `reach` metres from the enemy. */
function paintLane(
    painter: Painter,
    enemy: EnemyState,
    { reach, width, color, opacity }: LanePaint,
) {
    from.x = at.x;
    from.z = at.z;
    to.x = at.x + enemy.dashX * reach;
    to.z = at.z + enemy.dashZ * reach;
    painter.lane({ from, to, width, color, opacity });
}

interface LanePaint {
    reach: number;
    width: number;
    color: string;
    opacity: number;
}

/** A telegraph's charge: the bar over the enemy's head and the glow at
 *  its middle, both filling as the strike nears, and the filling shapes of
 *  the strike itself. */
function paintTell(painter: Painter, enemy: EnemyState, tint: string) {
    if (!enemy.tellSeconds || !tellPhases.has(enemy.phase)) return;
    const charge = Math.max(
        0,
        Math.min(1, 1 - enemy.phaseTimer / enemy.tellSeconds),
    );
    const barY = enemy.radius * 3 + u(36);
    painter.billboard({
        x: at.x,
        y: barY,
        z: at.z,
        width: u(40),
        height: u(6),
        color: "#101820",
        opacity: 0.8,
    });
    painter.billboard({
        x: at.x - u(19) * (1 - charge),
        y: barY,
        z: at.z + 0.01,
        width: u(38) * charge,
        height: u(4),
        color: tint,
    });
    painter.glow({
        x: at.x,
        y: u(24) + enemy.radius * 0.4,
        z: at.z + enemy.radius,
        width: u(10 + charge * 16),
        color: tint,
        opacity: 0.2 + charge * 0.7,
    });
    const width = enemy.kind === EnemyKind.Boss ? u(68) : u(44);
    if (
        (enemy.phase === EnemyPhase.JavelinTell ||
            enemy.phase === EnemyPhase.RushTell) &&
        enemy.dashX
    )
        paintLane(painter, enemy, {
            reach: enemy.reach * charge,
            width,
            color: tint,
            opacity: 0.45 + charge * 0.4,
        });
    if (enemy.phase === EnemyPhase.Land)
        painter.disc({
            at,
            radius: enemy.landRadius * charge,
            color: tint,
            opacity: 0.53,
        });
    if (enemy.phase === EnemyPhase.RiftTell)
        for (const mark of enemy.marks)
            painter.tellCircle({
                at: mark,
                radius: u(140),
                charge,
                color: tint,
            });
    if (enemy.phase === EnemyPhase.RingTell)
        painter.ring({
            at,
            radius: u(220),
            width: u(2 + charge * 12),
            share: charge,
            color: tint,
            opacity: 0.4 + charge * 0.6,
        });
    if (enemy.phase === EnemyPhase.ShearTell) {
        from.x = at.x;
        from.z = at.z;
        to.x = at.x + Math.cos(enemy.sweepFrom) * u(260) * charge;
        to.z = at.z + Math.sin(enemy.sweepFrom) * u(260) * charge;
        painter.lane({
            from,
            to,
            width: u(4 + charge * 8),
            color: tint,
            height: u(4),
        });
    }
    if (enemy.phase === EnemyPhase.Triad) {
        const elapsed = enemy.tellSeconds - enemy.phaseTimer;
        enemy.marks.forEach((mark, index) => {
            if (mark.done) return;
            const local = Math.max(0, Math.min(1, elapsed / triadTimes[index]));
            painter.disc({
                at: mark,
                radius: u(132) * local,
                color: tint,
                opacity: 0.53,
            });
        });
    }
}

/** An elite's or the boss's lanes, circles and blades, beside the charge. */
function paintAttack(painter: Painter, enemy: EnemyState, tint: string) {
    const width = enemy.kind === EnemyKind.Boss ? u(68) : u(44);
    const dashing =
        enemy.phase === EnemyPhase.JavelinTell ||
        enemy.phase === EnemyPhase.JavelinDash ||
        enemy.phase === EnemyPhase.RushTell ||
        enemy.phase === EnemyPhase.RushDash;
    if (dashing && enemy.dashX)
        paintLane(painter, enemy, {
            reach: enemy.reach,
            width,
            color: tint,
            opacity: 0.2,
        });
    if (enemy.phase === EnemyPhase.Land) {
        painter.disc({
            at,
            radius: enemy.landRadius,
            color: tint,
            opacity: 0.2,
        });
        painter.ring({
            at,
            radius: enemy.landRadius,
            width: u(3),
            color: tint,
        });
    }
    if (
        enemy.phase === EnemyPhase.RingTell ||
        enemy.phase === EnemyPhase.RingFire
    ) {
        const fire = enemy.phase === EnemyPhase.RingFire;
        painter.ring({
            at,
            radius: Math.max(u(8), fire ? enemy.ringRadius : u(220)),
            width: fire ? u(10) : u(2),
            color: tint,
        });
    }
    if (
        enemy.phase === EnemyPhase.ShearTell ||
        enemy.phase === EnemyPhase.ShearFire ||
        enemy.phase === EnemyPhase.Slash
    ) {
        from.x = at.x;
        from.z = at.z;
        if (enemy.phase === EnemyPhase.ShearTell) {
            to.x = at.x + Math.cos(enemy.sweepFrom) * u(260);
            to.z = at.z + Math.sin(enemy.sweepFrom) * u(260);
        } else {
            to.x = enemy.tipX;
            to.z = enemy.tipZ;
        }
        painter.lane({
            from,
            to,
            width: enemy.phase === EnemyPhase.ShearTell ? u(2) : u(8),
            color: tint,
            height: u(4),
        });
    }
    if (enemy.phase === EnemyPhase.Triad)
        for (const mark of enemy.marks)
            if (!mark.done)
                painter.ring({
                    at: mark,
                    radius: u(118),
                    width: u(2),
                    color: tint,
                });
}

/** A tank's telegraphs: the lane and DASH before its dash, and the stomp's
 *  ring filling after it. */
function paintTank(painter: Painter, enemy: EnemyState) {
    if (enemy.phase === EnemyPhase.StompCharge) {
        const fill = 1 - enemy.phaseTimer / 0.65;
        painter.disc({ at, radius: u(160), color: "#ff875c", opacity: 0.16 });
        painter.ring({ at, radius: u(160), width: u(2), color: "#ffb080" });
        painter.disc({
            at,
            radius: u(160) * fill,
            color: "#ffb080",
            opacity: 0.2,
        });
    }
    if (enemy.phase === EnemyPhase.Charge) {
        paintLane(painter, enemy, {
            reach: u(560 * 0.7),
            width: enemy.radius * 2 + u(10),
            color: "#ff925d",
            opacity: 0.21,
        });
        painter.disc({
            at,
            radius: enemy.radius + u(8 + (1 - enemy.phaseTimer) * 9),
            color: "#ffb080",
            opacity: 0.2,
        });
    }
}

function paintBolt(painter: Painter, kind: BoltKind, vx: number, vz: number) {
    const height = u(18);
    if (kind === BoltKind.Zap) {
        //  A jagged bolt: six joints jittered across its path.
        const length = 0.045;
        const startX = at.x - vx * length;
        const startZ = at.z - vz * length;
        const dx = at.x - startX;
        const dz = at.z - startZ;
        const span = Math.hypot(dx, dz) || 1;
        const normalX = -dz / span;
        const normalZ = dx / span;
        let lastX = startX;
        let lastZ = startZ;
        const time = performance.now() / 1000;
        for (let joint = 1; joint <= 6; joint++) {
            const share = joint / 6;
            const jag =
                joint === 6
                    ? 0
                    : Math.sin(time * 48 + joint * 2.3 + at.x * 42) *
                      0.5 *
                      u(16);
            const x = startX + dx * share + normalX * jag;
            const z = startZ + dz * share + normalZ * jag;
            from.x = lastX;
            from.z = lastZ;
            to.x = x;
            to.z = z;
            painter.lane({
                from,
                to,
                width: u(5),
                color: "#7ecbff",
                opacity: 0.67,
                height,
            });
            painter.lane({
                from,
                to,
                width: u(1.6),
                color: "#f7feff",
                height: height + 0.002,
            });
            lastX = x;
            lastZ = z;
        }
        return;
    }
    const shard = kind === BoltKind.Shard;
    from.x = at.x - vx * 0.02;
    from.z = at.z - vz * 0.02;
    to.x = at.x;
    to.z = at.z;
    painter.lane({
        from,
        to,
        width: shard ? u(2) : u(3),
        color: shard ? "#d7c4ff" : "#b4ee94",
        height,
    });
    painter.glow({
        x: at.x,
        y: height,
        z: at.z,
        width: shard ? u(3) : u(4),
        color: shard ? "#f4e9ff" : "#e5ffc9",
    });
}

/** Development: each body's ground circle and centre, to check overlaps
 *  and collisions, as the source's playtest toggle drew them. */
function paintAnchors(painter: Painter, world: World) {
    const mark = (spot: Spot, radius: number) => {
        painter.disc({ at: spot, radius, color: "#a9ed85", opacity: 0.15 });
        painter.ring({ at: spot, radius, width: u(1.5), color: "#d8ffae" });
    };
    readEach(world, enemies, ([enemy, position]) =>
        mark(position, enemy.radius),
    );
    const run = findRun(world);
    if (run)
        for (const prop of findStage(run.stage).props) mark(prop, prop.radius);
    mark(readHeroPosition(world), heroRadius);
}

export function Effects() {
    const world = useWorld();
    const painter = useMemo(() => new Painter(), []);

    useFrame(({ camera }) => {
        painter.begin(camera);
        paintHazards(painter, world);
        const fraction = readStepFraction();
        readEach(world, stomps, ([stomp], entity) => {
            blendPosition(entity, fraction, at);
            painter.disc({
                at,
                radius: u(160),
                color: "#ffb080",
                opacity: 0.33 * (stomp.life / 0.35),
            });
        });
        readEach(world, blasts, ([blast], entity) => {
            blendPosition(entity, fraction, at);
            const opacity = Math.max(0.25, blast.life / blast.maxLife);
            painter.disc({
                at,
                radius: blast.radius,
                color: "#ffd36a",
                opacity: 0.27 * opacity,
            });
            painter.ring({
                at,
                radius: blast.radius,
                width: u(2),
                color: "#ffe27a",
                opacity,
            });
        });
        readEach(world, enemies, ([enemy], entity) => {
            blendPosition(entity, fraction, at);
            if (enemy.kind === EnemyKind.Tank) paintTank(painter, enemy);
            const tint = tints[enemy.kind];
            if (!tint || enemy.dying) return;
            paintTell(painter, enemy, tint);
            paintAttack(painter, enemy, tint);
        });
        readEach(world, novas, ([nova], entity) => {
            blendPosition(entity, fraction, at);
            painter.ring({
                at,
                radius: nova.radius,
                width: u(3),
                color: "#9ad7ff",
            });
        });
        readEach(world, mines, ([mine], entity) => {
            blendPosition(entity, fraction, at);
            if (mine.spent) {
                painter.disc({
                    at,
                    radius: mine.radius * 0.35,
                    color: "#ffd0ea",
                    opacity: 0.53,
                });
                return;
            }
            painter.disc({ at, radius: u(7), color: "#ffd0ea" });
            painter.ring({
                at,
                radius: mine.radius,
                width: u(1),
                color: "#ffd0ea",
                opacity: 0.33,
            });
        });
        readEach(world, lasers, ([laser]) => {
            const fade = laser.life / 0.22;
            from.x = laser.fromX;
            from.z = laser.fromZ;
            to.x = laser.toX;
            to.z = laser.toZ;
            const height = u(18);
            painter.lane({
                from,
                to,
                width: u(17),
                color: "#4bb8ff",
                opacity: 0.27 * fade,
                height,
            });
            painter.lane({
                from,
                to,
                width: u(6),
                color: "#80ddff",
                opacity: fade,
                height: height + 0.002,
            });
            painter.lane({
                from,
                to,
                width: u(2),
                color: "#e5faff",
                opacity: fade,
                height: height + 0.004,
            });
        });
        readEach(world, boomerangs, ([boomerang], entity) => {
            blendPosition(entity, fraction, at);
            //  A spinning V of two blades.
            const spin = boomerang.age * 17;
            for (const blade of [-1, 1]) {
                const angle = spin + blade * 0.75;
                side.x = at.x + Math.cos(angle) * u(12);
                side.z = at.z + Math.sin(angle) * u(12);
                painter.lane({
                    from: at,
                    to: side,
                    width: u(5),
                    color: "#ffc589",
                    height: u(18),
                });
            }
        });
        readEach(world, bolts, ([bolt], entity) => {
            blendPosition(entity, fraction, at);
            paintBolt(painter, bolt.kind, bolt.vx, bolt.vz);
        });
        readEach(world, enemyShots, (_shot, entity) => {
            blendPosition(entity, fraction, at);
            const height = u(18);
            painter.glow({
                x: at.x,
                y: height,
                z: at.z,
                width: u(11),
                color: "#b586ef",
                opacity: 0.2,
            });
            painter.glow({
                x: at.x,
                y: height,
                z: at.z + 0.01,
                width: u(7),
                color: "#bd8af0",
            });
            painter.glow({
                x: at.x - u(2),
                y: height + u(2),
                z: at.z + 0.02,
                width: u(3),
                color: "#f3ddff",
            });
        });
        if (useChoice.getState().anchors) paintAnchors(painter, world);
        painter.end();
    });

    return <primitive object={painter.group} />;
}
