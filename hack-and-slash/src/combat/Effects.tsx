import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { useQuery } from "koota/react";
import {
    AdditiveBlending,
    CanvasTexture,
    CircleGeometry,
    DoubleSide,
    LinearFilter,
    MeshBasicMaterial,
    PlaneGeometry,
    SRGBColorSpace,
    type Group,
    type Mesh,
    type Texture,
} from "@spawnite/engine/three";
import type { Entity } from "koota";
import { itemIds, rarities, rarityColors } from "../items/items";
import { goldTexture, iconTexture } from "../items/icons";
import { goldLoot, LootTrait } from "../items/traits";
import {
    burstSeconds,
    floatSeconds,
    slashSeconds,
    boltRange,
    boltSpeed,
    swordHalfArc,
    swordReach,
} from "./systems";
import {
    ArrowTrait,
    BurstTrait,
    FloatKind,
    FloatTextTrait,
    SlashTrait,
} from "./traits";

/** Drawn after the world and over it, so an arc on a hillside or a number
 *  behind a tree still shows whole. */
const overWorld = 10;
/** Numbers draw over her too, after her sprite's own order. */
const overHero = 30;

/** Everything the fight draws for a moment, and the loot it leaves: one
 *  view per entity the step spawns. */
export function Effects() {
    const slashes = useQuery(SlashTrait);
    const arrows = useQuery(ArrowTrait);
    const floats = useQuery(FloatTextTrait);
    const bursts = useQuery(BurstTrait);
    const loot = useQuery(LootTrait);

    return (
        <>
            {slashes.map((entity) => (
                <SlashView key={entity.id()} entity={entity} />
            ))}
            {arrows.map((entity) => (
                <ArrowView key={entity.id()} entity={entity} />
            ))}
            {floats.map((entity) => (
                <FloatView key={entity.id()} entity={entity} />
            ))}
            {bursts.map((entity) => (
                <BurstView key={entity.id()} entity={entity} />
            ))}
            {loot.map((entity) => (
                <LootView key={entity.id()} entity={entity} />
            ))}
        </>
    );
}

/** Radians about y that turn +x onto the ground direction (x, z). */
function yawOf(x: number, z: number) {
    return Math.atan2(-z, x);
}

/** The sword's arc, level at her middle where she swung, bright as it lands
 *  and fading out. It draws over the ground, so a slope never cuts it. */
function SlashView({ entity }: { entity: Entity }) {
    const group = useRef<Group>(null);
    const material = useRef<MeshBasicMaterial>(null);

    useFrame(() => {
        if (!entity.isAlive() || !group.current || !material.current) return;
        const { x, y, z, dirX, dirZ, age } = entity.get(SlashTrait)!;
        const done = age / slashSeconds;
        group.current.position.set(x, y, z);
        group.current.rotation.y = yawOf(dirX, dirZ);
        group.current.scale.setScalar(0.85 + done * 0.2);
        material.current.opacity = 0.85 * (1 - done);
    });

    return (
        <group ref={group}>
            <mesh rotation-x={-Math.PI / 2} renderOrder={overWorld}>
                <ringGeometry
                    args={[
                        0.55,
                        swordReach,
                        20,
                        1,
                        -swordHalfArc,
                        swordHalfArc * 2,
                    ]}
                />
                <meshBasicMaterial
                    ref={material}
                    color="#fff4c8"
                    transparent
                    blending={AdditiveBlending}
                    depthTest={false}
                    depthWrite={false}
                    side={DoubleSide}
                    toneMapped={false}
                />
            </mesh>
        </group>
    );
}

/** An arrow: a shaft, a head and fletching along its flight. */
/** A crossbow's bolt in flight: short and heavy, its head steel and its
 *  vanes pale. In the last fifth of its range it drops toward the ground
 *  and shrinks away, so its end is seen. */
function ArrowView({ entity }: { entity: Entity }) {
    const group = useRef<Group>(null);

    useFrame(() => {
        if (!entity.isAlive() || !group.current) return;
        const { x, y, z, dirX, dirZ, age } = entity.get(ArrowTrait)!;
        const flown = (age * boltSpeed) / boltRange;
        const falling = Math.max(0, (flown - 0.8) / 0.2);
        group.current.position.set(x, y - falling * 0.6, z);
        group.current.rotation.y = yawOf(dirX, dirZ);
        group.current.rotation.z = -falling * 0.5;
        group.current.scale.setScalar(1 - falling * 0.7);
    });

    return (
        <group ref={group}>
            <mesh>
                <boxGeometry args={[0.46, 0.05, 0.05]} />
                <meshBasicMaterial color="#6b4a2b" />
            </mesh>
            <mesh position-x={0.27} rotation-z={-Math.PI / 2}>
                <coneGeometry args={[0.055, 0.12, 4]} />
                <meshBasicMaterial color="#d8dde3" />
            </mesh>
            <mesh position-x={-0.19}>
                <boxGeometry args={[0.1, 0.015, 0.12]} />
                <meshBasicMaterial color="#e8e2d0" />
            </mesh>
        </group>
    );
}

