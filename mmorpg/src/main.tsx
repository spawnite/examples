import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { openingModels } from "@spawnite/engine";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import { avatars, heroAvatarId } from "./avatars";

//  Lazily, so the game and the libraries it draws with land in a second
//  chunk, and the preloads below start while that chunk downloads. The
//  engine's Game draws the loading screen once it arrives.
const App = lazy(async () => ({ default: (await import("./app/App")).App }));

const container = document.getElementById("root");
if (!container) throw new Error("index.html has no #root");

createRoot(container).render(
    <StrictMode>
        <AppErrorBoundary>
            <Suspense>
                <App />
            </Suspense>
        </AppErrorBoundary>
    </StrictMode>,
);

//  Here rather than in the drei calls, which ride in the chunk above and so
//  start a download later than the files can. The attribute pair is the
//  request three's file loader makes, CORS with same-origin credentials, so
//  the loader takes what landed instead of fetching it again.
for (const model of [avatars[heroAvatarId].model, ...openingModels]) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "fetch";
    link.crossOrigin = "anonymous";
    link.href = model;
    document.head.append(link);
}
