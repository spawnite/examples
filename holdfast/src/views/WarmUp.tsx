import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, Mesh, PlaneGeometry, type Group } from "three";
import { useHeadless, useLoading, useModel } from "@spawnite/engine";
import { EliteModifier, MonsterKind } from "../siege/traits";
import { createDust, createGlow, createGlowSprite } from "./BurstView";
import { readTearTexture } from "./glowTexture";
import { useMonsterBatch } from "./monsters/batch";
import { listModelKinds, monsterModels } from "./monsters/models";
import { createMonsterRig, disposeMonsterRig } from "./monsters/rig";

//  What a wave draws that the scene does not hold as it loads: a rig of
//  each monster model and the glows of its bursts. They stay in the scene,
//  hidden, while the page is open: the engine compiles their shaders under
//  the loading screen, rather than in the frame a wave's first
//  monster rises, and the shaders stay compiled when a wave's last monster
//  sinks, as three drops a shader no material uses.

/** Small enough to cover no pixel, and still drawn. */
const unseenScale = 1e-4;
const white = new Color("#ffffff");
const quad = new PlaneGeometry(1, 1);

interface WarmRigProps {
    kind: MonsterKind;
}

/** A rig of `kind`'s model. The engine's compile leaves out the shadow
 *  pass's shader, so the rig is drawn for one frame too, too small to see:
 *  a frame draws its shadows before the rest. It draws once the loading
 *  screen's steps are in, so under the screen, which waits for the
 *  engine's compile, or once the engine has compiled the scene, where no
 *  screen is up. */
function WarmRig({ kind }: WarmRigProps) {
    const gltf = useModel(monsterModels[kind].url);
    const rig = useMemo(
        () => createMonsterRig(gltf, { kind, elite: EliteModifier.None }),
        [gltf, kind],
    );
    useLayoutEffect(() => () => disposeMonsterRig(rig), [rig]);
    const settled = useLoading(
        (state) => state.settled || state.shadersCompiled,
    );
    const groupRef = useRef<Group>(null);
    useLayoutEffect(() => {
        const group = groupRef.current;
        if (!settled || !group) return;
        group.visible = true;
        const hide = () => {
            group.visible = false;
        };
        rig.object.traverse((object) => {
            if (!(object instanceof Mesh)) return;
            object.onAfterRender = hide;
            //  The shadow pass shares one material among meshes and picks
            //  its shader again only when the kind of mesh changes, so a
            //  mesh with no texture drawn after one with a texture keeps
            //  that one's: picking again compiles this mesh's own.
            object.onBeforeShadow = (
                _renderer,
                _object,
                _camera,
                _shadowCamera,
                _geometry,
                depthMaterial,
            ) => {
                depthMaterial.needsUpdate = true;
            };
        });
    }, [settled, rig]);
    return (
        <group ref={groupRef} scale={unseenScale} visible={false}>
            <primitive object={rig.object} />
            <primitive object={rig.shadow} />
        </group>
    );
}

/** Holds `kind`'s batch from the first frame, in the scene with no copy
 *  in it: its draws, of none, compile its shaders under the loading screen,
 *  and the shaders stay while no monster of it stands. */
function WarmBatch({ kind }: WarmRigProps) {
    useMonsterBatch(kind);
    return null;
}

/** One of each material a burst draws with: a glow with a picture, one
 *  without, a glowing sprite and the dust. */
function WarmGlows() {
    const [materials] = useState(() => {
        const tear = createGlow(white);
        tear.map = readTearTexture();
        return {
            tear,
            glow: createGlow(white),
            sprite: createGlowSprite(white),
            dust: createDust(),
        };
    });
    useLayoutEffect(
        () => () => {
            for (const material of Object.values(materials)) material.dispose();
        },
        [materials],
    );
    return (
        <group visible={false}>
            <mesh geometry={quad} material={materials.tear} />
            <mesh geometry={quad} material={materials.glow} />
            <sprite material={materials.sprite} />
            <sprite material={materials.dust} />
        </group>
    );
}

export function WarmUp() {
    if (useHeadless()) return null;
    return (
        <>
            <WarmGlows />
            {listModelKinds().map((kind) => (
                //  Each its own boundary, so a model still loading holds
                //  back no other.
                <Suspense key={kind} fallback={null}>
                    <WarmRig kind={kind} />
                    {/*  The colossus draws on its own, never in a batch. */}
                    {kind !== MonsterKind.Colossus && <WarmBatch kind={kind} />}
                </Suspense>
            ))}
        </>
    );
}
