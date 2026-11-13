import { useEffect, useState } from "preact/hooks";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

type VideoStyleId = "cinematic" | "kinetic" | "minimal" | "dynamic";
type VideoDuration = 10 | 20 | 30 | 40;

type VideoGenerationRequest = {
  prompt: string;
  style: VideoStyleId;
  duration: VideoDuration;
  referenceImages: File[];
};

type VideoGenerationSubmissionResult = {
  message: string;
};

type VideoMakerFormValues = {
  prompt: string;
  style: VideoStyleId | null;
  duration: VideoDuration;
  referenceImages?: FileList;
};

type VideoMakerProps = {
  onSubmit?: (
    request: VideoGenerationRequest,
  ) => VideoGenerationSubmissionResult | Promise<VideoGenerationSubmissionResult>;
};

const PROMPT_MAX_LENGTH = 1_000;
const PROMPT_MIN_LENGTH = 10;
const MAX_REFERENCE_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const videoDurations: VideoDuration[] = [10, 20, 30, 40];
const acceptedReferenceImageTypes = ["image/png", "image/jpeg"] as const;

const videoStyles: { id: VideoStyleId; accentClass: string }[] = [
  { id: "cinematic", accentClass: "from-violet-500 via-fuchsia-500 to-amber-300" },
  { id: "kinetic", accentClass: "from-cyan-500 via-blue-600 to-violet-600" },
  { id: "minimal", accentClass: "from-slate-500 via-slate-700 to-slate-950" },
  { id: "dynamic", accentClass: "from-rose-500 via-orange-400 to-yellow-300" },
];

const appendTranscript = (basePrompt: string, transcript: string) => {
  const normalizedTranscript = transcript.trim();
  if (!normalizedTranscript) return basePrompt;
  return basePrompt ? `${basePrompt} ${normalizedTranscript}` : normalizedTranscript;
};

const isVideoDuration = (value: unknown): value is VideoDuration =>
  typeof value === "number" && videoDurations.includes(value as VideoDuration);

const isAcceptedReferenceImage = (file: File) =>
  acceptedReferenceImageTypes.includes(
    file.type as (typeof acceptedReferenceImageTypes)[number],
  );

const isAcceptedReferenceImageSize = (file: File) =>
  file.size <= MAX_REFERENCE_IMAGE_SIZE_BYTES;

