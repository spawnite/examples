import {
    AnimationClip,
    Matrix4,
    type Object3D,
    Quaternion,
    QuaternionKeyframeTrack,
    type SkinnedMesh,
    Vector3,
    VectorKeyframeTrack,
} from "three";

//  Her moves beyond the run: a sword slash, a parry, a fighting walk and her
//  idles, from the creator's rigged berserker and arcane robes. Their rigs
//  are hers, bone for bone, but each body's joints sit a little differently,
//  so a move is kept as how far each bone turns from its bind pose, in the
//  model's frame (Y-up, facing +z), and fitted to her bind pose when she
//  loads. Her hips' travel is kept as a share of the hips' height.

/** A move as its source's turns: per bone, one quaternion per frame (x, y,
 *  z, w), and the hips' travel from their bind place per frame (x, y, z),
 *  as a share of their height. */
export type Move = {
    fps: number;
    frames: number;
    turns: Record<string, number[]>;
    hips: number[];
};

export type MoveName =
    "slash" | "parry" | "fightWalk" | "walk" | "idle" | "fidget";

export type Moves = Record<MoveName, Move>;

const hipsName = "mixamorigHips";

/** Where each bone sits and faces in `skinned`'s bind pose, in the frame of
 *  the model as loaded: the inverse of its bind inverse. */
export function bindPoses(skinned: SkinnedMesh) {
    const poses = new Map<string, { at: Vector3; turn: Quaternion }>();
    const scale = new Vector3();
    skinned.skeleton.bones.forEach((bone, index) => {
        const at = new Vector3();
        const turn = new Quaternion();
        new Matrix4()
            .copy(skinned.skeleton.boneInverses[index])
            .invert()
            .decompose(at, turn, scale);
        poses.set(bone.name, { at, turn });
    });
    return poses;
}

/** Fits a move to `skinned`'s skeleton, as a clip of its bones' own turns:
 *  each bone turns in the model's frame as the source's did from its bind
 *  pose, and her hips travel as far for their height. `top` is the model as
 *  loaded, whose frame the bind poses are in. */
export function fitMove(
    name: string,
    move: Move,
    skinned: SkinnedMesh,
    top: Object3D,
) {
    const poses = bindPoses(skinned);
    const bones = skinned.skeleton.bones;
    const byName = new Map(bones.map((bone) => [bone.name, bone]));
    //  Her hips' parent is still: its turn and place in the model's frame.
    top.updateMatrixWorld(true);
    const hipsBone = byName.get(hipsName);
    const hipsParent = new Matrix4();
    if (hipsBone?.parent)
        hipsParent
            .copy(top.matrixWorld)
            .invert()
            .multiply(hipsBone.parent.matrixWorld);
    const hipsParentInverse = hipsParent.clone().invert();
    const hipsParentTurn = new Quaternion().setFromRotationMatrix(
        new Matrix4().extractRotation(hipsParent),
    );
    const hipsPose = poses.get(hipsName);
    const reach = hipsPose ? hipsPose.at.y : 0;

    const times = Array.from(
        { length: move.frames },
        (_, frame) => frame / move.fps,
    );
    const tracks = [];
    const world = new Map<string, Quaternion[]>();
    const turnAt = (bone: string, frame: number) => {
        const pose = poses.get(bone);
        if (!pose) return null;
        let turns = world.get(bone);
        if (!turns) {
            turns = [];
            const source = move.turns[bone];
            for (let each = 0; each < move.frames; each++) {
                const delta = source
                    ? new Quaternion().fromArray(source, each * 4)
                    : new Quaternion();
                turns.push(delta.multiply(pose.turn));
            }
            world.set(bone, turns);
        }
        return turns[frame];
    };
    const local = new Quaternion();
    for (const bone of bones) {
        if (!move.turns[bone.name]) continue;
        const values: number[] = [];
        const parent =
            bone.parent && byName.has(bone.parent.name)
                ? bone.parent.name
                : null;
        for (let frame = 0; frame < move.frames; frame++) {
            const own = turnAt(bone.name, frame)!;
            const above = parent ? turnAt(parent, frame)! : hipsParentTurn;
            local.copy(above).invert().multiply(own);
            values.push(local.x, local.y, local.z, local.w);
        }
        tracks.push(
            new QuaternionKeyframeTrack(
                `${bone.name}.quaternion`,
                times,
                values,
            ),
        );
    }
    if (hipsBone && hipsPose) {
        const values: number[] = [];
        const at = new Vector3();
        for (let frame = 0; frame < move.frames; frame++) {
            at.fromArray(move.hips, frame * 3)
                .multiplyScalar(reach)
                .add(hipsPose.at)
                .applyMatrix4(hipsParentInverse);
            values.push(at.x, at.y, at.z);
        }
        tracks.push(
            new VectorKeyframeTrack(`${hipsName}.position`, times, values),
        );
    }
    return new AnimationClip(name, (move.frames - 1) / move.fps, tracks);
}
