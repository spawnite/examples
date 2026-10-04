import { Suspense, useLayoutEffect, useMemo } from "react";
import { Clone } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import {
    Entity,
    Lighting,
    RunContext,
    useEntity,
    useHeadless,
    useModel,
} from "@spawnite/engine";
import barrelCactus from "@spawnite/assets/models/sled/barrel-cactus.glb?url";
import chalet from "@spawnite/assets/models/sled/chalet.glb?url";
import conifer from "@spawnite/assets/models/sled/conifer.glb?url";
import hoodoo from "@spawnite/assets/models/sled/hoodoo.glb?url";
import palm from "@spawnite/assets/models/sled/palm.glb?url";
import palmTrunk from "@spawnite/assets/models/sled/palm-trunk.glb?url";
import spruce from "@spawnite/assets/models/sled/spruce.glb?url";
import store from "@spawnite/assets/models/sled/store.glb?url";
import { RiderModel, type RiderPick } from "../components/RiderModel";
import { desert, snow, type SledMap } from "../maps";
import { riderScale } from "../ride/riders";
import type { ScreenPoint } from "./StageMark";
import { WorldId } from "./worlds";

//  The lobby's stage: the rider on its ride in the middle of a clearing
//  of the selected track's world, under one fixed camera. Everything is
//  placed by hand round the origin, where the rider stands facing the
//  camera, so the stage lies at negative z behind it.

/** Where the scene's controls stand on the screen: each look's middle and
 *  its width in pixels, and the Speed dial's middle under the ride. */
export interface StageLayout {
    rider: ScreenPoint;
    riderSpread: number;
    ride: ScreenPoint;
    rideSpread: number;
    dial: ScreenPoint;
}

/** Where the controls stand before the camera has measured the stage, and
 *  where no canvas draws one. */
export const defaultStageLayout: StageLayout = {
    rider: { x: 0.5, y: 0.4 },
    riderSpread: 150,
    ride: { x: 0.5, y: 0.52 },
    rideSpread: 150,
    dial: { x: 0.5, y: 0.66 },
};

/** A model on the stage: its file, metres across and back, its height in
 *  metres, and its turn about up in radians. */
type Placement = [
    url: string,
    x: number,
    z: number,
    height: number,
    turn: number,
];

/** Each world's clearing, laid out as the old sled's lobby was: a few
 *  close in, which a phone held upright sees, and the rest out to the
 *  sides, which a wide screen fills its edges with. */
const stages: Record<WorldId, { map: SledMap; props: Placement[] }> = {
    [WorldId.Snow]: {
        map: snow,
        props: [
            //  Behind the rider, a phone held upright shows both: the store
            //  stands further back, so it fits beside the chalet.
            [chalet, -1.1, -12, 3.6, 0.5],
            [store, 2.1, -15.5, 3.2, -0.45],
            [conifer, -0.6, -18.5, 4.6, 0.3],
            [spruce, 5.2, -17.5, 4.2, 1.9],
            [conifer, 1.4, -21, 5.2, 4.1],
            [conifer, -5.4, -9, 4.6, 5.2],
            [spruce, 5.6, -9.5, 4, 0.9],
            [conifer, -6.8, -15, 5.4, 3.3],
            [conifer, 7.6, -14, 4.8, 1.4],
            [conifer, -4.2, -20, 5, 2.2],
            [spruce, 9.6, -19, 4.4, 4.8],
            //  Out to the sides, which a wide screen shows: copies turned
            //  and sized apart, the far chalet half hidden by the trees.
            [store, -10.2, -13, 2.8, 1],
            [chalet, 11, -12.5, 3.2, -1],
            [chalet, 9, -22, 4, -0.15],
            [spruce, -12, -8, 4.2, 1.1],
            [conifer, 12.5, -7.5, 4.6, 2.9],
            [spruce, -13.5, -17, 4.4, 0.6],
            [conifer, -8.6, -21, 5, 3.7],
        ],
    },
    [WorldId.Desert]: {
        map: desert,
        props: [
            [palm, -1.8, -7.5, 4, 0.4],
            [barrelCactus, 2, -6.5, 0.8, 1.1],
            [palm, -0.8, -14, 4.6, 2.7],
            [hoodoo, 1.6, -14, 4.2, 0.2],
            [palmTrunk, 2.8, -10, 0.9, 1.6],
            [barrelCactus, -4.4, -7, 0.9, 3.9],
            [hoodoo, 7, -10, 3.4, 4.4],
            [hoodoo, -7.8, -13, 5, 1.8],
            [barrelCactus, 6.6, -12.5, 0.85, 2.5],
            [palm, -4.2, -18, 4.4, 5.1],
            [hoodoo, 3.4, -20.5, 4, 3.0],
            [palm, 8.4, -16, 4.2, 0.8],
            [palmTrunk, -6, -11, 0.8, 2.2],
        ],
    },
};

/** Metres the ground reaches out to, past where the fog hides it. */
const groundRadius = 400;

/** Radians the rider turns from facing the camera: the three-quarter
 *  front view. */
const riderTurn = 0.45;

/** The camera: the eye a little above and in front of the rider, the
 *  point it looks at, and the stage it keeps in frame, in metres: at least
 *  `width` across at the rider, which a phone held upright needs, and at
 *  least `height` top to bottom, which a wide screen needs. */