const floatColors: Record<FloatKind, string> = {
    [FloatKind.Hit]: "#ffffff",
    [FloatKind.Hurt]: "#ff5a4a",
    [FloatKind.Xp]: "#ffd24a",
    [FloatKind.Heal]: "#6cf07a",
    [FloatKind.Loot]: "#ffe9a8",
    [FloatKind.Alert]: "#ff3b30",
    [FloatKind.Crit]: "#ffb02e",
    [FloatKind.Poison]: "#a4e83a",
    [FloatKind.Burn]: "#ff8a2a",
};

//  The words drawn so far, the last used last. A fight's numbers are
//  nearly all different, and with great damage there is no end of them, so
//  only the most recent are kept, and the rest let go of.
const textCache = new Map<string, CanvasTexture>();
const textsKept = 160;

/** Canvas pixels a float's text is drawn at, per metre it spans. */
const textPixelsPerMetre = 96;
const textHeightMetres = 0.42;

/** Words in bold, edged in black, as a texture as wide as they need: one
 *  per text and colour. */
function textTexture(text: string, color: string) {
    const key = `${color}:${text}`;
    const cached = textCache.get(key);
    if (cached) {
        textCache.delete(key);
        textCache.set(key, cached);
        return cached;
    }
    if (textCache.size >= textsKept) {
        const [oldest, texture] = textCache.entries().next().value!;
        textCache.delete(oldest);
        texture.dispose();
    }
    const canvas = document.createElement("canvas");
    const paint = canvas.getContext("2d")!;
    const font = "bold 30px system-ui, sans-serif";
    paint.font = font;
    canvas.width = Math.ceil(paint.measureText(text).width) + 16;
    canvas.height = Math.round(textHeightMetres * textPixelsPerMetre);
    paint.font = font;
    paint.textAlign = "center";
    paint.textBaseline = "middle";
    paint.lineWidth = 6;
    paint.strokeStyle = "#101014";
    paint.strokeText(text, canvas.width / 2, canvas.height / 2 + 2);
    paint.fillStyle = color;
    paint.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    textCache.set(key, texture);
    return texture;
}

/** A number or a word that rises and fades over where it happened. */
function FloatView({ entity }: { entity: Entity }) {
    const group = useRef<Group>(null);
    const material = useRef<MeshBasicMaterial>(null);
    const { amount, text, kind } = entity.get(FloatTextTrait)!;
    const words =
        text ||
        (kind === FloatKind.Xp
            ? `+${amount} XP`
            : kind === FloatKind.Heal
              ? `+${amount}`
              : kind === FloatKind.Crit
                ? `${amount}!`
                : `${amount}`);
    const texture = textTexture(words, floatColors[kind]);
    //  A critical hit's number stands larger.
    const grow = kind === FloatKind.Crit ? 1.45 : 1;
    const width = (texture.image.width / textPixelsPerMetre) * grow;

    useFrame(() => {
        if (!entity.isAlive() || !group.current || !material.current) return;
        const { x, y, z, age } = entity.get(FloatTextTrait)!;
        const done = age / floatSeconds;
        group.current.position.set(x, y + done * 0.8, z);
        material.current.opacity = done < 0.6 ? 1 : 1 - (done - 0.6) / 0.4;
    });

    return (
        <group ref={group}>
            <Billboard>
                <mesh renderOrder={overHero}>
                    <planeGeometry args={[width, textHeightMetres * grow]} />
                    <meshBasicMaterial
                        ref={material}
                        map={texture}
                        transparent
                        depthTest={false}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
            </Billboard>
        </group>
    );
}

