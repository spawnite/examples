import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import type { Group } from "three";
import { useHeadless } from "@spawnite/engine";
import { addLatePose } from "../warden/latePoses";
import { readMarkMeshes, touchMarks, writeMarks } from "./marks";
import { readSigilLayers, sigilPixels, writeSigils } from "./sigils";

//  The one draw of each kind of mark every monster places, and of each
//  element mark's sign: in the scene from its first frame, so the engine
//  compiles their shaders under the loading screen, and written just before
//  the scene draws, once the frame's matrices are up to date.

/** Puts each layer's current mesh in `group`, and takes a replaced one
 *  out. */
function holdMeshes(group: Group) {
    const meshes = readMarkMeshes();
    for (const child of [...group.children])
        if (!meshes.some((mesh) => mesh === child)) group.remove(child);
    for (const mesh of meshes) if (mesh.parent !== group) group.add(mesh);
}

function DrawnMarks() {
    const groupRef = useRef<Group>(null);
    const signs = readSigilLayers();
    const readPixelRatio = useThree((state) => state.gl.getPixelRatio);
    useLayoutEffect(() => {
        const group = groupRef.current;
        if (group) holdMeshes(group);
        const removeMarks = addLatePose(writeMarks);
        const removeSigils = addLatePose(writeSigils);
        return () => {
            removeMarks();
            removeSigils();
        };
    }, []);
    useFrame(({ clock }) => {
        const group = groupRef.current;
        if (group) holdMeshes(group);
        touchMarks();
        //  A slow beat, so a sign catches the eye without flickering.
        const beat = 1 + 0.1 * Math.sin(clock.elapsedTime * 5);
        const pixels = sigilPixels * readPixelRatio() * beat;
        for (const points of Object.values(signs))
            points.material.size = pixels;
    });
    return (
        <>
            <group ref={groupRef} />
            {Object.values(signs).map((points) => (
                <primitive key={points.name} object={points} />
            ))}
        </>
    );
}

/** Every monster's marks, on a page: the room draws none. */
export function MonsterMarks() {
    return useHeadless() ? null : <DrawnMarks />;
}
