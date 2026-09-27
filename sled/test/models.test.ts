// @vitest-environment node
import { join } from "node:path";
import { expect, it } from "vitest";
import { checkModels } from "@spawnite/cli/models";

//  Against the committed manifest, which the test target's bake leaves
//  alone.
it("commits src/models.json as the bake writes it from public/assets", async () => {
    expect(await checkModels(join(import.meta.dirname, ".."))).toBeUndefined();
});
