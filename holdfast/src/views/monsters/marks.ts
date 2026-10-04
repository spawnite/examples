import {
    AdditiveBlending,
    Color,
    DynamicDrawUsage,
    IcosahedronGeometry,
    InstancedBufferAttribute,
    InstancedMesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    Object3D,
    PlaneGeometry,
    RingGeometry,
    Vector3,
    type BufferGeometry,
    type Material,
    type Texture,
    type WebGLProgramParametersWithUniforms,
} from "three";
import {
    FlameShape,
    readFlameTexture,
    readFrostTexture,
    readGlowTexture,
    readRingTexture,
    readShadowTexture,
} from "../glowTexture";

//  What every monster draws beside its body: its shadow on the ground, the
//  glow of its eyes, the ring a wind-up marks, its health bar, and what the
//  elements leave on it. Each kind of mark is one instanced draw for every
//  monster standing or falling. A view places a mark as an object with
//  nothing to draw, where it would place a mesh, and the layer draws a copy
//  at the object's world matrix once the frame's matrices are up to date.
//  As a mesh or a sprite each, 60 husks drew about 500 of them a frame,
//  sorted among the scene's other see-through draws, and they cost more of
//  the frame than the bodies.

/** The kinds of mark, each one draw. */
export enum MarkKind {
    /** The soft dark patch under a monster, laid flat. */
    Shadow = "shadow",
    /** A soft glow facing the camera as a sprite does: an eye on each side
     *  of a head whose eyes its texture paints, a burn's heart, a chill's
     *  haze. */
    Glow = "glow",
    /** A tongue of flame facing the camera: a burn's flames, one kind for
     *  each shape a tongue takes, so the tongues on a monster differ. */
    Flame = "flame",
    FlameLeft = "flameLeft",
    FlameRight = "flameRight",
    /** A soft ring on the ground at a marked monster's feet, laid flat. */
    Ring = "ring",
    /** Frost on the ground under a chilled monster, laid flat. */
    Frost = "frost",
    /** A shell of ice round a frozen monster. */
    Ice = "ice",
    /** The ring a monster marks the ground with as it winds up. */
    Warning = "warning",
    /** A hurt monster's bar: its dark back, and its red share over it. */
    BarBack = "barBack",
    BarFill = "barFill",
}

/** A mark: where it is drawn, and in what colour where its kind takes one.
 *  The colour is the mark's own, so a view may tint one monster's marks
 *  alone. */
export interface Mark {
    kind: MarkKind;
    object: Object3D;
    color: Color;
}

/** A mark of `kind` at `object`, white until its view colours it. */
export function createMark(kind: MarkKind, object = new Object3D()): Mark {
    return { kind, object, color: new Color(1, 1, 1) };
}

/** How a kind of mark is drawn. */
interface MarkLook {
    geometry: () => BufferGeometry;
    material: () => Material;
    /** Whether each mark's colour tints it. */
    colored: boolean;
    renderOrder: number;
}

//  The quad a sprite draws, ±0.5 across.
let quad: PlaneGeometry | undefined;
const readQuad = () => (quad ??= new PlaneGeometry(1, 1));
/** The ring a winding monster marks the ground with, as wide as its reach. */
let warningRing: RingGeometry | undefined;
const readWarningRing = () => (warningRing ??= new RingGeometry(0.82, 1, 40));
/** A rough shell of ice, faceted, a metre round its middle. */
/** How far each of a shell's corners stands out or in, by its index: a
 *  cut crystal rather than a round gem. Fixed, so every page's ice
 *  matches. */
const iceCorners = [
    1.08, 0.9, 1.12, 0.94, 1.02, 0.86, 1.1, 0.96, 1.05, 0.9, 1.14, 0.92,
];

/** A shell of ice: an icosahedron whose corners stand out and in, for
 *  large facets that each catch the light their own way. */
function createIceShell() {
    const shell = new IcosahedronGeometry(1, 1);
    const corners = shell.getAttribute("position");
    const corner = new Vector3();
    for (let index = 0; index < corners.count; index++) {
        corner.fromBufferAttribute(corners, index);
        //  Every copy of a corner moves alike, keyed by where it stands.
        const key =
            Math.abs(Math.round(corner.x * 7 + corner.y * 13 + corner.z * 29)) %
            iceCorners.length;
        corner.multiplyScalar(iceCorners[key]);
        corners.setXYZ(index, corner.x, corner.y, corner.z);
    }
    shell.computeVertexNormals();
    return shell;
}

let iceShell: IcosahedronGeometry | undefined;
const readIceShell = () => (iceShell ??= createIceShell());

