import { Vector3 } from "three";
import {
    Camera,
    CameraPreset,
    Chase,
    chaserCollides,
    CollisionLayer,
    Entity,
    Health,
    HeldItem,
    Pickup,
    Player,
    PointerButton,
    Replicas,
    Spin,
    Weapon,
    WeaponKind,
    World,
    type Position,
} from "@spawnite/engine";
import { EntityOverlay, Overlay } from "../components/Overlay";
import { Instructions } from "../hud/Instructions";
import { heroineAvatar } from "../avatars";
import "../models";

//  A room and `spawnite simulate` load this file alone, so it exports the
//  game's plugins.
export { plugins } from "../game";

//  The arena's one scene, which the room mounts headless and every page
//  mounts to draw it: the room spawns the monsters and coins, and on a page
//  each Entity draws the one the room streams at its place.

const monsterCount = 4;
//  Far enough out that the coins near the spawn are hers before they arrive.
const monsterRingMetres = 16;
//  Slower than her run (5 m/s): a monster she walks away from stays behind
//  her, and one she stands beside stops at reach rather than crowding her
//  into the room's collisions.
const monsterSpeed = 2.5;
const monsterReachMetres = 1.5;
//  Monsters block the players here, to keep that case tested.
const monsterCollides = [...chaserCollides, CollisionLayer.Players];
/** Half a metre off the ground, so a coin floats where she can see it. */
const coinHeightMetres = 0.4;
/** A monster's health and a heroine's are 100: ten rifle hits each, or
 *  four stones. */
const rifleDamage = 10;
const slingDamage = 25;

/** The positions of `count` points round the origin at `radius` metres and
 *  `height` up, the first `offset` radians round from the positive z axis. */
function createRingPositions(
    count: number,
    radius: number,
    offset: number,
    height: number,
) {
    return Array.from({ length: count }, (_, index) => {
        const angle = offset + (index / count) * Math.PI * 2;
        return new Vector3(
            Math.sin(angle) * radius,
            height,
            Math.cos(angle) * radius,
        );
    });
}

/** Four monsters on a ring round the heroines' spawn. */
export const monsterPositions: Vector3[] = createRingPositions(
    monsterCount,
    monsterRingMetres,
    0,
    0,
);

/** Four coins close in on the diagonals, eight farther out on the axes and
 *  between them: the same twelve in every room. */
export const coinPositions: Vector3[] = [
    ...createRingPositions(4, 3, Math.PI / 4, coinHeightMetres),
    ...createRingPositions(8, 6, 0, coinHeightMetres),
];

function toPosition(position: Vector3): Position {
    return [position.x, position.y, position.z];
}

/** The rifle in every heroine's right hand: a barrel from her grip
 *  forward, the way the hand faces. The kit holds no gun. */
function Rifle() {
    return (
        <HeldItem position={[0, 0, -0.15]}>
            <mesh castShadow>
                <boxGeometry args={[0.05, 0.08, 0.45]} />
                <meshStandardMaterial color="#2b2b30" />
            </mesh>
        </HeldItem>
    );
}

/** The meadow: every heroine, one per page in the room, each monster
 *  chasing the nearest of them, and the coins in reach of all of them. */
export function Arena() {
    return (
        <World map="meadow">
            {/*  Its own overlay draws each heroine's name over her bar. */}
            <Player avatar={heroineAvatar} nameplate={false} />
            <Camera preset={CameraPreset.Shooter} />
            <Weapon
                name="rifle"
                damage={rifleDamage}
                range={40}
                shotsPerSecond={4}
            />
            <Weapon
                name="sling"
                kind={WeaponKind.Projectile}
                damage={slingDamage}
                range={30}
                shotsPerSecond={1}
                speed={20}
                model="stone"
                button={PointerButton.Secondary}
            />
            {monsterPositions.map((position, index) => (
                <Entity
                    key={`monster-${index}`}
                    model="monster"
                    position={toPosition(position)}
                >
                    {/*  A capsule inside the drawn rock's 0.84 m width, and
                        0.1 m taller than its 0.61 m: just over her 0.6 m
                        step, so she jumps onto it rather than walking up
                        it. */}
                    <Chase
                        speed={monsterSpeed}
                        reach={monsterReachMetres}
                        radius={0.3}
                        height={0.7}
                        collides={monsterCollides}
                    />
                    <Health maximum={100} />
                    <EntityOverlay />
                </Entity>
            ))}
            {coinPositions.map((position, index) => (
                <Entity
                    key={`coin-${index}`}
                    model="coin"
                    position={toPosition(position)}
                >
                    <Pickup reward={1} />
                    <Spin speed={2} />
                </Entity>
            ))}
            {/*  The heroines, which the room spawns for each page rather
                than the scene. */}
            <Replicas>
                {(entity) => (
                    <>
                        <Overlay entity={entity} />
                        <Rifle />
                    </>
                )}
            </Replicas>
            <Instructions />
        </World>
    );
}
