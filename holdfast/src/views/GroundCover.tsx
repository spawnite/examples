import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useQueryFirst, useTrait } from "koota/react";
import {
    type ComponentProps,
    Suspense,
    useLayoutEffect,
    useMemo,
    useRef,
} from "react";
import {
    BufferAttribute,
    Color,
    type Mesh,
    MeshStandardMaterial,
    NoColorSpace,
    RepeatWrapping,
    SRGBColorSpace,
    type Texture,
} from "three";
import {
    GroundTrait,
    type GroundSurface,
    HeightfieldGeometry,
    useHeadless,
} from "@spawnite/engine";
import {
    groundFunctions,
    groundLayers,
    groundLayoutUniforms,
    groundVertexDeclarations,
    groundVertexOutputs,
} from "./ground/groundShader";
import { groundTextures } from "./ground/groundTextures";
import { Outland } from "./world/Outland";
import { Surroundings } from "./world/Surroundings";

//  The ground as this game paints it, laid over the engine's own: grass,
//  whose blades the engine grows as grassShader.ts shapes them, packed earth on the map's roads and wherever
//  feet wear it, a cobbled ring and flagstones under the hearth, each from a
//  photographed surface. The engine draws its ground flat, as
//  src/maps/materials.json sets it, with no textures to load; this draws
//  the same heights with the game's own surface, a hair in front of it.

//  The heights the geometry lays, and the paths the road weights read.
type GroundPaintSurface = ComponentProps<
    typeof HeightfieldGeometry
>["surface"] &
    Pick<GroundSurface, "getPathSurfaceAt">;

//  Object.keys types every key as a string; these are the table's own.
const layerNames = Object.keys(
    groundTextures,
) as (keyof typeof groundTextures)[];
const textureUrls = layerNames.flatMap((name) => [
    groundTextures[name].color,
    groundTextures[name].detail,
]);

/** Writes each vertex's share of a dirt road, from the map's own paths, as
 *  the `roadWeight` attribute the paint reads: the roads bend, which the
 *  shader alone cannot follow cheaply. The plane lies in its own x-y, which
 *  the ground's rotation stands up with its y along minus the world's z. */
function bakeRoadWeights(mesh: Mesh, surface: GroundPaintSurface) {
    const positions = mesh.geometry.attributes.position;
    const weights = new Float32Array(positions.count);
    for (let index = 0; index < positions.count; index++) {
        const paint = surface.getPathSurfaceAt({
            x: positions.getX(index),
            z: -positions.getY(index),
        });
        if (paint?.surface === "dirt") weights[index] = paint.weight;
    }
    mesh.geometry.setAttribute("roadWeight", new BufferAttribute(weights, 1));
}

/** The ground's material over the loaded maps, in textureUrls' order.
 *  The land's reads no grass, since past the map it is all forest floor
 *  and track. */
function createGroundMaterial(
    maps: Texture[],
    anisotropy: number,
    { land }: { land: boolean },
) {
    const material = new MeshStandardMaterial({
        roughness: 0.92,
        metalness: 0,
        //  In front of the engine's ground at the same depth.
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });
    const layerUniforms = Object.fromEntries(
        layerNames.flatMap((name, index) => {
            const [color, detail] = [maps[index * 2], maps[index * 2 + 1]];
            for (const map of [color, detail]) {
                map.wrapS = map.wrapT = RepeatWrapping;
                map.anisotropy = anisotropy;
            }
            color.colorSpace = SRGBColorSpace;
            detail.colorSpace = NoColorSpace;
            const texture = groundTextures[name];
            const uniformNames = groundLayers[name];
            return [
                [uniformNames.colorMap, { value: color }],
                [uniformNames.detailMap, { value: detail }],
                [uniformNames.tileMetres, { value: texture.tileMetres }],
                [uniformNames.mean, { value: new Color(...texture.mean) }],
            ];
        }),
    );
    if (land) material.defines = { GROUND_LAND: "" };
    material.onBeforeCompile = (shader) => {
        Object.assign(
            shader.uniforms,
            layerUniforms,
            Object.fromEntries(
                Object.entries(groundLayoutUniforms).map(([name, value]) => [
                    name,
                    { value },
                ]),
            ),
        );
        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                `#include <common>\n${groundVertexDeclarations}`,
            )
            .replace(
                "#include <worldpos_vertex>",
                `#include <worldpos_vertex>\n${groundVertexOutputs}`,
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>\n${groundFunctions}`,
            )
            .replace(
                "#include <color_fragment>",
                "#include <color_fragment>\ndiffuseColor.rgb = paintGround(vGroundPosition);",
            )
            .replace(
                "#include <roughnessmap_fragment>",
                "#include <roughnessmap_fragment>\nroughnessFactor = groundRoughness;",
            )
            .replace(
                "#include <normal_fragment_maps>",
                "#include <normal_fragment_maps>\nnormal = tiltGround(groundTangentNormal);",
            );
    };
    return material;
}

interface GroundPaintProps {
    surface: GroundPaintSurface;
}

/** The painted mesh over the map's heights, once its maps have loaded. */
function GroundPaint({ surface }: GroundPaintProps) {
    const maps = useTexture(textureUrls);
    const anisotropy = useThree((state) =>
        state.gl.capabilities.getMaxAnisotropy(),
    );
    const material = useMemo(
        () => createGroundMaterial(maps, anisotropy, { land: false }),
        [maps, anisotropy],
    );
    const landMaterial = useMemo(
        () => createGroundMaterial(maps, anisotropy, { land: true }),
        [maps, anisotropy],
    );
    const meshRef = useRef<Mesh>(null);
    useLayoutEffect(() => () => material.dispose(), [material]);
    useLayoutEffect(() => () => landMaterial.dispose(), [landMaterial]);
    //  After the geometry's own layout effect, which lays its vertices.
    useLayoutEffect(() => {
        if (meshRef.current) bakeRoadWeights(meshRef.current, surface);
    }, [surface]);

    return (
        <>
            <mesh
                ref={meshRef}
                name="ground cover"
                rotation-x={-Math.PI / 2}
                material={material}
                receiveShadow
                //  A pointer ray meets the engine's ground, not this.
                raycast={() => undefined}
            >
                <HeightfieldGeometry surface={surface} />
            </mesh>
            <Outland
                surface={surface}
                groundRef={meshRef}
                material={landMaterial}
            />
        </>
    );
}

/** The game's surface over the map's ground, and what stands round it. */
export function GroundCover() {
    const ground = useTrait(useQueryFirst(GroundTrait), GroundTrait);
    const headless = useHeadless();
    if (!ground || headless) return null;

    return (
        <>
            <Surroundings />
            {/*  Its own boundary: the engine's ground shows while the maps
                 load, and nothing else in the scene waits on them. */}
            <Suspense fallback={null}>
                <GroundPaint surface={ground.surface} />
            </Suspense>
        </>
    );
}
