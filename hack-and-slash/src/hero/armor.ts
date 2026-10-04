import {
    BufferAttribute,
    BufferGeometry,
    DataTexture,
    MeshToonMaterial,
    NearestFilter,
    RedFormat,
    SkinnedMesh,
    SRGBColorSpace,
    TextureLoader,
    type Material,
    type Texture,
} from "@spawnite/engine/three";
import type { ArmorSet } from "../items/items";

//  Her armor: six sets the creator made, each cut into a body piece,
//  gloves and boots that she wears over her base and that move with her
//  bones. Each piece was fitted to her base's bind shape offline, its head
//  and bare skin taken off, and skinned from her nearest point, so it
//  shares her skeleton and bends where she bends. A piece's file holds a
//  vertex count and an index count, then its positions and normals, in the
//  base's own Z-up metres, its texture coordinates, four bones and four
//  weights a vertex, and its triangles. The bones are numbered as
//  bones.json lists them and found in her skeleton by name. A set's pieces
//  share one texture. Each file and texture loads once and is shared.

/** A piece of a set: what she wears on her body, hands and feet. */
export type ArmorPart = "body" | "gloves" | "boots";

export const armorSets: { set: ArmorSet; name: string }[] = [
    { set: "arcane", name: "Arcane Robes" },
    { set: "battlemage", name: "Battle Mage" },
    { set: "berserker", name: "Berserker" },
    { set: "knight", name: "Knight" },
    { set: "ranger", name: "Ranger" },
    { set: "scout", name: "Scout" },
];

export const armorParts: { part: ArmorPart; name: string }[] = [
    { part: "body", name: "Armor" },
    { part: "gloves", name: "Gloves" },
    { part: "boots", name: "Boots" },
];

/** The piece worn in each of her armor's equipment slots. */
export const armorPartForSlot = {
    body: "body",
    hands: "gloves",
    feet: "boots",
} as const satisfies Record<string, ArmorPart>;

const folder = `${import.meta.env.BASE_URL}models/armor/`;

/** The bones' names, in the order the pieces number them. */
let boneNames: Promise<string[]> | undefined;
const files = new Map<string, Promise<ArrayBuffer>>();
const geometries = new Map<string, Promise<BufferGeometry>>();
const textures = new Map<ArmorSet, Promise<Texture>>();

let bands: DataTexture | undefined;

/** Three bands of light and shade, as the rest of her is lit: one for
 *  every piece, never freed. */
function toonBands() {
    if (!bands) {
        bands = new DataTexture(
            new Uint8Array([90, 180, 255]),
            3,
            1,
            RedFormat,
        );
        bands.minFilter = NearestFilter;
        bands.magFilter = NearestFilter;
        bands.needsUpdate = true;
    }
    return bands;
}

function loadBoneNames() {
    if (!boneNames) {
        boneNames = fetch(`${folder}bones.json`).then(
            (response) => response.json() as Promise<string[]>,
        );
        boneNames.catch(() => (boneNames = undefined));
    }
    return boneNames;
}

function loadFile(set: ArmorSet, part: ArmorPart) {
    const name = `${set}-${part}`;
    let file = files.get(name);
    if (!file) {
        file = fetch(`${folder}${name}.bin`).then((response) => {
            if (!response.ok) throw new Error(`No armor piece ${name}`);
            return response.arrayBuffer();
        });
        //  A failed load is tried again next time.
        file.catch(() => files.delete(name));
        files.set(name, file);
    }
    return file;
}

function loadTexture(set: ArmorSet) {
    let texture = textures.get(set);
    if (!texture) {
        texture = new TextureLoader()
            .loadAsync(`${folder}${set}.jpg`)
            .then((loaded) => {
                loaded.colorSpace = SRGBColorSpace;
                loaded.anisotropy = 4;
                return loaded;
            });
        texture.catch(() => textures.delete(set));
        textures.set(set, texture);
    }
    return texture;
}

/** The piece's geometry with its bones numbered as `bones` numbers them:
 *  one per piece and skeleton layout, as every copy of her shares one. */
