import {
    BufferAttribute,
    BufferGeometry,
    SRGBColorSpace,
    TextureLoader,
    type Texture,
} from "@spawnite/engine/three";

//  Gear made as models, as the creator's cat-ear headset is: cut from
//  their face-plate sheet by scripts/sheet-build.html, its colours sampled
//  from its texture into its corners. A file holds a vertex count and an
//  index count, then the positions in the sheet's own Z-up units, set level
//  about the point it is worn by, four colour bytes a vertex, as painted,
//  and the triangles. Each loads once, turned to the game's frame, Y-up and
//  facing +z.

const loads = new Map<string, Promise<BufferGeometry>>();

/** A colour byte as painted, as the light is reckoned in. */
const decoded = (byte: number) => (byte / 255) ** 2.2;

export function loadGearModel(file: string) {
    let load = loads.get(file);
    if (!load) {
        load = fetch(`${import.meta.env.BASE_URL}models/gear/${file}.bin`)
            .then((response) => response.arrayBuffer())
            .then((buffer) => {
                const [verts, count] = new Uint32Array(buffer, 0, 2);
                const raw = new Float32Array(buffer, 8, verts * 3);
                const bytes = new Uint8Array(buffer, 8 + verts * 12, verts * 4);
                const positions = new Float32Array(verts * 3);
                const colours = new Float32Array(verts * 3);
                for (let vertex = 0; vertex < verts; vertex++) {
                    //  The file's (x, y, z) is the game's (x, z, -y).
                    positions[vertex * 3] = raw[vertex * 3];
                    positions[vertex * 3 + 1] = raw[vertex * 3 + 2];
                    positions[vertex * 3 + 2] = -raw[vertex * 3 + 1];
                    for (let channel = 0; channel < 3; channel++)
                        colours[vertex * 3 + channel] = decoded(
                            bytes[vertex * 4 + channel],
                        );
                }
                const geometry = new BufferGeometry();
                geometry.setAttribute(
                    "position",
                    new BufferAttribute(positions, 3),
                );
                geometry.setAttribute("color", new BufferAttribute(colours, 3));
                geometry.setIndex(
                    new BufferAttribute(
                        new Uint32Array(buffer, 8 + verts * 16, count).slice(),
                        1,
                    ),
                );
                geometry.computeVertexNormals();
                return geometry;
            });
        load.catch(() => loads.delete(file));
        loads.set(file, load);
    }
    return load;
}

//  Weapons made as models, as the creator's swords are: cut to size by
//  scripts/sword-build.html, turned so the blade points along +z from the
//  middle of the grip at 0, in metres. A file holds a vertex count and an
//  index count, then the positions, the texture coordinates and the
//  triangles; its texture is a picture beside it, and a weapon with parts
//  that glow has a second, of its glow.

const weapons = new Map<string, Promise<BufferGeometry>>();
const pictures = new Map<string, Promise<Texture>>();

export function loadWeaponModel(file: string) {
    let load = weapons.get(file);
    if (!load) {
        load = fetch(`${import.meta.env.BASE_URL}models/weapons/${file}.bin`)
            .then((response) => response.arrayBuffer())
            .then((buffer) => {
                const [verts, count] = new Uint32Array(buffer, 0, 2);
                const geometry = new BufferGeometry();
                geometry.setAttribute(
                    "position",
                    new BufferAttribute(
                        new Float32Array(buffer, 8, verts * 3).slice(),
                        3,
                    ),
                );
                geometry.setAttribute(
                    "uv",
                    new BufferAttribute(
                        new Float32Array(
                            buffer,
                            8 + verts * 12,
                            verts * 2,
                        ).slice(),
                        2,
                    ),
                );
                geometry.setIndex(
                    new BufferAttribute(
                        new Uint32Array(buffer, 8 + verts * 20, count).slice(),
                        1,
                    ),
                );
                geometry.computeVertexNormals();
                return geometry;
            });
        load.catch(() => weapons.delete(file));
        weapons.set(file, load);
    }
    return load;
}

/** A weapon's picture, `file` its name under public/models/weapons,
 *  loaded once. */
export function loadWeaponPicture(file: string) {
    let load = pictures.get(file);
    if (!load) {
        load = new TextureLoader()
            .loadAsync(`${import.meta.env.BASE_URL}models/weapons/${file}.jpg`)
            .then((texture) => {
                texture.colorSpace = SRGBColorSpace;
                texture.flipY = true;
                return texture;
            });
        pictures.set(file, load);
    }
    return load;
}
