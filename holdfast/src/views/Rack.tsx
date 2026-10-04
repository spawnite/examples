import slabStone from "@spawnite/assets/models/holdfast/menhir-slab.glb?url";
import { Clone, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Entity as KootaEntity } from "koota";
import { useQuery, useQueryFirst, useTrait, useWorld } from "koota/react";
import {
    Suspense,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    type RefObject,
} from "react";
import {
    AdditiveBlending,
    Color,
    CylinderGeometry,
    DoubleSide,
    MeshBasicMaterial,
    PlaneGeometry,
    Ray,
    ShaderMaterial,
    Vector3,
    type Group,
    type Object3D,
} from "three";
import {
    AuthorityTrait,
    BodyKind,
    ColliderShape,
    CollisionLayer,
    Entity,
    GroundTrait,
    HeroTrait,
    Icon,
    measureCoverDistance,
    Text,
    TransformTrait,
    useHeadless,
    useModel,
    useTime,
    useWorldEntity,
    WalletTrait,
} from "@spawnite/engine";
import { measureHearing, playSound, Sound } from "../audio/sounds";
import { GunId, guns, isGunId, readUpgradePrice } from "../siege/guns";
import { isRackOpen, rackStands, type RackStand } from "../siege/shop";
import { MonsterTrait, WardenGunTrait, WardenTrait } from "../siege/traits";
import { readCardOffer, useHand, useHandAtTop } from "../hud/hand";
import { hudDisplay } from "../hud/look";
import { usePhase } from "./phase";
import { useModelShape } from "./circle/models";
import { createStoneMaterial } from "./circle/stoneMaterial";
import { emitGlow, emitSparks } from "./effects/EffectPools";
import { readGlowTexture } from "./glowTexture";
import { readWardenColor } from "./palette";
import {
    isSightBlocked,
    areTagsHidden,
    liftTags,
    type Point,
    readShaftStrength,
    readTagSight,
    type ScreenBox,
    type ScreenTag,
    type TagSight,
} from "./rackTags";
import { readGunModel } from "./warden/Gun";

//  The rack at the fire: three short stones north of the hearth, each with
//  its gun turning slowly over it in a shaft of firelight, and a tag over
//  it with the gun's name and price. A warden walks up to one to buy it, or
//  to raise the gun she holds a tier, as Call of Duty Zombies hangs its
//  guns on the walls. The shafts stay dark and the guns still until the
//  night begins. Each stone has a body, so the room and every page stop a
//  warden at it.

/** The plinth: metres across, deep and tall. */
const plinth = { width: 0.75, depth: 0.5, height: 0.95 };
/** Metres tall the stand's body stands, over the plinth to the gun. */
const bodyHeight = 1.9;
/** What the stand's body stops: the wardens alone. A monster walks
 *  through it, and the navmesh leaves it out, since the gaps between the
 *  stands are narrower than a colossus: one stood wedged there and held its
 *  wave for the rest of a bot run. */
const standCollides = [CollisionLayer.Players];
/** Metres over the ground the gun turns at, and radians a second. */
const gunHeight = 1.45;
const turnRate = 0.6;
/** Times its file's size a gun is drawn on the rack: one scale for all
 *  three, so the rail stands long and the scattergun short. */
const gunScale = 1.3;
/** Metres tall the shaft of light stands, and across. */
const shaftHeight = 2.6;
const shaftRadius = 0.5;
/** Metres a tag stands over its stand's foot: over the gun. Where the
 *  stands line up on the screen, RackTagLayout lifts the farther tags. */
const tagHeight = gunHeight + 0.75;

const stoneMaterial = createStoneMaterial({ height: 0.62, runes: false });
const shaftGeometry = new CylinderGeometry(
    shaftRadius * 0.7,
    shaftRadius,
    shaftHeight,
    32,
    1,
    true,
);
const poolGeometry = new PlaneGeometry(1, 1);
const amber = new Color("#ffb347");

