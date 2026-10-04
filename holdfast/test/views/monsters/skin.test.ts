import { MeshStandardMaterial } from "three";
import { expect, it } from "vitest";
import {
    createMonsterSkin,
    dressMaterial,
    paintSkin,
} from "../../../src/views/monsters/skin";
import { monsterModels } from "../../../src/views/monsters/models";
import { monsterLooks } from "../../../src/views/palette";
import { MonsterKind } from "../../../src/siege/traits";

//  A hit's light on a monster's skin: a husk's whole body flashes, and a
//  colossus, which the whole party fires at, keeps its body's colour and
//  lights its outline.

function dress(kind: MonsterKind) {
    const look = monsterLooks[kind];
    const skin = createMonsterSkin(look);
    const body = new MeshStandardMaterial();
    dressMaterial({ skin, material: body, look, eyes: false });
    return { skin, body };
}

it("washes a monster's body toward white at a hit", () => {
    const { skin, body } = dress(MonsterKind.Husk);

    paintSkin(skin, { flash: 1, threat: 0, wash: 1 });

    expect(body.emissive.r).toBeGreaterThan(0.5);
    expect(body.emissive.b).toBeGreaterThan(0.5);
});

it("keeps a colossus's body its own colour under a hit, and lights its outline instead", () => {
    const { skin, body } = dress(MonsterKind.Colossus);
    paintSkin(skin, { flash: 0, threat: 0, wash: 0 });
    const restingRim = skin.rim.rimColor.value.clone();

    paintSkin(skin, { flash: 1, threat: 0, wash: 0 });

    expect(body.emissive.getHex()).toBe(0x000000);
    expect(skin.rim.rimColor.value.r).toBeGreaterThan(restingRim.r * 3);
});

/** The shader text a dressed material compiles to, from a bare stand-in
 *  of three's own chunks. */
function compile(material: MeshStandardMaterial) {
    const shader = {
        uniforms: {},
        vertexShader: "#include <common>\n#include <begin_vertex>",
        fragmentShader:
            "#include <common>\n#include <clipping_planes_fragment>\n#include <emissivemap_fragment>",
    };
    material.onBeforeCompile(shader as never, undefined as never);
    return shader;
}

function dressPart(kind: MonsterKind, name: string) {
    const model = monsterModels[kind];
    const look = monsterLooks[kind];
    const skin = createMonsterSkin(look, { seams: model.seams });
    const material = new MeshStandardMaterial({ name });
    dressMaterial({ skin, material, look, eyes: false, cut: model.cut });
    return compile(material);
}

it("draws the brute's file without the halo over its horns, and keeps the horns", () => {
    for (const kind of [MonsterKind.Brute, MonsterKind.Colossus]) {
        expect(dressPart(kind, "Black").fragmentShader).toContain("discard");
        expect(dressPart(kind, "Demon_Main").fragmentShader).not.toContain(
            "discard",
        );
    }
});

it("burns seams through the colossus's skin and no other kind's", () => {
    expect(
        dressPart(MonsterKind.Colossus, "Demon_Main").fragmentShader,
    ).toContain("seamColor");
    expect(
        dressPart(MonsterKind.Brute, "Demon_Main").fragmentShader,
    ).not.toContain("seamColor");
});
