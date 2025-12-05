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
import { AnimatePresence, LazyMotion, domAnimation } from "motion/react";
import * as m from "motion/react-m";

//import des librairies
import { api } from "@/utils/axiosConfig";

//import des composants enfants
import { DownloadLink } from "@/components/link/DownloadLink";
import { ReactColorPicker } from "@/components/colorPicker/reactColorPicker";

//import des functions
// compose le sujet + le fond (canvas)
import composeBackground from "@/utils/composeBackground";

// compose le sujet + le fond (canvas)
import { getConfigForPlan } from "@/utils/fileRobotImageEditor/getConfigForPlan";

//import des images basiques d' arrire plan
import BgHero from "@/assets/images/hero-img.jpg";
import BgDessert from "@/assets/images/dessert.jpg";
import BgFriend from "@/assets/images/friend.jpg";
import BgSport from "@/assets/images/sport.jpg";

//import des data
import { socialImgPreset } from "@/data/content/components/editor/socialImgPreset";


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
  const [activePicker, setActivePicker] = useState<"color" | "image" | "erase" | "social">("color"); // onglet actif
  const [isPending, setIsPending] = useState(false);
  const [isColorPicker, setIsColorPicker] = useState(false); // affichage du composant colorpicker
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewSelection, setPreviewSelection] = useState<BgValue>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isEraserVisible, setIsEraserVisible] = useState(false);
  const [eraserBrushSize, setEraserBrushSize] = useState(40);
  const [eraserMaskData, setEraserMaskData] = useState<string | null>(null);
  const [eraserResult, setEraserResult] = useState<string | null>(null);
  const [isSendingEraser, setIsSendingEraser] = useState(false);
  const [eraserError, setEraserError] = useState("");

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
  const previewRequestId = useRef(0);
  const eraserCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const eraserImageRef = useRef<HTMLImageElement | null>(null);
  const eraserCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const eraserIsDrawingRef = useRef(false);
  const eraserLastPointRef = useRef<{ x: number; y: number } | null>(null);

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
      previewBackground(lastChoice.current);
      debounceTimer.current = null;
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

  useEffect(() => {
    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (eraserCtxRef.current) {
      eraserCtxRef.current.lineWidth = eraserBrushSize;
    }
  }, [eraserBrushSize]);

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

  const hidePreviewWindow = () => {
    previewRequestId.current += 1;
    setIsPreviewVisible(false);
    setPreviewSelection(null);
    setPreviewImage(null);
    setIsPreviewLoading(false);
  };

  const previewBackground = async (bg: Bg) => {
    setPreviewSelection(bg);
    setIsPreviewVisible(true);
    setIsPreviewLoading(true);
    setPreviewImage(null);
    previewRequestId.current += 1;
    const requestId = previewRequestId.current;
    try {
      const subject = baseSubject.current || currentSource;
      const composed = await composeBackground(subject, bg);
      if (previewRequestId.current === requestId) {
        setPreviewImage(composed);
      }
    } catch (error) {
      if (previewRequestId.current === requestId) {
        setPreviewImage(null);
      }
      console.error("Erreur preview background", error);
    } finally {
      if (previewRequestId.current === requestId) {
        setIsPreviewLoading(false);
      }
    }
  };

  const handleConfirmPreview = async () => {
    if (!previewSelection || isPreviewLoading) return;
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    lastChoice.current = null;
    await applyBackground(previewSelection, previewImage);
    hidePreviewWindow();
  };

  const handleCancelPreview = () => {
    lastChoice.current = null;
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    hidePreviewWindow();
  };

  const initializeEraserCanvas = () => {
    const img = eraserImageRef.current;
    const canvas = eraserCanvasRef.current;
    if (!img || !canvas) return;
    const { width, height } = img.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(59,130,246,0.2)";
    ctx.fillStyle = "rgba(59,130,246,0.2)";
    ctx.lineWidth = eraserBrushSize;
    eraserCtxRef.current = ctx;
  };

  const resetEraserSurface = () => {
    setEraserMaskData(null);
    setEraserResult(null);
    setEraserError("");
    eraserIsDrawingRef.current = false;
    eraserLastPointRef.current = null;
    const canvas = eraserCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
      }
    }
    requestAnimationFrame(() => initializeEraserCanvas());
  };

  const openMagicEraser = () => {
    if (isPreviewVisible) {
      hidePreviewWindow();
    }
    setActivePicker("erase");
    setIsEraserVisible(true);
    setIsSendingEraser(false);
    resetEraserSurface();
  };

  const closeMagicEraser = () => {
    resetEraserSurface();
    setIsEraserVisible(false);
    setIsSendingEraser(false);
    setActivePicker("color");
  };

  const getPointerPosition = (event: PointerEvent) => {
    const canvas = eraserCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const drawOnMask = (point: { x: number; y: number }) => {
    const ctx = eraserCtxRef.current;
    if (!ctx) return;
    const lastPoint = eraserLastPointRef.current;
    ctx.beginPath();
    if (lastPoint) {
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    } else {
      ctx.arc(point.x, point.y, eraserBrushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    eraserLastPointRef.current = point;
  };

  const updateMaskSnapshot = () => {
    const canvas = eraserCanvasRef.current;
    if (!canvas) return;
    setEraserMaskData(canvas.toDataURL("image/png"));
  };

  const handleEraserPointerDown = (event: PointerEvent) => {
    if (!isEraserVisible) return;
    const canvas = eraserCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(event.pointerId);
    eraserIsDrawingRef.current = true;
    const point = getPointerPosition(event);
    if (!point) return;
    eraserLastPointRef.current = null;
    drawOnMask(point);
    event.preventDefault();
  };

  const handleEraserPointerMove = (event: PointerEvent) => {
    if (!eraserIsDrawingRef.current) return;
    const point = getPointerPosition(event);
    if (!point) return;
    drawOnMask(point);
    event.preventDefault();
  };

  const stopEraserDrawing = (event?: PointerEvent) => {
    if (!eraserIsDrawingRef.current) return;
    const canvas = eraserCanvasRef.current;
    if (canvas && event) {
      canvas.releasePointerCapture?.(event.pointerId);
    }
    eraserIsDrawingRef.current = false;
    eraserLastPointRef.current = null;
    updateMaskSnapshot();
  };

  const sendMagicEraseRequest = async () => {
    if (!eraserMaskData) {
      setEraserError(
        "Dessinez une zone à effacer avant de valider l'empreinte."
      );
      return;
    }
    try {
      setIsSendingEraser(true);
      setEraserError("");
      const response = await api.post("/api/magic-eraser", {
        image: currentSource,
        mask: eraserMaskData,
      });
      const newImage =
        response?.data?.imageBase64 ||
        response?.data?.result ||
        response?.data?.image;
      if (!newImage) {
        throw new Error("Réponse du serveur invalide.");
      }
      setEraserResult(newImage);
    } catch (error: any) {
      console.error("Erreur magic erase", error);
      setEraserError(
        error?.response?.data?.message ||
          error?.message ||
          "Impossible d'effacer cette zone. Veuillez réessayer."
      );
    } finally {
      setIsSendingEraser(false);
    }
  };

  const handleConfirmMagicResult = () => {
    if (!eraserResult) return;
    setCurrentSource(eraserResult);
    baseSubject.current = eraserResult;
    renderEditor(eraserResult);
    closeMagicEraser();
  };

  // Compose et applique directement le fond choisi (couleur ou image)
  const applyBackground = async (
    bg: Bg,
    composedOverride?: string | null
  ) => {
    try {
      setIsComposing(true);
      setSelectedBg(bg);
      let composedResult: string;
      if (composedOverride) {
        composedResult = composedOverride;
      } else {
        const subject = baseSubject.current || currentSource;
        composedResult = await composeBackground(subject, bg);
      }
      setCurrentSource(composedResult);
      renderEditor(composedResult);
      return composedResult;
    } catch (e) {
      console.error("Erreur composition background", e);
    } finally {
      setIsComposing(false);
    }
  };

  // Restaure l'image d'origine (sans fond) issue de l'API
  const resetBackground = () => {
    handleCancelPreview();
    setSelectedBg(null);
    setCurrentSource(baseSubject.current);
    renderEditor(baseSubject.current);
  };

  const activeBackground =
    isPreviewVisible && previewSelection ? previewSelection : selectedBg;

  const renderActiveOptionContent = (activePiker) => {
    if (activePicker === "color") {
      return (
        <div
          className={
            "flex flex-row flex-wrap justify-evenly w-full lg:flex-col lg:items-start gap-5"
          }
        >
          <div className="min-h-[400px] w-auto lg:w-full">
            <ReactColorPicker setLastChoice={setLastPikerColor} />
          </div>
        </div>
      );
    }

    if (activePicker === "image") {
      if (planUser === "free") {
        return (
          <p className="mt-4 text-sm text-warning">
            Cette option est réservée aux abonnements supérieurs.
          </p>
        );
      }
      return (
        <div className="mt-3 lg:max-h-[65%] lg:w-full ">
          <p className="text-start text-base-content/70 mb-[10px]">
            Recherche d'images "PEXELS".
          </p>

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
                pattern="[A-Za-z0-9 \\-_'.,]{1,50}"
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

          <div>
            <ul className="w-[80%] flex gap-3 pb-2 overflow-auto flex-wrap lg:w-full lg:max-h-[300px]">
              {(pexelsImages.length > 0 ? pexelsImages : backgroundImages).map(
                (item: any) => {
                  const thumb = typeof item === "string" ? item : item.tiny;
                  const large = typeof item === "string" ? item : item.large;
                  const isActiveBg =
                    activeBackground?.type === "image" &&
                    activeBackground.value === large;
                  return (
                    <li key={thumb}>
                      <button
                        type="button"
                        onClick={() =>
                          previewBackground({ type: "image", value: large })
                        }
                        className={`cursor-pointer overflow-hidden rounded-lg ring-1 ring-base-200 hover:ring-primary transition snap-start ${
                          isActiveBg ? "ring-2 ring-primary" : ""
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
                }
              )}
            </ul>
          </div>
        </div>
      );
    }

    if (activePicker === "erase") {
      return (
        <div className="space-y-4 text-start">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Gomme magique</h3>
            <p className="text-sm text-base-content/70">
              Ajustez la taille du pinceau puis dessinez directement sur
              l'aperçu pour marquer les zones à effacer.
            </p>
          </div>
          <label className="flex flex-col gap-2 text-sm">
            Taille du pinceau :
            <span className="text-base font-semibold">
              {Math.round(eraserBrushSize)} px
            </span>
            <input
              type="range"
              min={10}
              max={200}
              step={5}
              value={eraserBrushSize}
              onInput={(event) =>
                setEraserBrushSize(
                  Number((event.target as HTMLInputElement).value)
                )
              }
              onChange={(event) =>
                setEraserBrushSize(
                  Number((event.target as HTMLInputElement).value)
                )
              }
            />
          </label>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="max-w-[1300px] mx-auto min-h-[80vh] flex flex-col justify-between items-center gap-3 lg:flex-row lg:h-[80vh]">
      {/* Zone éditeur Filerobot */}
      <div className="relative w-full h-full rounded-xl ring-1 ring-base-200 bg-base-100/60 backdrop-blur-sm lg:w-[calc(100%-400px)]">
        {isComposing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-base-100/50">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        )}
        <LazyMotion features={domAnimation}>
          <AnimatePresence>
            {isPreviewVisible && (
              <m.div
                key="background-preview"
                className="absolute inset-0 z-20 flex items-center justify-center bg-base-200/80 backdrop-blur-md p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <m.div
                  className="w-full max-w-3xl rounded-2xl bg-base-100/95 p-6 shadow-2xl space-y-5"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">
                      Prévisualisation du fond
                    </h3>
                    <p className="text-sm text-base-content/70">
                      Seule cette fenêtre applique le fond choisi. Validez pour
                      mettre à jour l'éditeur principal.
                    </p>
                  </div>
                  <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-base-200 bg-base-200/60">
                    {isPreviewLoading ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="loading loading-spinner loading-lg text-primary" />
                      </div>
                    ) : previewImage ? (
                      <m.img
                        src={previewImage}
                        alt="Aperçu du fond sélectionné"
                        className="h-full w-full object-contain"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-base-content/70">
                        <span>Impossible de générer un aperçu.</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() =>
                            previewSelection
                              ? previewBackground(previewSelection)
                              : null
                          }
                        >
                          Réessayer
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={handleCancelPreview}
                      disabled={isComposing}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleConfirmPreview}
                      disabled={
                        isPreviewLoading || !previewImage || isComposing
                      }
                    >
                      Valider ce fond
                    </button>
                  </div>
                </m.div>
              </m.div>
            )}
            {isEraserVisible && (
              <m.div
                key="magic-eraser"
                className="absolute inset-0 z-30 flex items-center justify-center bg-base-200/85 backdrop-blur-md p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <m.div
                  className="w-full max-w-3xl rounded-2xl bg-base-100/95 p-6 shadow-2xl space-y-5"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  {eraserResult ? (
                    <div className="space-y-4">
                      <p className="text-base-content/80">
                        Nouveau rendu généré. Vérifiez-le avant de l'appliquer à
                        l'éditeur.
                      </p>
                      <div className="relative w-full overflow-hidden rounded-2xl border border-base-200 bg-base-200/60">
                        <img
                          src={eraserResult}
                          alt="Résultat gomme magique"
                          className="w-full max-h-[70vh] object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-base-content/70">
                        Dessinez directement sur l'image pour marquer les zones
                        à effacer. Maintenez le clic pour créer votre masque.
                      </p>
                      <div className="relative w-full overflow-hidden rounded-2xl border border-base-200 bg-base-200/60">
                        <img
                          ref={eraserImageRef}
                          src={currentSource}
                          alt="Zone à retoucher"
                          className="w-full max-h-[70vh] object-contain"
                          onLoad={initializeEraserCanvas}
                        />
                        <canvas
                          ref={eraserCanvasRef}
                          className="absolute inset-0"
                          style={{ touchAction: "none", cursor: "crosshair" }}
                          onPointerDown={handleEraserPointerDown}
                          onPointerMove={handleEraserPointerMove}
                          onPointerUp={stopEraserDrawing}
                          onPointerLeave={stopEraserDrawing}
                          onPointerCancel={stopEraserDrawing}
                        />
                      </div>
                    </div>
                  )}
                  {eraserError && (
                    <p className="text-sm text-error">{eraserError}</p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={resetEraserSurface}
                      disabled={isSendingEraser}
                    >
                      {eraserResult ? "Recommencer" : "Effacer l'empreinte"}
                    </button>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={closeMagicEraser}
                        disabled={isSendingEraser}
                      >
                        Annuler
                      </button>
                      {eraserResult ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleConfirmMagicResult}
                          disabled={isSendingEraser}
                        >
                          Appliquer à l'éditeur
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-warning"
                          onClick={sendMagicEraseRequest}
                          disabled={isSendingEraser || !eraserMaskData}
                        >
                          {isSendingEraser
                            ? "Traitement..."
                            : "Valider l'empreinte"}
                        </button>
                      )}
                    </div>
                  </div>
                </m.div>
              </m.div>
            )}
          </AnimatePresence>
        </LazyMotion>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>

      <div
        className={
          "bg-component rounded-lg w-full flex flex-col justify-between items-center lg:w-[400px] lg:h-[100%] p-[10px]"
        }
      >
        {/* Commandes: onglets, reset, téléchargement */}
        <div className={"lg:h-[25%] lg:w-full "}>
          <h2 className={"p-[5px] text-xl text-center "}>
            Outils de retouche
          </h2>
          <div className="my-4 border-b border-t py-[10px] border-white/30 flex flex-row justify-evenly flex-wrap items-center gap-y-2 ">
            <button
              type="button"
              className={`w-[180px] btn ${
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
              <span>Colors picker</span>
            </button>
            {planUser !== "free" ? (
              <>
                <button
                  type="button"
                  className={`w-[180px] btn  ${
                    activePicker === "image" ? "btn-success" : "btn-ghost"
                  } hover:bg-success/50`}
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
                  <span>Images select</span>
                </button>
                <button
                  type="button"
                  className={`w-[180px] btn  ${
                    activePicker === "erase" ? "btn-success" : "btn-ghost"
                  } hover:bg-success/50`}
                  onClick={openMagicEraser}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    className="lucide lucide-wand-icon lucide-wand"
                  >
                    <path d="M15 4V2" />
                    <path d="M15 16v-2" />
                    <path d="M8 9h2" />
                    <path d="M20 9h2" />
                    <path d="M17.8 11.8 19 13" />
                    <path d="M15 9h.01" />
                    <path d="M17.8 6.2 19 5" />
                    <path d="m3 21 9-9" />
                    <path d="M12.2 6.2 11 5" />
                  </svg>
                  <span>Magic eraser</span>
                </button>
                <button
                  type="button"
                  className={`w-[180px] btn  ${
                    activePicker === "social" ? "btn-success" : "btn-ghost"
                  } hover:bg-success/50`}
                  onClick={openMagicEraser}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    className="lucide lucide-wand-icon lucide-wand"
                  >
                    <path d="M15 4V2" />
                    <path d="M15 16v-2" />
                    <path d="M8 9h2" />
                    <path d="M20 9h2" />
                    <path d="M17.8 11.8 19 13" />
                    <path d="M15 9h.01" />
                    <path d="M17.8 6.2 19 5" />
                    <path d="m3 21 9-9" />
                    <path d="M12.2 6.2 11 5" />
                  </svg>
                  <span>Social content</span>
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div id="active-option" className="w-full lg:max-h-[65%] lg:w-full">
          {renderActiveOptionContent()}
        </div>
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
