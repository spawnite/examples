import oakFat from "@spawnite/assets/models/holdfast/oak-fat.glb?url";
import oakRound from "@spawnite/assets/models/holdfast/oak-round.glb?url";
import pineRound from "@spawnite/assets/models/holdfast/pine-round.glb?url";
import pineSpire from "@spawnite/assets/models/holdfast/pine-spire.glb?url";
import pineTall from "@spawnite/assets/models/holdfast/pine-tall.glb?url";
import { useGLTF } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import {
    type BufferGeometry,
    type InstancedMesh,
    Mesh,
    MeshStandardMaterial,
    type Object3D,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Ground, useWorldEntity } from "@spawnite/engine";
import { placeTrees, TreeKind, type TreePlace } from "./forest/forestPlaces";

//  The wood round the map's edge: pines of three shapes and two broadleaf
//  trees in clumps and clearings, standing between the playable ground and
//  the skyline beyond. It is scenery only, with no body, so the Hollow
//  still walk in through it. Each kind's leaves and bark are one instanced
//  mesh each, ten draw calls for the wood, and no tree casts a shadow.

const kindUrls: Record<TreeKind, string> = {
    [TreeKind.PineTall]: pineTall,
    [TreeKind.PineRound]: pineRound,
    [TreeKind.PineSpire]: pineSpire,
    [TreeKind.OakRound]: oakRound,
    [TreeKind.OakFat]: oakFat,
};
const kinds = Object.values(TreeKind);

/** Which part of a tree a mesh is, and so which of its tints it takes. */
enum TreePart {
    Leaves = "leaves",
    Bark = "bark",
}

/** One instanced mesh of the wood: a part of one kind, and the trees of
 *  that kind. */
interface TreeBatch {
    part: TreePart;
    geometry: BufferGeometry;
    places: TreePlace[];
}

/** White, so each tree's own tint is its colour. */
const treeMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    roughness: 1,
    flatShading: true,
});

/** A model's meshes merged into one geometry per part, in the model's own
 *  space. The kit names its leaf materials `leafs…` and its bark `wood…`. */
function mergeTreeParts(scene: Object3D) {
    const parts: Record<TreePart, BufferGeometry[]> = {
        [TreePart.Leaves]: [],
        [TreePart.Bark]: [],
    };
    scene.updateMatrixWorld(true);
    scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const mesh = node;
        const material = Array.isArray(mesh.material)
            ? mesh.material[0]
            : mesh.material;
        const part = /leaf/i.test(material.name)
            ? TreePart.Leaves
            : TreePart.Bark;
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        for (const name of Object.keys(geometry.attributes)) {
            if (name !== "position" && name !== "normal") {
                geometry.deleteAttribute(name);
            }
        }
        parts[part].push(geometry);
    });
    return Object.values(TreePart).flatMap((part) => {
        const pieces = parts[part];
        if (pieces.length === 0) return [];
        const geometry =
            pieces.length === 1 ? pieces[0] : mergeGeometries(pieces);
        if (pieces.length > 1) for (const piece of pieces) piece.dispose();
        return geometry ? [{ part, geometry }] : [];
    });
}

interface TreeBatchMeshProps {
    batch: TreeBatch;
}

function TreeBatchMesh({ batch }: TreeBatchMeshProps) {
    const meshRef = useRef<InstancedMesh>(null);
    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        batch.places.forEach((place, index) => {
            mesh.setMatrixAt(index, place.matrix);
            mesh.setColorAt(
                index,
                batch.part === TreePart.Leaves ? place.leaves : place.bark,
            );
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
    }, [batch]);
    return (
        <instancedMesh
            ref={meshRef}
            args={[batch.geometry, treeMaterial, batch.places.length]}
            name="treeline"
        />
    );
}

function Wood() {
    const surface = useWorldEntity().get(Ground)?.surface;
    const models = useGLTF(kinds.map((kind) => kindUrls[kind]));
    const batches = useMemo(() => {
        const places = placeTrees(surface);
        return kinds.flatMap((kind, index) => {
            const kindPlaces = places.filter((place) => place.kind === kind);
            if (kindPlaces.length === 0) return [];
            return mergeTreeParts(models[index].scene).map(
                ({ part, geometry }) => ({
                    part,
                    geometry,
                    places: kindPlaces,
                }),
            );
        });
    }, [models, surface]);
    useLayoutEffect(
        () => () => {
            for (const { geometry } of batches) geometry.dispose();
        },
        [batches],
    );

    return (
        <>
            {batches.map((batch) => (
                <TreeBatchMesh key={batch.geometry.uuid} batch={batch} />
            ))}
        </>
    );
}

export function Treeline() {
    return (
        <Suspense fallback={null}>
            <Wood />
        </Suspense>
    );
}
