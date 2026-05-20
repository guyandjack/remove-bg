import { hydrate } from "preact-iso";
import { prerender as ssr } from "preact-iso";
import { App } from "./app";
import "./src/translate/function/i18next";
import { MotionProvider } from "./src/providers/MotionProvider";
import { HelmetProvider } from "react-helmet-async";
import type { HelmetServerState } from "react-helmet-async";

type PrerenderHeadElement = {
  type: string;
  props?: Record<string, string>;
  children?: string;
};

type HelmetContext = {
  helmet?: HelmetServerState;
};

function extractTextFromChildren(children: unknown): string {
  if (children == null) return "";
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join("");
  }
  return "";
}

function toPrerenderHeadElement(node: any): PrerenderHeadElement | null {
  if (!node || typeof node !== "object") return null;
  const type = node.type;
  if (typeof type !== "string") return null;

  const rawProps: Record<string, unknown> = (node.props as any) ?? {};
  const props: Record<string, string> = {};

  for (const key of Object.keys(rawProps)) {
    if (key === "children") continue;
    const value = rawProps[key];
    if (value == null) continue;
    if (typeof value === "boolean") {
      if (value) props[key] = "true";
      continue;
    }
    props[key] = String(value);
  }

  const children = extractTextFromChildren(rawProps.children);

  return {
    type,
    props: Object.keys(props).length ? props : undefined,
    children: children ? children : undefined,
  };
}

function helmetToPrerenderHead(helmet: HelmetServerState | undefined) {
  const elements = new Set<PrerenderHeadElement>();

  if (helmet) {
    const buckets: any[][] = [
      helmet.base?.toComponent?.() ?? [],
      helmet.meta?.toComponent?.() ?? [],
      helmet.link?.toComponent?.() ?? [],
      helmet.script?.toComponent?.() ?? [],
    ];

    // Optional buckets - kept for completeness, but not required by the task.
    // They stay safe because we serialize only string-ish props/children.
    buckets.push(helmet.noscript?.toComponent?.() ?? []);
    buckets.push(helmet.style?.toComponent?.() ?? []);

    for (const list of buckets) {
      for (const vnode of list) {
        const element = toPrerenderHeadElement(vnode);
        if (element) elements.add(element);
      }
    }
  }

  const htmlAttributes = helmet?.htmlAttributes?.toComponent?.() as any;
  const lang =
    htmlAttributes && typeof htmlAttributes.lang === "string"
      ? htmlAttributes.lang
      : "";

  const titleNodes = helmet?.title?.toComponent?.() as any[] | undefined;
  const title =
    Array.isArray(titleNodes) && titleNodes.length
      ? extractTextFromChildren(titleNodes[0]?.props?.children)
      : "";

  return {
    lang,
    title,
    elements: elements.size ? elements : undefined,
  };
}

const Root = ({ helmetContext }: { helmetContext?: HelmetContext }) => (
  <MotionProvider>
    <HelmetProvider {...(helmetContext ? { context: helmetContext } : {})}>
      <App />
    </HelmetProvider>
  </MotionProvider>
);

if (typeof window !== "undefined") {
  hydrate(<Root />, document.getElementById("root") as HTMLElement);
}

export async function prerender(data: any) {
  const helmetContext: HelmetContext = {};
  const result = await ssr(<Root helmetContext={helmetContext} {...data} />);

  return {
    ...result,
    head: helmetToPrerenderHead(helmetContext.helmet),
  };
}
