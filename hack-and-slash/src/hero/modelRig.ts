import {
    Bone,
    BoxGeometry,
    BufferAttribute,
    CanvasTexture,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DataTexture,
    Group,
    LinearFilter,
    Matrix4,
    Mesh,
    MeshToonMaterial,
    NearestFilter,
    Quaternion,
    RedFormat,
    ShaderChunk,
    SphereGeometry,
    SRGBColorSpace,
    TorusGeometry,
    Vector3,
    type BufferGeometry,
    type Object3D,
    type SkinnedMesh,
} from "@spawnite/engine/three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
    itemDef,
    type ArmorSet,
    type EquipSlot,
    type HeadShape,
    type ItemId,
} from "../items/items";
import {
    armorPartForSlot,
    loadArmorPiece,
    takeOffArmor,
    wearArmor,
} from "./armor";
import {
    faceCanvasHeight,
    faceCanvasWidth,
    isPlateFace,
    paintFace,
    paintPlate,
    plateCanvasHeight,
    plateCanvasWidth,
} from "./paintFace";
import { facePatch, type PatchSpan } from "./facePatch";
import {
    loadGearModel,
    loadWeaponModel,
    loadWeaponPicture,
} from "./gearModels";
import { makeWig, wigs } from "./wigs";

//  The hero's model: the creator's bald base, a chibi on a Mixamo rig,
//  coloured by region from the look, given a painted face, and dressed in
//  the gear she wears. The model file is Z-up in metres under a root that
//  turns it Y-up and scales it to centimetres; it faces +z, so her left is
//  +x. Gear and the face hang on mounts that follow their bones' places but
//  keep the rig's frame, built in world metres: Mixamo's run turns its
//  bones far from their bind pose, so a mount that turned with its bone
//  would spin her face round her head.

/** Metres tall the hero would stand in the world with the model's own
 *  head; her smaller head takes about 23 cm off. */
export const heroMetres = 1.5;
/** Centimetres tall the model stands, to the top of its head. */
const modelCentimetres = 221;
export const modelScale = heroMetres / modelCentimetres;

/** Her head's size against the model's, which was made a chibi's: smaller,
 *  so she stands nearer a young woman's proportions. Every fit on her head,
 *  her face, wig and headgear, is measured at the model's own size and
 *  shrinks with it. */
export const headSize = 0.62;

/** Where the middle of her head is from her head bone, which stands at her
 *  jaw, and its half-sizes across, up and front to back, in world metres:
 *  measured off the base's head in its bind pose. */
const headMiddle = new Vector3(-0.024, 0.187, 0);
const headRadii = new Vector3(0.271, 0.301, 0.248);

/** The rig's bones the game moves or hangs gear on, by what they are. */
const jointNames = {
    head: "mixamorigHead",
    headFront: "headfront",
    rightFingers: "mixamorigRightHandMiddle4",
    rightHand: "mixamorigRightHand",
    rightArm: "mixamorigRightArm",
    leftFingers: "mixamorigLeftHandMiddle4",
    leftHand: "mixamorigLeftHand",
    leftArm: "mixamorigLeftArm",
    leftForearm: "mixamorigLeftForeArm",
    chest: "mixamorigSpine2",
} as const;

/** Bones whose skin shows: her head, neck, forearms and hands. Her feet
 *  wear boots. Everything else wears her outfit. */
const skinBones = [
    "mixamorigHead",
    "mixamorigNeck",
    "mixamorigLeftForeArm",
    "mixamorigRightForeArm",
    "mixamorigLeftHand",
    "mixamorigRightHand",
];
const bootBones = [
    "mixamorigLeftFoot",
    "mixamorigRightFoot",
    "mixamorigLeftToeBase",
    "mixamorigRightToeBase",
    "mixamorigLeftToe_End",
    "mixamorigRightToe_End",
];

/** The bones each armor slot's piece covers: her body piece her trunk,
 *  shoulders, upper arms and thighs; her gloves her forearms, since some
 *  leave her hands bare; her boots her shins and feet. */
const coverBones: Record<ArmorSlot, string[]> = {
    body: [
        "mixamorigHips",
        "mixamorigSpine",
        "mixamorigSpine1",
        "mixamorigSpine2",
        "mixamorigLeftShoulder",
        "mixamorigRightShoulder",
        "mixamorigLeftArm",
        "mixamorigRightArm",
        "mixamorigLeftUpLeg",
        "mixamorigRightUpLeg",
    ],
    hands: ["mixamorigLeftForeArm", "mixamorigRightForeArm"],
    feet: ["mixamorigLeftLeg", "mixamorigRightLeg", ...bootBones],
};

/** How far her skin draws in under a piece she wears, in the model's own
 *  metres: about a centimetre where she stands, so her running limbs never
 *  poke through, which the pieces' fit alone let a few flecks do. */
const coveredShrink = 0.015;

export type ModelLook = {
    /** Her hairstyle, by its place in `wigs`. */
    style: number;
    hair: string;
    skin: string;
    leftEye: string;
    rightEye: string;
    outfit: string;
    face: number;
};