const shaftVertex = /* glsl */ `
varying vec2 vUv;
varying float vFacing;
void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    //  Its side faces straight out from its axis.
    vec3 worldNormal = normalize(mat3(modelMatrix) * vec3(position.x, 0.0, position.z));
    vec3 toEye = normalize(cameraPosition - world.xyz);
    //  Full where the tube faces the eye, gone at its edges, so it reads as
    //  light rather than as a tube.
    vFacing = abs(dot(worldNormal, toEye));
    gl_Position = projectionMatrix * viewMatrix * world;
}`;

/** Brightest at its foot and its middle, gone at its top and its edges,
 *  with bands of light that rise up it. */
const shaftFragment = /* glsl */ `
uniform float uTime;
uniform float uStrength;
uniform vec3 uColor;
varying vec2 vUv;
varying float vFacing;
void main() {
    float rise = vUv.y;
    float bands = 0.7 + 0.3 * sin(rise * 16.0 - uTime * 2.6);
    float glow = pow(max(1.0 - rise, 0.0), 2.2) * bands * uStrength;
    gl_FragColor = vec4(uColor, glow * pow(clamp(vFacing, 0.0, 1.0), 2.5) * 0.5);
}`;

function createShaftMaterial(color: Color) {
    return new ShaderMaterial({
        vertexShader: shaftVertex,
        fragmentShader: shaftFragment,
        uniforms: {
            uTime: { value: 0 },
            uStrength: { value: 0 },
            uColor: { value: color.clone().multiplyScalar(1.4) },
        },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        toneMapped: false,
    });
}

/** What her own page shows at a stand: whether it is shut, whether she
 *  holds its gun, and the tag's words. */
interface StandTag {
    title: string;
    price: number | null;
    detail: string;
    shut: boolean;
    own: boolean;
}

/** The tag over `stand` for her page. */
function readStandTag(
    stand: RackStand,
    { open, held, tier }: { open: boolean; held: GunId; tier: number },
): StandTag {
    const gun = guns[stand.gun];
    if (!open)
        return {
            title: gun.title,
            price: null,
            detail: "When the night begins",
            shut: true,
            own: false,
        };
    if (held !== stand.gun)
        return {
            title: gun.title,
            price: gun.price,
            detail: gun.text,
            shut: false,
            own: false,
        };
    const price = readUpgradePrice(tier);
    return {
        title: price === undefined ? `${gun.title} III` : "Upgrade",
        price: price ?? null,
        detail: price === undefined ? "Top tier" : gun.perks[tier].title,
        shut: false,
        own: true,
    };
}

/** A stand's tag on a page: the element drei places over the stand, and
 *  the point in the world it stands on, each once drawn. drei hands its
 *  element over after the stand's own effects run, so the layout reads
 *  both as it lays the tags out. */
interface ShownTag {
    element: RefObject<HTMLDivElement | null>;
    anchor: RefObject<Object3D | null>;
}

/** Each stand's tag, while its view is mounted, for the layout that keeps
 *  them apart. */
const shownTags = new Map<GunId, ShownTag>();

//  Written in place for each frame's layout.
const tagPoint = new Vector3();
const screenTags: ScreenTag[] = [];
const laidTags: HTMLElement[] = [];

/** Keeps the rack's tags apart on the screen, each frame they show: the
 *  nearest stand's where it stands, each farther one lifted above the
 *  tags it would cover and above her open cards. */
function RackTagLayout() {
    useFrame(({ camera, size }) => {
        screenTags.length = 0;
        laidTags.length = 0;
        for (const shown of shownTags.values()) {
            const element = shown.element.current;
            const anchor = shown.anchor.current;
            if (!element || !anchor || element.dataset.shown !== "true")
                continue;
            const tag = element.querySelector<HTMLElement>(".rack-tag");
            if (!tag) continue;
            anchor.getWorldPosition(tagPoint);
            const distance = tagPoint.distanceTo(camera.position);
            tagPoint.project(camera);
            //  Behind the camera: drei hides it.
            if (tagPoint.z > 1) continue;
            screenTags.push({
                x: ((tagPoint.x + 1) / 2) * size.width + size.left,
                y: ((1 - tagPoint.y) / 2) * size.height + size.top,
                width: tag.offsetWidth,
                height: tag.offsetHeight,
                distance,
            });
            laidTags.push(tag);
        }
        if (laidTags.length === 0) return;
        const kept: ScreenBox[] = [];
        for (const held of document.querySelectorAll(
            ".card-hand, .card-chip",
        )) {
            const { left, top, width, height } = held.getBoundingClientRect();
            kept.push({ left, top, width, height });
        }
        const lifts = liftTags(screenTags, kept);
        for (const [index, tag] of laidTags.entries()) {
            const translate = `0 ${Math.round(lifts[index])}px`;
            if (tag.style.translate !== translate)
                tag.style.translate = translate;
        }
    });
    return null;
}