/** A ring of light that spreads and fades where a monster fell. */
function BurstView({ entity }: { entity: Entity }) {
    const mesh = useRef<Mesh>(null);
    const material = useRef<MeshBasicMaterial>(null);

    useFrame(() => {
        if (!entity.isAlive() || !mesh.current || !material.current) return;
        const { x, y, z, size, age } = entity.get(BurstTrait)!;
        const done = age / burstSeconds;
        mesh.current.position.set(x, y + 0.1, z);
        mesh.current.scale.setScalar(size * (0.4 + done));
        material.current.opacity = 0.8 * (1 - done);
    });

    return (
        <mesh ref={mesh} rotation-x={-Math.PI / 2} renderOrder={overWorld}>
            <ringGeometry args={[0.35, 0.5, 24]} />
            <meshBasicMaterial
                ref={material}
                color="#ffffff"
                transparent
                blending={AdditiveBlending}
                depthTest={false}
                depthWrite={false}
                toneMapped={false}
            />
        </mesh>
    );
}

/** Loot on the ground: its picture hops out of the monster, then bobs over
 *  a glow in its rarity's colour until she walks over it. */
//  Loot's shapes and materials, one of each shared by every pile, so a
//  field of drops costs no new geometry or material a piece.
const lootGlowShape = new CircleGeometry(1, 16);
const lootPlane = new PlaneGeometry(1, 1);
const lootGlows = new Map<string, MeshBasicMaterial>();
const lootPictures = new Map<Texture, MeshBasicMaterial>();
const lootCounts = new Map<Texture, MeshBasicMaterial>();

function lootGlow(color: string) {
    let material = lootGlows.get(color);
    if (!material) {
        material = new MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.35,
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        });
        lootGlows.set(color, material);
    }
    return material;
}

function lootPicture(texture: Texture, into = lootPictures) {
    let material = into.get(texture);
    if (!material) {
        material = new MeshBasicMaterial({
            map: texture,
            alphaTest: 0.5,
            toneMapped: false,
        });
        into.set(texture, material);
    }
    return material;
}

/** A pile's size: a pile of gold grows with its gold, gently. */
const pileSize = (gold: boolean, amount: number) =>
    gold ? 0.5 * (1 + 0.18 * Math.log10(Math.max(1, amount))) : 0.7;

function LootView({ entity }: { entity: Entity }) {
    const group = useRef<Group>(null);
    const sprite = useRef<Group>(null);
    const picture = useRef<Mesh>(null);
    const label = useRef<Mesh>(null);
    const { item, rarity } = entity.get(LootTrait)!;
    const gold = item === goldLoot;
    const texture = gold ? goldTexture() : iconTexture(itemIds[item]);
    const glow = gold ? "#ffd24a" : rarityColors[rarities[rarity] ?? "common"];
    //  What the pile showed last, so a merge redraws only what changed.
    const shown = useRef({ count: 0, gold: -1 });

    useFrame(({ clock }) => {
        if (!entity.isAlive() || !group.current || !sprite.current) return;
        const drop = entity.get(LootTrait)!;
        group.current.position.set(drop.x, drop.y, drop.z);
        //  An arc as it pops out, then a slow bob.
        const pop = Math.min(1, drop.age / 0.35);
        const hop = pop < 1 ? Math.sin(pop * Math.PI) * 0.6 : 0;
        const bob = Math.sin(clock.elapsedTime * 3 + entity.id()) * 0.05;
        sprite.current.position.y = 0.35 + hop + bob;
        //  A pile's count over it, and a gold pile's size by its gold.
        if (drop.gold !== shown.current.gold && picture.current) {
            shown.current.gold = drop.gold;
            picture.current.scale.setScalar(pileSize(gold, drop.gold));
        }
        if (drop.count !== shown.current.count && label.current) {
            shown.current.count = drop.count;
            label.current.visible = !gold && drop.count > 1;
            if (label.current.visible) {
                const words = textTexture(`×${drop.count}`, "#ffffff");
                label.current.material = lootPicture(words, lootCounts);
                const width = words.image.width / textPixelsPerMetre;
                label.current.scale.set(width * 0.7, textHeightMetres * 0.7, 1);
            }
        }
    });

    const size = pileSize(gold, 1);
    return (
        <group ref={group}>
            <mesh
                geometry={lootGlowShape}
                material={lootGlow(glow)}
                rotation-x={-Math.PI / 2}
                position-y={0.04}
                scale={size * 0.55}
            />
            <group ref={sprite}>
                <Billboard>
                    <mesh
                        ref={picture}
                        geometry={lootPlane}
                        material={lootPicture(texture)}
                        scale={size}
                    />
                    <mesh
                        ref={label}
                        geometry={lootPlane}
                        position={[0.3, 0.32, 0.01]}
                        visible={false}
                    />
                </Billboard>
            </group>
        </group>
    );
}
