import {
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    Color,
    DynamicDrawUsage,
    Object3D,
    Points,
    PointsMaterial,
    SRGBColorSpace,
    Vector3,
} from "three";
import { flamePath } from "../../hud/ElementArt";
import { Mark, markElements } from "../../siege/elements";
import { elementColors } from "../palette";
import { isShown } from "./marks";

//  A marked monster's sign over its head: the mark's element, a flame or a
//  snowflake, in a dark disc ringed in its color, the same size on screen
//  however far the monster stands, and drawn over everything in front of
//  it. The ring and glow at its feet say "this one" up close; the sign says
//  it from across the circle and through a crowd, as Diablo and Hades hang
//  a status over an enemy's head. Every sign of one mark is one draw.

/** A mark a monster may wear. */
export type SignedMark = Mark.Blazing | Mark.Frozen;

const signedMarks: SignedMark[] = [Mark.Blazing, Mark.Frozen];

/** Pixels across a sign on the screen, at a pixel ratio of 1. */
export const sigilPixels = 42;

/** Pixels across each sign's texture. */
const texturePixels = 128;

/** Signs a layer starts with room for, and grows by doubling. */
const startingCapacity = 16;

/** Paints a mark's sign: a dark disc so it reads on the sky and the grass
 *  alike, a ring and the element's picture in its color, a little lighter,
 *  and a soft glow round the ring. */
function paintSigil(context: CanvasRenderingContext2D, mark: SignedMark) {
    const middle = texturePixels / 2;
    const color = new Color(elementColors[markElements[mark]]);
    const light = color.clone().lerp(new Color("#ffffff"), 0.35);
    const css = `#${light.getHexString()}`;
    const glow = context.createRadialGradient(
        middle,
        middle,
        middle * 0.6,
        middle,
        middle,
        middle,
    );
    glow.addColorStop(0, `#${color.getHexString()}aa`);
    glow.addColorStop(1, `#${color.getHexString()}00`);
    context.fillStyle = glow;
    context.fillRect(0, 0, texturePixels, texturePixels);
    context.beginPath();
    context.arc(middle, middle, middle * 0.7, 0, Math.PI * 2);
    context.fillStyle = "rgba(12, 10, 18, 0.82)";
    context.fill();
    context.lineWidth = texturePixels * 0.06;
    context.strokeStyle = css;
    context.stroke();
    //  The picture, 24 units square, drawn in the disc's middle.
    const scale = (texturePixels * 0.44) / 24;
    context.save();
    context.translate(middle - 12 * scale, middle - 12 * scale);
    context.scale(scale, scale);
    context.fillStyle = css;
    context.strokeStyle = css;
    if (mark === Mark.Blazing) context.fill(new Path2D(flamePath));
    else {
        context.lineWidth = 2.2;
        context.lineCap = "round";
        for (const turn of [0, 60, 120]) {
            context.save();
            context.translate(12, 12);
            context.rotate((turn * Math.PI) / 180);
            context.translate(-12, -12);
            context.stroke(new Path2D("M12 2.5v19"));
            context.stroke(new Path2D("M9 4.5l3 2.5 3-2.5M9 19.5l3-2.5 3 2.5"));
            context.restore();
        }
    }
    context.restore();
}

function createSigilTexture(mark: SignedMark) {
    const canvas = document.createElement("canvas");
    canvas.width = texturePixels;
    canvas.height = texturePixels;
    const context = canvas.getContext("2d");
    if (context) paintSigil(context, mark);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

/** One mark's signs: the anchors that wear it, and its one draw. */
interface SigilLayer {
    anchors: Set<Object3D>;
    points: Points<BufferGeometry, PointsMaterial>;
}

function createPoints(mark: SignedMark, capacity: number) {
    const geometry = new BufferGeometry();
    const place = new BufferAttribute(new Float32Array(capacity * 3), 3);
    place.setUsage(DynamicDrawUsage);
    geometry.setAttribute("position", place);
    geometry.setDrawRange(0, 0);
    const points = new Points(
        geometry,
        new PointsMaterial({
            map: createSigilTexture(mark),
            size: sigilPixels,
            sizeAttenuation: false,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
        }),
    );
    points.name = `monster ${mark} signs`;
    //  The signs spread over the whole arena.
    points.frustumCulled = false;
    //  Over the health bars.
    points.renderOrder = 12;
    return points;
}

let layers: Record<SignedMark, SigilLayer> | undefined;

/** Each mark's layer, made on first use. */
function readLayers() {
    layers ??= {
        [Mark.Blazing]: {
            anchors: new Set(),
            points: createPoints(Mark.Blazing, startingCapacity),
        },
        [Mark.Frozen]: {
            anchors: new Set(),
            points: createPoints(Mark.Frozen, startingCapacity),
        },
    };
    return layers;
}

/** Each mark's one draw, for the scene to hold. */
export function readSigilLayers() {
    const all = readLayers();
    return {
        [Mark.Blazing]: all[Mark.Blazing].points,
        [Mark.Frozen]: all[Mark.Frozen].points,
    };
}

/** Wears `mark`'s sign at `anchor` from the next draw on, in place of any
 *  sign it wore. */
export function showSigil(anchor: Object3D, mark: SignedMark) {
    const all = readLayers();
    for (const each of signedMarks)
        if (each !== mark) all[each].anchors.delete(anchor);
    all[mark].anchors.add(anchor);
}

export function hideSigil(anchor: Object3D) {
    for (const layer of Object.values(readLayers()))
        layer.anchors.delete(anchor);
}

//  Written in place for each sign.
const place = new Vector3();

/** Writes each shown sign at its anchor's place in the world as it stands,
 *  growing a layer that has outgrown its room. */
export function writeSigils() {
    for (const layer of Object.values(readLayers())) {
        const geometry = layer.points.geometry;
        let attribute = geometry.getAttribute("position") as BufferAttribute;
        if (layer.anchors.size > attribute.count) {
            let grown = attribute.count;
            while (grown < layer.anchors.size) grown *= 2;
            attribute = new BufferAttribute(new Float32Array(grown * 3), 3);
            attribute.setUsage(DynamicDrawUsage);
            geometry.setAttribute("position", attribute);
        }
        let count = 0;
        for (const anchor of layer.anchors) {
            if (!isShown(anchor)) continue;
            anchor.getWorldPosition(place);
            attribute.setXYZ(count, place.x, place.y, place.z);
            count++;
        }
        if (count === 0 && geometry.drawRange.count === 0) continue;
        geometry.setDrawRange(0, count);
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, count * 3);
        attribute.needsUpdate = true;
    }
}
