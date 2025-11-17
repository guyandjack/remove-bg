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
import axios from "axios";

//import des composants enfants
import { DownloadLink } from "@/components/link/DownloadLink";

//import des functions
import composeBackground from "@/utils/composeBackground"; // compose le sujet + le fond (canvas)
import { localOrProd } from "@/utils/localOrProd";

//import des images basiques d' arrire plan
import BgHero from "@/assets/images/hero-img.jpg";
import BgDessert from "@/assets/images/dessert.jpg";
import BgFriend from "@/assets/images/friend.jpg";
import BgSport from "@/assets/images/sport.jpg";

// URLs construites selon l’environnement (local/prod)
const { urlApi } = localOrProd();

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

// Retourne une configuration Filerobot selon le plan
function getConfigForPlan(plan: ImgEditorProps["planUser"], TABS: any, TOOLS: any) {
  switch (plan) {
    case "free":
      return {
        tabsIds: [TABS.ADJUST, TABS.RESIZE],
        //defaultTabId: TABS.ADJUST,
        //defaultToolId: TOOLS.CROP,
        removeSaveButton: true,
        
      };
    case "hobby":
      return {
        tabsIds: [TABS.ADJUST, TABS.ANNOTATE, TABS.RESIZE, TABS.FILTER],
        //defaultTabId: TABS.ADJUST,
       //defaultToolId: TOOLS.RESIZE,
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
        //defaultTabId: TABS.ADJUST,
        //defaultToolId: TOOLS.FINETUNE,
        finetune: { brightness: true, contrast: true, replaceColor: true },
        removeSaveButton: true,
      };
  }
}



// Miniatures locales (fallback si aucune recherche Pexels)
const backgroundImages = [BgHero, BgDessert, BgFriend, BgSport];

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
  const [selectedBg, setSelectedBg] = useState<
    { type: "color"; value: string } | { type: "image"; value: string } | null
  >(null); // dernier fond choisi
  const [activePicker, setActivePicker] = useState<"color" | "image">("color"); // onglet actif
  const [isPending, setIsPending] = useState(false);

  // Etats de recherche Pexels
  const [searchTerm, setSearchTerm] = useState(""); // terme saisi
  const [pexelsImages, setPexelsImages] = useState<PexelsImage[]>([]); // résultats (tiny + large)
  const [isSearching, setIsSearching] = useState(false); // spinner requête
  const [searchError, setSearchError] = useState(""); // message d’erreur

  // Récupère des images de fond via le backend (Pexels)
  const fetchImages = async (theme: string) => {
    const language = document.documentElement.lang;
    const value = theme.trim();
    if (value.length < 2) return; // évite les requêtes trop courtes
    try {
      setIsSearching(true);
      setSearchError("");
      const response = await axios.get(
        `${urlApi}/api/pexels/images/?theme=${encodeURIComponent(value)}&lang=${encodeURIComponent(language)}`,
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
  }, []);

  // 2) Changement de sujet (src): réinitialise l’éditeur et les sélections
  useEffect(() => {
    baseSubject.current = src;
    setCurrentSource(src);
    setSelectedBg(null);
    setPexelsImages([]);
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
    <div className="w-full">
      {/* Zone éditeur Filerobot */}
      <div
        style={{ width: "100%", height: "80vh" }}
        className="relative rounded-xl ring-1 ring-base-200 bg-base-100/60 backdrop-blur-sm"
      >
        {isComposing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-base-100/50">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        )}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* Commandes: onglets, reset, téléchargement */}
      <h2 className={"mt-[10px] text-xl"}>Ajouter un nouveau fond à votre image</h2>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="join">
          <button
            type="button"
            className={`btn join-item ${
              activePicker === "color" ? "btn-primary" : "btn-ghost"
            }`}
            onClick={() => setActivePicker("color")}
          >
            Couleurs
          </button>
          <button
            type="button"
            className={`btn join-item ${
              activePicker === "image" ? "btn-info" : "btn-ghost"
            }`}
            onClick={() => setActivePicker("image")}
          >
            Images
          </button>
        </div>

        <button type="button" className="btn" onClick={resetBackground}>
          Annuler le fond
        </button>

        <DownloadLink currentSource={currentSource} credit={credit} />
      </div>

      {/* Panneau Couleurs */}
      {activePicker === "color" ? (
        <div className="mt-3">
          <div className="label p-0 mb-2">
            <span className="label-text text-base-content/70">
              Couleurs unies
            </span>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-2 pb-2 snap-x snap-mandatory">
              {planColor[planUser].map((c) => (
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
        // Panneau Images (recherche Pexels + vignettes)
        <div className="mt-3">
          <div className="label p-0 mb-2">
            <span className="label-text text-base-content/70">
              Images de fond "PEXELS" gratuite et libre de droit.
            </span>
          </div>

          {/* Barre de recherche */}
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
                placeholder="Rechercher des images en ligne(ex: nature, city, people, animals...)"
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
          <div className="overflow-x-auto">
            <div className="flex gap-3 pb-2 snap-x snap-mandatory">
              {(pexelsImages.length > 0 ? pexelsImages : backgroundImages).map(
                (item: any) => {
                  const thumb = typeof item === "string" ? item : item.tiny;
                  const large = typeof item === "string" ? item : item.large;
                  return (
                    <button
                      key={thumb}
                      type="button"
                      onClick={() =>
                        applyBackground({ type: "image", value: large })
                      }
                      className={`overflow-hidden rounded-lg ring-1 ring-base-200 hover:ring-primary transition snap-start ${
                        selectedBg?.type === "image" &&
                        selectedBg.value === large
                          ? "ring-2 ring-primary"
                          : ""
                      } ${isSearching ? "opacity-60" : ""}`}
                      style={{ minWidth: "6rem" }}
                      disabled={isSearching}
                    >
                      <img
                        src={thumb}
                        alt="Fond"
                        className="h-20 w-full object-cover"
                      />
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { ImgEditor };
