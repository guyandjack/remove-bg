
import { render } from "preact";
import { App } from "./app";
import "./src/translate/function/i18next";
import { MotionProvider } from "./src/providers/MotionProvider";
import { HelmetProvider } from "react-helmet-async";



render(
  <MotionProvider>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </MotionProvider>,
  document.getElementById("root") as HTMLElement
);
