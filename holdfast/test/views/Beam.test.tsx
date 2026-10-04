import { create } from "@react-three/test-renderer";
import { CylinderGeometry, Group, Mesh, Object3D, Vector3 } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Beam, type BeamProps } from "../../src/views/Beam";
import { LatePoses } from "../../src/views/warden/latePoses";
import {
    findMuzzle,
    holdMuzzle,
    settleMuzzle,
} from "../../src/views/warden/muzzles";
import { keepThree } from "./readThree";

//  A shot's line starts at the barrel of the warden who fired it for as
//  long as it shows, wherever she runs meanwhile, and ends where the shot
//  ended. A line whose shooter has no drawn barrel stays where the room
//  says the shot left.

const hue = 1;
let release: () => void = () => undefined;

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => {
    release();
    vi.unstubAllGlobals();
});

/** Her place in the world with her barrel's end half a metre ahead of her
 *  right hand, settled as her hold draws it. */
function holdBarrel() {
    const place = new Group();
    place.position.set(2, 0, -1);
    place.rotation.y = 0.4;
    const muzzle = new Object3D();
    muzzle.position.set(0.3, 1.2, -0.6);
    place.add(muzzle);
    release = holdMuzzle(hue, muzzle);
    place.updateMatrixWorld(true);
    settleMuzzle(hue, place);
    return place;
}

/** Mounts a line from `from` to `to` beside her place, fired by
 *  `shooter`, and returns a draw of the scene and the line's two ends as
 *  drawn. */
async function mountLine(
    place: Group,
    { from, to, shooter }: Required<Pick<BeamProps, "from" | "to" | "shooter">>,
) {
    const { element: three, readThree } = keepThree();
    const renderer = await create(
        <>
            {three}
            <LatePoses />
            <primitive object={place} />
            <Beam from={from} to={to} color="#ff8844" shooter={shooter} />
        </>,
    );
    const [core] = renderer.scene
        .findAll(
            (node) =>
                node.instance instanceof Mesh &&
                node.instance.geometry instanceof CylinderGeometry &&
                node.instance.geometry.parameters.radiusTop === 0.025,
        )
        .map((node) => node.instance as Mesh);
    const draw = async () => {
        await renderer.advanceFrames(1, 1 / 60);
        const { gl, scene, camera } = readThree();
        gl.render(scene, camera);
    };
    //  The core runs along its own y, from -0.5 at the start to 0.5.
    const readEnds = () => ({
        start: core.localToWorld(new Vector3(0, -0.5, 0)),
        end: core.localToWorld(new Vector3(0, 0.5, 0)),
    });
    return { renderer, draw, readEnds };
}

it("keeps its start at her barrel while she strafes, and its end where the shot ended", async () => {
    const place = holdBarrel();
    //  The shot leaves the barrel as she fires.
    const from = new Vector3();
    expect(findMuzzle(hue, from)).toBe(true);
    const to = new Vector3(-4, 1, -30);
    const line = await mountLine(place, { from, to, shooter: hue });

    //  She runs left at 6 m/s for a tenth of a second.
    place.position.x -= 0.6;
    await line.draw();

    const barrel = new Vector3();
    findMuzzle(hue, barrel);
    const { start, end } = line.readEnds();
    expect(start.distanceTo(barrel)).toBeLessThan(1e-6);
    expect(end.distanceTo(to)).toBeLessThan(1e-6);
    await line.renderer.unmount();
});

it("stays where the room says the shot left when no barrel is drawn for it", async () => {
    const place = holdBarrel();
    const from = new Vector3(2, 1.2, -1);
    const to = new Vector3(-4, 1, -30);
    const line = await mountLine(place, { from, to, shooter: null });

    place.position.x -= 0.6;
    await line.draw();

    const { start, end } = line.readEnds();
    expect(start.distanceTo(from)).toBeLessThan(1e-6);
    expect(end.distanceTo(to)).toBeLessThan(1e-6);
    await line.renderer.unmount();
});
