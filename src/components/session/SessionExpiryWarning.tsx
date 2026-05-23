//import des hooks
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { sessionSignal } from "@/stores/session";

//import des fonctions
import { refreshAccessToken } from "@/utils/axiosConfig";
import { logoutClient } from "@/utils/auth/logout";
import { navigateWithLink } from "@/utils/navigateWithLink";

//import librairie animation
import * as m from "motion/react-m";

type DecodedJwtPayload = {
  exp?: number;
  iat?: number;
  rtExp?: number;
  refreshExp?: number;
  [key: string]: unknown;
};


function decodeJwtPayload(token: string): DecodedJwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1] || "";
    if (!payload) return null;

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
    const json = atob(base64 + pad);
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as any) : null;
  } catch {
    return null;
  }
}

function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const WARNING_LEAD_MS = 2 * 60 * 1000;

const SessionExpiryWarning = () => {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "success" | "error">("idle");
  

  const warnTimeoutRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const didAutoLogoutRef = useRef(false);
  const didWarnMissingRtExpRef = useRef(false);

  const token = sessionSignal.value?.token || null;
  const isAuth = Boolean(sessionSignal.value?.authentified);

  const refreshSessionExpiresAtMs = useMemo(() => {
    if (!token || typeof token !== "string") return null;
    const decoded = decodeJwtPayload(token);
    if (!decoded) return null;

    const refreshExpSeconds =
      typeof decoded.rtExp === "number"
        ? decoded.rtExp
        : typeof decoded.refreshExp === "number"
          ? decoded.refreshExp
          : null;

    const refreshExpiresAtMs = refreshExpSeconds ? refreshExpSeconds * 1000 : null;

    // Mode unique: on se base sur l'expiration du refresh token (fin rÃ©elle de session).
    return refreshExpiresAtMs;
  }, [token]);

  useEffect(() => {
    // Cleanup timers when token/auth changes
    if (warnTimeoutRef.current) {
      window.clearTimeout(warnTimeoutRef.current);
      warnTimeoutRef.current = null;
    }
    if (tickIntervalRef.current) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }

    setSecondsLeft(null);
    setFeedback("idle");
    didAutoLogoutRef.current = false;
    didWarnMissingRtExpRef.current = false;

    if (!isAuth || !refreshSessionExpiresAtMs) {
      if (isAuth && !refreshSessionExpiresAtMs && !didWarnMissingRtExpRef.current) {
        didWarnMissingRtExpRef.current = true;
        // Si `rtExp` n'est pas prÃ©sent, on ne peut pas faire un warning fiable sur la fin de session.
        // Le backend est censÃ© injecter `rtExp` (expiry du refresh) dans l'access token.
        // eslint-disable-next-line no-console
        console.warn("[SessionExpiryWarning] Missing refresh expiry (rtExp/refreshExp) in JWT payload.");
      }
      return;
    }

    const tick = () => {
      const remainingMs = refreshSessionExpiresAtMs - Date.now();
      if (remainingMs <= 0) {
        setSecondsLeft(0);
        if (tickIntervalRef.current) {
          window.clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
        }
        if (!didAutoLogoutRef.current) {
          didAutoLogoutRef.current = true;
          // Auto logout when session is effectively expired (refresh no longer possible)
          void logoutClient({
            onStart: () => setIsLoggingOut(true),
            onFinished: () => {
              setIsLoggingOut(false);
              window.setTimeout(() => navigateWithLink("/"), 2000);
            },
          });
        }
        return;
      }
      setSecondsLeft(Math.ceil(remainingMs / 1000));
    };

    const startCountdown = () => {
      tick();
      tickIntervalRef.current = window.setInterval(tick, 1000);
    };

    const warnStartMs = refreshSessionExpiresAtMs - WARNING_LEAD_MS;
    const delayMs = warnStartMs - Date.now();
    if (delayMs <= 0) {
      startCountdown();
      return;
    }

    warnTimeoutRef.current = window.setTimeout(startCountdown, delayMs);

    return () => {
      if (warnTimeoutRef.current) window.clearTimeout(warnTimeoutRef.current);
      if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current);
      warnTimeoutRef.current = null;
      tickIntervalRef.current = null;
    };
  }, [isAuth, refreshSessionExpiresAtMs]);

  const isVisible = secondsLeft !== null && secondsLeft <= Math.ceil(WARNING_LEAD_MS / 1000) ;

  const keepAlive = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setFeedback("idle");
    try {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        setFeedback("error");
        return;
      }
      setFeedback("success");
      window.setTimeout(() => setFeedback("idle"), 2500);
    } finally {
      setIsRefreshing(false);
    }
  };

  const logout = async () => {
    if (isLoggingOut) return;
    await logoutClient({
      onStart: () => setIsLoggingOut(true),
      onFinished: () => {
        setIsLoggingOut(false);
        window.setTimeout(() => navigateWithLink("/"), 2000);
      },
    });
  };

  if (!isVisible) return null;

  return (
    <m.div
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 24 }}
      transition={{
        duration: 0.7,
        ease: "easeOut",
      }}
      style={{ willChange: "transform, opacity" }}
      className="toast toast-top toast-center z-50 mt-16 "
    >
      <div className="alert bg-component border border-warning p-6 shadow-lg gap-4 flex flex-col justify-center items-center">
        <div className="flex flex-col justify-start items-center gap-2 w-[350px]">
          <span className="font-semibold">{t("sessionWarning.title")}</span>
          <span className="text-base">
            {t("sessionWarning.message", {
              time: formatSeconds(secondsLeft ?? 0),
            })}
          </span>
          {feedback === "success" ? (
            <span className="text-sm text-center">{t("sessionWarning.success")}</span>
          ) : feedback === "error" ? (
            <span className="text-sm text-center text-error">{t("sessionWarning.error")}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-6 md:flex-row">
          <button
            type="button"
            className="btn btn-sm btn-primary btn-outline w-[140px]"
            onClick={keepAlive}
            disabled={isRefreshing || isLoggingOut}
          >
            {isRefreshing
              ? t("sessionWarning.refreshing")
              : t("sessionWarning.keep")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-warning btn-outline w-[140px]"
            onClick={logout}
            disabled={isRefreshing || isLoggingOut}
          >
            {isLoggingOut
              ? t("sessionWarning.loggingOut")
              : t("sessionWarning.logout")}
          </button>
        </div>
      </div>
    </m.div>
  );
};

export { SessionExpiryWarning };