interface StandViewProps {
    stand: RackStand;
}

//  Written in place for each frame's sight of a stand.
const eyePoint = new Vector3();
const forward = new Vector3();
const toTag = new Vector3();
const bodies: Point[] = [];
const sightEnd: Point = { x: 0, y: 0, z: 0 };
const sightRay = new Ray();

/** What a page draws of one stand. */
function StandView({ stand }: StandViewProps) {
    const world = useWorld();
    const phase = usePhase();
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const held = useTrait(hero, WardenGunTrait);
    const survivor = useTrait(hero, WardenTrait);
    const coins = useTrait(hero, WalletTrait)?.coins ?? 0;
    const open = isRackOpen(phase);
    const folded = useHand((state) => state.folded);
    const picking = readCardOffer(phase, survivor).gathering && !folded;
    const handAtTop = useHandAtTop();
    const hidden = areTagsHidden({ phase, picking, handAtTop });
    const heldGun = held && isGunId(held.gun) ? held.gun : GunId.Blaster;
    const tag = readStandTag(stand, {
        open,
        held: heldGun,
        tier: held?.tier ?? 0,
    });
    const color = useMemo(
        () =>
            tag.own
                ? new Color(readWardenColor(survivor?.hue ?? 0))
                : amber.clone(),
        [tag.own, survivor?.hue],
    );
    const shaft = useMemo(() => createShaftMaterial(color), [color]);
    const pool = useMemo(
        () =>
            new MeshBasicMaterial({
                map: readGlowTexture(),
                color: color.clone().multiplyScalar(0.6),
                transparent: true,
                opacity: 0,
                blending: AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
            }),
        [color],
    );
    useLayoutEffect(
        () => () => {
            shaft.dispose();
            pool.dispose();
        },
        [shaft, pool],
    );
    const gunRef = useRef<Group>(null);
    const strengthRef = useRef(0);
    const sightRef = useRef<TagSight>({ shown: false, detail: false });
    const tagRef = useRef<HTMLDivElement>(null);
    const anchorRef = useRef<Group>(null);
    useEffect(() => {
        shownTags.set(stand.gun, { element: tagRef, anchor: anchorRef });
        return () => {
            shownTags.delete(stand.gun);
        };
    }, [stand.gun]);
    const shape = useModelShape(slabStone);
    if (!shape.boundingBox) shape.computeBoundingBox();
    const size =
        shape.boundingBox?.getSize(new Vector3()) ?? new Vector3(1, 1, 1);
    const model = useModel(readGunModel(stand.gun)).scene;

    //  Her purse meets this stand's price: its shaft burns brighter.
    const affordable = tag.price !== null && coins >= tag.price;
    useFrame(({ camera }, delta) => {
        const seconds = useTime.getState().seconds;
        const strength = strengthRef.current;
        strengthRef.current +=
            (readShaftStrength({ open, affordable }) - strength) *
            Math.min(1, delta * 2);
        shaft.uniforms.uTime.value = seconds;
        shaft.uniforms.uStrength.value =
            strengthRef.current * (0.85 + 0.15 * Math.sin(seconds * 2.3));
        pool.opacity = 0.25 + Math.min(1, strengthRef.current) * 0.65;
        const gun = gunRef.current;
        if (gun) {
            gun.rotation.y = open
                ? seconds * turnRate + stand.yaw
                : stand.yaw + Math.PI / 2;
            gun.position.y =
                gunHeight + (open ? Math.sin(seconds * 1.6) * 0.05 : -0.2);
        }
        //  The tag shows to a warden near the stand who faces it and sees
        //  it, by the rules in rackTags.ts.
        const element = tagRef.current;
        const anchor = anchorRef.current;
        if (!element || !anchor) return;
        const feet = hero?.get(TransformTrait);
        const metres = feet
            ? Math.hypot(feet.x - stand.x, feet.z - stand.z)
            : Infinity;
        anchor.getWorldPosition(toTag);
        eyePoint.copy(camera.position);
        const reach = toTag.distanceTo(eyePoint);
        toTag.sub(eyePoint).normalize();
        camera.getWorldDirection(forward);
        const degrees = (Math.acos(forward.dot(toTag)) * 180) / Math.PI;
        const was = sightRef.current;
        const seen = readTagSight(was, {
            hidden,
            metres,
            degrees,
            clear: true,
        });
        //  The sight lines are cast only for a tag the rest would show.
        const sight =
            seen.shown && !isClear(world, hero, eyePoint, toTag, reach)
                ? { shown: false, detail: false }
                : seen;
        if (sight.shown === was.shown && sight.detail === was.detail) return;
        sightRef.current = sight;
        element.dataset.shown = sight.shown ? "true" : "false";
        element.dataset.close = sight.detail ? "true" : "false";
    });

    const short = tag.price !== null && coins < tag.price;
    return (
        <group position-y={-bodyHeight / 2}>
            <mesh
                geometry={shape}
                material={stoneMaterial}
                scale={[
                    plinth.width / size.x,
                    plinth.height / size.y,
                    plinth.depth / size.z,
                ]}
                rotation-y={stand.yaw}
                castShadow
                receiveShadow
            />
            <mesh
                geometry={poolGeometry}
                material={pool}
                rotation-x={-Math.PI / 2}
                position-y={0.05}
                scale={2.4}
            />
            <mesh
                geometry={shaftGeometry}
                material={shaft}
                position-y={plinth.height + shaftHeight / 2 - 0.1}
                renderOrder={2}
            />
            <group ref={gunRef} position-y={gunHeight}>
                <Clone object={model} scale={gunScale} castShadow />
            </group>
            <group ref={anchorRef} position={[0, tagHeight, 0]} />
            <Html
                position={[0, tagHeight, 0]}
                center
                zIndexRange={[14, 12]}
                ref={tagRef}
                className="rack-tag-sight group"
                style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
            >
                <Text
                    as="div"
                    className={`rack-tag flex flex-col items-center gap-0.5 rounded-md border px-2.5 py-1 shadow-[0_4px_18px_rgb(0_0_0/0.5)] transition-[translate,opacity] duration-200 ease-out ${tag.shut ? "border-white/10 bg-slate-950/70" : tag.own ? "border-white/25 bg-slate-950/80" : "border-amber-300/50 bg-slate-950/80"}`}
                >
                    <Text as="div" className="flex items-center gap-2">
                        {tag.shut && (
                            <Icon
                                name="lock"
                                className="size-3.5 text-white/50"
                            />
                        )}
                        <Text
                            className={`${hudDisplay} text-base uppercase ${tag.shut ? "text-white/60" : "text-amber-50"}`}
                        >
                            {tag.title}
                        </Text>
                        {tag.price !== null && (
                            <Text as="span" className="flex items-center gap-1">
                                <Icon
                                    name="coins"
                                    className={`size-3.5 ${short ? "text-white/40" : "text-amber-300"}`}
                                />
                                <Text
                                    className={`${hudDisplay} text-base ${short ? "text-white/45" : "text-amber-200"}`}
                                >
                                    {tag.price}
                                </Text>
                            </Text>
                        )}
                    </Text>
                    <Text className="hidden text-xs font-semibold text-white/65 group-data-[close=true]:block">
                        {tag.detail}
                    </Text>
                </Text>
            </Html>
        </group>
    );
}

