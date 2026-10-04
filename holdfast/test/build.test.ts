// @vitest-environment node
import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";
import { checkGameBuild } from "@spawnite/engine/vite";
import type { Rolldown } from "vite";
import { beforeAll, expect, it } from "vitest";
import { composePlugins } from "@spawnite/engine/core";
import { plugins } from "../src/game";

const gameFolder = path.resolve(import.meta.dirname, "..");
let written: Rolldown.OutputBundle = {};

//  The engine's check holds the standalone build under this repository's ceiling
//  and keeps zod's classic API out.
beforeAll(async () => {
    written = await checkGameBuild(gameFolder);
}, 180_000);

//  drei's useGLTF brings three-stdlib's loader and decoders beside three's.
it("ships one glTF loader", () => {
    const moduleIds = Object.values(written).flatMap((output) =>
        output.type === "chunk" ? output.moduleIds : [],
    );
    expect(moduleIds).toContainEqual(
        expect.stringMatching(/three[\\/]examples[\\/].*GLTFLoader\.js$/),
    );
    expect(
        moduleIds.filter((id) =>
            /three-stdlib[\\/].*(GLTFLoader|DRACOLoader|MeshoptDecoder)/.test(
                id,
            ),
        ),
    ).toEqual([]);
});

//  A build renames a function and keeps a record's key. The room runs the
//  source and the page the build, and the welcome refuses a page whose
//  systems are named otherwise.
it("keeps each of the siege's system names through the build", () => {
    const code = Object.values(written)
        .map((output) => (output.type === "chunk" ? output.code : ""))
        .join("\n");
    const names = composePlugins(plugins)
        .entries.filter(({ plugin }) => plugin === "siege")
        .map(({ name }) => name.slice("siege.".length));

    expect(names.length).toBeGreaterThan(10);
    expect(
        names.filter((name) => !new RegExp(`\\b${name}\\s*[:,}]`).test(code)),
    ).toEqual([]);
});

/** Every `animate-*` class the game's source names. */
async function readAnimationClasses() {
    const files = await readdir(path.join(gameFolder, "src"), {
        recursive: true,
    });
    const names = new Set<string>();
    for (const file of files.filter((name) => /\.tsx?$/.test(name))) {
        const source = await readFile(
            path.join(gameFolder, "src", file),
            "utf8",
        );
        for (const [name] of source.matchAll(/\banimate-[a-z-]+\b/g))
            names.add(name);
    }
    return [...names];
}

/** The built stylesheet, all its files in one string. */
function readBuiltCss() {
    return Object.values(written)
        .filter((file) => file.type === "asset")
        .filter((file) => file.fileName.endsWith(".css"))
        .map((file) => String(file.source))
        .join("\n");
}

/** The `animation` value of the built rule for `className`. */
function readAnimation(css: string, className: string) {
    return new RegExp(`\\.${className}\\s*\\{[^}]*animation:([^;}]+)`).exec(
        css,
    )?.[1];
}

it("ships a rule and its keyframes for every animation the source names", async () => {
    const css = readBuiltCss();
    const names = await readAnimationClasses();

    expect(names).toContain("animate-kill-mark");
    //  The browser drops an at-rule it does not know, with all it holds.
    expect(css).not.toContain("@theme");
    //  Each of the game's own classes runs the keyframes of its own name, as
    //  Tailwind's do; Tailwind's built-in ones read its theme or none.
    for (const name of names) {
        const animation = readAnimation(css, name);
        expect(animation, name).toBeDefined();
        if (animation?.includes("var(--animate-") || animation === "none")
            continue;
        const keyframes = name.replace("animate-", "");
        expect(animation, name).toMatch(
            new RegExp(`(^|\\s)${keyframes}(\\s|$)`),
        );
        expect(css, name).toContain(`@keyframes ${keyframes}`);
    }
});

it("fades the kill mark within the 240 ms the mark stays in the page", () => {
    const animation = readAnimation(readBuiltCss(), "animate-kill-mark") ?? "";
    const [, amount, unit] = /(\d*\.?\d+)(ms|s)/.exec(animation) ?? [];

    expect(Number(amount) * (unit === "s" ? 1000 : 1)).toBeLessThanOrEqual(240);
});

//  The replay's words, which only its own chunk holds: the menu's line, the
//  Settings row, the dev server's path and the playback's page hook, the
//  taps the engine calls in a development build alone, and the recorded
//  clip's route and codec.
const replayWords = [
    "Keep a replay",
    "F8 marks this moment",
    "/__replay",
    "__GAME_REPLAY__",
    "receiveRoomFrame",
    "attachLoop",
    "markEngineEvents",
    "/__clips",
    "avc1.64002A",
];

it("ships none of the replay in a production build", () => {
    const moduleIds = Object.values(written).flatMap((output) =>
        output.type === "chunk" ? output.moduleIds : [],
    );
    //  A build that recorded nothing would pass for the wrong reason.
    expect(moduleIds).not.toEqual([]);
    expect(
        moduleIds.filter((id) =>
            /\/engine\/src\/replay\/|\/mediabunny\//.test(id),
        ),
    ).toEqual([]);
    const code = Object.values(written)
        .map((output) =>
            output.type === "chunk" ? output.code : String(output.source),
        )
        .join("\n");
    expect(replayWords.filter((word) => code.includes(word))).toEqual([]);
});
