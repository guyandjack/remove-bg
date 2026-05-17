import { useEffect, useRef, useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { useTranslation } from "react-i18next";
import { api } from "@/utils/axiosConfig";
import { setSessionFromApiResponse } from "@/stores/session";

type UiState = "loading" | "processing" | "success" | "failed";

export const BillingSuccessPage = ({ routeKey }: { routeKey: string }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [state, setState] = useState<UiState>("loading");
  const [message, setMessage] = useState<string>("");
  const pollingRef = useRef<number | null>(null);
  const finalizedRef = useRef<boolean>(false);

  const sessionId = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("session_id") || "";
    } catch {
      return "";
    }
  })();

  const stopPolling = () => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const finalizeIfPossible = async () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    try {
      const resp = await api.post(
        "/api/stripe/finalize",
        { sessionId },
        { withCredentials: true }
      );
      if (resp?.data?.status === "pending") {
        finalizedRef.current = false;
        return;
      }
      if (resp?.data?.status === "success") {
        setSessionFromApiResponse(resp.data);
        setState("success");
        setMessage(t("billingSuccess.success"));
        stopPolling();
        setTimeout(() => location.route("/services"), 1200);
        return;
      }
      // If unexpected payload, keep polling
      finalizedRef.current = false;
    } catch {
      finalizedRef.current = false;
    }
  };

  const poll = async () => {
    if (!sessionId) {
      setState("failed");
      setMessage(t("billingSuccess.missingSession"));
      stopPolling();
      return;
    }
    try {
      const resp = await api.get(`/api/billing/status?session_id=${encodeURIComponent(sessionId)}`);
      if (resp?.data?.success !== true) throw new Error("status_failed");
      const status = resp.data.status as string;
      if (status === "paid_active") {
        setState("processing");
        setMessage(t("billingSuccess.paidWaitingDb"));
        await finalizeIfPossible();
        return;
      }
      if (status === "paid_but_provisioning_failed") {
        setState("failed");
        setMessage(t("billingSuccess.provisioningFailed"));
        stopPolling();
        return;
      }
      if (status === "failed") {
        setState("failed");
        setMessage(t("billingSuccess.failed"));
        stopPolling();
        return;
      }
      setState("processing");
      setMessage(t("billingSuccess.processing"));
    } catch {
      setState("processing");
      setMessage(t("billingSuccess.processing"));
    }
  };

  useEffect(() => {
    poll();
    pollingRef.current = window.setInterval(poll, 2000) as any;
    return () => stopPolling();
  }, [routeKey]);

  return (
    <div className="page-container h-[100vh] lg:h-[calc(100vh_-_315px)]">
      <div className="max-w-xl mx-auto mt-10 card bg-component border border-base-300 shadow-sm">
        <div className="card-body">
          <h1 className="text-2xl font-bold">{t("billingSuccess.title")}</h1>
          <p className="text-base-content/70">{message}</p>
          {state === "processing" || state === "loading" ? (
            <div className="mt-4 flex items-center gap-2">
              <span className="loading loading-bars loading-sm" />
              <span className="text-sm text-base-content/70">{t("billingSuccess.doNotRetry")}</span>
            </div>
          ) : null}
          {state === "failed" ? (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    setState("processing");
                    setMessage(t("billingSuccess.processing"));
                    await finalizeIfPossible();
                  }}
                >
                  {t("billingSuccess.retryProvisioning")}
                </button>
                <button className="btn btn-ghost" onClick={() => location.route("/services")}>
                  {t("billingSuccess.backDashboard")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
