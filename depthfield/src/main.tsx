import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import App from "./app/app";

//  A hot update that reaches this module runs it again, so it renders into
//  the root it made the first time: a second root on the same element
//  would fight the first for its children.
const root: ReactDOM.Root =
    import.meta.hot?.data.root ??
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
if (import.meta.hot) import.meta.hot.data.root = root;

root.render(
    <StrictMode>
        <App />
    </StrictMode>,
);