//  A sprite's corners, on each copy: the copy's middle in view space, and
//  its corner out across the view by its world scale, as three's sprite
//  shader places a sprite with no rotation that shrinks with distance.
//  A flame's copy also stands forward, toward the camera, by its own width
//  times `forward`, so a tongue on a monster's chest burns in front of the
//  body rather than inside it.
function faceCamera(shader: WebGLProgramParametersWithUniforms, forward = 0) {
    shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        [
            "vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );",
            "vec2 spriteScale = vec2( length( instanceMatrix[ 0 ].xyz ), length( instanceMatrix[ 1 ].xyz ) );",
            "mvPosition.xy += transformed.xy * spriteScale;",
            `mvPosition.z += spriteScale.x * ${forward.toFixed(2)};`,
            "gl_Position = projectionMatrix * mvPosition;",
        ].join("\n"),
    );
}

/** Times its width a burn's tongue stands toward the camera. */
const flameForward = 0.45;

/** An additive glow of `map` that faces the camera, as a sprite of it
 *  does, standing `forward` times its width toward the camera. */
function createSpriteMaterial(map: Texture, forward = 0) {
    const material = new MeshBasicMaterial({
        map,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
    });
    material.onBeforeCompile = (shader) => faceCamera(shader, forward);
    material.customProgramCacheKey = () => `holdfast-glow-${forward}`;
    return material;
}

//  Ice's edges: a face seen edge-on glows blue and then white and turns
//  nearly solid, one seen square on stays clear, so the monster shows
//  through the middle of its shell and the shell's outline catches the
//  light. The copy's colour's red channel is how thick the ice is: a thin
//  coat of frost on a chilled monster, a full shell on a frozen one.
function lightIceEdges(shader: WebGLProgramParametersWithUniforms) {
    shader.fragmentShader = shader.fragmentShader
        .replace("#include <color_fragment>", "float thickness = vColor.r;")
        .replace(
            "#include <emissivemap_fragment>",
            [
                "#include <emissivemap_fragment>",
                "float edge = pow( 1.0 - abs( dot( normal, normalize( vViewPosition ) ) ), 1.6 );",
                "totalEmissiveRadiance += mix( vec3( 0.3, 0.68, 1.0 ), vec3( 0.96, 0.99, 1.0 ), pow( edge, 4.0 ) ) * edge * 2.2 * thickness;",
                "diffuseColor.a = mix( diffuseColor.a, 0.9, edge ) * thickness;",
                "totalEmissiveRadiance *= thickness;",
            ].join("\n"),
        );
}

/** A frozen monster's shell: pale ice blue, deeper blue in its facets'
 *  shade, clear in the middle and bright at its edges. */
function createIceMaterial() {
    const material = new MeshStandardMaterial({
        color: "#6cc4ff",
        emissive: new Color("#3a8fd0").multiplyScalar(0.5),
        roughness: 0.08,
        metalness: 0,
        transparent: true,
        opacity: 0.2,
        flatShading: true,
        depthWrite: false,
    });
    material.onBeforeCompile = lightIceEdges;
    material.customProgramCacheKey = () => "holdfast-ice";
    return material;
}

const markLooks: Record<MarkKind, MarkLook> = {
    [MarkKind.Shadow]: {
        geometry: readQuad,
        material: () =>
            new MeshBasicMaterial({
                map: readShadowTexture(),
                transparent: true,
                opacity: 0.75,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -2,
                polygonOffsetUnits: -2,
            }),
        colored: false,
        //  Under every other see-through draw, as the ground is.
        renderOrder: -1,
    },
    [MarkKind.Glow]: {
        geometry: readQuad,
        material: () => createSpriteMaterial(readGlowTexture()),
        colored: true,
        renderOrder: 0,
    },
    [MarkKind.Flame]: {
        geometry: readQuad,
        material: () =>
            createSpriteMaterial(
                readFlameTexture(FlameShape.Split),
                flameForward,
            ),
        colored: true,
        renderOrder: 0,
    },
    [MarkKind.FlameLeft]: {
        geometry: readQuad,
        material: () =>
            createSpriteMaterial(
                readFlameTexture(FlameShape.Left),
                flameForward,
            ),
        colored: true,
        renderOrder: 0,
    },
    [MarkKind.FlameRight]: {
        geometry: readQuad,
        material: () =>
            createSpriteMaterial(
                readFlameTexture(FlameShape.Right),
                flameForward,
            ),
        colored: true,
        renderOrder: 0,
    },
    [MarkKind.Ring]: {
        geometry: readQuad,
        material: () =>
            new MeshBasicMaterial({
                map: readRingTexture(),
                transparent: true,
                blending: AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
            }),
        colored: true,
        renderOrder: 0,
    },
    [MarkKind.Frost]: {
        geometry: readQuad,
        material: () =>
            new MeshBasicMaterial({
                map: readFrostTexture(),
                transparent: true,
                blending: AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
            }),
        colored: true,
        renderOrder: 0,
    },
    [MarkKind.Ice]: {
        geometry: readIceShell,
        material: createIceMaterial,
        colored: true,
        //  Before the glows, which light the shell rather than hide under it.
        renderOrder: -0.5,
    },
    [MarkKind.Warning]: {
        geometry: readWarningRing,
        material: () =>
            new MeshBasicMaterial({
                transparent: true,
                blending: AdditiveBlending,
                depthWrite: false,
                toneMapped: false,
            }),
        colored: true,
        renderOrder: 0,
    },
    [MarkKind.BarBack]: {
        geometry: readQuad,
        material: () =>
            new MeshBasicMaterial({
                color: "#1a0d10",
                transparent: true,
                opacity: 0.7,
                depthTest: false,
            }),
        colored: false,
        renderOrder: 10,
    },
    [MarkKind.BarFill]: {
        geometry: readQuad,
        material: () =>
            new MeshBasicMaterial({ color: "#ff4d5e", depthTest: false }),
        colored: false,
        renderOrder: 11,
    },
};

