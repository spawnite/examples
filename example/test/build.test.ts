// @vitest-environment node
import { readFileSync, realpathSync } from "node:fs";
import * as path from "node:path";
import { checkGameBuild, readFirstLoadFiles } from "@spawnite/engine/vite";
import { normalizePath, type Rolldown } from "vite";
import { beforeAll, expect, it } from "vitest";

const exampleFolder = path.resolve(import.meta.dirname, "..");

//  Every file the production build wrote, read off the bundle itself.
let bundle: Rolldown.OutputBundle = {};
//  The tree model the build wrote from public/, which the bundle omits.
let builtTree: Buffer | undefined;

//  The engine's check holds the standalone build under this repository's ceiling,
//  which the physics and the navmesh wasm stay out of as dynamic imports,
//  and keeps zod's classic API out.
beforeAll(async () => {
    bundle = await checkGameBuild(exampleFolder, {
        plugins: [
            {
                name: "read-tree",
                writeBundle({ dir = "" }) {
                    try {
                        builtTree = readFileSync(
                            path.join(dir, "assets/tree-tall.glb"),
                        );
                    } catch {
                        builtTree = undefined;
                    }
                },
            },
        ],
    });
}, 120_000);

//  A deploy uploads every chunk and a page fetches them one by one, so the
//  count is a cost of its own beside the bytes. A dynamic import that the
//  bundler cannot narrow, such as an icon looked up by name, writes one
//  chunk per module it might reach.
const maxChunks = 22;

it("splits its code into a handful of chunks", () => {
    const chunks = Object.values(bundle).filter(
        (output) => output.type === "chunk",
    );
    const names = chunks.map((chunk) => chunk.fileName).join("\n");
    expect(chunks.length, names).toBeLessThan(maxChunks);
});

//  The devtools package's files, as the build names its modules: the link
//  resolved, with forward slashes on every platform.
const devtoolsFolder = `${normalizePath(
    realpathSync(path.join(exampleFolder, "node_modules/@spawnite/devtools")),
)}/`;

//  What only the devtools bring into a build, so a static import of any of
//  them from the game or the engine fails here.
const devtoolsModules = [
    //  The engine's console capture.
    /object-inspect/,
    /error-stack-parser/,
    //  motion's drag and layout, which no `m` inside `LazyMotion` asks for.
    /framer-motion[\\/].*[\\/]gestures[\\/]drag[\\/]/,
    /[\\/]projection[\\/]node[\\/]/,
];

//  The devtools are for development: a deploy carries none of their code,
//  styles or fonts.
it("ships no devtools in a production build", () => {
    expect(
        Object.keys(bundle).filter((fileName) =>
            /devtools|\.woff2?$/.test(fileName),
        ),
    ).toEqual([]);
    const moduleIds = Object.values(bundle).flatMap((output) =>
        output.type === "chunk" ? output.moduleIds : [],
    );
    //  A build that recorded nothing would pass the checks below for the
    //  wrong reason.
    expect(moduleIds).not.toEqual([]);
    expect(moduleIds.filter((id) => id.startsWith(devtoolsFolder))).toEqual([]);
    expect(
        moduleIds.filter((id) =>
            devtoolsModules.some((pattern) => pattern.test(id)),
        ),
    ).toEqual([]);
});

//  The slow link `play start --latency` sets is for development: a deploy
//  holds no message of a player's.
it("ships no slow link in a production build", () => {
    const renderedIds = Object.values(bundle).flatMap((output) =>
        output.type === "chunk"
            ? Object.entries(output.modules)
                  .filter(([, module]) => module.renderedLength > 0)
                  .map(([id]) => id)
            : [],
    );
    //  The connection the link would sit in ships, so the check below
    //  reads a build that holds the code around it.
    expect(renderedIds).toContainEqual(
        expect.stringMatching(/[\\/]stores[\\/]roomConnection\.ts$/),
    );
    expect(
        renderedIds.filter((id) =>
            /engine[\\/]src[\\/](link|stores[\\/]pageLink)\.ts$/.test(id),
        ),
    ).toEqual([]);
});