export type ModelGear = {
    weapon: ItemId;
    shield: ItemId | null;
    head: ItemId | null;
    body: ItemId | null;
    hands: ItemId | null;
    feet: ItemId | null;
};

/** The slots whose items she wears as armor pieces. */
type ArmorSlot = keyof typeof armorPartForSlot;
const armorSlots = Object.keys(armorPartForSlot) as ArmorSlot[];

/** Three bands of light and shade, for a clean cartoon look. */
function toonBands() {
    const bands = new DataTexture(
        new Uint8Array([90, 180, 255]),
        3,
        1,
        RedFormat,
    );
    bands.minFilter = NearestFilter;
    bands.magFilter = NearestFilter;
    bands.needsUpdate = true;
    return bands;
}

/** Her colour by region: the share of skin and of boot each vertex carries
 *  blends her outfit into her boots and her skin, with hard edges; and
 *  under a wig, her scalp takes her hair's colour, so no gap in a wig shows
 *  her bald head. */
const regionShader = /* glsl */ `
uniform vec3 uSkin;
uniform vec3 uOutfit;
uniform vec3 uBoots;
uniform vec3 uHair;
uniform float uWig;
uniform float uHurt;
varying vec3 vRegion;
`;

const regionFragment = /* glsl */ `
#include <color_fragment>
{
    float skin = smoothstep(0.4, 0.6, vRegion.x);
    float boot = smoothstep(0.4, 0.6, vRegion.y);
    vec3 dressed = mix(mix(uOutfit, uBoots, boot), uSkin, skin);
    dressed = mix(dressed, uHair, uWig * smoothstep(0.4, 0.6, vRegion.z));
    diffuseColor.rgb = dressed;
    //  A hit reddens her for a moment.
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.08, 0.05), uHurt * 0.55);
}
`;

/** Where a piece of gear hangs: on `bone`, where the bone was in the bind
 *  pose, at `turn` in the rig's frame. With `follow`, it moves exactly as the
 *  skin round the bone does, turning with it: a hat on her head, a shield on
 *  her forearm. Without, it keeps its place on the bone but its own turn: a
 *  blade she aims. */
export type Mount = {
    group: Group;
    bone: Bone;
    /** The bone's inverse bind matrix, from the skeleton. */
    inverse: Matrix4;
    /** The bone's place in the bind pose, in the model's frame. */
    bindAt: Vector3;
    rest: Quaternion;
    turn: Quaternion;
    follow: boolean;
};

export type HeroRig = {
    root: Group;
    /** Her model, which a facing turns. */
    body: Object3D;
    skinned: SkinnedMesh;
    joints: Record<keyof typeof jointNames, Bone>;
    uniforms: Record<string, { value: unknown }>;
    /** Her painted face, repainted as her look changes, and the plate face
     *  that shows in its place when she wears one. */
    face: CanvasTexture;
    plate: CanvasTexture;
    faces: { painted: Mesh; plate: Mesh };
    /** The look she last took, for a face that finishes loading after. */
    look?: ModelLook;
    /** The wig she wears and the style it is, or null for a bare head. */
    wig: { style: number; mesh: Mesh | null };
    /** Where the gear hangs, by slot, to be emptied and refilled, and the
     *  turn each hangs at on its bone. */
    mounts: { head: Mount; weapon: Mount; shield: Mount; offHand: Mount };
    /** Where her right fist closes, from her hand bone, in the weapon
     *  mount's metres: a sword's grip sits here; and her left, for a
     *  second weapon. */
    grip: Vector3;
    leftGrip: Vector3;
    /** The armor she wears by slot: the set asked for, and its piece once
     *  loaded. */
    armor: Record<
        ArmorSlot,
        { set: ArmorSet | null; mesh: SkinnedMesh | null }
    >;
};

/** Whether a point of her head, in the model's own Z-up metres, is scalp
 *  a wig covers: above her hairline, or the back of her head down to her
 *  nape. Her front is -y there, and her head bone stands at 1.55 m. Over
 *  her brow the hairline rises to where every wig's cap sits: her forehead
 *  is skin, which the thin bangs of the twin tails and the bob leave
 *  showing, and tinted there it read as a stain in her hair's colour. */
function isScalp(y: number, z: number) {
    const hairline = 1.92;
    const brow = 2.05;
    const nape = 1.45;
    //  From her sides, at 5 cm forward of her head's middle, to her
    //  forehead, at 20 cm, the hairline rises from the one to the other.
    const forward = Math.min(1, Math.max(0, (-y - 0.05) / 0.15));
    return z > hairline + (brow - hairline) * forward || (y > 0.05 && z > nape);
}

/** How much of each vertex's weight goes to the named bones. */
function shareOf(mesh: SkinnedMesh, names: string[]) {
    const indices = new Set(
        names
            .map((name) =>
                mesh.skeleton.bones.findIndex((b) => b.name === name),
            )
            .filter((index) => index >= 0),
    );
    const { skinIndex, skinWeight } = mesh.geometry.attributes;
    const share = new Float32Array(skinIndex.count);
    for (let vertex = 0; vertex < skinIndex.count; vertex++) {
        let sum = 0;
        for (let k = 0; k < 4; k++)
            if (indices.has(skinIndex.getComponent(vertex, k)))
                sum += skinWeight.getComponent(vertex, k);
        share[vertex] = sum;
    }
    return share;
}

