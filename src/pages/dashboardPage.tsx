//import des hooks
import { useLocation } from "preact-iso";
import { useEffect, useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import axios from "axios";

//import des composant enfant
import { PriceCard } from "@/components/card/priceCard";
import { FormResetPassword } from "@/components/form/FormResetPassword";
import { FormDeleteReasonAccount } from "@/components/form/formDeleteReasonAccount";

//instance axios
import { api } from "@/utils/axiosConfig";

//import des fonctions
import { initSessionFromLocalStorage, sessionSignal } from "@/stores/session";
import { isAuthentified } from "@/utils/request/isAuthentified";
import { setActiveLink } from "@/utils/setActiveLink";
import { setDocumentTitle } from "@/utils/setDocumentTitle";

type SubmitState = "idle" | "loading" | "success" | "error";
type CurrencyCode = "CHF" | "EUR" | "USD";
type BillingAccountState = {
  customer?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
  subscription: null | {
    subscription_status: string;
    stripe_cancel_at_period_end: boolean;
    plan_access_until_iso: string | null;
    plan_access_until_date: string | null;
    plan_name: string | null;
    plan_code?: string | null;
    pending_change_type?: string | null;
    pending_change_effective_at?: string | null;
    period_start?: string | null;
    period_end?: string | null;
    period_start_date?: string | null;
    period_end_date?: string | null;
  };
  marketing: {
    marketing_consent: boolean;
    marketing_consent_updated_at: string | null;
  };
  account: {
    account_deletion_requested: boolean;
    account_deletion_requested_at: string | null;
  };
};

type PropsPage = {
  routeKey: string;
};

const DashboardPage = ({ routeKey }: PropsPage) => {
  const [cancelSubmitting, setCancelSubmitting] = useState<SubmitState>("idle");
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [billingSubmitting, setBillingSubmitting] =
    useState<SubmitState>("idle");
  const [billingState, setBillingState] = useState<BillingAccountState | null>(
    null,
  );
  const [marketingSubmitting, setMarketingSubmitting] =
    useState<SubmitState>("idle");
  const [marketingMessage, setMarketingMessage] = useState<string | null>(null);
  const [deletionSubmitting, setDeletionSubmitting] =
    useState<SubmitState>("idle");
  const [deletionMessage, setDeletionMessage] = useState<string | null>(null);
  const [deletionFeedbackToken, setDeletionFeedbackToken] = useState<
    string | null
  >(null);
  const [pendingDeletionToast, setPendingDeletionToast] = useState<{
    status: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>("");
  const [planModalStep, setPlanModalStep] = useState<"select" | "confirm">(
    "select",
  );
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [planChangeSubmitting, setPlanChangeSubmitting] =
    useState<SubmitState>("idle");
  const [planChangeMessage, setPlanChangeMessage] = useState<string | null>(
    null,
  );
  const [actionToast, setActionToast] = useState<{
    status: "idle" | "success" | "error" | "info";
    message: string | null;
  }>({ status: "idle", message: null });
  const actionToastTimeoutRef = useRef<number | null>(null);
  const { t } = useTranslation();
  const dashboardActionBtn = "btn btn-sm min-w-[180px]";
  const location = useLocation();

  const currency: CurrencyCode = "CHF";
  const textLangCard = {
    tag: t("priceCard.tag"),
    remove_bg: t("priceCard.remove_bg"),
    conversion: t("priceCard.conversion"),
    price: t("priceCard.price"),
    credit: t("priceCard.credit"),
    conversions_suffix: t("priceCard.conversions_suffix"),
    unlimited: t("priceCard.unlimited"),
    size_max: t("priceCard.size_max"),
    tools: t("priceCard.tools"),
    gomme_magique: t("priceCard.gomme_magique"),
    Image_pexels: t("priceCard.img_pexels"),
    api: t("priceCard.api"),
    bundle: t("priceCard.bundle"),
    subscribe: t("dashboardPage.billing.subscription.selectPlanCta"),
  };

  useEffect(() => {
    setActiveLink();
    setDocumentTitle();
  }, [routeKey]);

  // Auth + hydration guard
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      // Rehydrate session first
      initSessionFromLocalStorage();

      // 1) Early redirect if no token at all (use hydrated signal only)
      const token = sessionSignal?.value?.token;
      if (!token) {
        const redirect = encodeURIComponent("/dashboard");
        location.route(`/login?redirect=${redirect}`);
        return;
      }

      // 2) Verify with API (uses axios interceptors for refresh)
      try {
        await isAuthentified();
        if (!mounted) return;
        if (sessionSignal?.value && sessionSignal.value.authentified !== true) {
          sessionSignal.value = {
            ...sessionSignal.value,
            authentified: true,
          } as any;
        }

        // Fetch billing/account state for the dashboard (subscription/marketing/account flags)
        setBillingSubmitting("loading");
        try {
          const resp = await api.get("/api/account/billing-account");
          if (!mounted) return;
          if (resp?.data?.success && resp.data) {
            setBillingState(resp.data as any);
            setBillingSubmitting("success");
          } else {
            setBillingSubmitting("error");
          }
        } catch {
          if (!mounted) return;
          setBillingSubmitting("error");
        } finally {
          setTimeout(() => mounted && setBillingSubmitting("idle"), 1200);
        }
      } catch {
        if (!mounted) return;
        const redirect = encodeURIComponent("/dashboard");
        location.route(`/login?redirect=${redirect}`);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (actionToastTimeoutRef.current) {
        window.clearTimeout(actionToastTimeoutRef.current);
      }
    };
  }, []);

  const pushActionToast = (payload: {
    status: "success" | "error" | "info";
    message: string;
  }) => {
    setActionToast({ status: payload.status, message: payload.message });
    if (typeof window === "undefined") return;
    if (actionToastTimeoutRef.current)
      window.clearTimeout(actionToastTimeoutRef.current);
    actionToastTimeoutRef.current = window.setTimeout(() => {
      setActionToast({ status: "idle", message: null });
      actionToastTimeoutRef.current = null;
    }, 4500);
  };

  type DashboardAction =
    | "subscription_cancel"
    | "subscription_resume"
    | "plan_change"
    | "account_deletion";

  const normalizeIsoDate = (input: unknown): string | null => {
    if (typeof input !== "string") return null;
    const raw = input.trim();
    if (!raw) return null;
    // Accept both YYYY-MM-DD and full ISO (YYYY-MM-DDTHH:mm:ssZ) and return YYYY-MM-DD.
    const ymd = raw.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
  };

  const resolveDashboardApiErrorMessage = (
    action: DashboardAction,
    error: unknown,
  ): string => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = (error.response?.data || {}) as any;
      const errorCode = typeof data?.errorCode === "string" ? data.errorCode : "";

      // Network / CORS / timeout (no HTTP response).
      if (!status) return t("dashboardPage.errors.network");

      // Auth (token missing/expired/invalid). Backends in this repo often use `errorCode: veri*`.
      if (status === 401 || errorCode.startsWith("veri"))
        return t("dashboardPage.errors.sessionExpired");

      // Stripe/payment related
      if (action === "plan_change" && status === 402)
        return t("dashboardPage.billing.subscription.paymentFailed");

      // Conflicts: concurrent billing actions / already pending plan change / Stripe lock.
      if (status === 409) {
        if (action === "plan_change")
          return t("dashboardPage.billing.subscription.changePlanAlreadyPending");
        return t("dashboardPage.errors.actionInProgress");
      }
    }

    // Action-scoped fallback (avoid leaking backend `message` to the customer).
    if (action === "subscription_cancel")
      return t("dashboardPage.subscription.cancelError");
    if (action === "subscription_resume")
      return t("dashboardPage.billing.subscription.resumeError");
    if (action === "plan_change")
      return t("dashboardPage.billing.subscription.changePlanError");
    return t("dashboardPage.billing.account.deletionError");
  };

  const creditsRemaining =
    sessionSignal?.value?.credits?.remaining_last_24h ?? 0;
  const creditsUsed = sessionSignal?.value?.credits?.used_last_24h ?? 0;
  const planName =
    sessionSignal?.value?.plan?.name || sessionSignal?.value?.plan?.code || "-";
  const userDisplayName = (() => {
    const first = billingState?.customer?.first_name?.trim() || "";
    const last = billingState?.customer?.last_name?.trim() || "";
    const full = `${first} ${last}`.trim();
    if (full) return full;
    return (
      sessionSignal?.value?.user?.first_name ||
      sessionSignal?.value?.user?.email ||
      "-"
    );
  })();
  const billingPeriodRange = ((): any => {
    const start = billingState?.subscription?.period_start_date || "";
    const end = billingState?.subscription?.period_end_date || "";
    //if (start && end) return `Du ${start} <br>au ${end}`;
    if (start && end)
      return {
        start: start,
        end: end,
      };
    if (end) return end;
    return "-";
  })();

  const handleCancelSubscription = async () => {
    setCancelSubmitting("loading");
    setCancelMessage(null);
    try {
      const resp = await api.post("/api/subscription/cancel");
      const accessUntil = normalizeIsoDate(resp?.data?.plan_access_until);
      const msg = accessUntil
        ? t("dashboardPage.subscription.cancelSuccessWithDate", {
            date: accessUntil,
          })
        : t("dashboardPage.subscription.cancelSuccess");
      setCancelMessage(msg);
      setCancelSubmitting("success");
      pushActionToast({ status: "success", message: msg });

      // Refresh billing state to show canceling + access until
      try {
        const st = await api.get("/api/account/billing-account");
        if (st?.data?.success) setBillingState(st.data as any);
      } catch {}
    } catch (e: any) {
      setCancelSubmitting("error");
      const msg = resolveDashboardApiErrorMessage("subscription_cancel", e);
      setCancelMessage(msg);
      pushActionToast({ status: "error", message: msg });
    } finally {
      setTimeout(() => setCancelSubmitting("idle"), 2500);
    }
  };

  const handleResumeSubscription = async () => {
    setCancelSubmitting("loading");
    setCancelMessage(null);
    try {
      await api.post("/api/subscription/resume");
      const msg = t("dashboardPage.billing.subscription.resumeSuccess");
      setCancelMessage(msg);
      setCancelSubmitting("success");
      pushActionToast({ status: "success", message: msg });

      try {
        const st = await api.get("/api/account/billing-account");
        if (st?.data?.success) setBillingState(st.data as any);
      } catch {}
    } catch (e: any) {
      setCancelSubmitting("error");
      const msg = resolveDashboardApiErrorMessage("subscription_resume", e);
      setCancelMessage(msg);
      pushActionToast({ status: "error", message: msg });
    } finally {
      setTimeout(() => setCancelSubmitting("idle"), 2500);
    }
  };

  const handleToggleMarketingConsent = async () => {
    if (!billingState) return;
    if (marketingSubmitting === "loading") return;
    const nextValue = !billingState.marketing.marketing_consent;

    setMarketingSubmitting("loading");
    setMarketingMessage(null);
    try {
      const resp = await api.post("/api/marketing/consent", {
        marketing_consent: nextValue,
      });
      if (resp?.data?.success !== true)
        throw new Error("marketing_update_failed");
      setMarketingSubmitting("success");
      {
        // Update local UI only after backend validation (no optimistic flip).
        setBillingState((prev) =>
          prev
            ? {
                ...prev,
                marketing: {
                  ...prev.marketing,
                  marketing_consent: nextValue,
                },
              }
            : prev,
        );
        const msg = t("dashboardPage.billing.marketing.success");
        setMarketingMessage(msg);
        pushActionToast({ status: "success", message: msg });
      }
      // Refresh from backend (source of truth)
      const st = await api.get("/api/account/billing-account");
      if (st?.data?.success) setBillingState(st.data as any);
    } catch {
      setMarketingSubmitting("error");
      {
        const msg = t("dashboardPage.billing.marketing.error");
        setMarketingMessage(msg);
        pushActionToast({ status: "error", message: msg });
      }
      // Reload state (source of truth) to avoid any stale UI.
      try {
        const st = await api.get("/api/account/billing-account");
        if (st?.data?.success) setBillingState(st.data as any);
      } catch {}
    } finally {
      setTimeout(() => setMarketingSubmitting("idle"), 2000);
    }
  };

  const handleAccountDeletionRequest = async () => {
    if (deletionSubmitting === "loading") return;
    setDeletionSubmitting("loading");
    setDeletionMessage(null);
    try {
      const resp = await api.post("/api/account/deletion-request");
      if (resp?.data?.success !== true) throw new Error("deletion_failed");
      setDeletionSubmitting("success");
      {
        const msg = t("dashboardPage.billing.account.deletionSuccess");
        setDeletionMessage(msg);
        // Toast is displayed only AFTER the post-action modal is closed.
        setPendingDeletionToast({ status: "success", message: msg });
      }

      // Refresh local billing state so the UI is immediately consistent (actions disabled, etc.).
      try {
        const st = await api.get("/api/account/billing-account");
        if (st?.data?.success) setBillingState(st.data as any);
      } catch {}

      const feedbackToken =
        typeof resp?.data?.deletion_feedback_token === "string"
          ? resp.data.deletion_feedback_token
          : null;
      // Always open the modal. Redirection is only driven by the modal close/submit flow.
      setDeletionFeedbackToken(feedbackToken);
      const dialog = document.getElementById(
        "account_deletion_feedback_modal",
      ) as HTMLDialogElement | null;
      dialog?.showModal?.();
    } catch (e: any) {
      setDeletionSubmitting("error");
      {
        const msg = resolveDashboardApiErrorMessage("account_deletion", e);
        setDeletionMessage(msg);
        pushActionToast({ status: "error", message: msg });
      }
    } finally {
      setTimeout(() => setDeletionSubmitting("idle"), 2500);
    }
  };

  const closeDeletionFeedbackModal = () => {
    // Close modal first, then show feedback (toast), then finalize local logout.
    try {
      const dialog = document.getElementById(
        "account_deletion_feedback_modal",
      ) as HTMLDialogElement | null;
      dialog?.close?.();
    } catch {}

    if (pendingDeletionToast) {
      pushActionToast(pendingDeletionToast);
      setPendingDeletionToast(null);
    }

    // Finalize deletion on the client side AFTER collecting (or skipping) feedback.
    // Small delay so the toast can be perceived after the modal closes (UX).
    window.setTimeout(() => {
      try {
        localStorage.removeItem("session");
      } catch {}
      try {
        sessionSignal.value = {
          ...(sessionSignal.value as any),
          token: null,
          authentified: false,
        } as any;
      } catch {}
      location.route("/");
    }, 1200);
  };

  const openPlanChangeModal = async () => {
    setPlanModalStep("select");
    setSelectedPlan(null);
    setPlanChangeMessage(null);
    setPlanChangeSubmitting("idle");
    try {
      const resp = await api.get("/api/plan/option");
      const plans = resp?.data?.plans;
      if (Array.isArray(plans)) {
        // Keep inactive plans visible (disabled in UI) to avoid an empty modal when only inactive plans exist.
        setAvailablePlans(plans.filter((p) => p));
      } else {
        setAvailablePlans([]);
      }
    } catch {
      setAvailablePlans([]);
    } finally {
      const dialog = document.getElementById(
        "plan_change_modal",
      ) as HTMLDialogElement | null;
      dialog?.showModal?.();
    }
  };

  const closePlanChangeModal = () => {
    setPlanModalStep("select");
    setSelectedPlan(null);
    setPlanChangeMessage(null);
    setPlanChangeSubmitting("idle");
    const dialog = document.getElementById(
      "plan_change_modal",
    ) as HTMLDialogElement | null;
    dialog?.close?.();
  };

  const currentPlanCode =
    billingState?.subscription?.plan_code ||
    sessionSignal?.value?.plan?.code ||
    "";

  const currentPlan =
    availablePlans.find((p) => p?.name === currentPlanCode) || null;
  const selectablePlans = availablePlans.filter(
    (p) =>
      p?.name &&
      p.name !== currentPlanCode &&
      // Le plan "pro" n'est pas supporté côté produit, on ne l'affiche pas.
      p.name !== "pro",
  );

  const resolveSelectedChangeType = (
    plan: any,
  ): "upgrade" | "downgrade" | "same" => {
    if (!currentPlan) return "upgrade";
    const currentPrice = Number(currentPlan?.price ?? 0);
    const targetPrice = Number(plan?.price ?? 0);
    if (targetPrice > currentPrice) return "upgrade";
    if (targetPrice < currentPrice) return "downgrade";
    return "same";
  };

  const confirmPlanChange = async () => {
    if (!selectedPlan) return;
    if ((selectedPlan as any)?.active === false) return;
    setPlanChangeSubmitting("loading");
    setPlanChangeMessage(null);
    try {
      const resp = await api.post("/api/subscription/change-plan", {
        plan_code: selectedPlan.name,
        currency: currency,
      });
      if (resp?.data?.success !== true) throw new Error("change_plan_failed");
      if (
        resp?.data?.redirectUrl &&
        typeof resp.data.redirectUrl === "string"
      ) {
        setPlanChangeSubmitting("success");
        setPlanChangeMessage(t("dashboardPage.billing.subscription.checkoutRedirect"));
        setTimeout(() => {
          window.location.assign(resp.data.redirectUrl);
        }, 3000);
        return;
      }
      setPlanChangeSubmitting("success");
      const pending = resp?.data?.pending === true;
      const changeType = typeof resp?.data?.change_type === "string" ? resp.data.change_type : "";
      const effectiveAt = normalizeIsoDate(resp?.data?.effective_at);

      const msg =
        pending && changeType === "upgrade"
          ? t("dashboardPage.billing.subscription.changePlanPendingUpgrade")
          : pending && changeType === "downgrade" && effectiveAt
            ? t("dashboardPage.billing.subscription.changePlanPendingDowngrade", {
                date: effectiveAt,
              })
            : t("dashboardPage.billing.subscription.changePlanSuccess");

      setPlanChangeMessage(msg);
      try {
        const st = await api.get("/api/account/billing-account");
        if (st?.data?.success) setBillingState(st.data as any);
      } catch {}
      setTimeout(() => {
        const dialog = document.getElementById(
          "plan_change_modal",
        ) as HTMLDialogElement | null;
        dialog?.close?.();
      }, 800);
    } catch (e: any) {
      setPlanChangeSubmitting("error");
      setPlanChangeMessage(
        resolveDashboardApiErrorMessage("plan_change", e),
      );
    } finally {
      setTimeout(() => setPlanChangeSubmitting("idle"), 2500);
    }
  };

  return (
    <div className="page-container">
      {actionToast.status !== "idle" ? (
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
          <div className="toast toast-top toast-center mt-20">
            <p
              className={`alert pointer-events-auto ${
                actionToast.status === "success"
                  ? "alert-success"
                  : actionToast.status === "error"
                    ? "alert-error"
                    : "alert-info"
              }`}
            >
              <span>{actionToast.message}</span>
            </p>
          </div>
        </div>
      ) : null}
      <div className="mb-8">
        <h1 className="text-3xl text-center lg:text-4xl font-bold">
          {t("dashboardPage.title")}
        </h1>
        <p className="text-base-content/70 mt-2">
          {t("dashboardPage.subtitle")}
        </p>
      </div>

      <div className="flex flex-col items-center md:flex-row md:flex-wrap md:justify-center  gap-4 max-w-[992px]">
        <div className="w-[200px] h-[100px] stat bg-component rounded-xl border border-base-300">
          <div className="stat-title">{t("dashboardPage.stats.user")}</div>
          <div className="stat-value text-primary truncate text-base">
            {userDisplayName}
          </div>
        </div>
        <div className="w-[200px] h-[100px] stat bg-component rounded-xl border border-base-300">
          <div className="stat-title">{t("dashboardPage.stats.planTitle")}</div>
          <div className="stat-value text-success">{planName}</div>
        </div>
        <div className="w-[200px] h-[100px] stat bg-component rounded-xl border border-base-300">
          <div className="stat-desc">
            {t("dashboardPage.stats.billingPeriod")}
          </div>
          <div className="stat-title">
            <p>
              <span>du </span>
              <span
                className="stat-value text-dark text-base"
                dangerouslySetInnerHTML={{ __html: billingPeriodRange.start }}
              ></span>
            </p>
            <p>
              <span>au </span>
              <span
                className="stat-value text-dark text-base"
                dangerouslySetInnerHTML={{ __html: billingPeriodRange.end }}
              ></span>
            </p>
          </div>
        </div>
        <div className="p-2 border rounded-xl border-primary/70">
          <p className={"text-sm py-2"}>Supression d'arriere plan</p>
          <div
            className={
              "flex flex-col justify-start items-center gap-2 md: flex-row"
            }
          >
            <div className="w-[200px] h-[100px] stat bg-component rounded-xl border border-base-300">
              <div className="stat-title">
                {t("dashboardPage.stats.creditsRemainingTitle")}
              </div>
              <div className="stat-value text-primary">{creditsRemaining}</div>
            </div>

            <div className="w-[200px] h-[100px] stat bg-component rounded-xl border border-base-300">
              <div className="stat-title">
                {t("dashboardPage.stats.creditsUsedTitle")}
              </div>
              <div className="stat-value text-info">{creditsUsed}</div>
            </div>
          </div>
        </div>
        <div className="p-2 border rounded-xl border-secondary/70">
          <p className={"text-sm py-2"}>Convertion de fichiers image</p>
          <div
            className={
              "flex flex-col justify-start items-center gap-2 md: flex-row"
            }
          >
            <div className="w-[200px] h-[100px] stat bg-component rounded-xl border border-base-300">
              <div className="stat-title">
                {t("dashboardPage.stats.creditsRemainingTitleConverter")}
              </div>
              <div className="stat-value text-secondary">
                {creditsRemaining}
              </div>
            </div>

            <div className="w-[200px] h-[100px] stat bg-component rounded-xl border border-base-300">
              <div className="stat-title">
                {t("dashboardPage.stats.creditsUsedTitleConverter")}
              </div>
              <div className="stat-value text-secondary">{creditsUsed}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[1300px]">
        <section className="lg:col-span-2 card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">{t("dashboardPage.billing.title")}</h2>
            <p className="text-base-content/70">
              {t("dashboardPage.billing.description")}
            </p>

            {billingSubmitting === "error" ? (
              <div role="alert" className="alert alert-error mt-4">
                <span>{t("dashboardPage.billing.loadError")}</span>
              </div>
            ) : null}

            {/* Abonnement */}
            <div className="mt-4 rounded-xl bg-component border border-base-300 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">
                    {t("dashboardPage.billing.subscription.title")}
                  </h3>
                  <p className="text-base-content/70 text-sm mt-1">
                    {t("dashboardPage.billing.subscription.statusLabel")}:{" "}
                    {billingState?.subscription?.subscription_status ||
                      t("dashboardPage.billing.subscription.statusUnknown")}
                  </p>
                  {billingState?.subscription?.subscription_status ===
                  "canceling" ? (
                    <p className="text-base-content/70 text-sm mt-1">
                      {t("dashboardPage.billing.subscription.accessUntilLabel")}
                      :{" "}
                      {billingState.subscription.plan_access_until_date || "-"}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    className={`${dashboardActionBtn} btn-info btn-outline`}
                    onClick={openPlanChangeModal}
                  >
                    {t("dashboardPage.billing.subscription.changeCta")}
                  </button>

                  {billingState?.subscription?.subscription_status ===
                  "canceling" ? (
                    <button
                      className={`${dashboardActionBtn} btn-outline btn-success`}
                      disabled={
                        currentPlanCode === "free" ||
                        cancelSubmitting === "loading" ||
                        billingState?.account?.account_deletion_requested
                      }
                      onClick={handleResumeSubscription}
                    >
                      {cancelSubmitting === "loading" ? (
                        <span className="loading loading-bars loading-sm text-info" />
                      ) : null}
                      {t("dashboardPage.billing.subscription.resumeCta")}
                    </button>
                  ) : (
                    <button
                      className={`${dashboardActionBtn} btn-outline btn-error`}
                      disabled={
                        currentPlanCode === "free" ||
                        cancelSubmitting === "loading" ||
                        billingState?.account?.account_deletion_requested
                      }
                      onClick={() => {
                        const dialog = document.getElementById(
                          "cancel_sub_modal",
                        ) as HTMLDialogElement | null;
                        dialog?.showModal?.();
                      }}
                    >
                      {cancelSubmitting === "loading" ? (
                        <span className="loading loading-bars loading-sm text-info" />
                      ) : null}
                      {t("dashboardPage.billing.subscription.cancelCta")}
                    </button>
                  )}
                </div>
              </div>

              {billingState?.subscription?.subscription_status ===
              "canceling" ? (
                <p className="text-base-content/70 text-sm mt-3">
                  {t("dashboardPage.billing.subscription.resumeHelp")}
                </p>
              ) : (
                <p className="text-base-content/70 text-sm mt-3">
                  {t("dashboardPage.billing.subscription.cancelHelp", {
                    date:
                      billingState?.subscription?.plan_access_until_date || "-",
                  } as any)}
                </p>
              )}

              {/* Feedback is shown via the fixed toast to avoid layout shifts */}
            </div>

            {/* Préférences marketing */}
            <div className="mt-4 rounded-xl bg-component border border-base-300 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">
                    {t("dashboardPage.billing.marketing.title")}
                  </h3>
                  <p className="text-base-content/70 text-sm mt-1">
                    {t("dashboardPage.billing.marketing.currentLabel")}:{" "}
                    {billingState?.marketing?.marketing_consent
                      ? t("dashboardPage.billing.marketing.active")
                      : t("dashboardPage.billing.marketing.inactive")}
                  </p>
                </div>
                <button
                  className={`btn-marketing ${dashboardActionBtn} btn-outline btn-info`}
                  disabled={
                    marketingSubmitting === "loading" ||
                    billingState?.account?.account_deletion_requested
                  }
                  onClick={handleToggleMarketingConsent}
                >
                  {marketingSubmitting === "loading" ? (
                    <span className="loading loading-bars loading-sm text-info" />
                  ) : null}
                  {billingState?.marketing?.marketing_consent
                    ? t("dashboardPage.billing.marketing.disableCta")
                    : t("dashboardPage.billing.marketing.enableCta")}
                </button>
              </div>
              <p className="text-base-content/70 text-sm mt-1">
                {billingState?.marketing?.marketing_consent
                  ? t("dashboardPage.billing.marketing.emailingTrue")
                  : t("dashboardPage.billing.marketing.emailingFalse")}
              </p>
              {/* Feedback is shown via the fixed toast to avoid layout shifts */}
            </div>

            {/* Compte */}
            <div className="mt-4 rounded-xl bg-component border border-error/40 p-4">
              <div className="flex items-start flex-wrap justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-error">
                    {t("dashboardPage.billing.account.title")}
                  </h3>
                  {/*  <p className="text-base-content/70 text-sm mt-1">
                    {billingState?.account?.account_deletion_requested
                      ? t("dashboardPage.billing.account.deletionRequested")
                      : t("dashboardPage.billing.account.deletionNotRequested")}
                  </p> */}
                  <p className="text-base-content/70 text-sm mt-2">
                    {t("dashboardPage.billing.account.deletionWarning")}
                  </p>
                  <div className="mt-3">
                    <label className="form-control w-full max-w-xs">
                      <div className="label">
                        <span className="label-text">
                          {t("dashboardPage.billing.account.typeToConfirm")}
                        </span>
                      </div>
                      <input
                        className="input input-bordered w-full max-w-xs"
                        value={deleteConfirmText}
                        onInput={(e: any) =>
                          setDeleteConfirmText(e.currentTarget.value)
                        }
                        placeholder="SUPPRIMER"
                      />
                    </label>
                  </div>
                </div>
                <button
                  className={`btn-delete-account ${dashboardActionBtn} btn-error`}
                  disabled={
                    deletionSubmitting === "loading" ||
                    billingState?.account?.account_deletion_requested ||
                    deleteConfirmText !== "SUPPRIMER"
                  }
                  onClick={handleAccountDeletionRequest}
                >
                  {deletionSubmitting === "loading" ? (
                    <span className="loading loading-bars loading-sm text-info" />
                  ) : null}
                  {t("dashboardPage.billing.account.deleteCta")}
                </button>
              </div>
              {/* Feedback is shown via the fixed toast to avoid layout shifts */}
            </div>

            {/* Cancel modal */}
            <dialog id="cancel_sub_modal" className="modal">
              <div className="modal-box">
                <h3 className="font-bold text-lg">
                  {t("dashboardPage.billing.subscription.cancelModalTitle")}
                </h3>
                <p className="py-2 text-base-content/70">
                  {t("dashboardPage.billing.subscription.cancelModalBody")}
                </p>
                <div className="modal-action">
                  <form method="dialog" className="flex gap-2">
                    <button className="btn btn-ghost">
                      {t("dashboardPage.billing.subscription.cancelModalClose")}
                    </button>
                    <button
                      className="btn btn-error"
                      onClick={(e) => {
                        e.preventDefault();
                        handleCancelSubscription();
                        const dialog = document.getElementById(
                          "cancel_sub_modal",
                        ) as HTMLDialogElement | null;
                        dialog?.close?.();
                      }}
                    >
                      {t(
                        "dashboardPage.billing.subscription.cancelModalConfirm",
                      )}
                    </button>
                  </form>
                </div>
              </div>
              <form method="dialog" className="modal-backdrop">
                <button>close</button>
              </form>
            </dialog>

            {/* Plan change modal */}
            <dialog id="plan_change_modal" className="modal">
              <div className="modal-box max-w-5xl pt-8 border border-base-100/70">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-lg">
                    {t("dashboardPage.billing.subscription.changeModalTitle")}
                  </h3>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={closePlanChangeModal}
                  >
                    {t("dashboardPage.billing.subscription.changeModalClose")}
                  </button>
                </div>
                <p className="py-2 text-base-content/70">
                  {t("dashboardPage.billing.subscription.changeModalBody")}
                </p>

                {planModalStep === "select" ? (
                  <div className="">
                    <div className="rounded-xl border border-base-300 bg-component p-4">
                      <p className="text-sm text-base-content/70">
                        <span className="font-semibold">
                          {t("dashboardPage.billing.subscription.subtitle")}
                        </span>{" "}
                        <span className="capitalize">
                          {currentPlanCode || "-"}
                        </span>
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-base-content/70">
                          -{" "}
                          {t("dashboardPage.billing.subscription.upgradeInfo")}
                        </p>
                        <p className="text-sm text-base-content/70">
                          -{" "}
                          {t(
                            "dashboardPage.billing.subscription.downgradeInfo",
                          )}
                        </p>
                      </div>
                    </div>
                    <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {selectablePlans.map((p) =>
                        p.name === "visitor" ? null : (
                          <li key={p.name} className="flex justify-center">
                            <PriceCard
                              lang={textLangCard as any}
                              option={p}
                              currency={currency}
                              onSelect={() => {
                                setSelectedPlan(p);
                                setPlanModalStep("confirm");
                              }}
                              isCurrentPlan={false}
                              currentBadgeLabel={t(
                                "dashboardPage.billing.subscription.currentBadge",
                              )}
                              disabled={p?.active === false}
                              disabledBadgeLabel="Indisponible"
                            />
                          </li>
                        ),
                      )}
                    </ul>
                    {selectablePlans.length === 0 ? (
                      <p className="text-sm text-base-content/70 mt-4">
                        {t(
                          "dashboardPage.billing.subscription.noPlanAvailable",
                        )}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {planModalStep === "confirm" && selectedPlan ? (
                  <div className="mt-4">
                    <div className="rounded-xl border border-base-300 p-4">
                      <p className="font-semibold">
                        {t("dashboardPage.billing.subscription.confirmTitle")}{" "}
                        <span className="capitalize">{selectedPlan.name}</span>
                      </p>
                      <p className="text-sm text-base-content/70 mt-2">
                        {resolveSelectedChangeType(selectedPlan) === "upgrade"
                          ? t(
                              "dashboardPage.billing.subscription.confirmUpgrade",
                            )
                          : resolveSelectedChangeType(selectedPlan) ===
                              "downgrade"
                            ? t(
                                "dashboardPage.billing.subscription.confirmDowngrade",
                              )
                            : "Vous êtes déjà sur ce plan."}
                      </p>
                    </div>
                    {planChangeMessage ? (
                      <div
                        role="alert"
                        className={`alert mt-3 ${
                          planChangeSubmitting === "error"
                            ? "alert-error"
                            : planChangeSubmitting === "success"
                              ? "alert-success"
                              : "alert-info"
                        }`}
                      >
                        <span>{planChangeMessage}</span>
                      </div>
                    ) : null}
                    <div className="modal-action">
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => setPlanModalStep("select")}
                        disabled={planChangeSubmitting === "loading"}
                      >
                        {t("dashboardPage.billing.subscription.back")}
                      </button>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={confirmPlanChange}
                        disabled={
                          planChangeSubmitting === "loading" ||
                          resolveSelectedChangeType(selectedPlan) === "same" ||
                          (selectedPlan as any)?.active === false
                        }
                      >
                        {planChangeSubmitting === "loading" ? (
                          <span className="loading loading-bars loading-sm text-info" />
                        ) : null}
                        {t("dashboardPage.billing.subscription.confirm")}
                      </button>
                    </div>
                  </div>
                ) : null}

                <form method="dialog" className="modal-backdrop">
                  <button>close</button>
                </form>
              </div>
            </dialog>

            {/* Account deletion feedback modal (post-deletion) */}
            <dialog
              id="account_deletion_feedback_modal"
              className="modal"
              onCancel={(e) => {
                e.preventDefault();
                closeDeletionFeedbackModal();
              }}
            >
              <div className="modal-box max-w-2xl">
                <FormDeleteReasonAccount
                  token={deletionFeedbackToken}
                  onClose={closeDeletionFeedbackModal}
                  onSubmitted={closeDeletionFeedbackModal}
                  content={{
                    title: t(
                      "dashboardPage.billing.account.deletionFeedback.title",
                    ),
                    subtitle: t(
                      "dashboardPage.billing.account.deletionFeedback.subtitle",
                    ),
                    expensive: t(
                      "dashboardPage.billing.account.deletionFeedback.expensive",
                    ),
                    no_more_use: t(
                      "dashboardPage.billing.account.deletionFeedback.no_more_use",
                    ),
                    bad_quality_result: t(
                      "dashboardPage.billing.account.deletionFeedback.bad_quality_result",
                    ),
                    difficult: t(
                      "dashboardPage.billing.account.deletionFeedback.difficult",
                    ),
                    bad_UX: t(
                      "dashboardPage.billing.account.deletionFeedback.bad_UX",
                    ),
                    found_alternative: t(
                      "dashboardPage.billing.account.deletionFeedback.found_alternative",
                    ),
                    other_reason: t(
                      "dashboardPage.billing.account.deletionFeedback.other_reason",
                    ),
                    placeholder: t(
                      "dashboardPage.billing.account.deletionFeedback.placeholder",
                    ),
                    button_submit: t(
                      "dashboardPage.billing.account.deletionFeedback.button_submit",
                    ),
                    button_close: t(
                      "dashboardPage.billing.account.deletionFeedback.button_close",
                    ),
                    success: t(
                      "dashboardPage.billing.account.deletionFeedback.success",
                    ),
                    error: t(
                      "dashboardPage.billing.account.deletionFeedback.error",
                    ),
                    validation_error: t(
                      "dashboardPage.billing.account.deletionFeedback.validation_error",
                    ),
                  }}
                />
              </div>
              <div
                className="modal-backdrop"
                onClick={closeDeletionFeedbackModal}
              />
            </dialog>
          </div>
        </section>

        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">{t("dashboardPage.password.title")}</h2>
            <p className="text-base-content/70">
              {t("dashboardPage.password.description")}
            </p>
            <div className="mt-3 p-4 rounded-xl bg-component border border-base-300">
              <FormResetPassword mode="dashboard" embedded />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Historique des usages</h2>
            <p className="text-base-content/70">À venir: détails des opérations des 24h.</p>
            <div className="overflow-x-auto mt-2">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Action</th>
                    <th>Crédits</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>-</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section> */}

        {/* <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Clé API</h2>
            <p className="text-base-content/70">Générez et gérez votre clé API (prochainement).</p>
            <div className="join mt-2">
              <input className="input input-bordered join-item w-full" type="password" value="****************" readOnly />
              <button className="btn join-item btn-ghost" onClick={(e) => e.preventDefault()}>Afficher</button>
              <button className="btn join-item btn-outline" onClick={(e) => e.preventDefault()}>Régénérer</button>
            </div>
          </div>
        </section> */}
      </div>
    </div>
  );
};

export { DashboardPage };
