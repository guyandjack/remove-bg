import { hydrate } from "preact-iso";
import { prerender as ssr } from "preact-iso";
import { App } from "./app";
import "./src/translate/function/i18next";
import { MotionProvider } from "./src/providers/MotionProvider";
import { HelmetProvider } from "react-helmet-async";

const Root = () => (
  <MotionProvider>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </MotionProvider>
);

if (typeof window !== "undefined") {
  hydrate(<Root />, document.getElementById("root") as HTMLElement);
}

export async function prerender(data: any) {
  return await ssr(<Root {...data} />);
}