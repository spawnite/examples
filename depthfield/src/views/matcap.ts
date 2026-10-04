import {
    CanvasTexture,
    MeshMatcapMaterial,
    SRGBColorSpace,
    type Texture,
} from "three";

//  The models' shading, the same for the soldier, the guns and the swarm.
//  The field has no lights and no tone mapping, so a model is lit by a
//  matcap: a painted sphere whose colour at each normal is the model's
//  shade there, lit from the camera's upper left like the source's
//  figures, darker on their right side. The rim version adds a bright
//  ring at the silhouette, so a model stands off the dark floor. Neither
//  passes white, so only a colour lifted past it glows.

/** A matcap `size` pixels across, with a rim or without. */
function paintMatcap(rim: boolean, size = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d")!;
    const half = size / 2;
    //  The body: bright where it faces the light, falling to a shade.
    const body = context.createRadialGradient(
        half * 0.7,
        half * 0.6,
        size * 0.05,
        half,
        half,
        half,
    );
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.45, "#d9d9d9");
    body.addColorStop(0.85, "#8a8a8a");
    body.addColorStop(1, "#6a6a6a");
    context.fillStyle = body;
    context.fillRect(0, 0, size, size);
    if (rim) {
        const ring = context.createRadialGradient(
            half,
            half,
            half * 0.78,
            half,
            half,
            half,
        );
        ring.addColorStop(0, "rgba(255,255,255,0)");
        ring.addColorStop(0.75, "rgba(255,255,255,0.55)");
        ring.addColorStop(1, "rgba(255,255,255,0.95)");
        context.fillStyle = ring;
        context.fillRect(0, 0, size, size);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

const matcaps = new Map<boolean, Texture>();

/** The shared matcap, with a rim or without. */
export function readMatcap(rim: boolean) {
    let matcap = matcaps.get(rim);
    if (!matcap) {
        matcap = paintMatcap(rim);
        matcaps.set(rim, matcap);
    }
    return matcap;
}

/** A model's material: flat colour or the model's own texture, lit by
 *  the matcap. An instanced copy's colour multiplies it. */
export function createModelMaterial(rim: boolean, map: Texture | null = null) {
    return new MeshMatcapMaterial({
        matcap: readMatcap(rim),
        map,
        toneMapped: false,
    });
}

/** A turn round the colour wheel, in radians, as a shader uniform. */
export interface HueTurn {
    value: number;
}

/** Turns `material`'s colour round the colour wheel by `hue`'s value,
 *  after its texture, and returns `hue`: a look recolours the soldier's
 *  painted armour as the sprite's looks recoloured its pixels. Materials
 *  handed one `hue` turn together. */
export function addHueTurn(
    material: MeshMatcapMaterial,
    hue: HueTurn = { value: 0 },
) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.hueTurn = hue;
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "void main() {",
                `uniform float hueTurn;
vec3 turnHue(vec3 color, float angle) {
    const vec3 axis = vec3(0.57735);
    float cosine = cos(angle);
    return color * cosine + cross(axis, color) * sin(angle)
        + axis * dot(axis, color) * (1.0 - cosine);
}
void main() {`,
            )
            .replace(
                "#include <map_fragment>",
                "#include <map_fragment>\n\tdiffuseColor.rgb = turnHue(diffuseColor.rgb, hueTurn);",
            );
    };
    return hue;
}

let glowTexture: Texture | null = null;

/** A soft white dot, bright at its centre, for a muzzle's flash. */
export function readGlowTexture() {
    if (glowTexture) return glowTexture;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.7)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    glowTexture = new CanvasTexture(canvas);
    return glowTexture;
}
