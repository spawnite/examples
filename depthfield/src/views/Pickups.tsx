import { useFrame } from "@react-three/fiber";
import { createQuery } from "koota";
import { useWorld } from "koota/react";
import { useMemo } from "react";
import {
    CanvasTexture,
    CircleGeometry,
    InstancedMesh,
    MeshBasicMaterial,
    OctahedronGeometry,
    PlaneGeometry,
    SRGBColorSpace,
    Vector3,
} from "three";
import { readEach, TransformTrait } from "@spawnite/engine";
import { enemyStats, u } from "../rules/data";
import { DropTrait, DropKind, GemTrait } from "../rules/traits";
import {
    blendPosition,
    finishInstances,
    lieFlat,
    placeInstance,
    readStepFraction,
    glowInstance,
} from "./instances";

//  What lies on the field to take: the experience orbs, a glowing diamond
//  in the colour of the kind they fell from, and the four drops, each drawn
//  as the source drew it, facing the camera and bobbing.

const gemCapacity = 600;
const dropCapacity = 48;

const gems = createQuery(GemTrait, TransformTrait);
const drops = createQuery(DropTrait, TransformTrait);

/** A drop's picture, 48 pixels square, as the source painted it. */
function paintDrop(kind: DropKind) {
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const context = canvas.getContext("2d")!;
    const circle = (x: number, y: number, radius: number, color: string) => {
        context.fillStyle = color;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    };
    const x = 24;
    const y = 24;
    switch (kind) {
        case DropKind.Health:
            circle(x, y, 11, "#5d2937");
            context.fillStyle = "#ff9cb8";
            context.fillRect(x - 3, y - 7, 6, 14);
            context.fillRect(x - 7, y - 3, 14, 6);
            break;
        case DropKind.Magnet:
            circle(x, y, 14, "#174759");
            context.strokeStyle = "#83e5ff";
            context.lineWidth = 5;
            context.beginPath();
            context.moveTo(x - 6, y - 7);
            context.lineTo(x - 6, y + 2);
            context.arc(x, y + 2, 6, Math.PI, 0, true);
            context.lineTo(x + 6, y - 7);
            context.stroke();
            context.fillStyle = "#f0fbff";
            context.fillRect(x - 8.5, y - 8, 5, 4);
            context.fillRect(x + 3.5, y - 8, 5, 4);
            break;
        case DropKind.DoubleXp:
            context.shadowColor = "#b6ff6a";
            context.shadowBlur = 12;
            circle(x, y, 12, "#214018");
            context.fillStyle = "#d8ff9a";
            context.font = "bold 11px Arial";
            context.textAlign = "center";
            context.fillText("×2", x, y + 4);
            break;
        case DropKind.Food:
            circle(x, y, 12, "#8a3d16");
            circle(x - 1, y + 1, 7, "#ffb15a");
            context.fillStyle = "#6fbf4a";
            context.beginPath();
            context.ellipse(x + 4, y - 7, 4, 2.5, -0.6, 0, Math.PI * 2);
            context.fill();
            break;
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

const dropKinds = [
    DropKind.Health,
    DropKind.Magnet,
    DropKind.DoubleXp,
    DropKind.Food,
];

function makeMesh(
    geometry: ConstructorParameters<typeof InstancedMesh>[0],
    material: ConstructorParameters<typeof InstancedMesh>[1],
    capacity: number,
) {
    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
}

//  Written in place each frame.
const at = new Vector3();
const spot = new Vector3();
const scale = new Vector3();

export function Pickups() {
    const world = useWorld();
    const meshes = useMemo(() => {
        const shadow = new MeshBasicMaterial({
            color: "#000000",
            transparent: true,
            opacity: 0.27,
            depthWrite: false,
        });
        return {
            gem: makeMesh(
                new OctahedronGeometry(1),
                new MeshBasicMaterial({ toneMapped: false }),
                gemCapacity,
            ),
            gemShadow: makeMesh(new CircleGeometry(1, 12), shadow, gemCapacity),
            dropShadow: makeMesh(
                new CircleGeometry(1, 16),
                shadow,
                dropCapacity,
            ),
            drops: Object.fromEntries(
                dropKinds.map((kind) => [
                    kind,
                    makeMesh(
                        new PlaneGeometry(u(48), u(48)),
                        new MeshBasicMaterial({
                            map: paintDrop(kind),
                            transparent: true,
                            toneMapped: false,
                        }),
                        dropCapacity,
                    ),
                ]),
            ) as Record<DropKind, InstancedMesh>,
        };
    }, []);

    useFrame(({ camera, clock }) => {
        const fraction = readStepFraction();
        const time = clock.elapsedTime;
        let gemCount = 0;
        readEach(world, gems, ([gem], entity) => {
            if (gemCount >= gemCapacity) return;
            blendPosition(entity, fraction, at);
            placeInstance(meshes.gemShadow, gemCount, {
                position: spot.set(at.x, 0.06, at.z),
                scale: scale.set(u(6), u(3), 1),
                rotation: lieFlat,
            });
            placeInstance(meshes.gem, gemCount, {
                position: spot.set(
                    at.x,
                    u(9 + Math.sin(time * 4 + at.x * 42) * 2),
                    at.z,
                ),
                scale: scale.set(u(4), u(6), u(4)),
            });
            glowInstance(meshes.gem, gemCount, enemyStats[gem.kind].orb);
            gemCount++;
        });
        finishInstances(meshes.gem, gemCount);
        finishInstances(meshes.gemShadow, gemCount);
        const counts: Record<DropKind, number> = {
            health: 0,
            magnet: 0,
            doubleXp: 0,
            food: 0,
        };
        let shadows = 0;
        readEach(world, drops, ([drop], entity) => {
            const index = counts[drop.kind];
            if (index >= dropCapacity) return;
            blendPosition(entity, fraction, at);
            placeInstance(meshes.dropShadow, shadows++, {
                position: spot.set(at.x, 0.06, at.z),
                scale: scale.set(u(10), u(4), 1),
                rotation: lieFlat,
            });
            placeInstance(meshes.drops[drop.kind], index, {
                position: spot.set(at.x, u(12 + Math.sin(time * 4) * 2), at.z),
                rotation: camera.quaternion,
            });
            counts[drop.kind]++;
        });
        finishInstances(meshes.dropShadow, shadows);
        for (const kind of dropKinds)
            finishInstances(meshes.drops[kind], counts[kind]);
    });

    return (
        <>
            <primitive object={meshes.gemShadow} />
            <primitive object={meshes.gem} />
            <primitive object={meshes.dropShadow} />
            {dropKinds.map((kind) => (
                <primitive key={kind} object={meshes.drops[kind]} />
            ))}
        </>
    );
}
