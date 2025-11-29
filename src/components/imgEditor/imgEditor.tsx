// ImgEditor.tsx
//
// Rôle du composant:
// - Afficher l’éditeur Filerobot pour une image sujet (sans fond) fournie par l’API.
// - Proposer deux sélecteurs d’arrière‑plan (onglets): couleurs unies et images.
// - Rechercher des images via l’API backend (Pexels) et les faire défiler horizontalement.
// - Appliquer immédiatement le fond choisi dans l’éditeur (pas de preview séparée).
// - Permettre de revenir à l’image d’origine (sans fond) et de télécharger le résultat.

//import des hooks
import { useEffect, useRef, useState } from "preact/hooks";

//import des librairies
import { api } from "@/utils/axiosConfig";

//import des composants enfants
import { DownloadLink } from "@/components/link/DownloadLink";
import { ReactColorPicker } from "@/components/colorPicker/reactColorPicker";

//import des functions
import composeBackground from "@/utils/composeBackground"; // compose le sujet + le fond (canvas)

//import des images basiques d' arrire plan
import BgHero from "@/assets/images/hero-img.jpg";
import BgDessert from "@/assets/images/dessert.jpg";
import BgFriend from "@/assets/images/friend.jpg";
import BgSport from "@/assets/images/sport.jpg";

//import des data
import { planColor } from "@/data/content/components/editor/planColor";

//declaration des types
// Types auxiliaires
type PexelsImage = { tiny: string; large: string };

// Props du composant ImgEditor
type ImgEditorProps = {
  // src: image sans fond (dataURL/URL) retournée par votre API remove‑bg
  src: string;
  // plan: configuration Filerobot (onglets/outils)
  planUser: string;

  credit: number;
};

type Bg = { type: "color"; value: string } | { type: "image"; value: string };

type BgValue = Bg | null;

// Retourne une configuration Filerobot selon le plan
function getConfigForPlan(
  plan: ImgEditorProps["planUser"],
  TABS: any,
  TOOLS: any
) {
  switch (plan) {
    case "free":
      return {
        tabsIds: [TABS.RESIZE],
        defaultTabId: TABS.RESIZE,
        //defaultToolId: TOOLS.RESIZE,
        removeSaveButton: true,
      };
    case "hobby":
      return {
        tabsIds: [TABS.ADJUST, TABS.RESIZE, TABS.FILTERS],
        //defaultTabId: TABS.ADJUST,
        //defaultToolId: TOOLS.AJUST,
        finetune: { brightness: true, contrast: true, replaceColor: true },
        removeSaveButton: true,
      };
    case "pro":
      return {
        tabsIds: [],
        //defaultTabId: TABS.ADJUST,
        //defaultToolId: TOOLS.FINETUNE,
        finetune: { brightness: true, contrast: true, replaceColor: true },
        removeSaveButton: true,
      };
    default:
      return {
        tabsIds: [],
        defaultTabId: TABS.FINETUNE,
        defaultToolId: TOOLS.FINETUNE,
        finetune: { brightness: true, contrast: true, replaceColor: true },
        removeSaveButton: true,
      };
  }
}

// Miniatures locales (fallback si aucune recherche Pexels)
const backgroundImages = [BgHero, BgDessert, BgFriend, BgSport];
const MAX_PEXELS_PAGES = 5;

