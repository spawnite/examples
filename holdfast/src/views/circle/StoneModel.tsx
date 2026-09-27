import { hashKeys } from "@spawnite/engine";
import { Vector3 } from "three";
import { standingStoneModels, useModelShape } from "./models";
import { createStoneMaterial } from "./stoneMaterial";

//  What a page draws of one standing stone: one of the three shapes, turned,
//  leant and sized by its place in the ring, so no two neighbours match.

const runeStone = createStoneMaterial({ height: 0.78, runes: true });

/** Metres of each stone sunk into the ground. */
const sunkMetres = 0.15;
/** The drawn footprint, inside the 1.1 m capsule the stone stands in. */
const depthMetres = 0.6;
const widthMetres = { least: 0.95, most: 1.05 };
/** Metres a stone stands above the ground. */
const heightMetres = { least: 3.2, most: 3.9 };

const fileSize = new Vector3();

interface StoneModelProps {
    /** The stone's place in the ring. */
    index: number;
}

export function StoneModel({ index }: StoneModelProps) {
    const shape = useModelShape(
        standingStoneModels[index % standingStoneModels.length],
    );
    //  Each file is scaled by its own size, so every shape fills the same
    //  footprint whatever its proportions.
    if (!shape.boundingBox) shape.computeBoundingBox();
    shape.boundingBox?.getSize(fileSize);
    const width =
        widthMetres.least +
        hashKeys(index, 2) * (widthMetres.most - widthMetres.least);
    const height =
        heightMetres.least +
        hashKeys(index, 1) * (heightMetres.most - heightMetres.least);
    return (
        <mesh
            geometry={shape}
            material={runeStone}
            scale={[
                width / fileSize.x,
                (height + sunkMetres) / fileSize.y,
                depthMetres / fileSize.z,
            ]}
            position-y={-sunkMetres}
            rotation={[
                (hashKeys(index, 3) - 0.5) * 0.08,
                (hashKeys(index, 4) - 0.5) * 0.35,
                (hashKeys(index, 5) - 0.5) * 0.1,
            ]}
            castShadow
            receiveShadow
        />
    );
}