/** A fresh copy of the loaded base, coloured, faced and ready for gear. */
export function buildHeroRig(source: Object3D): HeroRig {
    const body = clone(source);
    const root = new Group();
    const uniforms: HeroRig["uniforms"] = {
        uSkin: { value: new Color() },
        uOutfit: { value: new Color() },
        uBoots: { value: new Color("#3b2a20") },
        uHair: { value: new Color() },
        uWig: { value: 0 },
        uHurt: { value: 0 },
        //  Which slots' pieces she wears, one to a component.
        uCover: { value: new Vector3() },
    };
    const material = new MeshToonMaterial({ gradientMap: toonBands() });
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nattribute vec3 region;\nattribute vec4 cover;\nuniform vec3 uCover;\nvarying vec3 vRegion;\nvarying float vFlat;",
            )
            .replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>\nvRegion = region;\nvFlat = cover.w * ${headFlat.toFixed(2)};\ntransformed -= normal * dot(cover.xyz, uCover) * ${coveredShrink};`,
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>\nvarying float vFlat;\n${regionShader}`,
            )
            .replace("#include <color_fragment>", regionFragment);
    };
    //  Her head lit mostly flat, the rest of her in its bands.
    flatLit(material, true);
    let skinned: SkinnedMesh | undefined;
    const bones: Record<string, Bone> = {};
    body.traverse((node) => {
        if ((node as Bone).isBone) bones[node.name] = node as Bone;
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        if ((mesh as SkinnedMesh).isSkinnedMesh) {
            skinned = mesh as SkinnedMesh;
            mesh.material = material;
            mesh.castShadow = true;
            mesh.frustumCulled = false;
        } else mesh.visible = false;
    });
    //  The regions, once per model: every copy shares the one geometry.
    const geometry = skinned!.geometry;
    if (geometry.attributes.region?.itemSize !== 3) {
        const skin = shareOf(skinned!, skinBones);
        const boots = shareOf(skinned!, bootBones);
        const head = shareOf(skinned!, ["mixamorigHead"]);
        const position = geometry.attributes.position;
        const region = new Float32Array(skin.length * 3);
        for (let vertex = 0; vertex < skin.length; vertex++) {
            region[vertex * 3] = skin[vertex];
            region[vertex * 3 + 1] = boots[vertex];
            region[vertex * 3 + 2] =
                head[vertex] > 0.5 &&
                isScalp(position.getY(vertex), position.getZ(vertex))
                    ? 1
                    : 0;
        }
        geometry.setAttribute("region", new BufferAttribute(region, 3));
    }
    //  What each piece of armor covers, and last how much her head, which
    //  is lit flat.
    if (geometry.attributes.cover?.itemSize !== 4) {
        const shares = armorSlots.map((slot) =>
            shareOf(skinned!, coverBones[slot]),
        );
        const head = shareOf(skinned!, ["mixamorigHead"]);
        const cover = new Float32Array(head.length * 4);
        for (let vertex = 0; vertex < head.length; vertex++) {
            for (let slot = 0; slot < 3; slot++)
                cover[vertex * 4 + slot] = shares[slot][vertex];
            cover[vertex * 4 + 3] = head[vertex];
        }
        geometry.setAttribute("cover", new BufferAttribute(cover, 4));
    }
    const joints = Object.fromEntries(
        Object.entries(jointNames).map(([joint, name]) => [joint, bones[name]]),
    ) as HeroRig["joints"];
    root.add(body);
    root.scale.setScalar(modelScale);
    root.updateMatrixWorld(true);
    const mount = (bone: Bone, rest: Quaternion, follow: boolean) =>
        mountOn(root, skinned!, bone, rest, follow);
    const mounts = {
        head: mount(joints.head, new Quaternion(), true),
        //  Held as `applyGear` sets for the weapon in it.
        weapon: mount(joints.rightHand, new Quaternion(), true),
        shield: mount(joints.leftForearm, new Quaternion(), true),
        //  A second weapon, in her left fist as the first is in her right.
        offHand: mount(joints.leftHand, new Quaternion(), true),
    };
    const { face, plate, faces } = buildFace(mounts.head, skinned!);
    //  Her fist closes a little under half way from her wrist, where her
    //  hand bone starts, to her fingertips.
    const fingers = mountOn(
        root,
        skinned!,
        joints.rightFingers,
        new Quaternion(),
        true,
    );
    root.remove(fingers.group);
    const grip = fingers.bindAt
        .clone()
        .sub(mounts.weapon.bindAt)
        .multiplyScalar(gripAlong * modelScale);
    const leftFingers = mountOn(
        root,
        skinned!,
        joints.leftFingers,
        new Quaternion(),
        true,
    );
    root.remove(leftFingers.group);
    const leftGrip = leftFingers.bindAt
        .clone()
        .sub(mounts.offHand.bindAt)
        .multiplyScalar(gripAlong * modelScale);
    return {
        root,
        body,
        skinned: skinned!,
        joints,
        uniforms,
        face,
        plate,
        faces,
        mounts,
        grip,
        leftGrip,
        wig: { style: 0, mesh: null },
        armor: {
            body: { set: null, mesh: null },
            hands: { set: null, mesh: null },
            feet: { set: null, mesh: null },
        },
    };
}

