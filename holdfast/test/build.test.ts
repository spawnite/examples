// @vitest-environment node
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
    firstLoadCeilingBytes,
    readFirstLoadBytes,
} from "@spawnite/engine/vite";
import { build, type Rolldown } from "vite";
import { beforeAll, expect, it } from "vitest";

const gameFolder = path.resolve(import.meta.dirname, "..");
const written: Rolldown.OutputBundle = {};

beforeAll(async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "game-build-"));
    //  Vite reads NODE_ENV, not the mode, and a deploy builds in production.
    const testEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
        await build({
            root: gameFolder,
            logLevel: "silent",
            build: { outDir, emptyOutDir: true },
            plugins: [
                {
                    name: "record-bundle",
                    writeBundle: (_options, output) =>
                        void Object.assign(written, output),
                },
            ],
        });
    } finally {
        process.env.NODE_ENV = testEnvironment;
        await rm(outDir, { recursive: true, force: true });
    }
}, 180_000);

it("keeps the first load under the platform's ceiling", () => {
    expect(readFirstLoadBytes(written)).toBeLessThanOrEqual(
        firstLoadCeilingBytes,
    );
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
