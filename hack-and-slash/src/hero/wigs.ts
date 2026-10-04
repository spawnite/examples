import {
    BufferAttribute,
    BufferGeometry,
    Color,
    Mesh,
    MeshToonMaterial,
    TextureLoader,
    type Texture,
} from "@spawnite/engine/three";

//  Her hairstyles: the creator's wigs, fitted to her bald head. Each file
//  holds a wig's mesh as it came out of Blender: a vertex count and an
//  index count, then the positions, Z-up with its fringe toward -y, then,
//  for a wig shaded by its texture, its texture coordinates, and the
//  triangles. Loaded once each and shared.

export type Wig = {
    name: string;
    /** The file under public/models/hair, none for a bare head. */
    file?: string;
    /** The height, in the file's units, of the top of the wig's cap over
     *  her forehead: a bun or a tail's bunch may stand higher, but the cap is
     *  what sits on her crown. */
    crown?: number;
    /** Metres a unit of the file spans on her: across, up and front to
     *  back. Each is full, as a chibi's hair is, standing off her head all
     *  round, and fitted so the cap at her temples matches the short cut's:
     *  between the first fit, which the creator found small, and a third
     *  larger, which they found too big for her head. */
    scale?: [number, number, number];
    /** Metres the cap's crown stands above hers, and forward of her head's
     *  middle. */
    lift?: number;
    forward?: number;
    /** A map of the light and dark of the creator's texture, strand by
     *  strand, under public/models/hair: it shades the hair's colour, so
     *  the strands show in any colour she picks. */
    shade?: string;
};

export const wigs: Wig[] = [
    { name: "None" },
    {
        name: "Short",
        file: "short",
        crown: 0.721,
        scale: [0.4, 0.32, 0.4],
        lift: 0.069,
        forward: 0.026,
    },
    //  Shaded by the creator's texture for it.
    {
        name: "Twin tails",
        file: "twintail",
        crown: 0.833,
        scale: [0.67, 0.54, 0.68],
        lift: 0.069,
        forward: 0.026,
        shade: "twintail-shade.jpg",
    },
    {
        name: "Curly",
        file: "curly",
        crown: 0.659,
        scale: [0.4, 0.33, 0.4],
        lift: 0.073,
        forward: 0.026,
    },
    {
        name: "Twin curls",
        file: "twin-curly",
        crown: 0.657,
        scale: [0.45, 0.525, 0.66],
        lift: 0.09,
        forward: 0.03,
    },
    //  Cut whole from the creator's face-plate sheet: a bob whose fringe
    //  falls to her brow and whose hair frames her face to her jaw.
    //  Fitted by eye.
    {
        name: "Bob",
        file: "bob",
        crown: -0.001,
        scale: [0.8, 0.8, 0.8],
        lift: 0.02,
        forward: 0,
    },
];

const loads = new Map<string, Promise<BufferGeometry>>();

/** A wig's mesh, turned to the game's frame: Y-up, its fringe toward +z,
 *  its cap's crown at 0. */
function loadWig(wig: Wig) {
    const file = wig.file!;
    let load = loads.get(file);
    if (!load) {
        load = fetch(`${import.meta.env.BASE_URL}models/hair/${file}.bin`)
            .then((response) => response.arrayBuffer())
            .then((buffer) => {
                const [verts, count] = new Uint32Array(buffer, 0, 2);
                const raw = new Float32Array(buffer, 8, verts * 3);
                const positions = new Float32Array(verts * 3);
                for (let vertex = 0; vertex < verts; vertex++) {
                    //  Blender's (x, y, z) is the game's (x, z, -y).
                    positions[vertex * 3] = raw[vertex * 3];
                    positions[vertex * 3 + 1] = raw[vertex * 3 + 2];
                    positions[vertex * 3 + 2] = -raw[vertex * 3 + 1];
                }
                const geometry = new BufferGeometry();
                geometry.setAttribute(
                    "position",
                    new BufferAttribute(positions, 3),
                );
                //  A shaded wig's file carries its texture coordinates.
                const uvBytes = wig.shade ? verts * 8 : 0;
                if (wig.shade)
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
                        new Uint32Array(
                            buffer,
                            8 + verts * 12 + uvBytes,
                            count,
                        ).slice(),
                        1,
                    ),
                );
                geometry.translate(0, -(wig.crown ?? 0), 0);
                geometry.computeVertexNormals();
                return geometry;
            });
        loads.set(file, load);
    }
    return load;
}

const shades = new Map<string, Promise<Texture>>();

/** A wig's shading map, loaded once. Its values are light itself, not a
 *  colour, so it is read as it is written. */
function loadShade(file: string) {
    let load = shades.get(file);
    if (!load) {
        load = new TextureLoader().loadAsync(
            `${import.meta.env.BASE_URL}models/hair/${file}`,
        );
        shades.set(file, load);
    }
    return load;
}

/** The mesh for `wig` in `color`, or null for a bare head; toon-lit with
 *  the bands the rest of her uses, and shaded strand by strand where the
 *  wig has a shading map. */
export async function makeWig(wig: Wig, color: string, bands: Texture) {
    if (!wig.file) return null;
    const [geometry, shade] = await Promise.all([
        loadWig(wig),
        wig.shade ? loadShade(wig.shade) : null,
    ]);
    const mesh = new Mesh(
        geometry,
        new MeshToonMaterial({
            color: new Color(color),
            gradientMap: bands,
            map: shade,
        }),
    );
    mesh.scale.set(...(wig.scale ?? [0.33, 0.33, 0.33]));
    mesh.castShadow = true;
    return mesh;
}