/** How far from her wrist to her fingertips her fist closes round a grip. */
const gripAlong = 0.45;

/** A weapon is held in her fist, turning with her hand: a sword's blade or
 *  a crossbow's stock, built along +z, comes out of her fist ahead of her
 *  in the bind pose, which carries it out from her body through her slash,
 *  ahead of her as she runs and raised at her side as she stands. */
const heldRest = new Quaternion();

/** Her face: a patch shaped to the front of her head, painted with her
 *  eyes, brows, mouth and blush; and a larger one for a plate face, the
 *  plate's photograph laid on her head from the front, as it was taken,
 *  so its face keeps the plate's proportions. They hang on her head mount,
 *  whose frame is world metres from her head bone in the bind pose, Y-up,
 *  facing +z. Both are lit mostly flat, as her head is. */
function buildFace(head: Mount, skinned: SkinnedMesh) {
    const canvasTexture = (width: number, height: number) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.minFilter = LinearFilter;
        texture.generateMipmaps = false;
        return texture;
    };
    const face = canvasTexture(faceCanvasWidth, faceCanvasHeight);
    const plate = canvasTexture(plateCanvasWidth, plateCanvasHeight);
    const headBone = skinned.skeleton.bones.indexOf(head.bone);
    //  The model's own Z-up metres to the mount's: its bind frame is Y-up
    //  centimetres, and the mount's origin is the head bone there.
    const bindMatrix = skinned.bindMatrix;
    const bind = new Vector3();
    const toMount = (x: number, y: number, z: number, into: Vector3) =>
        into
            .copy(bind.set(x, y, z).applyMatrix4(bindMatrix))
            .sub(head.bindAt)
            .multiplyScalar(modelScale);
    const patch = (
        name: string,
        span?: PatchSpan,
        project?: (across: number, up: number) => [number, number],
    ) =>
        facePatch(
            skinned,
            headBone,
            headMiddle,
            headRadii,
            toMount,
            name,
            span,
            project,
        );
    const mesh = (geometry: BufferGeometry, map: CanvasTexture) => {
        const material = new MeshToonMaterial({
            map,
            gradientMap: toonBands(),
            transparent: true,
            alphaTest: 0.35,
            polygonOffset: true,
            polygonOffsetFactor: -2,
        });
        flatLit(material);
        const drawn = new Mesh(geometry, material);
        drawn.renderOrder = 21;
        head.group.add(drawn);
        return drawn;
    };
    const painted = mesh(patch("painted"), face);
    const plated = mesh(
        patch("plate", plateSpan, (across, up) => [
            plateMiddle[0] + across * platePerMetre[0],
            plateMiddle[1] + up * platePerMetre[1],
        ]),
        plate,
    );
    plated.visible = false;
    return { face, plate, faces: { painted, plate: plated } };
}

/** How the plates' photographs lie on her head, seen from the front: her
 *  head's middle at this share across and up each photograph, and the
 *  shares of it a metre spans. The plate's cheeks, 514 of its 634 pixels
 *  across, span her head's width, 0.542 metres; its chin, at the
 *  photograph's foot, stands at her chin, 0.3 metres under her head's
 *  middle. (The photograph's rows count down, the texture's up.) */
const plateMiddle = [0.4975, 1 - 0.4434] as const;
const platePerMetre = [948 / 634, 948 / 512] as const;
/** The plate's patch: most of the front of her head, down past her chin. */
const plateSpan: PatchSpan = {
    phiSpread: 1.35,
    thetaTop: 0.75,
    thetaBottom: 2.75,
};

/** Lights a material mostly flat, as her head is: its light bands pulled
 *  most of the way to the brightest, so no band's edge cuts across her
 *  face as the sun moves round. `flat` is how far, per vertex where the
 *  material has it, else all of it. */
function flatLit(material: MeshToonMaterial, perVertex = false) {
    const before = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
        before?.call(material, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <gradientmap_pars_fragment>",
            ShaderChunk.gradientmap_pars_fragment.replace(
                "float dotNL = dot( normal, lightDirection );",
                `float dotNL = mix( dot( normal, lightDirection ), 1.0, ${perVertex ? "vFlat" : headFlat.toFixed(2)} );`,
            ),
        );
    };
    material.customProgramCacheKey = () =>
        perVertex ? "hero-flat-body" : "hero-flat-face";
}

/** How flat her head is lit. */
const headFlat = 0.7;

function mountOn(
    root: Group,
    skinned: SkinnedMesh,
    bone: Bone,
    rest: Quaternion,
    follow: boolean,
): Mount {
    const index = skinned.skeleton.bones.indexOf(bone);
    const inverse = skinned.skeleton.boneInverses[index].clone();
    const bindAt = new Vector3().setFromMatrixPosition(
        new Matrix4().copy(inverse).invert(),
    );
    const group = new Group();
    //  Its matrix is written whole by `followBones`.
    group.matrixAutoUpdate = false;
    root.add(group);
    return {
        group,
        bone,
        inverse,
        bindAt,
        rest,
        turn: rest.clone(),
        follow,
    };
}