//  A .wasm file compiles while it downloads and weighs a third less than
//  the -compat build's base64 chunk, which Node keeps.
it("ships Rapier's wasm as a file, without the -compat build", () => {
    expect(Object.keys(bundle)).toContainEqual(
        expect.stringMatching(/^assets\/rapier_wasm3d_bg-.*\.wasm$/),
    );
    const moduleIds = Object.values(bundle).flatMap((output) =>
        output.type === "chunk" ? output.moduleIds : [],
    );
    expect(moduleIds).toContainEqual(
        expect.stringMatching(/rapier3d-simd[\\/]rapier\.js$/),
    );
    expect(
        moduleIds.filter((id) => id.includes("rapier3d-simd-compat")),
    ).toEqual([]);
});

//  A second decoder is a wasm and its wrapper that no model loads.
it("ships one Draco decoder", () => {
    const decoders = Object.keys(bundle)
        .filter((fileName) => /draco_(decoder|wasm_wrapper)/.test(fileName))
        .sort();
    expect(decoders).toEqual([
        expect.stringMatching(/draco_decoder-.*\.wasm$/),
        expect.stringMatching(/draco_wasm_wrapper-.*\.js$/),
    ]);
});

//  drei's useGLTF brings three-stdlib's loader and decoders beside three's.
it("ships one glTF loader", () => {
    const moduleIds = Object.values(bundle).flatMap((output) =>
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

//  A sky is a megabyte and a half, and the example's scenes name none.
it("ships no sky its scenes do not name", () => {
    expect(
        Object.keys(bundle).filter((fileName) => /\.(hdr|exr)$/.test(fileName)),
    ).toEqual([]);
});

//  The example's tree is the engine's kit tree, byte for byte: the build
//  keeps the example's copy and points the engine's scatter at it.
it("ships one copy of a model the game and the engine both carry", () => {
    //  The copy the build keeps: Vite copies public/ as it is, outside the
    //  bundle.
    const publicTree = readFileSync(
        path.join(exampleFolder, "public/assets/tree-tall.glb"),
    );
    expect(builtTree?.equals(publicTree)).toBe(true);
    expect(
        Object.keys(bundle).filter((fileName) =>
            fileName.includes("tree-tall"),
        ),
    ).toEqual([]);
    const code = Object.values(bundle)
        .flatMap((output) => (output.type === "chunk" ? [output.code] : []))
        .join("\n");
    expect(code).toMatch(/[`"']assets\/tree-tall\.glb[`"']/);
});

it("validates with zod/mini", () => {
    const moduleIds = Object.values(bundle).flatMap((output) =>
        output.type === "chunk" ? output.moduleIds : [],
    );
    expect(moduleIds).toContainEqual(
        expect.stringMatching(/[\\/]zod[\\/]v4[\\/]mini[\\/]/),
    );
});

//  What a first frame draws without, each loaded where it is first used, as
//  the frame page lists them.
const deferredModules = [
    //  EXRLoader, for a sky that names an `.exr`.
    /EXRLoader/,
    //  recast's library and the line materials its wireframe draws with.
    /@recast-navigation/,
    /[\\/]jsm[\\/]lines[\\/]/,
];

it("keeps what a first frame draws without out of the initial load", () => {
    //  Each pattern names a module the build holds somewhere, so a rename
    //  fails here rather than passing the check below by matching nothing.
    const everyId = Object.values(bundle).flatMap((output) =>
        output.type === "chunk" ? Object.keys(output.modules) : [],
    );
    for (const pattern of deferredModules)
        expect(
            everyId.some((id) => pattern.test(id)),
            String(pattern),
        ).toBe(true);
    expect(Object.keys(bundle)).toContainEqual(
        expect.stringMatching(/^assets\/pickup-.*\.mp3$/),
    );
    const initialChunks = [...readFirstLoadFiles(bundle)].flatMap(
        (fileName) => {
            const output = bundle[fileName];
            return output.type === "chunk" ? [output] : [];
        },
    );
    const renderedIds = initialChunks.flatMap((chunk) =>
        Object.entries(chunk.modules)
            .filter(([, module]) => module.renderedLength > 0)
            .map(([id]) => id),
    );
    expect(
        renderedIds.filter((id) =>
            deferredModules.some((pattern) => pattern.test(id)),
        ),
    ).toEqual([]);
    //  A sound, which a view preloads as a file rather than as base64 here.
    expect(
        initialChunks
            .filter((chunk) => chunk.code.includes("data:audio/"))
            .map((chunk) => chunk.fileName),
    ).toEqual([]);
});
