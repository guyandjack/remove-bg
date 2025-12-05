import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { socialImgPreset } from "@/data/content/components/editor/socialImgPreset";
import { api } from "@/utils/axiosConfig";

type SocialPreset = (typeof socialImgPreset)[number];

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
  network?: SocialPreset["network"];
  category?: SocialPreset["category"];
  presetId?: SocialPreset["id"];
};

type SubmitStatus =
  | { state: "idle"; message?: string }
  | { state: "success"; message: string }
  | { state: "error"; message: string }
  | { state: "loading"; message: string };

const buildId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const displayLabel = (value = "") =>
  value.length <= 1
    ? value.toUpperCase()
    : value.charAt(0).toUpperCase() + value.slice(1);

const useGroupedPresets = () =>
  useMemo(() => {
    const networkSet = new Set<string>();
    const catByNetwork: Record<string, string[]> = {};
    const presetMap: Record<string, SocialPreset[]> = {};

    socialImgPreset.forEach((preset) => {
      networkSet.add(preset.network);

      if (!catByNetwork[preset.network]) {
        catByNetwork[preset.network] = [];
      }
      if (!catByNetwork[preset.network].includes(preset.category)) {
        catByNetwork[preset.network].push(preset.category);
      }

      const key = `${preset.network}-${preset.category}`;
      if (!presetMap[key]) {
        presetMap[key] = [];
      }

      presetMap[key].push(preset);
    });

    return {
      networks: Array.from(networkSet),
      catByNetwork,
      presetMap,
    };
  }, []);