//  Written in place while placing.
const skin = new Matrix4();
const placed = new Matrix4();
const rootInverse = new Matrix4();
const at = new Vector3();
const rootTurn = new Quaternion();
const held = new Quaternion();
const unit = new Vector3();

/** Where the bone's skin is now: the matrix the skinning itself uses, from
 *  the model's bind frame to the world. */
function placeMount(root: Group, mount: Mount) {
    skin.multiplyMatrices(mount.bone.matrixWorld, mount.inverse);
    if (mount.follow) {
        //  In the bind frame, a world metre is 1 / modelScale of its units.
        unit.setScalar(1 / modelScale);
        placed.compose(mount.bindAt, mount.turn, unit);
        placed.premultiply(skin);
    } else {
        at.copy(mount.bindAt).applyMatrix4(skin);
        root.getWorldQuaternion(rootTurn);
        held.copy(rootTurn).multiply(mount.turn);
        placed.compose(at, held, unit.setScalar(1));
    }
    rootInverse.copy(root.matrixWorld).invert();
    mount.group.matrix.multiplyMatrices(rootInverse, placed);
    mount.group.matrixWorldNeedsUpdate = true;
}

/** Moves each mount to its bone, after the pose for the frame is set and
 *  the rig's matrices are brought up to date. */
export function followBones(rig: HeroRig) {
    placeMount(rig.root, rig.mounts.head);
    placeMount(rig.root, rig.mounts.weapon);
    placeMount(rig.root, rig.mounts.shield);
    placeMount(rig.root, rig.mounts.offHand);
    rig.root.updateMatrixWorld(true);
}

export function applyLook(rig: HeroRig, look: ModelLook) {
    (rig.uniforms.uSkin.value as Color).set(look.skin);
    (rig.uniforms.uOutfit.value as Color).set(look.outfit);
    rig.look = look;
    const plateFace = isPlateFace(look.face);
    rig.faces.painted.visible = !plateFace;
    rig.faces.plate.visible = plateFace;
    paintFace(rig.face.image as HTMLCanvasElement, look);
    rig.face.needsUpdate = true;
    //  A plate still loading paints once it has, as she looks then.
    const repaint = () => {
        paintPlate(rig.plate.image as HTMLCanvasElement, rig.look ?? look);
        rig.plate.needsUpdate = true;
    };
    if (plateFace) {
        paintPlate(rig.plate.image as HTMLCanvasElement, look, repaint);
        rig.plate.needsUpdate = true;
    }
    applyWig(rig, look.style, look.hair);
    (rig.uniforms.uHair.value as Color).set(look.hair);
    rig.uniforms.uWig.value = (wigs[look.style] ?? wigs[0]).file ? 1 : 0;
}

/** Puts on the wig for `style` in `color`: a new wig once it has loaded,
 *  or the one she wears recoloured. */
function applyWig(rig: HeroRig, style: number, color: string) {
    const worn = rig.wig;
    if (worn.style === style) {
        if (worn.mesh)
            (worn.mesh.material as MeshToonMaterial).color.set(color);
        return;
    }
    worn.style = style;
    const wig = wigs[style] ?? wigs[0];
    void makeWig(wig, color, toonBands()).then((mesh) => {
        //  A later choice has already won.
        if (rig.wig.style !== style) {
            if (mesh) (mesh.material as MeshToonMaterial).dispose();
            return;
        }
        if (rig.wig.mesh) {
            rig.mounts.head.group.remove(rig.wig.mesh);
            (rig.wig.mesh.material as MeshToonMaterial).dispose();
        }
        rig.wig.mesh = mesh;
        if (!mesh) return;
        //  Its top just over her crown, its middle over her head's.
        mesh.position.set(
            headMiddle.x,
            headMiddle.y + headRadii.y + (wig.lift ?? 0),
            headMiddle.z + (wig.forward ?? 0),
        );
        rig.mounts.head.group.add(mesh);
    });
}

function flat(color: string) {
    return new MeshToonMaterial({
        color: new Color(color),
        gradientMap: toonBands(),
    });
}

function part(
    geometry: ConstructorParameters<typeof Mesh>[0],
    color: string,
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
) {
    const mesh = new Mesh(geometry, flat(color));
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    return mesh;
}

/** Her headgear, in metres from her head bone, which stands at her jaw:
 *  the middle of her head is 0.17 m above it, and her crown 0.45 m. */