/** Metres short of a tag the cover test stops, so the stand's own body
 *  under its tag is never its cover. */
const standClearance = 0.8;

/** Whether nothing stands between the camera at `eye` and the tag
 *  `direction` from it, `reach` metres away: no cover in the physics
 *  world, and no warden but her own, or monster, across the line. */
function isClear(
    world: ReturnType<typeof useWorld>,
    hero: KootaEntity | undefined,
    eye: Vector3,
    direction: Vector3,
    reach: number,
) {
    sightRay.origin.copy(eye);
    sightRay.direction.copy(direction);
    const range = reach - standClearance;
    if (
        range > 0 &&
        measureCoverDistance(world, { ray: sightRay, range }) < range
    )
        return false;
    bodies.length = 0;
    for (const entity of world.query(TransformTrait, WardenTrait)) {
        if (entity === hero) continue;
        const at = entity.get(TransformTrait);
        if (at) bodies.push(at);
    }
    for (const entity of world.query(TransformTrait, MonsterTrait)) {
        const at = entity.get(TransformTrait);
        if (at) bodies.push(at);
    }
    sightEnd.x = eye.x + direction.x * reach;
    sightEnd.y = eye.y + direction.y * reach;
    sightEnd.z = eye.z + direction.z * reach;
    return !isSightBlocked(eye, sightEnd, bodies);
}

