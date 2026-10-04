import { Devtools, type DevtoolsPanel } from "@spawnite/devtools";

//  Loaded only in development, through the lazy import in app.tsx, so a
//  production build never reaches this module or the devtools behind it.

//  Where `spawnite add panel` has a panel's entry pasted.
const panels: DevtoolsPanel[] = [];

export default function ExampleDevtools() {
    return <Devtools panels={panels} />;
}
