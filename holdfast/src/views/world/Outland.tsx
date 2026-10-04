import { useLayoutEffect, useMemo, type RefObject } from "react";
import {
    BufferAttribute,
    BufferGeometry,
    type Material,
    type Mesh,
} from "three";
import {
    type GroundHeight,
    landMetres,
    mapEdgeMetres,
    readLandHeight,
} from "./land";

//  The land past the map's square: one mesh from the ground's edge
//  out toward the skyline, meeting the edge's heights and climbing into
//  the wood's hills, so the ground never ends in a lip and no view finds
//  the dark below the skyline. It takes the ground's own paint, forest
//  floor with each road's track running on across it. One draw.

/** Metres between the mesh's vertices: the map's own cell, so along the
 *  map's edge the land shares the ground's vertices and no crack opens
 *  between them. */
const landCellMetres = 1;

/** The land's mesh over a square grid, leaving out the cells the map's
 *  ground covers and those past the land's reach. */
export function buildLand(ground: GroundHeight) {
    const side = Math.ceil((landMetres * 2) / landCellMetres);
    const origin = -(side * landCellMetres) / 2;
    const vertices = side + 1;
    const positions = new Float32Array(vertices * vertices * 3);
    const weights = new Float32Array(vertices * vertices);
    for (let row = 0; row < vertices; row++) {
        for (let column = 0; column < vertices; column++) {
            const point = {
                x: origin + column * landCellMetres,
                z: origin + row * landCellMetres,
            };
            const index = (row * vertices + column) * 3;
            positions[index] = point.x;
            positions[index + 1] = readLandHeight(ground, point);
            positions[index + 2] = point.z;
        }
    }
    const indices: number[] = [];
    const inner = mapEdgeMetres;
    for (let row = 0; row < side; row++) {
        for (let column = 0; column < side; column++) {
            const left = origin + column * landCellMetres;
            const near = origin + row * landCellMetres;
            const right = left + landCellMetres;
            const far = near + landCellMetres;
            const covered =
                left >= -inner &&
                right <= inner &&
                near >= -inner &&
                far <= inner;
            const middleX = left + landCellMetres / 2;
            const middleZ = near + landCellMetres / 2;
            if (covered || Math.hypot(middleX, middleZ) > landMetres) continue;
            const a = row * vertices + column;
            const b = a + 1;
            const c = a + vertices;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    //  The paint reads a road's share from the map's paths, which end at
    //  the rim; the tracks past it are the paint's own.
    geometry.setAttribute("roadWeight", new BufferAttribute(weights, 1));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

/** A place on the map's edge, as a key both meshes' vertices share. */
function keyEdge(x: number, z: number) {
    return `${Math.round(x)},${Math.round(z)}`;
}

/** Writes the ground mesh's own normals onto the land's vertices along the
 *  map's edge, so the light does not step across the seam: each mesh
 *  otherwise works its edge normals out from its own side alone. The
 *  ground lies in its plane's x-y, stood up by a quarter turn about x. */
export function matchEdgeNormals(land: BufferGeometry, ground: BufferGeometry) {
    const groundPositions = ground.getAttribute("position");
    const groundNormals = ground.getAttribute("normal");
    const edge = new Map<string, number>();
    for (let index = 0; index < groundPositions.count; index++) {
        const x = groundPositions.getX(index);
        const z = -groundPositions.getY(index);
        if (Math.max(Math.abs(x), Math.abs(z)) >= mapEdgeMetres - 1e-3)
            edge.set(keyEdge(x, z), index);
    }
    const positions = land.getAttribute("position");
    const normals = land.getAttribute("normal");
    for (let index = 0; index < positions.count; index++) {
        const match = edge.get(
            keyEdge(positions.getX(index), positions.getZ(index)),
        );
        if (match === undefined) continue;
        normals.setXYZ(
            index,
            groundNormals.getX(match),
            groundNormals.getZ(match),
            -groundNormals.getY(match),
        );
    }
    normals.needsUpdate = true;
}

interface OutlandProps {
    surface: GroundHeight;
    /** The ground's painted mesh, whose edge normals the land takes. */
    groundRef: RefObject<Mesh | null>;
    /** The ground's painted material. */
    material: Material;
}

/** The land past the map, drawn with the ground's paint. */
export function Outland({ surface, groundRef, material }: OutlandProps) {
    const geometry = useMemo(() => buildLand(surface), [surface]);
    useLayoutEffect(() => () => geometry.dispose(), [geometry]);
    //  After the ground's geometry lays its heights and normals, which its
    //  own layout effect does first: it mounts before this.
    useLayoutEffect(() => {
        const ground = groundRef.current?.geometry;
        if (ground) matchEdgeNormals(geometry, ground);
    }, [geometry, groundRef]);
    return (
        <mesh
            name="outland"
            geometry={geometry}
            material={material}
            //  After the wood and the ground, so the depth test drops what
            //  they hide before its paint is worked out.
            renderOrder={1}
            receiveShadow
            raycast={() => undefined}
        />
    );
}
