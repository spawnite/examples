import { expect, it } from "vitest";
import { createWardenBody } from "../../src/views/avatars";

//  The loader keeps one live model per address, so two wardens in one body
//  must ask for it by two addresses.
it("gives two wardens in one body an address each for the same file", () => {
    const first = createWardenBody(0);
    const third = createWardenBody(2);

    expect(third.model).not.toBe(first.model);
    expect(third.model.split("#")[0]).toBe(first.model.split("#")[0]);
});
