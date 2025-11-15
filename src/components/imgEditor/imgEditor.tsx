// ImgEditor.tsx
//import des hooks
import { useEffect, useRef, useState } from "preact/hooks";

//import des librairies
import axios from "axios";

//import des composants enfants
import composeBackground from "@/utils/composeBackground";
import {Loader} from "@/components/loader/Loader";

import BgHero from "@/assets/images/hero-img.jpg";
import BgDessert from "@/assets/images/dessert.jpg";
import BgFriend from "@/assets/images/friend.jpg";
import BgSport from "@/assets/images/sport.jpg";
import { localOrProd } from "@/utils/localOrProd";

const { urlApi } = localOrProd();

type PexelsImage = { tiny: string; large: string };

type ImgEditorProps = {
  src: string;
  plan?: "free" | "hobby" | "pro" | "test";
};

function getConfigForPlan(plan: ImgEditorProps["plan"], TABS: any, TOOLS: any) {
  switch (plan) {
    case "free":
      return {
        tabsIds: [TABS.ADJUST, TABS.RESIZE],
        defaultTabId: TABS.ADJUST,
        defaultToolId: TOOLS.CROP,
        watermark: { text: "Helveclick", opacity: 0.8, url: "" },
      };
    case "hobby":
      return {
        tabsIds: [TABS.ADJUST, TABS.ANNOTATE, TABS.RESIZE, TABS.FILTER],
        defaultTabId: TABS.ADJUST,
        defaultToolId: TOOLS.RESIZE,
        watermark: { text: "" },
        finetune: { brightness: true, contrast: true, replaceColor: true },
      };
    case "pro":
      return {
        tabsIds: [],
        defaultTabId: TABS.ADJUST,
        defaultToolId: TOOLS.FINETUNE,
        finetune: { brightness: true, contrast: true, replaceColor: true },
      };
    default:
      return {
        tabsIds: [],
        defaultTabId: TABS.ADJUST,
        defaultToolId: TOOLS.FINETUNE,
        removeSaveButton: true,
        finetune: { brightness: true, contrast: true, replaceColor: true },
      };
  }
}

// Palette de couleurs (winter/night friendly)
const colorPalette = [
  "#000000",
  "#1f2937",
  "#4b5563",
  "#9ca3af",
  "#f3f4f6",
  "#ffffff",
  "#0c4a6e",
  "#1d4ed8",
  "#0ea5e9",
  "#38bdf8",
  "#bae6fd",
  "#064e3b",
  "#059669",
  "#22c55e",
  "#86efac",
  "#d1fae5",
  "#b45309",
  "#f59e0b",
  "#fbbf24",
  "#fcd34d",
  "#fef9c3",
  "#7f1d1d",
  "#dc2626",
  "#f43f5e",
  "#fb7185",
  "#ffe4e6",
  "#e0e7ff",
  "#ede9fe",
  "#fce7f3",
  "#ecfdf5",
  "#fef2f2",
];

const backgroundImages = [BgHero, BgDessert, BgFriend, BgSport];

