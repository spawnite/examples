import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import {
    BufferAttribute,
    DoubleSide,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    Mesh,
    MeshStandardMaterial,
    Sphere,
    Vector3,
    Vector4,
} from "three";
import { useWorld } from "koota/react";
import {
    type GroundSurface,
    Hero,
    Transform,
    useQualityLevel,
} from "@spawnite/engine";
import { hearthMetres, ringMetres } from "../layout";
import {
    countDrawnBlades,
    grassFade,
    plantGrass,
    readGrassShare,
} from "./grassField";
import {
    grassFragmentDeclarations,
    grassVertexDeclarations,
    grassVertexPosition,
    grassVertexShape,
} from "./grassShader";

//  Grass blades on the map's grass, dense round the camera and thinning to
//  none at grassFade.far, one draw a patch, and only the patches in view.

/** A blade's rest height and its width at the root, in metres. */
const bladeMetres = { height: 0.32, width: 0.03 };
/** Metres round a warden's feet where the grass lies flat. */
const trampleMetres = 1.1;
/** Rows of the blade's strip below its tip. */
const bladeRows = 4;

/** The one strip every blade is drawn from: pairs of vertices up to a
 *  tip, each vertex holding its side and its height up the blade. */
function createBladeShape() {
    const sides: number[] = [];
    for (let row = 0; row < bladeRows; row++)
        sides.push(-1, row / bladeRows, 1, row / bladeRows);
    sides.push(0, 1);
    const indices: number[] = [];
    for (let row = 0; row < bladeRows - 1; row++) {
        const base = row * 2;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
    const top = (bladeRows - 1) * 2;
    indices.push(top, top + 1, top + 2);
    const blade = new BufferAttribute(new Float32Array(sides), 2);
    //  three wants a position and a normal, or it shades the blade flat;
    //  the shader writes both.
    const placeholder = new BufferAttribute(
        new Float32Array((sides.length / 2) * 3),
        3,
    );
    return {
        blade,
        placeholder,
        index: new BufferAttribute(new Uint16Array(indices), 1),
    };
}

const grassUniforms = {
    uTime: { value: 0 },
    uFadeNear: { value: grassFade.near },
    uFadeFar: { value: grassFade.far },
    uBladeHeight: { value: bladeMetres.height },
    uBladeWidth: { value: bladeMetres.width },
    uRing: { value: ringMetres.radius },
    uRingHalfWidth: { value: ringMetres.halfWidth },
    uHearth: { value: hearthMetres },
    uTrample: { value: [0, 1, 2, 3].map(() => new Vector4()) },
};

function createGrassMaterial() {
    const material = new MeshStandardMaterial({
        roughness: 0.75,
        metalness: 0,
        side: DoubleSide,
    });
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, grassUniforms);
        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                `#include <common>\n${grassVertexDeclarations}`,
            )
            .replace("#include <beginnormal_vertex>", grassVertexShape)
            .replace("#include <begin_vertex>", grassVertexPosition);
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>\n${grassFragmentDeclarations}`,
            )
            .replace(
                "#include <color_fragment>",
                "#include <color_fragment>\ndiffuseColor.rgb = vGrassColor;",
            )
            //  Both faces take the up-leaning normal: flipped for the back
            //  face, half the field would turn dark.
            .replace(
                "#include <normal_fragment_begin>",
                "#include <normal_fragment_begin>\nnormal = normalize(vNormal);",
            );
    };
    return material;
}

interface GrassProps {
    surface: GroundSurface;
}

/** The blades, as many as the Graphics setting plants. */
export function Grass({ surface }: GrassProps) {
    const level = useQualityLevel();
    const share = readGrassShare(level);
    const material = useMemo(createGrassMaterial, []);
    const meshes = useMemo(() => {
        const shape = createBladeShape();
        return plantGrass({ surface, share }).map((patch) => {
            const geometry = new InstancedBufferGeometry();
            geometry.setIndex(shape.index);
            geometry.setAttribute("position", shape.placeholder);
            geometry.setAttribute("normal", shape.placeholder);
            geometry.setAttribute("blade", shape.blade);
            geometry.setAttribute(
                "root",
                new InstancedBufferAttribute(patch.roots, 4),
            );
            geometry.setAttribute(
                "groundUnder",
                new InstancedBufferAttribute(patch.ground, 2),
            );
            let heights = 0;
            for (let index = 0; index < patch.count; index++)
                heights += patch.roots[index * 4 + 1];
            geometry.boundingSphere = new Sphere(
                new Vector3(
                    patch.centerX,
                    heights / patch.count,
                    patch.centerZ,
                ),
                patch.radius + 1,
            );
            geometry.instanceCount = 0;
            const mesh = new Mesh(geometry, material);
            mesh.name = "grass";
            mesh.receiveShadow = true;
            mesh.visible = false;
            //  A pointer ray meets the engine's ground, not a blade.
            mesh.raycast = () => undefined;
            return { mesh, patch };
        });
    }, [surface, share, material]);
    useLayoutEffect(
        () => () => {
            for (const { mesh } of meshes) mesh.geometry.dispose();
        },
        [meshes],
    );
    useLayoutEffect(() => () => material.dispose(), [material]);
    const world = useWorld();
    useFrame(({ camera, clock }) => {
        grassUniforms.uTime.value = clock.elapsedTime;
        const trample = grassUniforms.uTrample.value;
        let warden = 0;
        for (const hero of world.query(Hero, Transform)) {
            const at = hero.get(Transform);
            if (!at || warden === trample.length) continue;
            trample[warden++].set(at.x, at.z, trampleMetres, 1);
        }
        //  Far off and weightless: a zero radius would divide by zero.
        for (; warden < trample.length; warden++)
            trample[warden].set(1e4, 1e4, 1, 0);
        for (const { mesh, patch } of meshes) {
            const drawn = countDrawnBlades(patch, camera.position);
            mesh.geometry.instanceCount = drawn;
            mesh.visible = drawn > 0;
        }
    });

    return (
        <group name="grass">
            {meshes.map(({ mesh }) => (
                <primitive key={mesh.uuid} object={mesh} />
            ))}
        </group>
    );
}
