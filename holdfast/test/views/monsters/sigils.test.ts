import { Object3D, Scene } from "three";
import { expect, it } from "vitest";
import { Mark } from "../../../src/siege/elements";
import {
    hideSigil,
    readSigilLayers,
    showSigil,
    writeSigils,
} from "../../../src/views/monsters/sigils";

//  A marked monster wears its mark's sign over its head: one draw for each
//  mark, every sign at its anchor's place in the world as the frame draws.

/** An anchor standing in a scene at `x`, 2 m up. */
function placeAnchor(x: number) {
    const scene = new Scene();
    const anchor = new Object3D();
    anchor.position.set(x, 2, 0);
    scene.add(anchor);
    scene.updateMatrixWorld();
    return anchor;
}

function readPlaces(mark: Mark.Blazing | Mark.Frozen) {
    const points = readSigilLayers()[mark];
    const place = points.geometry.getAttribute("position");
    return Array.from(
        { length: points.geometry.drawRange.count },
        (_, index) => [place.getX(index), place.getY(index)],
    );
}

it("draws each shown sign at its anchor, in its own mark's layer", () => {
    const burning = placeAnchor(3);
    const frozen = placeAnchor(-5);

    showSigil(burning, Mark.Blazing);
    showSigil(frozen, Mark.Frozen);
    writeSigils();

    expect(readPlaces(Mark.Blazing)).toEqual([[3, 2]]);
    expect(readPlaces(Mark.Frozen)).toEqual([[-5, 2]]);
    hideSigil(burning);
    hideSigil(frozen);
});

it("moves a sign from one mark's layer to the other, and takes it away", () => {
    const anchor = placeAnchor(1);

    showSigil(anchor, Mark.Frozen);
    showSigil(anchor, Mark.Blazing);
    writeSigils();
    expect(readPlaces(Mark.Frozen)).toEqual([]);
    expect(readPlaces(Mark.Blazing)).toEqual([[1, 2]]);

    hideSigil(anchor);
    writeSigils();
    expect(readPlaces(Mark.Blazing)).toEqual([]);
});

it("skips a sign whose monster is hidden", () => {
    const anchor = placeAnchor(1);
    anchor.visible = false;

    showSigil(anchor, Mark.Frozen);
    writeSigils();

    expect(readPlaces(Mark.Frozen)).toEqual([]);
    hideSigil(anchor);
});