const VideoMaker = ({ onSubmit }: VideoMakerProps) => {
  const { t, i18n } = useTranslation();
  const [dictationBasePrompt, setDictationBasePrompt] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VideoMakerFormValues>({
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      prompt: "",
      style: null,
      duration: 10,
    },
  });
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();
  const prompt = watch("prompt");
  const selectedStyle = watch("style");
  const referenceImages = watch("referenceImages");
  const selectedReferenceImages = referenceImages
    ? Array.from(referenceImages)
    : [];

  useEffect(() => {
    if (!listening) return;
    setValue("prompt", appendTranscript(dictationBasePrompt, transcript), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [dictationBasePrompt, listening, setValue, transcript]);

  useEffect(() => {
    return () => {
      SpeechRecognition.stopListening();
    };
  }, []);

  const startDictation = async () => {
    if (!browserSupportsSpeechRecognition || !isMicrophoneAvailable) return;

    setFormMessage(null);
    setDictationBasePrompt(prompt.trimEnd());
    resetTranscript();

    try {
      await SpeechRecognition.startListening({
        continuous: true,
        language: i18n.language.startsWith("fr") ? "fr-FR" : i18n.language,
      });
    } catch {
      setFormMessage(t("videoMaker.dictationStartError"));
    }
  };

  const stopDictation = () => {
    SpeechRecognition.stopListening();
  };

  const submitGenerationRequest = async (data: VideoMakerFormValues) => {
    // The style validation above ensures the cast is safe before exposing the API contract.
    const selectedStyle = data.style as VideoStyleId;

    if (!onSubmit) {
      setFormMessage(t("videoMaker.formPendingNotice"));
      return;
    }

    setFormMessage(null);
    try {
      const submissionResult = await onSubmit({
        prompt: data.prompt.trim(),
        style: selectedStyle,
        duration: data.duration,
        referenceImages: data.referenceImages
          ? Array.from(data.referenceImages)
          : [],
      });
      setFormMessage(submissionResult.message);
    } catch {
      setFormMessage(t("videoMaker.formSubmitError"));
    }
  };

  const dictationUnavailableMessage = !browserSupportsSpeechRecognition
    ? t("videoMaker.dictationUnsupported")
    : !isMicrophoneAvailable
      ? t("videoMaker.dictationPermissionDenied")
      : null;

  return (
    <section
      className="bg-component mx-auto w-full max-w-5xl rounded-2xl border border-base-300 p-5 shadow-sm sm:p-8"
      aria-labelledby="video-maker-title"
    >
      <div className="max-w-2xl space-y-3">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">
          {t("videoMaker.eyebrow")}
        </p>
        <h2 id="video-maker-title" className="text-3xl font-bold sm:text-4xl">
          {t("videoMaker.title")}
        </h2>
        <p className="text-base-content/75">{t("videoMaker.description")}</p>
      </div>

      <form
        className="mt-8 space-y-8"
        onSubmit={handleSubmit(submitGenerationRequest)}
        noValidate
      >
        <fieldset>
          <legend className="mb-3 text-lg font-semibold">
            {t("videoMaker.stylesLegend")}
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {videoStyles.map((style) => {
              const isSelected = selectedStyle === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  className={`group relative overflow-hidden rounded-xl border text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-base-300 hover:border-primary/60"
                  }`}
                  aria-pressed={isSelected}
                  aria-describedby={errors.style ? "video-style-error" : undefined}
                  onClick={() => {
                    setValue("style", style.id, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                    setFormMessage(null);
                  }}
                >
                  <div
                    className={`aspect-video bg-gradient-to-br ${style.accentClass} flex items-center justify-center p-4`}
                    aria-hidden="true"
                  >
                    <svg
                      className="h-10 w-10 text-white/90 drop-shadow"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none" />
                    </svg>
                  </div>
                  <span className="block space-y-1 p-3">
                    <span className="block font-semibold">
                      {t(`videoMaker.styles.${style.id}.title`)}
                    </span>
                    <span className="block text-sm text-base-content/65">
                      {t("videoMaker.previewUnavailable")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <input
            type="hidden"
            {...register("style", {
              validate: (value) => value !== null || t("videoMaker.styleRequired"),
            })}
          />
          {errors.style ? (
            <p id="video-style-error" className="mt-3 text-sm text-error" role="alert">
              {errors.style.message}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-end">
          <div>
            <label htmlFor="video-prompt" className="mb-2 block text-lg font-semibold">
              {t("videoMaker.promptLabel")}
            </label>
            <div className="relative">
              <textarea
                id="video-prompt"
                className={`textarea textarea-bordered min-h-40 w-full resize-y pr-14 ${
                  errors.prompt ? "textarea-error" : ""
                }`}
                placeholder={t("videoMaker.promptPlaceholder")}
                aria-invalid={errors.prompt ? "true" : undefined}
                aria-describedby={`video-prompt-help video-prompt-count${
                  errors.prompt ? " video-prompt-error" : ""
                }`}
                {...register("prompt", {
                  required: t("videoMaker.promptRequired"),
                  minLength: {
                    value: PROMPT_MIN_LENGTH,
                    message: t("videoMaker.promptMinLength", {
                      count: PROMPT_MIN_LENGTH,
                    }),
                  },
                  maxLength: {
                    value: PROMPT_MAX_LENGTH,
                    message: t("videoMaker.promptMaxLength", {
                      count: PROMPT_MAX_LENGTH,
                    }),
                  },
                  validate: (value) =>
                    value.trim().length >= PROMPT_MIN_LENGTH ||
                    t("videoMaker.promptMinLength", { count: PROMPT_MIN_LENGTH }),
                  onChange: () => setFormMessage(null),
                })}
              />
              <button
                type="button"
                className={`btn btn-circle btn-sm absolute right-3 bottom-3 ${
                  listening ? "btn-error" : "btn-primary"
                }`}
                aria-label={
                  listening
                    ? t("videoMaker.dictationStop")
                    : t("videoMaker.dictationStart")
                }
                aria-pressed={listening}
                disabled={!browserSupportsSpeechRecognition || !isMicrophoneAvailable}
                onClick={listening ? stopDictation : startDictation}
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-base-content/65">
              <span id="video-prompt-help">{t("videoMaker.promptHelper")}</span>
              <span id="video-prompt-count">
                {t("videoMaker.characterCount", {
                  count: prompt.length,
                  max: PROMPT_MAX_LENGTH,
                })}
              </span>
            </div>
            {listening ? (
              <p className="mt-2 text-sm font-medium text-error" role="status">
                {t("videoMaker.dictationListening")}
              </p>
            ) : null}
            {dictationUnavailableMessage ? (
              <p className="mt-2 text-sm text-warning" role="status">
                {dictationUnavailableMessage}
              </p>
            ) : null}
            {errors.prompt ? (
              <p id="video-prompt-error" className="mt-2 text-sm text-error" role="alert">
                {errors.prompt.message}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="video-duration" className="mb-2 block text-lg font-semibold">
              {t("videoMaker.durationLabel")}
            </label>
            <select
              id="video-duration"
              className={`select select-bordered w-full ${
                errors.duration ? "select-error" : ""
              }`}
              aria-invalid={errors.duration ? "true" : undefined}
              aria-describedby={errors.duration ? "video-duration-error" : undefined}
              {...register("duration", {
                valueAsNumber: true,
                validate: (value) =>
                  isVideoDuration(value) || t("videoMaker.durationInvalid"),
              })}
            >
              <option value={10}>{t("videoMaker.durations.ten")}</option>
              <option value={20}>{t("videoMaker.durations.twenty")}</option>
              <option value={30}>{t("videoMaker.durations.thirty")}</option>
              <option value={40}>{t("videoMaker.durations.forty")}</option>
            </select>
            {errors.duration ? (
              <p id="video-duration-error" className="mt-2 text-sm text-error" role="alert">
                {errors.duration.message}
              </p>
            ) : null}
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-lg font-semibold">
            {t("videoMaker.referenceImagesLabel")}
          </legend>
          <p id="video-reference-images-help" className="mb-3 text-sm text-base-content/65">
            {t("videoMaker.referenceImagesHint")}
          </p>
          <input
            id="video-reference-images"
            type="file"
            multiple
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            className={`file-input file-input-bordered w-full ${
              errors.referenceImages ? "file-input-error" : ""
            }`}
            aria-invalid={errors.referenceImages ? "true" : undefined}
            aria-describedby={`video-reference-images-help${
              errors.referenceImages ? " video-reference-images-error" : ""
            }`}
            {...register("referenceImages", {
              validate: (files) => {
                if (!files) return true;
                const images = Array.from(files);

                if (!images.every(isAcceptedReferenceImage)) {
                  return t("videoMaker.referenceImagesInvalidType");
                }

                return (
                  images.every(isAcceptedReferenceImageSize) ||
                  t("videoMaker.referenceImagesTooLarge")
                );
              },
              onChange: () => setFormMessage(null),
            })}
          />
          {errors.referenceImages ? (
            <p
              id="video-reference-images-error"
              className="mt-2 text-sm text-error"
              role="alert"
            >
              {errors.referenceImages.message}
            </p>
          ) : null}
          {selectedReferenceImages.length > 0 ? (
            <div className="mt-3">
              <p className="text-sm font-medium">
                {t("videoMaker.referenceImagesSelected", {
                  count: selectedReferenceImages.length,
                })}
              </p>
              <ul className="mt-1 list-inside list-disc text-sm text-base-content/65">
                {selectedReferenceImages.map((file) => (
                  <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </fieldset>

        {formMessage ? (
          <div className="alert alert-info" role="status">
            <span>{formMessage}</span>
          </div>
        ) : null}

        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? t("videoMaker.submitting") : t("videoMaker.submit")}
          </button>
        </div>
      </form>
    </section>
  );
};

export { VideoMaker };
export type {
  VideoGenerationRequest,
  VideoGenerationSubmissionResult,
  VideoStyleId,
};
