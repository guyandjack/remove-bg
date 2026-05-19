import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { sessionSignal } from "@/stores/session";
import { refreshAccessToken } from "@/utils/axiosConfig";
import { logoutClient } from "@/utils/auth/logout";
import { navigateWithLink } from "@/utils/navigateWithLink";

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

const WARNING_LEAD_MS = 5 * 60 * 1000;

const SessionExpiryWarning = () => {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [feedback, setFeedback] = useState<"idle" | "success" | "error">("idle");

  const warnTimeoutRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const didAutoLogoutRef = useRef(false);

  const token = sessionSignal.value?.token || null;
  const isAuth = Boolean(sessionSignal.value?.authentified);

  const sessionExpiresAtMs = useMemo(() => {
    if (!token || typeof token !== "string") return null;
    const decoded = decodeJwtPayload(token);
    if (!decoded) return null;

    const rtExp = decoded.rtExp;
    const refreshExp = decoded.refreshExp;
    const accessExp = decoded.exp;

    const expSeconds =
      typeof rtExp === "number"
        ? rtExp
        : typeof refreshExp === "number"
          ? refreshExp
          : typeof accessExp === "number"
            ? accessExp
            : null;

    return expSeconds ? expSeconds * 1000 : null;
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

    if (!isAuth || !sessionExpiresAtMs) return;

    const tick = () => {
      const remainingMs = sessionExpiresAtMs - Date.now();
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

    const warnStartMs = sessionExpiresAtMs - WARNING_LEAD_MS;
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
  }, [isAuth, sessionExpiresAtMs]);

  const isVisible = secondsLeft !== null && secondsLeft <= Math.ceil(WARNING_LEAD_MS / 1000);

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
    <div className="toast toast-top toast-center z-50 mt-16">
      <div className="alert alert-warning shadow-lg gap-3 flex items-center">
        <div className="flex flex-col">
          <span className="font-semibold">{t("sessionWarning.title")}</span>
          <span className="text-sm">
            {t("sessionWarning.message", { time: formatSeconds(secondsLeft ?? 0) })}
          </span>
          {feedback === "success" ? (
            <span className="text-sm">{t("sessionWarning.success")}</span>
          ) : feedback === "error" ? (
            <span className="text-sm">{t("sessionWarning.error")}</span>
          ) : null}
        </div>

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={keepAlive}
            disabled={isRefreshing || isLoggingOut}
          >
            {isRefreshing ? t("sessionWarning.refreshing") : t("sessionWarning.keep")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={logout}
            disabled={isRefreshing || isLoggingOut}
          >
            {isLoggingOut ? t("sessionWarning.loggingOut") : t("sessionWarning.logout")}
          </button>
        </div>
      </div>
    </div>
  );
};

export { SessionExpiryWarning };
