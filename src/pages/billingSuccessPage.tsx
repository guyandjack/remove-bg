import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { useTranslation } from "react-i18next";
import { SEO } from "@/components/SEO";
import { api } from "@/utils/axiosConfig";
import { setSessionFromApiResponse } from "@/stores/session";

type UiState = "loading" | "processing" | "success" | "attention";
type AttentionKind =
  | "missing_session"
  | "payment_failed"
  | "session_expired"
  | "provisioning_failed"
  | "technical_issue"
  | "unknown";

type BillingStatus = "paid_active" | "processing" | "failed" | "paid_but_provisioning_failed";

type BillingStatusResponse = {
  success: true;
  status: BillingStatus;
  stripe?: {
    payment_status: string | null;
    session_status: string | null;
    subscription_status: string | null;
    invoice_status: string | null;
  };
  db?: unknown;
  message?: string;
};

type FinalizeResponse = {
  status: "success" | "pending" | "error";
  message?: string;
  code?: string;
};

const POLL_INTERVAL_MS = 2000;
const LONG_WAIT_MS = 45_000;
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

export const BillingSuccessPage = ({ routeKey }: { routeKey: string }) => {
  const { t } = useTranslation();
  const location = useLocation();

  const [uiState, setUiState] = useState<UiState>("loading");
  const [attentionKind, setAttentionKind] = useState<AttentionKind | null>(null);
  const [messageKey, setMessageKey] = useState<string>("billingSuccess.messages.processing");
  const [pollTicks, setPollTicks] = useState<number>(0);

  const pollingRef = useRef<number | null>(null);
  const finalizedRef = useRef<boolean>(false);
  const consecutivePollErrorsRef = useRef<number>(0);

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("session_id") || "";
  }, [routeKey]);

  const stopPolling = () => {
    if (typeof window === "undefined") return;
    if (!pollingRef.current) return;
    window.clearInterval(pollingRef.current);
    pollingRef.current = null;
  };

  const startPolling = () => {
    if (typeof window === "undefined") return;
    if (pollingRef.current) return;
    pollingRef.current = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS) as any;
  };

  const clearCheckoutSessionFromUrl = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("session_id")) return;
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", url.toString());
  };

  const goToPricing = () => location.route("/pricing");
  const goToServices = () => location.route("/services");
  const goToContact = () => location.route("/contact");

  const finalizeIfPossible = async () => {
    if (!sessionId) return;
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    try {
      const resp = await api.post<FinalizeResponse | any>(
        "/api/stripe/finalize",
        { sessionId },
        { withCredentials: true },
      );

      const data = resp?.data as FinalizeResponse | undefined;
      if (data?.status === "pending") {
        finalizedRef.current = false;
        return;
      }
      if (data?.status === "success") {
        setSessionFromApiResponse(resp.data);
        setUiState("success");
        setAttentionKind(null);
        setMessageKey("billingSuccess.messages.success");
        stopPolling();
        clearCheckoutSessionFromUrl();
        setTimeout(() => goToServices(), 1200);
        return;
      }

      // Unexpected payload or explicit error: keep polling a bit, but give the user a safe fallback.
      finalizedRef.current = false;
      consecutivePollErrorsRef.current += 1;
      if (consecutivePollErrorsRef.current >= MAX_CONSECUTIVE_POLL_ERRORS) {
        setUiState("attention");
        setAttentionKind("technical_issue");
        setMessageKey("billingSuccess.messages.technicalIssue");
        stopPolling();
      }
    } catch {
      finalizedRef.current = false;
      consecutivePollErrorsRef.current += 1;
      if (consecutivePollErrorsRef.current >= MAX_CONSECUTIVE_POLL_ERRORS) {
        setUiState("attention");
        setAttentionKind("technical_issue");
        setMessageKey("billingSuccess.messages.technicalIssue");
        stopPolling();
      }
    }
  };

  const poll = async () => {
    setPollTicks((v) => v + 1);

    if (!sessionId) {
      setUiState("attention");
      setAttentionKind("missing_session");
      setMessageKey("billingSuccess.messages.missingSession");
      stopPolling();
      return;
    }

    try {
      const resp = await api.get<BillingStatusResponse>(
        `/api/billing/status?session_id=${encodeURIComponent(sessionId)}`,
      );
      if (resp?.data?.success !== true) throw new Error("status_failed");

      consecutivePollErrorsRef.current = 0;

      const status = resp.data.status;
      if (status === "paid_active") {
        setUiState("processing");
        setAttentionKind(null);
        setMessageKey("billingSuccess.messages.paidWaitingDb");
        await finalizeIfPossible();
        return;
      }

      if (status === "paid_but_provisioning_failed") {
        setUiState("attention");
        setAttentionKind("provisioning_failed");
        setMessageKey("billingSuccess.messages.provisioningFailed");
        stopPolling();
        return;
      }

      if (status === "failed") {
        const stripeSessionStatus = String(resp.data?.stripe?.session_status || "");
        setUiState("attention");
        setAttentionKind(
          stripeSessionStatus === "expired" ? "session_expired" : "payment_failed",
        );
        setMessageKey(
          stripeSessionStatus === "expired"
            ? "billingSuccess.messages.paymentExpired"
            : "billingSuccess.messages.paymentFailed",
        );
        stopPolling();
        return;
      }

      setUiState("processing");
      setAttentionKind(null);
      setMessageKey("billingSuccess.messages.processing");
    } catch {
      consecutivePollErrorsRef.current += 1;

      if (consecutivePollErrorsRef.current >= MAX_CONSECUTIVE_POLL_ERRORS) {
        setUiState("attention");
        setAttentionKind("technical_issue");
        setMessageKey("billingSuccess.messages.technicalIssue");
        stopPolling();
        return;
      }

      setUiState("processing");
      setAttentionKind(null);
      setMessageKey("billingSuccess.messages.processing");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    consecutivePollErrorsRef.current = 0;
    setPollTicks(0);

    void poll();
    startPolling();
    return () => stopPolling();
  }, [routeKey]);

  const elapsedMs = pollTicks * POLL_INTERVAL_MS;
  const isLongWait = uiState === "processing" && elapsedMs >= LONG_WAIT_MS;

  const actions = useMemo(() => {
    const common = {
      contact: { id: "contact", label: t("billingSuccess.actions.contact"), onClick: goToContact },
      services: { id: "services", label: t("billingSuccess.actions.services"), onClick: goToServices },
      pricing: { id: "pricing", label: t("billingSuccess.actions.pricing"), onClick: goToPricing },
      retryActivation: {
        id: "retryActivation",
        label: t("billingSuccess.actions.retryActivation"),
        onClick: async () => {
          setUiState("processing");
          setAttentionKind(null);
          setMessageKey("billingSuccess.messages.processing");
          startPolling();
          await finalizeIfPossible();
        },
      },
    };

    if (uiState === "success") {
      return { primary: common.services, secondary: [common.contact] };
    }

    if (uiState === "processing") {
      // Avoid encouraging a second payment while Stripe confirmation might still be in flight.
      return isLongWait
        ? { primary: common.contact, secondary: [common.pricing] }
        : { primary: common.contact, secondary: [] };
    }

    // attention
    switch (attentionKind) {
      case "provisioning_failed":
        // Payment may already be confirmed; retry activation is safe, retrying payment is not.
        return { primary: common.retryActivation, secondary: [common.contact, common.services] };
      case "missing_session":
        return { primary: common.pricing, secondary: [common.contact] };
      case "session_expired":
      case "payment_failed":
        return { primary: common.pricing, secondary: [common.contact] };
      case "technical_issue":
        return { primary: common.contact, secondary: [common.pricing] };
      default:
        return { primary: common.contact, secondary: [common.pricing] };
    }
  }, [attentionKind, goToContact, goToPricing, goToServices, isLongWait, uiState, t]);

  return (
    <div className="page-container page-container--center min-h-[100vh] lg:min-h-[calc(100vh_-_315px)]">
      <SEO
        content={{
          title: `${t("billingSuccess.messages.title")} | WizPix`,
          description: "Page de confirmation de paiement WizPix.",
        }}
      />
      <div className="card bg-component shadow-sm w-full max-w-lg">
        <div className="card-body">
          <h1 className="text-2xl font-bold">{t("billingSuccess.messages.title")}</h1>

          <p className="text-base-content/70">{t(messageKey)}</p>

          {uiState === "processing" || uiState === "loading" ? (
            <div className="mt-4 flex items-center gap-2">
              <span className="loading loading-bars loading-sm loading-info text-info" />
              <span className="text-sm text-base-content/70">
                {t("billingSuccess.messages.doNotRetry")}
              </span>
            </div>
          ) : null}

          {isLongWait ? (
            <div className="mt-4">
              <div role="alert" className="alert alert-warning">
                <span className="text-sm">{t("billingSuccess.messages.takingLong")}</span>
              </div>
            </div>
          ) : null}

          {uiState === "attention" ? (
            <p className="mt-4 text-sm text-base-content/70">
              {t("billingSuccess.messages.fallbackContact")}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={actions.primary.onClick}>
              {actions.primary.label}
            </button>
            {actions.secondary.map((a) => (
              <button key={a.id} className="btn btn-ghost" onClick={a.onClick}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
