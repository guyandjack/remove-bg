import { useMemo, useState } from "preact/hooks";
import { useForm } from "react-hook-form";
import axios from "axios";

import { Loader } from "@/components/loader/Loader";
import { localOrProd } from "@/utils/localOrProd";

type DeleteReasonContent = {
  title: string;
  subtitle: string;
  expensive: string;
  no_more_use: string;
  bad_quality_result: string;
  difficult: string;
  bad_UX: string;
  found_alternative: string;
  other_reason: string;
  placeholder: string;
  button_submit: string;
  button_close: string;
  success: string;
  error: string;
  validation_error: string;
};

type FormValues = {
  expensive: boolean;
  no_more_use: boolean;
  bad_quality_result: boolean;
  difficult: boolean;
  bad_UX: boolean;
  found_alternative: boolean;
  other: boolean;
  other_text: string;
};

const { urlApi } = localOrProd();

type Props = {
  content: DeleteReasonContent;
  token: string | null;
  onClose: () => void;
  onSubmitted: () => void;
};

function FormDeleteReasonAccount({ content, token, onClose, onSubmitted }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      expensive: false,
      no_more_use: false,
      bad_quality_result: false,
      difficult: false,
      bad_UX: false,
      found_alternative: false,
      other: false,
      other_text: "",
    },
  });

  const otherEnabled = watch("other");

  const selectedReasons = watch([
    "expensive",
    "no_more_use",
    "bad_quality_result",
    "difficult",
    "bad_UX",
    "found_alternative",
    "other",
  ]);

  const hasAnyReason = useMemo(() => selectedReasons.some(Boolean), [selectedReasons]);

  const onSubmit = async (data: FormValues) => {
    if (status === "loading") return;

    const otherText = String(data.other_text || "").trim();
    const hasOtherText = otherText.length >= 3;
    const hasReasons = Object.values({
      expensive: data.expensive,
      no_more_use: data.no_more_use,
      bad_quality_result: data.bad_quality_result,
      difficult: data.difficult,
      bad_UX: data.bad_UX,
      found_alternative: data.found_alternative,
      other: data.other,
    }).some(Boolean);

    if (!hasReasons && !hasOtherText) {
      setError("other_text", { type: "validate", message: content.validation_error });
      setStatus("idle");
      return;
    }
    if (data.other && !hasOtherText) {
      setError("other_text", { type: "validate", message: content.validation_error });
      setStatus("idle");
      return;
    }

    setStatus("loading");
    setStatusMessage(null);
    try {
      const payload = {
        token,
        reasons: {
          expensive: data.expensive,
          no_more_use: data.no_more_use,
          bad_quality_result: data.bad_quality_result,
          difficult: data.difficult,
          bad_UX: data.bad_UX,
          found_alternative: data.found_alternative,
          other: data.other,
        },
        other_text: otherText || null,
      };

      // If backend token is unavailable (typically missing DB migration), store locally only.
      if (typeof token === "string" && token.trim()) {
        const resp = await axios.post(`${urlApi}/api/account/deletion-feedback`, payload, {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        });
        if (resp?.data?.success !== true) throw new Error("submit_failed");
      }

      setStatus("success");
      setStatusMessage(content.success);
      try {
        localStorage.setItem("wizpix:account_deletion_feedback", JSON.stringify(payload));
      } catch {}
      setTimeout(() => onSubmitted(), 800);
    } catch {
      setStatus("error");
      setStatusMessage(content.error);
    } finally {
      if (status !== "success") {
        setTimeout(() => setStatus("idle"), 2500);
      }
    }
  };

  const submitDisabled =
    status === "loading" ||
    isSubmitting ||
    (!hasAnyReason && !String(watch("other_text") || "").trim());

  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight">{content.title}</h3>
          <p className="mt-1 text-sm text-base-content/70">
            {content.subtitle}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onClose}
          disabled={status === "loading"}
        >
          {content.button_close}
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
        <div className="rounded-xl border border-base-300 bg-base-100 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                {...register("expensive")}
              />
              <span className="text-sm">{content.expensive}</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                {...register("no_more_use")}
              />
              <span className="text-sm">{content.no_more_use}</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                {...register("bad_quality_result")}
              />
              <span className="text-sm">{content.bad_quality_result}</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                {...register("difficult")}
              />
              <span className="text-sm">{content.difficult}</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                {...register("bad_UX")}
              />
              <span className="text-sm">{content.bad_UX}</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                {...register("found_alternative")}
              />
              <span className="text-sm">{content.found_alternative}</span>
            </label>
            <label className="flex items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                {...register("other")}
              />
              <span className="text-sm">{content.other_reason}</span>
            </label>

            <div className="sm:col-span-2">
              <textarea
                className="textarea textarea-bordered w-full min-h-[120px]"
                placeholder={content.placeholder}
                {...register("other_text", {
                  maxLength: { value: 2000, message: content.error },
                })}
              />
              {errors.other_text ? (
                <p className="mt-1 text-sm text-error">
                  {String(errors.other_text.message)}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {statusMessage ? (
          <div
            role="alert"
            className={`alert ${
              status === "error"
                ? "alert-error"
                : status === "success"
                  ? "alert-success"
                  : "alert-info"
            }`}
          >
            <span>{statusMessage}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={status === "loading"}
          >
            {content.button_close}
          </button>
          <button
            type="submit"
            className="relative btn btn-primary sm:min-w-[180px]"
            disabled={submitDisabled}
          >
            {status === "loading" ? (
              <div className="absolute top-[50%] left-[1rem] translate-y-[-50%]">
                <span
                  className={`loading loading-bars loading-sm loading-info text-info`}
                ></span>
              </div>
            ) : null}
            {content.button_submit}
          </button>
        </div>

        {/* {status === "loading" ? <Loader top="top-[100%]" /> : null} */}
      </form>
    </div>
  );
}

export { FormDeleteReasonAccount };
// Backward-compat named export (old component name)
export { FormDeleteReasonAccount as formDeleteReasonAccount };
