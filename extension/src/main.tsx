import { render } from "preact";
import { App } from "./App";

const root = document.getElementById("app");
if (!root) throw new Error("Hackdrop: #app element not found in document");

render(<App />, root);