const ImgEditor = ({ src, planUser, credit }: ImgEditorProps) => {
  // Refs DOM/instances Filerobot
  const containerRef = useRef<HTMLDivElement | null>(null); // conteneur pour le canvas Filerobot
  const editorRef = useRef<any>(null); // instance Filerobot en cours
  const FIERef = useRef<any>(null); // constructeur Filerobot (window.FilerobotImageEditor)

  // Sujet (sans fond) — référence figée à l’image d’origine pour recomposer
  const baseSubject = useRef<string>(src);

  // Etats principaux
  const [currentSource, setCurrentSource] = useState<string>(src); // image actuellement affichée dans l’éditeur
  const [isComposing, setIsComposing] = useState(false); // spinner pendant la composition canvas
  const [selectedBg, setSelectedBg] = useState<BgValue>(null); // dernier fond choisi
  const [activePicker, setActivePicker] = useState<"color" | "image">("color"); // onglet actif
  const [isPending, setIsPending] = useState(false);
  const [isColorPicker, setIsColorPicker] = useState(false); // affichage du composant colorpicker

  // Etats de recherche Pexels
  const [searchTerm, setSearchTerm] = useState(""); // terme saisi
  const [pexelsImages, setPexelsImages] = useState<PexelsImage[]>([]); // résultats (tiny + large)
  const [isSearching, setIsSearching] = useState(false); // spinner requête
  const [searchError, setSearchError] = useState(""); // message d'erreur
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [lastSearchTerm, setLastSearchTerm] = useState("");

  const debounceTimer = useRef<number | null>(null);
  const lastChoice = useRef<Bg | null>(null);

  // Récupère des images de fond via le backend (Pexels)
  const fetchImages = async (theme: string, page = 1) => {
    const language = document.documentElement.lang;
    const value = theme.trim();
    if (value.length < 2) return; // évite les requêtes trop courtes
    const safePage = Math.max(1, Math.min(page, MAX_PEXELS_PAGES));
    try {
      setIsSearching(true);
      setSearchError("");
      const response = await api.get(
        `/api/pexels/images/?theme=${encodeURIComponent(
          value
        )}&lang=${encodeURIComponent(language)}&page=${safePage}`
        /* { headers: { "Content-Type": "application/json" }, timeout: 10000 } */
      );
      const data = response?.data || {};
      const photos = (data?.photos || []) as any[];
      const images: PexelsImage[] = photos
        .map((p) => ({
          tiny: p?.src?.tiny,
          large: p?.src?.large2x || p?.src?.large || p?.src?.original,
        }))
        .filter((i) => i.tiny && i.large);
      setPexelsImages(images);
      setLastSearchTerm(value);
      setCurrentPage(safePage);
      setHasNextPage(Boolean(data?.next_page) && safePage < MAX_PEXELS_PAGES);
      setHasPrevPage(safePage > 1);
    } catch (error: any) {
      console.log("error fetch images:", error?.message || error);
      setSearchError("Erreur lors de la recherche d'images.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleChangePage = (direction: "next" | "prev") => {
    if (!lastSearchTerm) return;
    if (direction === "next" && hasNextPage) {
      fetchImages(lastSearchTerm, currentPage + 1);
    }
    if (direction === "prev" && hasPrevPage) {
      fetchImages(lastSearchTerm, currentPage - 1);
    }
  };

  //recupere et applique la derniere couleur choisi.
  const setLastPikerColor = (value: string) => {
    // construit la bonne structure Bg
    lastChoice.current = { type: "color", value };

    // annule un ancien timer
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
    }

    // applique après 500 ms
    debounceTimer.current = window.setTimeout(() => {
      if (!lastChoice.current) return;
      applyBackground(lastChoice.current);
    }, 500);
  };

  // 1) Montage: bloque le clic droit et instancie Filerobot sur currentSource
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

    return () => {
      document.removeEventListener("contextmenu", blockContext);
      editorRef.current?.terminate?.();
    };
  }, [planUser]);

  // 2) Changement de sujet (src): réinitialise l’éditeur et les sélections
  useEffect(() => {
    baseSubject.current = src;
    setCurrentSource(src);
    setSelectedBg(null);
    setPexelsImages([]);
    setCurrentPage(1);
    setHasNextPage(false);
    setHasPrevPage(false);
    setLastSearchTerm("");
    if (FIERef.current && containerRef.current) {
      renderEditor(src);
    }
  }, [src]);

  // Monte ou remonte Filerobot pour afficher/éditer `source`
  const renderEditor = (source: string) => {
    const FIE = FIERef.current;
    if (!FIE || !containerRef.current) return;
    editorRef.current?.terminate?.(); // nettoie l’ancienne instance
    const { TABS, TOOLS } = FIE;
    const baseConfig = {
      source,
      onSave: (result: any) => {
        // met à jour la source avec la version sauvegardée par Filerobot
        if (result?.imageBase64) setCurrentSource(result.imageBase64);
      },
    };
    const planConfig = getConfigForPlan(planUser, TABS, TOOLS);
    const config = { ...baseConfig, ...planConfig };
    const editor = new FIE(containerRef.current, config);
    editorRef.current = editor;
    editor.render({ onClose: () => editor.terminate() });
  };

  // Compose et applique directement le fond choisi (couleur ou image)
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

  // Restaure l’image d’origine (sans fond) issue de l’API
  const resetBackground = () => {
    setSelectedBg(null);
    setCurrentSource(baseSubject.current);
    renderEditor(baseSubject.current);
  };

  return (
    <div className="max-w-[1800px] mx-auto min-h-[80vh] flex flex-col justify-between items-center gap-3 lg:flex-row lg:h-[80vh]">
      {/* Zone éditeur Filerobot */}
      <div className="relative w-full h-full rounded-xl ring-1 ring-base-200 bg-base-100/60 backdrop-blur-sm lg:w-[calc(100%-350px)]">
        {isComposing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-base-100/50">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        )}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>

      <div
        className={
          "bg-component rounded-lg w-full flex flex-col justifi-start items-center lg:w-[350px] lg:h-[100%] p-[10px]"
        }
      >
        {/* Commandes: onglets, reset, téléchargement */}
        <div
          className={"lg:h-[20%] lg:w-full lg:w-full "}
        >
          <h2 className={"mt-[10px] text-xl text-center"}>
            Ajouter un nouveau fond à votre image
          </h2>
          <div className="my-4 flex flex-row justify-evenly flex-wrap items-center gap-2">
            <button
              type="button"
              className={`flex flex-row gap-3 p-[5px] btn ${
                activePicker === "color" ? "btn-success" : "btn-ghost"
              } hover:bg-success/50`}
              onClick={() => {
                setActivePicker("color");
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z"
                />
              </svg>
              <span>color picker</span>
            </button>
            {planUser !== "free" ? (
              <button
                type="button"
                className={`btn  ${
                  activePicker === "image" ? "btn-info" : "btn-ghost"
                } hover:bg-info/50`}
                onClick={() => setActivePicker("image")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  />
                </svg>
                <span>Images</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Panneau Couleurs */}
        {activePicker === "color" ? (
          <div className="lg:h-full lg:max-h-[65%] lg:w-full ">
            <div
              className={
                "flex flex-row flex-wrap justify-evenly w-full lg:flex-col lg:items-start gap-5"
              }
            >
              <div className="min-h-[400px] w-auto lg:w-full">
                <ReactColorPicker
                  setColorValue={setSelectedBg}
                  setLastChoice={setLastPikerColor}
                />
              </div>
            </div>
          </div>
        ) : planUser !== "free" ? (
          // Panneau Images (recherche Pexels + vignettes)
          <div className="mt-3 lg:h-full lg:max-h-[65%] lg:w-full ">
            <p className="text-start text-base-content/70 mb-[10px]">
              Recherche d'images "PEXELS".
            </p>

            {/* Barre de recherche */}
            <div className="mb-3">
              <form
                className="join w-full lg:w-full"
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchImages(searchTerm, 1);
                }}
              >
                <input
                  id="search"
                  type="search"
                  placeholder="Images en ligne(ex: nature, city, people, animals...)"
                  className="input input-bordered join-item w-full bg-base-200 text-base-content placeholder:text-base-content/60"
                  pattern="[A-Za-z0-9 \-_'.,]{1,50}"
                  aria-label="Search through pexels images library"
                  maxLength={50}
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm((e.target as HTMLInputElement).value)
                  }
                />
                <button
                  type="submit"
                  className="btn btn-info join-item"
                  disabled={isSearching}
                >
                  {isSearching ? "..." : "Search"}
                </button>
              </form>
              {searchError && (
                <p className="mt-2 text-sm text-error">{searchError}</p>
              )}
            </div>

            {/* Carrousel horizontal de vignettes */}

            <div className="my-4 text-start text-base-content/70 mb-[10px] flex flex-col gap-2">
              <span>Images libre de droit.</span>
              <div className="flex items-center justify-center gap-5">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={!lastSearchTerm || !hasPrevPage || isSearching}
                  onClick={() => handleChangePage("prev")}
                >
                  Prev
                </button>
                <span className="text-sm">
                  {lastSearchTerm
                    ? `Page ${currentPage}/${MAX_PEXELS_PAGES}`
                    : "Page -"}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={!lastSearchTerm || !hasNextPage || isSearching}
                  onClick={() => handleChangePage("next")}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="">
              <ul className="w-[80%] flex gap-3 pb-2 overflow-auto flex-wrap lg:w-full lg:max-h-[300px]">
                {(pexelsImages.length > 0
                  ? pexelsImages
                  : backgroundImages
                ).map((item: any) => {
                  const thumb = typeof item === "string" ? item : item.tiny;
                  const large = typeof item === "string" ? item : item.large;
                  return (
                    <li>
                      <button
                        key={thumb}
                        type="button"
                        onClick={() =>
                          applyBackground({ type: "image", value: large })
                        }
                        className={`cursor-pointer overflow-hidden rounded-lg ring-1 ring-base-200 hover:ring-primary transition snap-start ${
                          selectedBg?.type === "image" &&
                          selectedBg.value === large
                            ? "ring-2 ring-primary"
                            : ""
                        } ${isSearching ? "opacity-60" : ""} `}
                        disabled={isSearching}
                      >
                        <img
                          src={thumb}
                          alt="Fond"
                          className="h-[80px] w-[80px] object-cover"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : null}
        <div className={"lg:w-full h-[15%]"}>
          <div className={"my-3"}>
            <DownloadLink currentSource={currentSource} credit={credit} />
          </div>
          <button
            type="button"
            className="btn btn-warning"
            onClick={resetBackground}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
              />
            </svg>
            <span>Annuler le fond</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export { ImgEditor };