const SocialPicture = () => {
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [status, setStatus] = useState<SubmitStatus>({ state: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const urlRegistry = useRef<Set<string>>(new Set());

  const { networks, catByNetwork, presetMap } = useGroupedPresets();

  useEffect(
    () => () => {
      urlRegistry.current.forEach((url) => URL.revokeObjectURL(url));
      urlRegistry.current.clear();
    },
    []
  );

  const addFiles = (files: FileList | null) => {
    if (!files || !files.length) return;

    const nextImages: SelectedImage[] = Array.from(files).map((file) => {
      const previewUrl = URL.createObjectURL(file);
      urlRegistry.current.add(previewUrl);
      return {
        id: buildId(),
        file,
        previewUrl,
      };
    });

    setImages((prev) => [...prev, ...nextImages]);
    setStatus({ state: "idle" });
    setErrors({});
  };

  const replaceFile = (imageId: string, file?: File | null) => {
    if (!file) return;
    setImages((prev) =>
      prev.map((item) => {
        if (item.id !== imageId) return item;
        URL.revokeObjectURL(item.previewUrl);
        urlRegistry.current.delete(item.previewUrl);
        const previewUrl = URL.createObjectURL(file);
        urlRegistry.current.add(previewUrl);
        return {
          ...item,
          file,
          previewUrl,
        };
      })
    );
  };

  const removeImage = (imageId: string) => {
    setImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === imageId);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
        urlRegistry.current.delete(imageToRemove.previewUrl);
      }

      return prev.filter((img) => img.id !== imageId);
    });
  };

  const clearAll = () => {
    urlRegistry.current.forEach((url) => URL.revokeObjectURL(url));
    urlRegistry.current.clear();
    setImages([]);
    setStatus({ state: "idle" });
    setErrors({});
  };

  const handleNetworkChange = (imageId: string, network: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? { ...img, network, category: undefined, presetId: undefined }
          : img
      )
    );
  };

  const handleCategoryChange = (imageId: string, category: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? { ...img, category, presetId: undefined }
          : img
      )
    );
  };

  const handlePresetChange = (imageId: string, presetId: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, presetId } : img))
    );
  };

  const validateSelection = () => {
    const nextErrors: Record<string, string> = {};
    images.forEach((img) => {
      if (!img.network) {
        nextErrors[img.id] = "Choisis un réseau social.";
      } else if (!img.category) {
        nextErrors[img.id] = "Choisis la catégorie associée.";
      } else if (!img.presetId) {
        nextErrors[img.id] = "Sélectionne un format à appliquer.";
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    if (!images.length) {
      setStatus({ state: "error", message: "Ajoute au moins une image." });
      return;
    }

    if (!validateSelection()) {
      setStatus({
        state: "error",
        message: "Complète les paramètres pour chaque image avant de valider.",
      });
      return;
    }

    const formData = new FormData();

    images.forEach((img, index) => {
      const preset = socialImgPreset.find((item) => item.id === img.presetId);
      formData.append(`assets[${index}][file]`, img.file);
      formData.append(`assets[${index}][presetId]`, img.presetId || "");
      formData.append(`assets[${index}][network]`, img.network || "");
      formData.append(`assets[${index}][category]`, img.category || "");
      if (preset) {
        formData.append(`assets[${index}][width]`, String(preset.width));
        formData.append(`assets[${index}][height]`, String(preset.height));
        formData.append(`assets[${index}][ratio]`, preset.ratio);
        formData.append(
          `assets[${index}][defaultFormat]`,
          preset.defaultFormat
        );
      }
    });

    try {
      setStatus({ state: "loading", message: "Envoi en cours..." });
      await api.post("/api/social/pictures", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStatus({
        state: "success",
        message: "Les images ont été envoyées pour traitement.",
      });
    } catch (error) {
      console.error("Erreur lors de l'envoi :", error);
      setStatus({
        state: "error",
        message:
          "Impossible d'envoyer les images. Vérifie ta connexion ou réessaie plus tard.",
      });
    }
  };

  const getPresets = (network?: string, category?: string) => {
    if (!network || !category) return [];
    return presetMap[`${network}-${category}`] || [];
  };

  return (
    <section className="w-full max-w-[1100px] mx-auto py-12 px-4">
      <header className="flex flex-col gap-2 mb-8 text-center">
        <h2 className="text-3xl font-semibold">Social picture</h2>
        <p className="text-base-content/80">
          Téléverse une ou plusieurs images puis associe-les au réseau social et
          au format adapté avant de lancer le traitement.
        </p>
      </header>

      <form className="space-y-8" onSubmit={handleSubmit}>
        <div className="border border-dashed border-base-300 rounded-xl p-6 text-center">
          <p className="mb-4 font-medium">
            Fais glisser tes fichiers ici ou utilise le bouton.
          </p>
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(event.currentTarget.files);
              if (event.currentTarget) {
                event.currentTarget.value = "";
              }
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => uploadRef.current?.click()}
          >
            Ajouter des images
          </button>
        </div>

        {images.length ? (
          <div className="grid gap-6 md:grid-cols-2">
            {images.map((img) => {
              const presets = getPresets(img.network, img.category);
              const previewPreset = socialImgPreset.find(
                (preset) => preset.id === img.presetId
              );

              return (
                <article
                  key={img.id}
                  className="bg-base-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={img.previewUrl}
                      alt="aperçu"
                      className="w-28 h-28 object-cover rounded-xl border border-base-300"
                    />
                    <div className="flex-1 space-y-3">
                      <label className="form-control w-full">
                        <span className="label-text font-semibold">
                          Réseau social
                        </span>
                        <select
                          className="select select-bordered select-sm"
                          value={img.network || ""}
                          onChange={(event) =>
                            handleNetworkChange(img.id, event.currentTarget.value)
                          }
                        >
                          <option value="">Choisir...</option>
                          {networks.map((network) => (
                            <option key={network} value={network}>
                              {displayLabel(network)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="form-control w-full">
                        <span className="label-text font-semibold">
                          Catégorie / usage
                        </span>
                        <select
                          className="select select-bordered select-sm"
                          value={img.category || ""}
                          onChange={(event) =>
                            handleCategoryChange(img.id, event.currentTarget.value)
                          }
                          disabled={!img.network}
                        >
                          <option value="">Choisir...</option>
                          {(img.network ? catByNetwork[img.network] : [])?.map(
                            (category) => (
                              <option key={category} value={category}>
                                {displayLabel(category.replace(/_/g, " "))}
                              </option>
                            )
                          )}
                        </select>
                      </label>

                      <label className="form-control w-full">
                        <span className="label-text font-semibold">
                          Format prédéfini
                        </span>
                        <select
                          className="select select-bordered select-sm"
                          value={img.presetId || ""}
                          onChange={(event) =>
                            handlePresetChange(img.id, event.currentTarget.value)
                          }
                          disabled={!img.network || !img.category}
                        >
                          <option value="">Choisir...</option>
                          {presets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {previewPreset ? (
                        <div className="text-sm bg-base-100 rounded-lg p-3 border border-base-300">
                          <p className="font-semibold">
                            {previewPreset.width}×{previewPreset.height} px
                          </p>
                          <p>Ratio: {previewPreset.ratio}</p>
                          <p>Format: {previewPreset.defaultFormat}</p>
                          <p className="text-xs text-base-content/70">
                            {previewPreset.recommendedUse}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-between">
                    <label className="btn btn-xs btn-outline" htmlFor={img.id}>
                      Changer de photo
                    </label>
                    <input
                      id={img.id}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) =>
                        replaceFile(img.id, event.currentTarget.files?.[0])
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-xs btn-error btn-outline"
                      onClick={() => removeImage(img.id)}
                    >
                      Retirer
                    </button>
                  </div>

                  {errors[img.id] ? (
                    <p className="text-error text-sm">{errors[img.id]}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-base-content/70">
            Aucune image sélectionnée pour l'instant.
          </p>
        )}

        <footer className="flex flex-wrap gap-3 justify-end">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={clearAll}
            disabled={!images.length}
          >
            Annuler
          </button>
          <button
            type="submit"
            className={`btn btn-success ${
              status.state === "loading" ? "loading" : ""
            }`}
            disabled={!images.length || status.state === "loading"}
          >
            Valider et envoyer
          </button>
        </footer>

        {status.state !== "idle" ? (
          <p
            className={`text-sm ${
              status.state === "success"
                ? "text-success"
                : status.state === "error"
                ? "text-error"
                : "text-base-content"
            }`}
          >
            {status.message}
          </p>
        ) : null}
      </form>
    </section>
  );
};

export { SocialPicture };
