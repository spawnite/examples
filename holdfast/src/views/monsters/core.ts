import { Color, Object3D, Vector3 } from "three";
import { MonsterKind } from "../../siege/traits";
import { readWeakSpot } from "../../siege/weakSpots";
import { createMark, MarkKind, type Mark } from "./marks";

//  The colossus's core: a glow on its chest, where its weak spot is, that
//  rides the chest's bone as it walks and swings, and throbs so a player
//  sees where to aim. Two of the glow layer's glows, a wide soft one and a
//  hot small one over it.

/** The bone the core rides. */
const coreBone = "Torso";
/** Metres across each glow, the wide one first, at the kind's size. */
const glowMetres = [1.25, 0.5];
/** Metres the glow stands in front of the weak spot's middle, so the chest
 *  hides none of it. */
const standOutMetres = 0.18;

const white = new Color("#ffffff");
const at = new Vector3();
const boneScale = new Vector3();

export interface CoreGlow {
    marks: Mark[];
    /** Each mark's colour at the top of its throb. */
    colors: Color[];
}

interface CoreGlowOptions {
    object: Object3D;
    /** The model's scale in the world at its kind's size. */
    scale: number;
    color: string;
}

/** Adds the core's glows to a colossus's model, on its chest's bone, where
 *  its weak spot's middle stands. The model stands at its rest pose, in its
 *  own frame, when this runs. */
export function addCoreGlow({
    object,
    scale,
    color,
}: CoreGlowOptions): CoreGlow {
    const bone = object.getObjectByName(coreBone);
    if (!bone) return { marks: [], colors: [] };
    object.updateMatrixWorld(true);
    bone.getWorldScale(boneScale);
    //  The weak spot in the model's frame: the model faces +z, and is drawn
    //  at `scale`.
    const spot = readWeakSpot(MonsterKind.Colossus).at;
    at.set(-spot.x / scale, spot.y / scale, -(spot.z - standOutMetres) / scale);
    const local = bone.worldToLocal(at.clone());
    const base = new Color(color).lerp(white, 0.35);
    const marks = glowMetres.map((metres) => {
        const mark = createMark(MarkKind.Glow, new Object3D());
        mark.object.position.copy(local);
        mark.object.scale.setScalar(metres / scale / boneScale.x);
        bone.add(mark.object);
        return mark;
    });
    const colors = [
        base.clone().multiplyScalar(1.6),
        base.clone().lerp(white, 0.6).multiplyScalar(3),
    ];
    return { marks, colors };
}

/** Throbs the core's glows about once a second: `now` in seconds. */
export function throbCore({ marks, colors }: CoreGlow, now: number) {
    const throb = 0.75 + 0.25 * Math.sin(now * 5.5);
    marks.forEach((mark, index) =>
        mark.color.copy(colors[index]).multiplyScalar(throb),
    );
}