export function buildHead(id: ItemId) {
    const item = itemDef(id);
    const [main, trim] = item.colors;
    const gear = new Group();
    const up = headMiddle.y;
    if (item.headShape === "cap") {
        gear.add(
            part(
                new SphereGeometry(0.29, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
                main,
                [0, up + 0.03, 0],
            ),
        );
        gear.add(
            part(new CylinderGeometry(0.29, 0.29, 0.04, 14), trim, [
                0,
                up + 0.03,
                0,
            ]),
        );
        gear.add(
            part(new BoxGeometry(0.3, 0.025, 0.18), trim, [0, up + 0.04, 0.3]),
        );
    } else if (item.headShape === "helm") {
        gear.add(
            part(
                new SphereGeometry(
                    0.31,
                    14,
                    8,
                    0,
                    Math.PI * 2,
                    0,
                    Math.PI / 1.8,
                ),
                main,
                [0, up - 0.01, 0],
            ),
        );
        gear.add(
            part(new CylinderGeometry(0.315, 0.315, 0.05, 14), trim, [
                0,
                up - 0.01,
                0,
            ]),
        );
        gear.add(
            part(new BoxGeometry(0.05, 0.22, 0.18), main, [
                0.285,
                up - 0.13,
                0.05,
            ]),
        );
        gear.add(
            part(new BoxGeometry(0.05, 0.22, 0.18), main, [
                -0.285,
                up - 0.13,
                0.05,
            ]),
        );
        gear.add(
            part(new BoxGeometry(0.035, 0.16, 0.035), trim, [
                0,
                up - 0.07,
                0.3,
            ]),
        );
    } else if (item.headShape === "hat") {
        gear.add(
            part(new CylinderGeometry(0.46, 0.46, 0.03, 18), main, [
                0,
                up + 0.17,
                0,
            ]),
        );
        gear.add(
            part(new CylinderGeometry(0.21, 0.25, 0.28, 14), main, [
                0,
                up + 0.31,
                0,
            ]),
        );
        gear.add(
            part(new CylinderGeometry(0.255, 0.255, 0.05, 14), trim, [
                0,
                up + 0.2,
                0,
            ]),
        );
        gear.add(
            part(
                new ConeGeometry(0.035, 0.36, 5),
                trim,
                [0.22, up + 0.42, -0.05],
                [0, 0, -0.5],
            ),
        );
    }
    //  The drawn headgear, made for her bare head, grown about her head's
    //  middle to sit over her hair, and raised to her brow.
    const fit = headgearFits[item.headShape ?? "cap"];
    if (fit) {
        const worn = new Group();
        for (const piece of [...gear.children]) worn.add(piece);
        worn.position.y = -up;
        const grown = new Group();
        grown.add(worn);
        grown.scale.setScalar(fit.scale);
        grown.position.y = up + fit.lift;
        gear.add(grown);
    }
    if (item.headShape === "headset") {
        //  The creator's model, its cups over her ears and its band over
        //  her hair, at the size of the head it was made for.
        void loadGearModel("headset").then((geometry) => {
            const material = new MeshToonMaterial({
                vertexColors: true,
                gradientMap: toonBands(),
                transparent: true,
            });
            const headset = new Mesh(geometry, material);
            headset.scale.setScalar(headsetScale);
            headset.rotation.x = headsetTilt;
            headset.position.set(
                headMiddle.x,
                up + headsetCupsAt[0],
                headMiddle.z + headsetCupsAt[1],
            );
            headset.castShadow = true;
            //  Sorted as the rest of her is, after the fight's effects.
            headset.renderOrder = 20;
            gear.add(headset);
        });
    }
    return gear;
}

/** How much each drawn headgear grows about her head's middle, and the
 *  metres it rises, to sit over her fullest hair: fitted by eye over the
 *  short cut, the twin tails, the twin curls and the bob. */
const headgearFits: Partial<
    Record<HeadShape, { scale: number; lift: number }>
> = {
    cap: { scale: 1.38, lift: 0.07 },
    helm: { scale: 1.36, lift: 0.1 },
    hat: { scale: 1.05, lift: 0 },
};

/** Where the headset's cups' middle, its file's 0, stands over her ears,
 *  as metres up and forward from her head's middle; and metres on her a
 *  unit of the sheet spans. Fitted by eye over her wigs: its cat's ears
 *  stand out of her hair and its cups on her ears. */
const headsetCupsAt = [-0.029, -0.08] as const;
const headsetScale = 1.1;
/** Radians its band leans back from upright, to stand over her crown. */
const headsetTilt = -0.35;

/** How much larger than their files' 0.8 m the creator's swords are
 *  drawn, so they read at the camera's distance. */
const swordScale = 1.5;
/** Radians the creator's swords turn about their length in her fist. */
const swordRoll = Math.PI / 2;

/** Her weapon, out of her right fist along her forearm's reach. */
export function buildWeapon(id: ItemId) {
    const item = itemDef(id);
    const [main, trim] = item.colors;
    const gear = new Group();
    if (item.weapon === "crossbow") {
        //  A hand crossbow, its grip in her fist and its stock out along
        //  her reach: the prod across its front, bowed forward, its string
        //  drawn back to the nut, and a bolt laid ready.
        const arc = Math.PI * 0.62;
        const radius = 0.24;
        gear.add(part(new BoxGeometry(0.05, 0.13, 0.07), main, [0, -0.05, 0]));
        gear.add(
            part(new BoxGeometry(0.06, 0.06, 0.46), main, [0, 0.03, 0.17]),
        );
        gear.add(
            part(new BoxGeometry(0.035, 0.02, 0.4), trim, [0, 0.07, 0.19]),
        );
        const prod = part(
            new TorusGeometry(radius, 0.022, 5, 14, arc),
            trim,
            [0, 0.04, 0.39 - radius],
            [Math.PI / 2, 0, Math.PI / 2 - arc / 2],
        );
        gear.add(prod);
        const chord = 2 * radius * Math.sin(arc / 2);
        const back = radius * Math.cos(arc / 2);
        gear.add(
            part(new BoxGeometry(chord, 0.008, 0.008), "#e8e2d0", [
                0,
                0.04,
                0.39 - radius + back,
            ]),
        );
        gear.add(
            part(new BoxGeometry(0.02, 0.02, 0.3), "#8a5a2b", [0, 0.085, 0.3]),
        );
        gear.add(
            part(
                new ConeGeometry(0.018, 0.05, 5),
                "#d8dde3",
                [0, 0.085, 0.47],
                [Math.PI / 2, 0, 0],
            ),
        );
    } else if (item.model) {
        //  The creator's sword, its grip in her fist and its blade out
        //  along her forearm's reach, lit as she is; the Ember Sword's
        //  runes glow.
        const file = item.model;
        void Promise.all([
            loadWeaponModel(file),
            loadWeaponPicture(file),
            item.glows ? loadWeaponPicture(`${file}-glow`) : null,
        ]).then(([geometry, map, glow]) => {
            const material = new MeshToonMaterial({
                map,
                gradientMap: toonBands(),
                transparent: true,
                ...(glow
                    ? { emissiveMap: glow, emissive: new Color("#ffffff") }
                    : {}),
            });
            material.userData.ownGlow = !!glow;
            const sword = new Mesh(geometry, material);
            sword.scale.setScalar(swordScale);
            //  Turned a quarter about its length, so its edge, not its
            //  flat, faces the way her fist strikes.
            sword.rotation.z = swordRoll + (item.edgeFlip ? Math.PI : 0);
            sword.castShadow = true;
            //  Sorted as the rest of her is, after the fight's effects.
            sword.renderOrder = 20;
            gear.add(sword);
        });
    } else {
        gear.add(
            part(
                new CylinderGeometry(0.025, 0.025, 0.14, 6),
                trim,
                [0, 0, 0],
                [Math.PI / 2, 0, 0],
            ),
        );
        gear.add(part(new BoxGeometry(0.18, 0.035, 0.035), trim, [0, 0, 0.08]));
        gear.add(part(new BoxGeometry(0.07, 0.015, 0.55), main, [0, 0, 0.36]));
    }
    return gear;
}

/** Her shield, strapped outside her left forearm. */
export function buildShield(id: ItemId) {
    const [face, rim] = itemDef(id).colors;
    const gear = new Group();
    gear.add(
        part(
            new CylinderGeometry(0.22, 0.22, 0.05, 14),
            rim,
            [0.1, -0.08, 0.04],
            [0, 0, Math.PI / 2],
        ),
    );
    gear.add(
        part(
            new CylinderGeometry(0.18, 0.18, 0.06, 14),
            face,
            [0.11, -0.08, 0.04],
            [0, 0, Math.PI / 2],
        ),
    );
    gear.add(part(new SphereGeometry(0.05, 8, 6), rim, [0.15, -0.08, 0.04]));
    return gear;
}

/** Empties a mount of its gear, keeping anything that is not gear, such as
 *  the face on her head, and hangs the new gear there. */
function refill({ group: mount }: Mount, gear: Group | null) {
    for (const child of [...mount.children]) {
        if (!child.userData.gear) continue;
        mount.remove(child);
        child.traverse((node) => {
            const mesh = node as Mesh;
            if (!mesh.isMesh) return;
            mesh.geometry.dispose();
            (mesh.material as MeshToonMaterial).dispose();
        });
    }
    if (gear) {
        gear.userData.gear = true;
        mount.add(gear);
    }
}

export function applyGear(rig: HeroRig, gear: ModelGear) {
    refill(rig.mounts.head, gear.head ? buildHead(gear.head) : null);
    const weapon = rig.mounts.weapon;
    weapon.follow = true;
    weapon.rest.copy(heldRest);
    weapon.turn.copy(weapon.rest);
    const held = buildWeapon(gear.weapon);
    held.position.copy(rig.grip);
    refill(weapon, held);
    for (const slot of armorSlots) applyArmor(rig, slot, gear[slot]);
    //  Her off hand: a shield on her forearm, or a second weapon in her
    //  left fist.
    const second =
        gear.shield && itemDef(gear.shield).weapon ? gear.shield : null;
    refill(
        rig.mounts.shield,
        gear.shield && !second ? buildShield(gear.shield) : null,
    );
    let offHeld: Group | null = null;
    if (second) {
        offHeld = buildWeapon(second);
        offHeld.position.copy(rig.leftGrip);
    }
    refill(rig.mounts.offHand, offHeld);
}

/** How each worn slot glows, for gear merged up past +7. */
export type GearGlows = Partial<
    Record<EquipSlot, { color: string; strength: number }>
>;

const glowColor = new Color();

/** Lights her glowing gear from within, pulsing slowly; the rest unlit.
 *  Every frame, as a piece can finish loading at any time. */
export function glowGear(rig: HeroRig, glows: GearGlows, time: number) {
    const pulse = 0.8 + 0.2 * Math.sin(time * 3);
    const light = (
        slot: EquipSlot,
        root: Object3D | null,
        onlyGear: boolean,
    ) => {
        if (!root) return;
        const glow = glows[slot];
        if (glow)
            glowColor.set(glow.color).multiplyScalar(glow.strength * pulse);
        else glowColor.setRGB(0, 0, 0);
        //  A piece with its own glow, such as the Ember Sword's runes,
        //  keeps it.
        const paint = (node: Object3D) => {
            const mesh = node as Mesh;
            const material = mesh.material as MeshToonMaterial;
            if (mesh.isMesh && !material.userData?.ownGlow)
                material.emissive?.copy(glowColor);
        };
        if (!onlyGear) return root.traverse(paint);
        for (const child of root.children)
            if (child.userData.gear) child.traverse(paint);
    };
    light("head", rig.mounts.head.group, true);
    light("weapon", rig.mounts.weapon.group, true);
    light("shield", rig.mounts.shield.group, true);
    light("shield", rig.mounts.offHand.group, true);
    for (const slot of armorSlots) light(slot, rig.armor[slot].mesh, false);
}

/** Puts on the piece of armor the item in `slot` is, taking off the one
 *  before: the piece loads once, and a later choice made while it loads
 *  wins. Her skin draws in under it once it is on. */
function applyArmor(rig: HeroRig, slot: ArmorSlot, id: ItemId | null) {
    const set = id ? (itemDef(id).armorSet ?? null) : null;
    const worn = rig.armor[slot];
    if (worn.set === set) return;
    worn.set = set;
    const cover = rig.uniforms.uCover.value as Vector3;
    const index = armorSlots.indexOf(slot);
    if (worn.mesh) {
        takeOffArmor(worn.mesh);
        worn.mesh = null;
        cover.setComponent(index, 0);
    }
    if (!set) return;
    void loadArmorPiece(set, armorPartForSlot[slot], rig.skinned).then(
        (piece) => {
            if (worn.set !== set || worn.mesh) {
                (piece.material as MeshToonMaterial).dispose();
                return;
            }
            flashWithHer(
                piece.material as MeshToonMaterial,
                rig.uniforms.uHurt,
            );
            wearArmor(rig.skinned, piece);
            worn.mesh = piece;
            cover.setComponent(index, 1);
        },
    );
}

/** Reddens a piece's material with her when she is hurt, from her own
 *  uniform. */
function flashWithHer(material: MeshToonMaterial, hurt: { value: unknown }) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uHurt = hurt;
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                "#include <common>\nuniform float uHurt;",
            )
            .replace(
                "#include <color_fragment>",
                "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.08, 0.05), uHurt * 0.55);",
            );
    };
    material.customProgramCacheKey = () => "armor-hurt";
}

