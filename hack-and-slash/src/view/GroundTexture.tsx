import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useTrait } from "koota/react";
import {
    GroundTrait,
    groundTextures,
    RefTrait,
    useWorldEntity,
} from "@spawnite/engine";
import {
    LinearFilter,
    LinearMipmapLinearFilter,
    Mesh,
    MeshLambertMaterial,
    RepeatWrapping,
    SRGBColorSpace,
    TextureLoader,
} from "@spawnite/engine/three";
import { useDetail } from "./graphics";

/** Metres of ground one grass image covers: a blade a few centimetres
 *  across, which reads as grass at her feet in town and as a lawn from
 *  the wilds' camera. The image is painted as two tiles by two, so its
 *  pattern comes round every half of this. */
const metresPerImage = 4;

/** The ground's own read of its map, and what it becomes: the grass read
 *  twice, the second time mirrored left to right, larger and shifted, and
 *  the two blended by a slow noise, a patch every few images. The painted
 *  tile's light clumps sit on a lattice, and one read alone shows it as
 *  diagonal bands across the whole meadow. The mirrored read's bands run
 *  the other way and never line up with the first's, so the ground breaks
 *  into patches of each, while every blade still points up the image.
 *  `vMapUv` counts in images, the repeat already taken in. */
const mapChunk = "#include <map_fragment>";
const grassChunk = /* glsl */ `
#ifdef USE_MAP
    vec2 grassCell = floor(vMapUv * 0.5);
    vec2 grassWithin = fract(vMapUv * 0.5);
    grassWithin = grassWithin * grassWithin * (3.0 - 2.0 * grassWithin);
    float grassBlend = mix(
        mix(grassHash(grassCell), grassHash(grassCell + vec2(1.0, 0.0)), grassWithin.x),
        mix(grassHash(grassCell + vec2(0.0, 1.0)), grassHash(grassCell + vec2(1.0, 1.0)), grassWithin.x),
        grassWithin.y
    );
    vec4 sampledDiffuseColor = mix(
        texture2D(map, vMapUv),
        texture2D(map, vec2(-vMapUv.x, vMapUv.y) * 0.71 + vec2(0.37, 0.61)),
        smoothstep(0.25, 0.75, grassBlend)
    );
    diffuseColor *= sampledDiffuseColor;
#endif
`;
/** A number from 0 to 1 for each whole cell, the same every frame: the
 *  noise's corners, which the blend above eases between. */
const commonChunk = "#include <common>";
const hashChunk = /* glsl */ `
float grassHash(vec2 cell) {
    return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
}
`;

/** The engine's grass on the World's ground, in place of the grey-green
 *  grid the engine draws it with. The engine ships the grass and a path
 *  beside its scatter models, for a splat it has yet to bake, and its
 *  ground view never reads either; this lays the grass on the ground's
 *  own material once the ground has mounted and the image has loaded,
 *  with the read above in place of the material's own, and gives the
 *  grid back when it unmounts.
 *
 *  The ground's vertex colours stay: they paint a path's surface as a
 *  tint over the grid's grey-green, and white everywhere else, which
 *  leaves the grass as it is. The meadow's one path has no surface, so
 *  the whole meadow is white and the grass reads true. A map with a
 *  surfaced path would want the path image under it instead, which the
 *  engine's splat is to bring; its tint over the grass would read darker
 *  and greener than the surface it names.
 *
 *  Mounted inside a World, whose ground it finds: the mesh the engine's
 *  ground view holds on the World's ground entity. */
export function GroundTexture() {
    const ground = useWorldEntity();
    //  Held there once the ground view has mounted, which can be after
    //  this has, behind the views' own Suspense.
    const mesh = useTrait(ground, RefTrait)?.object;
    const size = useTrait(ground, GroundTrait)?.surface.size;
    const renderer = useThree((state) => state.gl);
    //  Low graphics read the grass once, as it is painted, bands and all,
    //  and sharpen the far grass less.
    const detail = useDetail();
    const blend = detail === "high" || detail === "medium";

    useEffect(() => {
        if (!(mesh instanceof Mesh) || !size) return;
        const material = mesh.material;
        if (!(material instanceof MeshLambertMaterial)) return;
        const grid = material.map;
        const compile = material.onBeforeCompile;
        const cacheKey = material.customProgramCacheKey;
        let unmounted = false;

        //  Laid on only once it has loaded: a texture with no image yet
        //  draws black.
        const grass = new TextureLoader().load(groundTextures.grass, () => {
            if (unmounted) return;
            material.map = grass;
            if (blend) {
                material.onBeforeCompile = (shader) => {
                    shader.fragmentShader = shader.fragmentShader
                        .replace(commonChunk, `${commonChunk}\n${hashChunk}`)
                        .replace(mapChunk, grassChunk);
                };
                material.customProgramCacheKey = () => "bladebound-grass";
            }
            material.needsUpdate = true;
        });
        //  It carries colour, as the engine notes beside it.
        grass.colorSpace = SRGBColorSpace;
        grass.wrapS = RepeatWrapping;
        grass.wrapT = RepeatWrapping;
        //  The ground's coordinates run once across the whole map.
        grass.repeat.setScalar(size / metresPerImage);
        //  The wilds' camera looks along the ground as much as down on it:
        //  the far grass would shimmer without the mipmaps, and blur to a
        //  smear without the anisotropy.
        grass.anisotropy = Math.min(
            renderer.capabilities.getMaxAnisotropy(),
            blend ? 16 : 4,
        );
        grass.magFilter = LinearFilter;
        grass.minFilter = LinearMipmapLinearFilter;
        grass.generateMipmaps = true;

        return () => {
            unmounted = true;
            if (material.map === grass) {
                material.map = grid;
                material.onBeforeCompile = compile;
                material.customProgramCacheKey = cacheKey;
                material.needsUpdate = true;
            }
            grass.dispose();
        };
    }, [mesh, size, renderer, blend]);

    return null;
}