function loadGeometry(set: ArmorSet, part: ArmorPart, bones: string[]) {
    const key = `${set}-${part}|${bones.join(",")}`;
    let geometry = geometries.get(key);
    if (!geometry) {
        geometry = Promise.all([loadFile(set, part), loadBoneNames()]).then(
            ([buffer, names]) => {
                //  Each of the file's bones, as a bone of hers: a bone she
                //  lacks falls back to the one it ends, else her hips.
                const index = new Map(bones.map((name, i) => [name, i]));
                const remap = names.map(
                    (name) =>
                        index.get(name) ??
                        index.get(name.replace(/_end$/, "")) ??
                        0,
                );
                const [verts, count] = new Uint32Array(buffer, 0, 2);
                const at = (floats: number) => 8 + verts * floats;
                const skinIndex = new Uint16Array(
                    buffer,
                    at(32),
                    verts * 4,
                ).map((bone) => remap[bone] ?? 0);
                const built = new BufferGeometry();
                built.setAttribute(
                    "position",
                    new BufferAttribute(
                        new Float32Array(buffer, at(0), verts * 3),
                        3,
                    ),
                );
                built.setAttribute(
                    "normal",
                    new BufferAttribute(
                        new Float32Array(buffer, at(12), verts * 3),
                        3,
                    ),
                );
                built.setAttribute(
                    "uv",
                    new BufferAttribute(
                        new Float32Array(buffer, at(24), verts * 2),
                        2,
                    ),
                );
                built.setAttribute(
                    "skinIndex",
                    new BufferAttribute(skinIndex, 4),
                );
                built.setAttribute(
                    "skinWeight",
                    new BufferAttribute(
                        new Uint8Array(buffer, at(40), verts * 4),
                        4,
                        true,
                    ),
                );
                built.setIndex(
                    new BufferAttribute(
                        new Uint32Array(buffer, at(44), count),
                        1,
                    ),
                );
                built.computeBoundingSphere();
                return built;
            },
        );
        geometry.catch(() => geometries.delete(key));
        geometries.set(key, geometry);
    }
    return geometry;
}

/** A piece of armor for the hero whose body is `skinned`: bound to her
 *  skeleton with her bind matrix, so it follows her bones as her skin
 *  does, and toon-lit in its set's texture with the bands the rest of her
 *  uses. Put it on with `wearArmor`. */
export async function loadArmorPiece(
    set: ArmorSet,
    part: ArmorPart,
    skinned: SkinnedMesh,
) {
    const [geometry, map] = await Promise.all([
        loadGeometry(
            set,
            part,
            skinned.skeleton.bones.map((bone) => bone.name),
        ),
        loadTexture(set),
    ]);
    const mesh = new SkinnedMesh(
        geometry,
        new MeshToonMaterial({ map, gradientMap: toonBands() }),
    );
    mesh.name = `armor-${set}-${part}`;
    mesh.userData.armor = { set, part };
    mesh.bind(skinned.skeleton, skinned.bindMatrix);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    return mesh;
}

/** Puts `piece` on the hero whose body is `skinned`: beside her body under
 *  the same parent, placed as her body is, and drawn in the same pass and
 *  order. Its skinning takes it to where her bones are whatever its
 *  place, but beside her body it is shown, hidden and removed with her. */
export function wearArmor(skinned: SkinnedMesh, piece: SkinnedMesh) {
    piece.position.copy(skinned.position);
    piece.quaternion.copy(skinned.quaternion);
    piece.scale.copy(skinned.scale);
    piece.renderOrder = skinned.renderOrder;
    const body = [skinned.material].flat()[0] as Material;
    (piece.material as Material).transparent = body.transparent;
    skinned.parent!.add(piece);
}

/** Takes `piece` off and frees its material; its geometry and texture stay
 *  loaded, shared with every other piece of its kind. */
export function takeOffArmor(piece: SkinnedMesh) {
    piece.removeFromParent();
    (piece.material as Material).dispose();
}