interface GunWatchProps {
    entity: KootaEntity;
}

/** A burst of firelight and sparks at the stand a warden buys at or
 *  upgrades at, heard from where this page's warden stands. */
function GunWatch({ entity }: GunWatchProps) {
    const held = useTrait(entity, WardenGunTrait);
    const hero = useQueryFirst(HeroTrait, AuthorityTrait);
    const lastRef = useRef(held);
    useEffect(() => {
        const last = lastRef.current;
        lastRef.current = held;
        if (!held || !last || !isGunId(held.gun)) return;
        //  A new run hands everyone the blaster back: no purchase.
        if (held.bought <= last.bought) return;
        const raised = held.gun === last.gun;
        const stand = rackStands.find(({ gun }) => gun === held.gun);
        if (!stand) return;
        const at = new Vector3(stand.x, gunHeight, stand.z);
        const hue = entity.get(WardenTrait)?.hue ?? 0;
        const color = new Color(readWardenColor(hue)).lerp(
            new Color("#ffffff"),
            0.4,
        );
        emitGlow({
            position: at,
            color: color.clone().multiplyScalar(2.4),
            seconds: 0.45,
            size: 0.6,
            endSize: 2.6,
        });
        emitGlow({
            position: at.clone().setY(0.1),
            color: amber.clone().multiplyScalar(1.8),
            seconds: 0.6,
            size: 0.5,
            endSize: 3.4,
            ring: true,
        });
        emitSparks({
            position: at,
            color: amber.clone().multiplyScalar(2.6),
            count: raised ? 26 : 18,
            speed: 5,
            toward: new Vector3(0, 1, 0),
            spread: 1.1,
            seconds: 0.8,
            weight: 0.5,
        });
        const feet = hero?.get(TransformTrait);
        playSound(raised ? Sound.Upgrade : Sound.RackBuy, {
            volume: feet ? measureHearing(feet.distanceTo(at)) : 1,
        });
    }, [held, entity, hero]);
    return null;
}

/** The rack's stands, each stood on the map's ground with a body, and on a
 *  page the stands drawn and every warden's purchases watched. */
export function Rack() {
    const surface = useWorldEntity().get(GroundTrait)?.surface;
    const headless = useHeadless();
    const wardens = useQuery(WardenGunTrait);
    return (
        <>
            {rackStands.map((stand) => {
                const floor =
                    surface?.getHeightAt({ x: stand.x, z: stand.z }) ?? 0;
                return (
                    <Entity
                        key={stand.gun}
                        name={`rack-${stand.gun}`}
                        position={[stand.x, floor + bodyHeight / 2, stand.z]}
                        collider={{
                            shape: ColliderShape.Capsule,
                            kind: BodyKind.Fixed,
                            size: [plinth.width, bodyHeight, plinth.width],
                            collides: standCollides,
                        }}
                    >
                        {!headless && (
                            <Suspense fallback={null}>
                                <StandView stand={stand} />
                            </Suspense>
                        )}
                    </Entity>
                );
            })}
            {!headless &&
                wardens.map((entity) => (
                    <GunWatch key={entity} entity={entity} />
                ))}
            {!headless && <RackTagLayout />}
        </>
    );
}