/** One kind's draw and the marks it draws. */
interface MarkLayer {
    kind: MarkKind;
    marks: Set<Mark>;
    mesh: InstancedMesh | null;
    material: Material | null;
}

const layers = new Map<MarkKind, MarkLayer>(
    Object.values(MarkKind).map((kind) => [
        kind,
        { kind, marks: new Set(), mesh: null, material: null },
    ]),
);

/** Copies a layer starts with room for, and grows by doubling. */
const startingCapacity = 64;

/** Whether a mark came or went, or moved, since the copies were last
 *  written. */
let changed = true;

/** Draws `marks` from the next draw on, until `hideMarks` takes them. */
export function showMarks(marks: readonly Mark[]) {
    for (const mark of marks) layers.get(mark.kind)?.marks.add(mark);
    changed = true;
}

export function hideMarks(marks: readonly Mark[]) {
    for (const mark of marks) layers.get(mark.kind)?.marks.delete(mark);
    changed = true;
}

/** Says the marks may have moved: the frame's views have run. */
export function touchMarks() {
    changed = true;
}

/** Whether `object` would draw: it and everything holding it visible, up
 *  to a scene. */
export function isShown(object: Object3D) {
    let at: Object3D | null = object;
    while (at) {
        if (!at.visible) return false;
        if (!at.parent) return (at as { isScene?: boolean }).isScene === true;
        at = at.parent;
    }
    return false;
}

function createLayerMesh(layer: MarkLayer, capacity: number) {
    const look = markLooks[layer.kind];
    layer.material ??= look.material();
    const mesh = new InstancedMesh(look.geometry(), layer.material, capacity);
    mesh.name = `monster ${layer.kind}s`;
    mesh.count = 0;
    //  The copies spread over the whole arena.
    mesh.frustumCulled = false;
    mesh.renderOrder = look.renderOrder;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    if (look.colored) {
        mesh.instanceColor = new InstancedBufferAttribute(
            new Float32Array(capacity * 3),
            3,
        );
        mesh.instanceColor.setUsage(DynamicDrawUsage);
    }
    return mesh;
}

/** Each layer's mesh, with room for every mark it holds: a new, larger
 *  mesh where it has outgrown its own. The holder adds and removes them. */
export function readMarkMeshes() {
    const meshes: InstancedMesh[] = [];
    for (const layer of layers.values()) {
        const capacity = layer.mesh?.instanceMatrix.count ?? 0;
        if (!layer.mesh || layer.marks.size > capacity) {
            let grown = Math.max(startingCapacity, capacity);
            while (grown < layer.marks.size) grown *= 2;
            layer.mesh?.dispose();
            layer.mesh = createLayerMesh(layer, grown);
        }
        meshes.push(layer.mesh);
    }
    return meshes;
}

/** Writes every shown mark into its layer's copies, at its object's world
 *  matrix as it stands, where anything changed since the last write: a
 *  frame that draws the scene more than once writes them once. */
export function writeMarks() {
    if (!changed) return;
    changed = false;
    for (const layer of layers.values()) {
        const { mesh } = layer;
        if (!mesh) continue;
        const room = mesh.instanceMatrix.count;
        let count = 0;
        for (const mark of layer.marks) {
            if (count === room) break;
            if (!isShown(mark.object)) continue;
            mesh.setMatrixAt(count, mark.object.matrixWorld);
            if (mesh.instanceColor) mesh.setColorAt(count, mark.color);
            count++;
        }
        //  A layer that drew none and draws none uploads nothing.
        if (count === 0 && mesh.count === 0) continue;
        mesh.count = count;
        for (const copies of [mesh.instanceMatrix, mesh.instanceColor]) {
            if (!copies) continue;
            copies.clearUpdateRanges();
            copies.addUpdateRange(0, count * copies.itemSize);
            copies.needsUpdate = true;
        }
    }
}
