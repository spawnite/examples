/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { lygia, roomsContentPolicy } from "@spawnite/engine/vite";
import { watchModels } from "@spawnite/cli/models";

export default defineConfig({
    //  Relative, so one build serves at the site's root or under a path.
    base: "./",
    plugins: [
        react(),
        tailwindcss(),
        lygia(),
        watchModels(),
        roomsContentPolicy(process.env.ROOMS_DOMAIN),
    ],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["test/setup.ts"],
        include: ["test/**/*.test.{ts,tsx}"],
        //  Through Vite rather than Node: Node cannot load the stylesheets
        //  the devtools' bundle imports, and a test's mock of drei reaches
        //  the engine's own model loads only through Vite.
        server: {
            deps: {
                inline: ["@spawnite/devtools", "@spawnite/engine"],
            },
        },
    },
});
