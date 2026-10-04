// @vitest-environment node
import * as path from "node:path";
import { checkGameBuild } from "@spawnite/engine/vite";
import { it } from "vitest";

it("builds for production within the platform's rules", async () => {
    await checkGameBuild(path.resolve(import.meta.dirname, ".."));
}, 180_000);
