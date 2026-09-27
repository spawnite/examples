// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
    firstLoadCeilingBytes,
    readFirstLoadBytes,
} from "@spawnite/engine/vite";
import { build, type Rolldown } from "vite";
import { expect, it } from "vitest";

it("keeps the first load under the platform's ceiling", async () => {
    const written: Rolldown.OutputBundle = {};
    const outDir = await mkdtemp(path.join(tmpdir(), "game-build-"));
    //  Vite reads NODE_ENV, not the mode, and a deploy builds in production.
    const testEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
        await build({
            root: path.resolve(import.meta.dirname, ".."),
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
    expect(readFirstLoadBytes(written)).toBeLessThanOrEqual(
        firstLoadCeilingBytes,
    );
}, 180_000);