//  Written in place while posing.
const parentTurn = new Quaternion();
const turn = new Quaternion();
const axis = new Vector3();
const undo = new Quaternion();

//  Written in place while levelling her head.
const headAt = new Vector3();
const gaze = new Vector3();
const across = new Vector3();
const modelUp = new Vector3(0, 1, 0);

/** The most her gaze dips below level before her head lifts it back. */
const gazeDip = 0.06;

/** Sizes her head about its bone, at her jaw, after the animation poses the
 *  frame, which may write the bone's scale, and before her matrices update.
 *  Her face, wig and headgear hang on that bone, so they shrink with it. */
export function sizeHead(rig: HeroRig) {
    rig.joints.head.scale.setScalar(headSize);
}

/** Lifts her head so she looks no further down than a little below level:
 *  her moves lean her over, and from the camera above a chibi looking at
 *  the ground shows her hair and not her face. Her matrices must be up to
 *  date. */
export function levelHead(rig: HeroRig) {
    const { head, headFront } = rig.joints;
    headAt.setFromMatrixPosition(head.matrixWorld);
    gaze.setFromMatrixPosition(headFront.matrixWorld).sub(headAt);
    rig.root.getWorldQuaternion(rootTurn);
    gaze.applyQuaternion(rootTurn.invert());
    const level = Math.hypot(gaze.x, gaze.z);
    const dip = -Math.atan2(gaze.y, level) - gazeDip;
    if (dip <= 0 || level === 0) return;
    //  About the level line across her face: lifting her gaze.
    across.set(gaze.x, 0, gaze.z).cross(modelUp).normalize();
    turnBone(rig, head, across, Math.min(dip, 0.7));
}

/** Turns `bone` by `angle` about `modelAxis`, an axis in the rig's frame,
 *  on top of whatever pose the animation gave it. */
export function turnBone(
    rig: HeroRig,
    bone: Bone,
    modelAxis: Vector3,
    angle: number,
) {
    rig.root.getWorldQuaternion(rootTurn);
    axis.copy(modelAxis).applyQuaternion(rootTurn);
    bone.parent!.getWorldQuaternion(parentTurn);
    turn.setFromAxisAngle(axis, angle);
    //  In the parent's frame: undo the parent, turn in the world, redo it.
    undo.copy(parentTurn).invert().multiply(turn).multiply(parentTurn);
    bone.quaternion.premultiply(undo);
}