const ImgEditor = ({ src, plan }: ImgEditorProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);
  const FIERef = useRef<any>(null);

  // Image d’origine (sans fond) provenant de l’API
  const baseSubject = useRef<string>(src);

  const [currentSource, setCurrentSource] = useState<string>(src);
  const [isComposing, setIsComposing] = useState(false);
  const [selectedBg, setSelectedBg] = useState<
    | { type: "color"; value: string }
    | { type: "image"; value: string }
    | null
  >(null);
  const [activePicker, setActivePicker] = useState<"color" | "image">("color");

  // Recherche Pexels
  const [searchTerm, setSearchTerm] = useState("");
  const [pexelsImages, setPexelsImages] = useState<PexelsImage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const fetchImages = async (theme: string) => {
    const value = theme.trim();
    const lang = document.documentElement.lang;
    if (value.length < 2) return;
    try {
      setIsSearching(true);
      setSearchError("");
      const response = await axios.get(
        `${urlApi}/api/pexels/images/?theme=${value}&lang=${lang}`,
        { headers: { "Content-Type": "application/json" }, timeout: 10000 }
      );
      const photos = (response?.data?.photos || []) as any[];
      const images: PexelsImage[] = photos
        .map((p) => ({
          tiny: p?.src?.tiny,
          large: p?.src?.large2x || p?.src?.large || p?.src?.original,
        }))
        .filter((i) => i.tiny && i.large);
      setPexelsImages(images);
    } catch (error: any) {
      console.log("error fetch images:", error?.message || error);
      setSearchError("Erreur lors de la recherche d’images.");
    } finally {
      setIsSearching(false);
    }
  };

  // Init Filerobot + protection clic droit
  useEffect(() => {
    const blockContext = (e: MouseEvent) => e.preventDefault();
    //document.addEventListener("contextmenu", blockContext);

    const FIE = (window as any).FilerobotImageEditor;
    if (!FIE || !containerRef.current) {
      console.warn("FilerobotImageEditor non disponible.");
      return () => document.removeEventListener("contextmenu", blockContext);
    }
    FIERef.current = FIE;
    renderEditor(currentSource);

    const rect = containerRef.current.getBoundingClientRect();
    const scroll = rect.top;
    window.scrollTo({top: scroll, behavior: "smooth"});

    return () => {
      document.removeEventListener("contextmenu", blockContext);
      editorRef.current?.terminate?.();
    };
  }, []);

  // Quand le src change (nouvelle image sans fond)
  useEffect(() => {
    baseSubject.current = src;
    setCurrentSource(src);
    setSelectedBg(null);
    setPexelsImages([]);
    if (FIERef.current && containerRef.current) {
      renderEditor(src);
    }
  }, [src]);

  const renderEditor = (source: string) => {
    const FIE = FIERef.current;
    if (!FIE || !containerRef.current) return;
    editorRef.current?.terminate?.();
    const { TABS, TOOLS } = FIE;
    const baseConfig = {
      source,
      onSave: (result: any) => {
        if (result?.imageBase64) setCurrentSource(result.imageBase64);
      },
    };
    const planConfig = getConfigForPlan(plan, TABS, TOOLS);
    const config = { ...baseConfig, ...planConfig };
    const editor = new FIE(containerRef.current, config);
    editorRef.current = editor;
    editor.render({ onClose: () => editor.terminate() });
  };

  const applyBackground = async (
    bg: { type: "color"; value: string } | { type: "image"; value: string }
  ) => {
    try {
      setIsComposing(true);
      setSelectedBg(bg);
      const subject = baseSubject.current || currentSource;
      const composed = await composeBackground(subject, bg);
      setCurrentSource(composed);
      renderEditor(composed);
    } catch (e) {
      console.error("Erreur composition background", e);
    } finally {
      setIsComposing(false);
    }
  };

  const resetBackground = () => {
    setSelectedBg(null);
    setCurrentSource(baseSubject.current);
    renderEditor(baseSubject.current);
  };

  return (
    <div className="w-full">
      <div
        style={{ width: "100%", height: "80vh" }}
        className="relative rounded-xl ring-1 ring-base-200 bg-base-100/60 backdrop-blur-sm"
      >
        {isComposing && (
          <Loader text="is composing..." />
        )}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="join">
          <button
            type="button"
            className={`btn join-item ${activePicker === "color" ? "btn-success" : "btn-ghost"}`}
            onClick={() => setActivePicker("color")}
          >
            Couleurs
          </button>
          <button
            type="button"
            className={`btn join-item ${activePicker === "image" ? "btn-info" : "btn-ghost"}`}
            onClick={() => setActivePicker("image")}
          >
            Images
          </button>
        </div>

        <button type="button" className="btn" onClick={resetBackground}>
          Annuler le fond
        </button>

        <a className="btn btn-outline" href={currentSource} download="image-composed.png">
          Télécharger
        </a>
      </div>

      {activePicker === "color" ? (
        <div className="mt-3">
          <div className="label p-0 mb-2">
            <span className="label-text text-base-content/70">Couleurs unies</span>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-2 pb-2 snap-x snap-mandatory">
              {colorPalette.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => applyBackground({ type: "color", value: c })}
                  className={`btn btn-circle btn-sm border-0 snap-start ${
                    selectedBg?.type === "color" && selectedBg.value === c
                      ? "ring ring-primary ring-offset-2 ring-offset-base-100"
                      : ""
                  }`}
                  style={{ backgroundColor: c, minWidth: "2.25rem" }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <div className="label p-0 mb-2">
            <span className="label-text text-base-content/70">Images de fond</span>
          </div>

          <div className="mb-3">
            <form
              className="join w-full lg:w-[600px]"
              onSubmit={(e) => {
                e.preventDefault();
                fetchImages(searchTerm);
              }}
            >
              <input
                id="search"
                type="search"
                placeholder="Rechercher des images (ex: nature, city, people, animals...)"
                className="input input-bordered join-item w-full bg-base-200 text-base-content placeholder:text-base-content/60"
                pattern="[A-Za-z0-9 \-_'.,]{1,50}"
                aria-label="Search through pexels images library"
                maxLength={50}
                value={searchTerm}
                onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
              />
              <button type="submit" className="btn btn-info join-item" disabled={isSearching}>
                {isSearching ? "..." : "Search"}
              </button>
            </form>
            {searchError && <p className="mt-2 text-sm text-error">{searchError}</p>}
          </div>

          <div className="overflow-x-auto">
            <div className="flex gap-3 pb-2 snap-x snap-mandatory">
              {(pexelsImages.length > 0 ? pexelsImages : backgroundImages).map((item: any) => {
                const thumb = typeof item === "string" ? item : item.tiny;
                const large = typeof item === "string" ? item : item.large;
                return (
                  <button
                    key={thumb}
                    type="button"
                    onClick={() => applyBackground({ type: "image", value: large })}
                    className={`overflow-hidden rounded-lg ring-1 ring-base-200 hover:ring-primary transition snap-start ${
                      selectedBg?.type === "image" && selectedBg.value === large
                        ? "ring-2 ring-primary"
                        : ""
                    } ${isSearching ? "opacity-60" : ""}`}
                    style={{ minWidth: "6rem" }}
                    disabled={isSearching}
                  >
                    <img src={thumb} alt="Fond" className="h-20 w-full object-cover" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { ImgEditor };