const shot = {
    eye: new Vector3(0, 2.4, 7.5),
    target: new Vector3(0, 0.55, 0),
    width: 3.2,
    height: 5.4,
};

/** Metres up the rider's middle stands, its ride's, and the dial's spot
 *  on the snow in front of it; and each look's width in metres. */
const anchors = {
    rider: new Vector3(0, 1.05, 0),
    ride: new Vector3(0, 0.3, 0),
    dial: new Vector3(0, 0, 2.1),
};
const lookWidths = { rider: 1.1, ride: 1.3 };

/** The screen point the camera draws `point` at, as fractions of the
 *  screen from its top left. */
function project(camera: PerspectiveCamera, point: Vector3): ScreenPoint {
    const { x, y } = point.clone().project(camera);
    return { x: (x + 1) / 2, y: (1 - y) / 2 };
}

/** Pixels across the screen a look `width` metres wide at `point` takes. */
function measureSpread(
    camera: PerspectiveCamera,
    point: Vector3,
    width: number,
    screenWidth: number,
) {
    const half = new Vector3(width / 2, 0, 0);
    const left = project(camera, point.clone().sub(half));
    const right = project(camera, point.clone().add(half));
    return (right.x - left.x) * screenWidth;
}

/** Stands the canvas's camera on the shot, its lens wide enough for the
 *  shot at the screen's shape, and tells `onLayout` where the controls
 *  stand. Again on each resize.
 *  ponytail: the engine has no fixed camera, so this writes the canvas's
 *  own; a `Camera` that takes an eye and a target would replace it. */
function StageCamera({
    onLayout,
}: {
    onLayout: (layout: StageLayout) => void;
}) {
    const camera = useThree((state) => state.camera);
    const { width, height } = useThree((state) => state.size);
    useLayoutEffect(() => {
        if (!(camera instanceof PerspectiveCamera)) return;
        const aspect = width / height;
        const distance = shot.eye.distanceTo(shot.target);
        const half = Math.max(shot.height / 2, shot.width / 2 / aspect);
        camera.aspect = aspect;
        camera.fov = (2 * Math.atan(half / distance) * 180) / Math.PI;
        camera.position.copy(shot.eye);
        camera.lookAt(shot.target);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        onLayout({
            rider: project(camera, anchors.rider),
            riderSpread: measureSpread(
                camera,
                anchors.rider,
                lookWidths.rider,
                width,
            ),
            ride: project(camera, anchors.ride),
            rideSpread: measureSpread(
                camera,
                anchors.ride,
                lookWidths.ride,
                width,
            ),
            dial: project(camera, anchors.dial),
        });
    }, [camera, width, height, onLayout]);
    return null;
}

/** A model stood on its lowest point, `height` metres tall. */
function Prop({ placement }: { placement: Placement }) {
    const [url, x, z, height, turn] = placement;
    const { scene } = useModel(url);
    const { scale, lift } = useMemo(() => {
        const bounds = new Box3().setFromObject(scene);
        const scale = height / (bounds.max.y - bounds.min.y);
        return { scale, lift: -bounds.min.y * scale };
    }, [scene, height]);
    return (
        <Clone
            object={scene}
            scale={scale}
            position={[x, lift, z]}
            rotation-y={turn}
            castShadow
            receiveShadow
        />
    );
}

/** The rider's animal on its ride, idling, as the run draws it, in full
 *  colour whether the player owns the look or not, to show it off. It
 *  turns once round as the look on show changes, or is bought. */
function StageRider({
    rider,
    ride,
    locked,
}: RiderPick & { locked: { rider: boolean; ride: boolean } }) {
    const entity = useEntity();
    return (
        <group rotation-y={riderTurn} scale={riderScale}>
            <Suspense fallback={null}>
                <RiderModel
                    entity={entity}
                    rider={rider}
                    ride={ride}
                    idle
                    turnKey={`${rider} ${ride} ${locked.rider} ${locked.ride}`}
                />
            </Suspense>
        </group>
    );
}

export interface StageProps extends RiderPick {
    world: WorldId;
    /** Which of the looks on show the player does not own yet: a buy turns
     *  the rider as a new look does. */
    locked: { rider: boolean; ride: boolean };
    onLayout: (layout: StageLayout) => void;
}

/** The lobby's 3D stage: the clearing of `world`, the rider on show in
 *  the middle, the world's light and sky, and the fixed camera. */
export function Stage({ world, rider, ride, locked, onLayout }: StageProps) {
    const { map, props } = stages[world];
    const headless = useHeadless();
    if (headless) return null;
    return (
        <>
            <StageCamera onLayout={onLayout} />
            <Lighting
                look={map.look}
                focus={shot.target}
                shadowBox={{ halfWidth: 12, depth: 30 }}
                sky={map.background}
            />
            <mesh rotation-x={-Math.PI / 2} receiveShadow>
                <circleGeometry args={[groundRadius, 64]} />
                <meshStandardMaterial
                    color={map.albedo}
                    emissive={map.emissive}
                    roughness={1}
                />
            </mesh>
            <Suspense fallback={null}>
                {props.map((placement) => (
                    <Prop key={placement.join(" ")} placement={placement} />
                ))}
            </Suspense>
            <Entity name="Rider" authority={RunContext.Client}>
                <StageRider rider={rider} ride={ride} locked={locked} />
            </Entity>
        </>
    );
}
