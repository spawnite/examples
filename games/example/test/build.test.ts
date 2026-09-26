// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { gzipSync } from "node:zlib";
import { build, type Plugin, type Rolldown } from "vite";
import { beforeAll, expect, it } from "vitest";

const exampleFolder = path.resolve(import.meta.dirname, "..");

//  The most the page, its code and its styles may weigh gzipped: what a
//  phone downloads before it draws a frame.
const initialLoadBudgetBytes = 720_000;

//  Every file the production build wrote, read off the bundle itself.
const bundle: Rolldown.OutputBundle = {};

function recordBundle(): Plugin {
    return {
        name: "record-bundle",
        writeBundle(_options, output) {
            Object.assign(bundle, output);
        },
    };
}

beforeAll(async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "example-build-"));
    //  Vitest runs under NODE_ENV=test, and Vite reads NODE_ENV rather than
    //  the mode to decide import.meta.env.DEV. The build a deploy runs sees
    //  production, so this one must too.
    const testEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
        await build({
            root: exampleFolder,
            logLevel: "silent",
            build: { outDir, emptyOutDir: true },
            plugins: [recordBundle()],
        });
    } finally {
        process.env.NODE_ENV = testEnvironment;
        await rm(outDir, { recursive: true, force: true });
    }
}, 120_000);

//  A deploy uploads every chunk and a page fetches them one by one, so the
//  count is a cost of its own beside the bytes. A dynamic import that the
//  bundler cannot narrow, such as an icon looked up by name, writes one
//  chunk per module it might reach.
const maxChunks = 20;

it("splits its code into a handful of chunks", () => {
    const chunks = Object.values(bundle).filter(
        (output) => output.type === "chunk",
    );
    expect(chunks.length).toBeLessThan(maxChunks);
});

//  The devtools reach the page through a bare stylesheet import in their
//  entry, which the bundler drops when the package calls itself side-effect
//  free. The dev server never tree-shakes, so only a build shows the loss.
it("ships the devtools stylesheet in a production build", () => {
    const fileNames = Object.keys(bundle);
    expect(fileNames).toContainEqual(
        expect.stringMatching(/^assets\/devtools-.*\.js$/),
    );
    expect(fileNames).toContainEqual(
        expect.stringMatching(/^assets\/devtools-.*\.css$/),
    );
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

//  Every browser the platform serves reads woff2, so a woff beside it is a
//  file a deploy uploads and no page fetches.
it("ships the devtools' fonts as woff2 alone", () => {
    const fonts = Object.keys(bundle).filter((fileName) =>
        /\.woff2?$/.test(fileName),
    );
    expect(fonts).toContainEqual(expect.stringMatching(/\.woff2$/));
    expect(fonts.filter((fileName) => fileName.endsWith(".woff"))).toEqual([]);
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

//  The page, its entry chunk, what that imports statically and their
//  stylesheets. The physics and the navmesh wasm are dynamic imports, which
//  the world draws without.
function readInitialFiles() {
    const initialFiles = new Set(["index.html"]);
    const visit = (fileName: string) => {
        const chunk = bundle[fileName];
        if (initialFiles.has(fileName) || chunk?.type !== "chunk") return;
        initialFiles.add(fileName);
        chunk.viteMetadata?.importedCss.forEach((css) => initialFiles.add(css));
        chunk.imports.forEach(visit);
    };
    Object.values(bundle)
        .filter((output) => output.type === "chunk" && output.isEntry)
        .forEach((entry) => visit(entry.fileName));
    return initialFiles;
}

it("keeps the initial load under its budget", () => {
    const bytes = [...readInitialFiles()]
        .map((fileName) => {
            const output = bundle[fileName];
            return output.type === "chunk" ? output.code : output.source;
        })
        .reduce((total, source) => total + gzipSync(source).length, 0);

    expect(bytes).toBeLessThanOrEqual(initialLoadBudgetBytes);
});

//  What a first frame draws without, each loaded where it is first used, as
//  the frame page lists them.
const deferredModules = [
    //  motion's drag and layout, which no `m` inside `LazyMotion` asks for.
    /framer-motion[\\/].*[\\/]gestures[\\/]drag[\\/]/,
    /[\\/]projection[\\/]node[\\/]/,
    //  EXRLoader, for a sky that names an `.exr`.
    /EXRLoader/,
    //  The devtools' console capture.
    /object-inspect/,
    /error-stack-parser/,
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
    const initialChunks = [...readInitialFiles()].flatMap((fileName) => {
        const output = bundle[fileName];
        return output.type === "chunk" ? [output] : [];
    });
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
