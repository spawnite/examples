import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Matrix4, type Group } from "three";
import { disposeMonsterRig, type MonsterRig } from "./rig";
import { MonsterClip } from "./models";
import { flashSeconds, measureProgress } from "./motion";
import { paintSkin, type SkinLight } from "./skin";

//  What a monster leaves when the room takes it away: its body blending
//  from the pose it died in into its fall where it stood, then sinking into
//  the ground with its shadow. The room forgets a monster the step it dies,
//  so the page keeps the body for the show.

/** Seconds a body lies before it sinks, and takes to sink. */
const lieSeconds = 1.1;
const sinkSeconds = 0.8;
/** Metres a body sinks: through the ground, whatever its size. */
const sinkMetres = 2.5;
/** Seconds the fall takes to take over from the pose it died in. */
const blendSeconds = 0.2;

interface Corpse {
    rig: MonsterRig;
    seconds: number;
    /** Where it sank from. */
    y: number;
}

const corpses = new Set<Corpse>();
//  Written in place each frame.
const light: SkinLight = { flash: 0, threat: 0 };
let holder: Group | null = null;

/** Hands a monster's body, placed as `placement` puts it in the world, to
 *  the ground to fall and sink. */
export function dropCorpse(rig: MonsterRig, placement: Matrix4) {
    const fall = rig.actions[MonsterClip.Fall];
    if (!holder || !fall) {
        disposeMonsterRig(rig);
        return;
    }
    for (const action of Object.values(rig.actions))
        if (action !== fall && action.isRunning()) action.fadeOut(blendSeconds);
    fall.reset().fadeIn(blendSeconds).play();
    light.flash = rig.skin.flash;
    light.threat = 0;
    paintSkin(rig.skin, light);
    placement.decompose(
        rig.object.position,
        rig.object.quaternion,
        rig.object.scale,
    );
    holder.add(rig.object);
    //  Its shadow stays where it stood, on the ground.
    rig.shadow.getWorldPosition(rig.shadow.position);
    holder.add(rig.shadow);
    corpses.add({ rig, seconds: 0, y: rig.object.position.y });
}

export function Corpses() {
    const groupRef = useRef<Group>(null);
    useFrame((_state, delta) => {
        holder = groupRef.current;
        for (const corpse of corpses) {
            corpse.seconds += delta;
            corpse.rig.mixer.update(delta);
            const { rig } = corpse;
            //  The hit that killed it still fades.
            if (rig.skin.flash > 0) {
                light.flash = Math.max(
                    0,
                    rig.skin.flash - delta / flashSeconds,
                );
                light.threat = 0;
                paintSkin(rig.skin, light);
            }
            const sinking = Math.max(0, corpse.seconds - lieSeconds);
            rig.object.position.y =
                corpse.y - (sinking / sinkSeconds) * sinkMetres;
            rig.shadow.scale.setScalar(
                rig.shadowMetres *
                    Math.max(0.001, 1 - measureProgress(sinking, sinkSeconds)),
            );
            if (sinking < sinkSeconds) continue;
            holder?.remove(corpse.rig.object);
            disposeMonsterRig(corpse.rig);
            corpses.delete(corpse);
        }
    });
    return <group ref={groupRef} />;
}
