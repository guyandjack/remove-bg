
import { render } from "preact";
import { App } from "./app";
import "./src/translate/function/i18next";
import { MotionProvider } from "./src/providers/MotionProvider";



render(
  <MotionProvider>
    <App />
  </MotionProvider>,
  document.getElementById("root") as HTMLElement
);
