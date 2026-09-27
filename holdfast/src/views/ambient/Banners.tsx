import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import {
    CanvasTexture,
    CylinderGeometry,
    DoubleSide,
    MeshStandardMaterial,
    PlaneGeometry,
    SRGBColorSpace,
    SphereGeometry,
} from "three";
import {
    Ground,
    useHeadless,
    useWorldEntity,
    type Position,
} from "@spawnite/engine";
import { standingStones } from "../layout";

//  Two banners on poles at the north road's gate, one beside each stone
//  that flanks it, their cloth rippling in the wind. Drawn only: nothing
//  stops at them.

/** The stones either side of the north road, and which way along the ring
 *  is away from the road for each. */
const flanks = [
    { stone: standingStones[0], away: 1 },
    { stone: standingStones[standingStones.length - 1], away: -1 },
];
/** Metres a pole stands out past its stone and along the ring from it:
 *  clear of the stone's body and of the road. */
const poleOut = 0.9;
const poleAside = 1.1;

const poleHeight = 4.6;
const poleGeometry = new CylinderGeometry(0.05, 0.07, poleHeight, 8);
const armGeometry = new CylinderGeometry(0.035, 0.035, 1.15, 6);
armGeometry.rotateZ(Math.PI / 2);
const finialGeometry = new SphereGeometry(0.09, 10, 8);
const woodMaterial = new MeshStandardMaterial({
    color: "#4a3324",
    roughness: 0.9,
});
const bronzeMaterial = new MeshStandardMaterial({
    color: "#8a6a3a",
    roughness: 0.45,
    metalness: 0.6,
});

/** The cloth: hung by its top edge, finely cut down its length so the
 *  wind's wave bends it smoothly. */
const clothWidth = 0.95;
const clothLength = 2.1;
const clothGeometry = new PlaneGeometry(clothWidth, clothLength, 6, 18);
clothGeometry.translate(0, -clothLength / 2, 0);

/** Pixels of the cloth's painting. */
const paintWidth = 128;
const paintLength = 284;

/** The circle's emblem on a muted field: a ring of stones round a flame,
 *  a pale trim, and a swallowtail cut from its foot. */
function paintBanner() {
    const canvas = document.createElement("canvas");
    canvas.width = paintWidth;
    canvas.height = paintLength;
    const context = canvas.getContext("2d");
    if (context) {
        const tail = 40;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(paintWidth, 0);
        context.lineTo(paintWidth, paintLength);
        context.lineTo(paintWidth / 2, paintLength - tail);
        context.lineTo(0, paintLength);
        context.closePath();
        context.fillStyle = "#5a2a2e";
        context.fill();
        context.lineWidth = 7;
        context.strokeStyle = "#c9a86a";
        context.stroke();
        context.fillStyle = "#3e1c20";
        context.fillRect(0, 0, paintWidth, 18);
        const middle = { x: paintWidth / 2, y: 132 };
        context.fillStyle = "#d8bb7c";
        for (let stone = 0; stone < 10; stone++) {
            const angle = (stone / 10) * Math.PI * 2;
            context.save();
            context.translate(
                middle.x + Math.sin(angle) * 40,
                middle.y - Math.cos(angle) * 40,
            );
            context.rotate(angle);
            context.fillRect(-4, -7, 8, 14);
            context.restore();
        }
        context.beginPath();
        context.moveTo(middle.x, middle.y - 24);
        context.quadraticCurveTo(
            middle.x + 18,
            middle.y + 2,
            middle.x + 12,
            middle.y + 16,
        );
        context.quadraticCurveTo(
            middle.x,
            middle.y + 24,
            middle.x - 12,
            middle.y + 16,
        );
        context.quadraticCurveTo(
            middle.x - 18,
            middle.y + 2,
            middle.x,
            middle.y - 24,
        );
        context.fill();
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

/** The wind's wave in the cloth, laid over the standard material's vertex
 *  step: it grows from nothing at the hung edge to its full reach at the
 *  foot, and each banner's place shifts its phase. */
const windChunk = /* glsl */ `
#include <begin_vertex>
float hang = clamp(-position.y / ${clothLength.toFixed(2)}, 0.0, 1.0);
float phase = modelMatrix[3].x * 0.7 + modelMatrix[3].z * 0.3;
float ripple = sin(uWind * 2.4 - position.y * 2.6 + position.x * 1.5 + phase) * 0.6
    + sin(uWind * 3.9 - position.y * 4.1 - position.x * 3.0 + phase * 1.7) * 0.3;
transformed.z += ripple * 0.16 * pow(hang, 1.3);
transformed.x += sin(uWind * 1.1 + phase) * 0.14 * hang * hang;
`;

/** The banners, stood on the map's ground by their stones. A page draws
 *  them; the room, headless, has nothing to draw. */
export function Banners() {
    return useHeadless() ? null : <Standards />;
}

function Standards() {
    const surface = useWorldEntity().get(Ground)?.surface;
    const wind = useMemo(() => ({ value: 0 }), []);
    const cloth = useMemo(() => {
        const material = new MeshStandardMaterial({
            map: paintBanner(),
            side: DoubleSide,
            alphaTest: 0.5,
            roughness: 0.85,
        });
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uWind = wind;
            shader.vertexShader = `uniform float uWind;\n${shader.vertexShader.replace(
                "#include <begin_vertex>",
                windChunk,
            )}`;
        };
        return material;
    }, [wind]);
    useLayoutEffect(
        () => () => {
            cloth.map?.dispose();
            cloth.dispose();
        },
        [cloth],
    );
    const places = useMemo(
        () =>
            flanks.map(({ stone, away }) => {
                const out = Math.hypot(stone.x, stone.z);
                const radial = { x: stone.x / out, z: stone.z / out };
                //  Along the ring, away from the road.
                const along = { x: radial.z * away, z: -radial.x * away };
                const x = stone.x + radial.x * poleOut + along.x * poleAside;
                const z = stone.z + radial.z * poleOut + along.z * poleAside;
                const position: Position = [
                    x,
                    surface?.getHeightAt({ x, z }) ?? 0,
                    z,
                ];
                //  The cloth faces the circle's middle, and hangs on the
                //  pole's side away from the road.
                const yaw = Math.atan2(-x, -z);
                const side =
                    Math.cos(yaw) * along.x - Math.sin(yaw) * along.z > 0
                        ? 1
                        : -1;
                return { key: `${x}:${z}`, position, yaw, side };
            }),
        [surface],
    );
    useFrame(({ clock }) => {
        wind.value = clock.elapsedTime;
    });

    return (
        <>
            {places.map(({ key, position, yaw, side }) => (
                <group key={key} position={position} rotation-y={yaw}>
                    <mesh
                        geometry={poleGeometry}
                        material={woodMaterial}
                        position-y={poleHeight / 2}
                        castShadow
                    />
                    <mesh
                        geometry={finialGeometry}
                        material={bronzeMaterial}
                        position-y={poleHeight + 0.06}
                    />
                    <mesh
                        geometry={armGeometry}
                        material={woodMaterial}
                        position={[0.5 * side, poleHeight - 0.25, 0.04]}
                    />
                    <mesh
                        geometry={clothGeometry}
                        material={cloth}
                        position={[0.5 * side, poleHeight - 0.28, 0.08]}
                    />
                </group>
            ))}
        </>
    );
}
