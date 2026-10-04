import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTrait } from "koota/react";
import { GroundTrait, RefTrait, useWorldEntity } from "@spawnite/engine";
import {
    InstancedMesh,
    Light,
    OrthographicCamera,
    Vector4,
    type Object3D,
} from "@spawnite/engine/three";

//  The minimap's picture: the whole map seen from straight above, taken
//  once the World has stood its ground and its trees, rocks and grass, and
//  again a little later for any the scatter stood late. Only the ground,
//  the scatter and the lights are drawn for it, so no monster, loot or
//  hero is caught in it. It is drawn into the game's own canvas in a frame
//  before that frame's view, which is drawn over it, so it is never seen
//  there, and copied out at once.

/** The picture and the metres across it covers, centred on the origin
 *  with north up; none until it is taken. */
export const mapPicture: { image: HTMLCanvasElement | null; size: number } = {
    image: null,
    size: 0,
};

/** Seconds into the scene each picture is taken. */
const takeAt = [2.5, 9];

//  Written in place.
const viewport = new Vector4();

export function MapBake() {
    const ground = useWorldEntity();
    const size = useTrait(ground, GroundTrait)?.surface.size;
    const groundMesh = useTrait(ground, RefTrait)?.object as
        Object3D | undefined;
    const since = useRef(0);
    const taken = useRef(0);

    useEffect(() => {
        since.current = 0;
        taken.current = 0;
        return () => {
            mapPicture.image = null;
        };
    }, [size, groundMesh]);

    useFrame(({ gl, scene }, delta) => {
        if (!size || !groundMesh || taken.current >= takeAt.length) return;
        since.current += delta;
        if (since.current < takeAt[taken.current]) return;
        taken.current += 1;

        //  Everything drawn but the ground, the scatter and the lights,
        //  hidden for the picture.
        const hidden: Object3D[] = [];
        const kept = new Set<Object3D>();
        groundMesh.traverse((object) => kept.add(object));
        scene.traverse((object) => {
            if (!object.visible || kept.has(object)) return;
            const drawn =
                "isMesh" in object ||
                "isPoints" in object ||
                "isLine" in object ||
                "isSprite" in object;
            //  The scatter is the engine's instanced meshes, three's own or
            //  the faster kind it culls instance by instance.
            const scatter =
                object instanceof InstancedMesh || "isInstancedMesh2" in object;
            if (drawn && !scatter && !(object instanceof Light)) {
                object.visible = false;
                hidden.push(object);
            }
        });
        const fog = scene.fog;
        scene.fog = null;

        //  Straight down over the middle, north up, the map filling a
        //  square of the canvas.
        const canvas = gl.domElement;
        const side = Math.min(canvas.width, canvas.height);
        const camera = new OrthographicCamera(
            -size / 2,
            size / 2,
            size / 2,
            -size / 2,
            1,
            600,
        );
        camera.position.set(0, 300, 0);
        camera.up.set(0, 0, -1);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        gl.getViewport(viewport);
        gl.setViewport(
            0,
            0,
            side / gl.getPixelRatio(),
            side / gl.getPixelRatio(),
        );
        gl.render(scene, camera);

        const picture = mapPicture.image ?? document.createElement("canvas");
        picture.width = side;
        picture.height = side;
        picture
            .getContext("2d")
            ?.drawImage(
                canvas,
                0,
                canvas.height - side,
                side,
                side,
                0,
                0,
                side,
                side,
            );
        mapPicture.image = picture;
        mapPicture.size = size;

        gl.setViewport(viewport);
        scene.fog = fog;
        for (const object of hidden) object.visible = true;
    });

    return null;
}
