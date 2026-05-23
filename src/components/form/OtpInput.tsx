// OtpInput.tsx (ou .jsx)
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import type { JSX } from "preact";

//import des librairies
import axios from "axios";
import { useForm } from "react-hook-form";

//import des composnta enfants
import { Loader } from "@/components/loader/Loader";

import { login } from "@/utils/axiosConfig";
import { setSessionFromApiResponse } from "@/stores/session";
import { REGEX } from "@/shared/validationRegex";

import type { FormValues as SignUpFormValues } from "./FormSignUp";

type OtpInputProps = {
  length?: number; // par défaut 6
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  question: string;
  action: string;
  title: string;
  dataUser: SignUpFormValues | null;
  errorRequire: string;
  errorPattern: string;
  onResend: (
    data: SignUpFormValues
  ) => Promise<{ ok: boolean; kind: "initial" | "resend"; error?: string }>;
  className?: string; // classes wrapper
  textSuccess: string;
  textError: string;
  resendSuccessText: string;
  resendErrorText: string;
  verifyInvalidText: string;
  loaderVerifyText: string;
  loaderResendText: string;
  emailUser?: string;
};

type OtpFormValues = {
  otp: string;
  email?: string;
  id?: string;
};

function OtpInput({
  length = 6,
  onResend,
  autoFocus = true,
  title,
  question,
  action,
  dataUser,
  errorRequire,
  errorPattern,
  className = "",
  textSuccess,
  textError,
  resendSuccessText,
  resendErrorText,
  verifyInvalidText,
  loaderVerifyText,
  loaderResendText,
  emailUser,
}: OtpInputProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    trigger,
  } = useForm<OtpFormValues>({ mode: "onChange", defaultValues: { otp: "" } });

  const [values, setValues] = useState<string[]>(() => Array(length).fill(""));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  //state qui gere l' validite de la reponse.
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const statusTimeoutRef = useRef<number | null>(null);

  //gere en partie l' affichage du loader
  const [isLoader, setIsLoader] = useState(false);
  const [loadingReason, setLoadingReason] = useState<null | "verify" | "resend">(
    null
  );

  // Initialise le tableau de refs
  const slots = useMemo(() => Array.from({ length }, (_, i) => i), [length]);

  const location = useLocation();
  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      inputsRef.current[0].focus();
      inputsRef.current[0].select?.();
    }
  }, [autoFocus]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  const showStatus = (
    next: "success" | "error",
    message: string,
    durationMs = 3500
  ) => {
    if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
    setStatus(next);
    setStatusMessage(message);
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatus("idle");
      setStatusMessage("");
      statusTimeoutRef.current = null;
    }, durationMs);
  };

  const clearOtpInputs = () => {
    setValues(Array(length).fill(""));
    setValue("otp", "", { shouldDirty: true, shouldValidate: true });
  };

  //fonction apppeler lors du resend des infos users
  const resend = async (e: Event) => {
    const idBtn = (e.currentTarget as HTMLButtonElement | null)?.id;
    if (idBtn !== "resend") return;

    clearOtpInputs();
    inputsRef.current[0]?.focus();

    if (!dataUser) {
      showStatus("error", resendErrorText);
      return;
    }

    setIsLoader(true);
    setLoadingReason("resend");
    try {
      const result = await onResend({ ...dataUser, id: idBtn });
      if (result.ok) showStatus("success", resendSuccessText);
      else showStatus("error", result.error || resendErrorText);
    } catch (error) {
      console.error("resend otp unexpected error:", error);
      showStatus("error", resendErrorText);
    } finally {
      setIsLoader(false);
      setLoadingReason(null);
    }
  };

  const focusIndex = (i: number) => {
    const el = inputsRef.current[i];
    if (el) {
      el.focus();
      el.select?.();
    }
  };

  const setAt = (i: number, val: string) => {
    setValues((prev) => {
      const next = [...prev];
      next[i] = val;
      const code = next.join("");

      // Quand les 6 cases sont remplies, on met otp + on valide + on soumet
      if (next.every((v) => v !== "")) {
        setValue("otp", code, { shouldValidate: true, shouldDirty: true });
        // Option 1: valider puis soumettre si valide
        trigger("otp").then((valid) => {
          if (valid) handleSubmit(onSubmitOtp)(); // <-- ICI on APPELLE la fonction retournée
        });
      } else {
        // sinon on garde otp partiel (optionnel)
        setValue("otp", code, { shouldDirty: true });
      }
      return next;
    });
  };

  const handleChange = (i: number, v: string) => {
    // garde uniquement le premier chiffre
    const digit = v.replace(/\D/g, "").slice(0, 1);
    if (!digit) {
      setAt(i, "");
      return;
    }
    setAt(i, digit);
    // focus suivant
    if (i < length - 1) focusIndex(i + 1);
  };

  const handleKeyDown = (
    i: number,
    e: JSX.TargetedKeyboardEvent<HTMLInputElement>
  ) => {
    const key = e.key;

    if (key === "Backspace") {
      if (values[i]) {
        // efface la case courante
        setAt(i, "");
      } else if (i > 0) {
        // va à la case précédente et efface
        focusIndex(i - 1);
        setAt(i - 1, "");
      }
      e.preventDefault();
    }

    if (key === "ArrowLeft" && i > 0) {
      focusIndex(i - 1);
      e.preventDefault();
    }
    if (key === "ArrowRight" && i < length - 1) {
      focusIndex(i + 1);
      e.preventDefault();
    }
    if (key === "Home") {
      focusIndex(0);
      e.preventDefault();
    }
    if (key === "End") {
      focusIndex(length - 1);
      e.preventDefault();
    }
  };

  const handlePaste = (
    i: number,
    e: JSX.TargetedClipboardEvent<HTMLInputElement>
  ) => {
    e.preventDefault();
    const text = (e.clipboardData?.getData("text") || "").replace(/\D/g, "");
    if (!text) return;

    setValues((prev) => {
      const next = [...prev];
      let idx = i;
      for (const ch of text) {
        if (idx >= length) break;
        next[idx] = ch;
        idx++;
      }
      // focus dernier rempli (ou suivant)
      const last = Math.min(i + text.length - 1, length - 1);
      focusIndex(last < length - 1 ? last + 1 : last);

      const code = next.join("").slice(0, length);
      const complete = code.length === length && next.every((v) => v !== "");
      setValue("otp", code, {
        shouldDirty: true,
        shouldValidate: complete,
      });
      if (complete) {
        trigger("otp").then((valid) => {
          if (valid) handleSubmit(onSubmitOtp)();
        });
      }

      return next;
    });
  };

  const onSubmitOtp = async (data: OtpFormValues) => {
    setLoadingReason("verify");
    setIsLoader(true);
    try {
      const mailUser: any = emailUser || dataUser?.email;
      const payload = { ...data, email: mailUser };

      const response = await login.post(
        "/api/signup/check/otp",
        payload,
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        }
      );

      const result = response.data;
      if (!result || result.status !== "success") {
        showStatus("error", verifyInvalidText);
        return;
      }
      if (result.status === "success" && result.plan.code === "free") {
        setSessionFromApiResponse(result);
        showStatus("success", textSuccess, 2000);
        setTimeout(() => {
          location.route("/services");
        }, 2000);
      } else if (result.status === "success" && result.redirect) {
        //redirection vers le checkout de stripe
        window.location.href = result.redirectUrl;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const payload = error.response?.data;
        const serverMessage =
          typeof payload === "string" ? payload : payload?.message;
        showStatus("error", serverMessage || textError);
      } else {
        console.error("otp verify unexpected error:", error);
        showStatus("error", textError);
      }
    } finally {
      setIsLoader(false);
      setLoadingReason(null);
    }
  };

  return (
    <form className={`flex flex-col items-center gap-3 ${className}`}>
      <label className="text-sm opacity-70">{title}</label>

      <div className="relative flex items-center gap-2">
        {slots.map((idx) => (
          <input
            key={idx}
            ref={(el) => {
              inputsRef.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d*"
            maxLength={1}
            value={values[idx]}
            onChange={(e) => handleChange(idx, e.currentTarget.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={(e) => handlePaste(idx, e)}
            disabled={isSubmitting || isLoader || status !== "idle"}
            aria-label={`Code ${idx + 1}`}
            className={[
              // DaisyUI + Tailwind : case carrée, centrée
              "input input-bordered",
              "w-12 h-12 md:w-14 md:h-14",
              "text-center text-2xl font-semibold tracking-wider",
              "focus:outline-none focus:ring-2 focus:ring-primary",
              "disabled:opacity-50",
            ].join(" ")}
          />
        ))}

        {/* champ caché validé par RHF */}
        <input
          id="otp"
          type="hidden"
          {...register("otp", {
            required: errorRequire,
            pattern: {
              value: REGEX.otp6,
              message: errorPattern,
            },
          })}
          className="input input-bordered w-full bg-base-200 text-base-content"
        />

        {/* message d’erreur global */}
        {errors.otp && (
          <p className="absolute top-[100%] text-error text-sm">
            {errors.otp.message as string}
          </p>
        )}
      </div>

      {/* Exemple d'aide / actions */}
      <p className="relative text-xs opacity-80 text-center">
        {question}
        <button
          disabled={isLoader || status !== "idle"}
          id="resend"
          type="button"
          className="relative btn btn-primary ml-5"
          onClick={(e) => {
            resend(e);
          }}
        >
          {isLoader && status === "idle" ? (
            <div className="left-[1rem]">
              <span
                className={`loading loading-bars loading-sm loading-info text-info`}
              ></span>
            </div>
          ) : null}
          {action}
        </button>
        <span
          className={`btn w-100 transition-all duration-500 transform 
          ${status === "idle" ? "opacity-0 translate-y-0" : ""}
          ${
            status === "success"
              ? "opacity-100 translate-y-3 bg-green-500 text-white px-4 py-2 rounded-lg"
              : ""
          }
          ${
            status === "error"
              ? "opacity-100 translate-y-3 bg-red-500 text-white px-4 py-2 rounded-lg"
              : ""
          }
        `}
        >
          {statusMessage}
        </span>
      </p>
      {/* {isLoader ? (
        <Loader
          top="top-[100%]"
          text={
            loadingReason === "resend" ? loaderResendText : loaderVerifyText
          }
        />
      ) : null} */}
    </form>
  );
}

export { OtpInput };
