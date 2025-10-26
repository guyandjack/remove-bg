
import { render } from "preact";
import { App } from "./app";
import "./src/translate/function/i18next";



render(<App />, document.getElementById("root") as HTMLElement);
