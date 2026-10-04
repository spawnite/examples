import {
    AdditiveBlending,
    CanvasTexture,
    MathUtils,
    MeshBasicMaterial,
} from "three";
import {
    CircleEmitter,
    ColorOverLife,
    ConstantValue,
    Gradient,
    ParticleSystem,
    RenderMode,
    Vector3,
} from "three.quarks";
import { u } from "../rules/data";

//  The sparks: each burst throws its count of dots outward at 65 units a
//  second, 10 units up, fading over 0.45 seconds.

const lifeSeconds = 0.45;
const speed = u(65);
const size = u(6);
/** Metres above the ground the sparks fly at. */
export const sparkHeight = u(10);

/** A soft round dot, for each spark. */
function paintDot() {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(8, 8, 7, 0, Math.PI * 2);
    context.fill();
    return new CanvasTexture(canvas);
}

function buildSparkEffect() {
    const { emitter } = new ParticleSystem({
        duration: lifeSeconds,
        looping: false,
        //  A ring of no width: every dot leaves the centre, straight out.
        shape: new CircleEmitter({ radius: 0, thickness: 0 }),
        startLife: new ConstantValue(lifeSeconds),
        startSpeed: new ConstantValue(speed),
        startSize: new ConstantValue(size),
        emissionOverTime: new ConstantValue(0),
        emissionBursts: [
            {
                time: 0,
                count: new ConstantValue(14),
                cycle: 1,
                interval: 1,
                probability: 1,
            },
        ],
        //  Additive, so a dot fades as its colour falls to black.
        behaviors: [
            new ColorOverLife(
                new Gradient(
                    [
                        [new Vector3(1, 1, 1), 0],
                        [new Vector3(0, 0, 0), 1],
                    ],
                    [
                        [1, 0],
                        [1, 1],
                    ],
                ),
            ),
        ],
        material: new MeshBasicMaterial({
            map: paintDot(),
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            toneMapped: false,
        }),
        renderMode: RenderMode.BillBoard,
        worldSpace: true,
    });
    //  The ring lies in the emitter's own XY plane; the field's ground is
    //  XZ.
    emitter.rotation.x = -MathUtils.degToRad(90);
    return emitter;
}

let sparkEffect: ReturnType<typeof buildSparkEffect> | undefined;

/** The spark effect the field's `Particles` plays, its colour and count
 *  named by each burst. Built at the first read, which a page makes and a
 *  room's server never does: the dot is drawn on a canvas. */
export function readSparkEffect() {
    sparkEffect ??= buildSparkEffect();
    return sparkEffect;
}
