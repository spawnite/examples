import { createPortal, useFrame, useThree } from "@react-three/fiber";
import type { Entity } from "koota";
import { useQueryFirst, useTrait } from "koota/react";
import {
    Suspense,
    useLayoutEffect,
    useMemo,
    useRef,
    type ReactNode,
} from "react";
import { VRMHumanBoneName, type VRM } from "@pixiv/three-vrm";
import { AdditiveBlending, MathUtils, RingGeometry, Vector3 } from "three";
import {
    Ground,
    HeroAnimationView,
    isPlayerHero,
    Obstacles,
    VrmView,
} from "@spawnite/engine";
import { WardenTrait } from "../siege/traits";
import { createWardenBody } from "./avatars";
import { readGlowTexture } from "./glowTexture";
import { readWardenColor } from "./palette";
import { Blaster } from "./warden/Blaster";
import { holdBlaster } from "./warden/aimPose";
import { addLatePose } from "./warden/latePoses";

//  A warden: an avatar playing the engine's clips, with her right arm held
//  out along her aim and her blaster in that hand, a ring of her colour at
//  her feet so two players tell each other apart across the circle, and
//  lying on the ground while she is down.

const ringGeometry = new RingGeometry(0.42, 0.56, 40);

//  Written in place each frame.
const looking = new Vector3();

interface WardenRigProps {
    entity: Entity;
    vrm: VRM;
    hue: number;
    down: boolean;
}

/** Her two-handed hold on the blaster, laid over the clips just before
 *  each draw, her fall, and her blaster in her hand. */
function WardenRig({ entity, vrm, hue, down }: WardenRigProps) {
    const { humanoid } = vrm;
    const hand = humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightHand);
    //  A VRM 0.x body faces the other way in its own frame, so its right arm
    //  rests along positive x and forward is negative z.
    const side = vrm.meta.metaVersion === "0" ? 1 : -1;
    const own = isPlayerHero(entity);

    const camera = useThree((state) => state.camera);
    const downRef = useRef(down);
    downRef.current = down;
    useLayoutEffect(() => {
        const arms = [
            humanoid.getRawBoneNode(VRMHumanBoneName.RightUpperArm),
            humanoid.getRawBoneNode(VRMHumanBoneName.LeftUpperArm),
            humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm),
            humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm),
        ];
        return addLatePose(() => {
            //  Down, her arms keep the clip's.
            if (downRef.current) return;
            //  Her own page knows where she aims up or down; another's holds
            //  the gun level.
            const pitch = own
                ? MathUtils.clamp(
                      Math.asin(camera.getWorldDirection(looking).y),
                      -0.7,
                      0.7,
                  )
                : 0;
            holdBlaster(vrm, { pitch });
            humanoid.update();
            //  The renderer reads the bones' world matrices next, and the
            //  gun hangs from the normalized hand.
            for (const arm of arms) arm?.updateMatrixWorld(true);
        });
    }, [camera, humanoid, own, vrm]);

    useFrame((_state, delta) => {
        //  Down, she lies on her back; up, she stands.
        vrm.scene.rotation.x = MathUtils.damp(
            vrm.scene.rotation.x,
            down ? -Math.PI / 2 : 0,
            8,
            delta,
        );
        vrm.scene.position.y = MathUtils.damp(
            vrm.scene.position.y,
            down ? 0.2 : 0,
            8,
            delta,
        );
    });

    const color = readWardenColor(hue);
    return (
        <>
            {hand &&
                createPortal(
                    //  The hand's frame: her arm runs along x, toward the
                    //  barrel once the arm is out, with up along y.
                    <group
                        position={[side * 0.06, -0.02, 0]}
                        rotation-y={(-side * Math.PI) / 2}
                    >
                        <Blaster hue={hue} color={color} lit={own} />
                    </group>,
                    hand,
                )}
            <mesh
                geometry={ringGeometry}
                rotation-x={-Math.PI / 2}
                position-y={0.04}
            >
                <meshBasicMaterial
                    color={color}
                    alphaMap={readGlowTexture()}
                    transparent
                    opacity={0.8}
                    blending={AdditiveBlending}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
        </>
    );
}

interface WardenViewProps {
    entity: Entity;
    /** Drawn inside her body, so it follows her: what hangs over her. */
    children?: ReactNode;
}

function WardenBody({ entity, children }: WardenViewProps) {
    const survivor = useTrait(entity, WardenTrait);
    const hue = survivor?.hue ?? 0;
    const down = survivor?.down ?? false;
    const body = useMemo(() => createWardenBody(hue), [hue]);
    const ground = useTrait(useQueryFirst(Ground), Ground);
    const obstacles = useTrait(useQueryFirst(Obstacles), Obstacles);
    return (
        <VrmView
            entity={entity}
            body={body}
            ground={ground?.surface}
            obstacles={obstacles?.bvh}
        >
            {({ vrm }) => (
                <>
                    <HeroAnimationView
                        entity={entity}
                        vrm={vrm}
                        armSpread={body.armSpread}
                    />
                    <WardenRig
                        entity={entity}
                        vrm={vrm}
                        hue={hue}
                        down={down}
                    />
                    {children}
                </>
            )}
        </VrmView>
    );
}

/** Her own boundary, so a body still loading hides nothing else. */
export function WardenView(props: WardenViewProps) {
    return (
        <Suspense fallback={null}>
            <WardenBody {...props} />
        </Suspense>
    );
}
