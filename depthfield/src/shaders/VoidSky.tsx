import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { Color, LinearSRGBColorSpace } from "three";
import { Shader } from "@spawnite/engine";
import type { StagePalette } from "../rules/stages";

//  The source's sky behind its arena, in the stage's colours: the top's at
//  the top of the screen, the middle's by the middle and the bottom's from
//  seven tenths down. It is painted by where each pixel falls on the screen
//  rather than on the mesh, as the source painted its backdrop, and its
//  colours are written as they are, in sRGB, past tone mapping.
const fragment = `void main() {
    float down = 1.0 - gl_FragCoord.y / uScreenHeight;
    float along = clamp(down / 0.7, 0.0, 1.0);
    vec3 color = along < 0.55
        ? mix(uTop, uMiddle, along / 0.55)
        : mix(uMiddle, uBottom, (along - 0.55) / 0.45);
    gl_FragColor = vec4(color, 1.0);
}`;

/** `hex`'s sRGB channels as they are: read as linear, three converts
 *  nothing, and the shader writes them past tone mapping. */
function readRawColor(hex: string) {
    return new Color().setStyle(hex, LinearSRGBColorSpace);
}

interface VoidSkyMaterialProps {
    palette: Pick<StagePalette, "skyTop" | "skyMiddle" | "skyBottom">;
}

/** The material of the mesh it sits in: the stage's sky, by screen
 *  height. */
export function VoidSkyMaterial({
    palette: { skyTop, skyMiddle, skyBottom },
}: VoidSkyMaterialProps) {
    //  gl_FragCoord counts the drawing buffer's pixels.
    const screenHeight = useThree(
        (state) => state.size.height * state.viewport.dpr,
    );
    const uniforms = useMemo(
        () => ({
            uTop: readRawColor(skyTop),
            uMiddle: readRawColor(skyMiddle),
            uBottom: readRawColor(skyBottom),
        }),
        [skyTop, skyMiddle, skyBottom],
    );
    return (
        <Shader
            fragment={fragment}
            uniforms={{ ...uniforms, uScreenHeight: screenHeight }}
        />
    );
}
