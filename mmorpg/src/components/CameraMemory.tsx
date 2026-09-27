import { useEffect } from "react";
import { useQueryFirst, useWorld } from "koota/react";
import { CameraTrait, useSaveStore } from "@spawnite/engine";
import { loadCamera } from "../save";

/** Puts the camera back where the save left it, once the orbit stands. */
export function CameraMemory() {
    const world = useWorld();
    const camera = useQueryFirst(CameraTrait);
    const store = useSaveStore();

    useEffect(() => {
        if (camera) loadCamera(world, { store });
    }, [camera, world, store]);

    return null;
}
