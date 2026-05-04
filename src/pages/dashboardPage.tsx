
import { initSessionFromLocalStorage, sessionSignal } from "@/stores/session";
import { api } from "@/utils/axiosConfig";
import { isAuthentified } from "@/utils/request/isAuthentified";
import { useEffect, useRef, useState } from "preact/hooks"; 
import { useTranslation } from "react-i18next"; 
import { navigateWithLink } from "@/utils/navigateWithLink"; 
import { PriceCard } from "@/components/card/priceCard";
import { FormResetPassword } from "@/components/form/FormResetPassword";
 
//import des fonctions 
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

const DashboardPage = ({routeKey}: PropsPage) => {
  const [cancelSubmitting, setCancelSubmitting] = useState<SubmitState>("idle");
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [billingSubmitting, setBillingSubmitting] = useState<SubmitState>("idle");
  const [billingState, setBillingState] = useState<BillingAccountState | null>(null);
  const [marketingSubmitting, setMarketingSubmitting] = useState<SubmitState>("idle");
  const [marketingMessage, setMarketingMessage] = useState<string | null>(null);
  const [deletionSubmitting, setDeletionSubmitting] = useState<SubmitState>("idle");
  const [deletionMessage, setDeletionMessage] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>("");
  const [planModalStep, setPlanModalStep] = useState<"select" | "confirm">("select");
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [planChangeSubmitting, setPlanChangeSubmitting] = useState<SubmitState>("idle");
  const [planChangeMessage, setPlanChangeMessage] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<{
    status: "idle" | "success" | "error" | "info";
    message: string | null;
  }>({ status: "idle", message: null });
  const actionToastTimeoutRef = useRef<number | null>(null);
  const { t } = useTranslation();
  const dashboardActionBtn = "btn btn-sm min-w-[220px]";

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
        navigateWithLink(`/login?redirect=${redirect}`);
        return;
      }
      
      // 2) Verify with API (uses axios interceptors for refresh)
      try {
        await isAuthentified();
        if (!mounted) return;
        if (sessionSignal?.value && sessionSignal.value.authentified !== true) {
          sessionSignal.value = { ...sessionSignal.value, authentified: true } as any;
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
        navigateWithLink(`/login?redirect=${redirect}`);
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

  const pushActionToast = (payload: { status: "success" | "error" | "info"; message: string }) => {
    setActionToast({ status: payload.status, message: payload.message });
    if (typeof window === "undefined") return;
    if (actionToastTimeoutRef.current) window.clearTimeout(actionToastTimeoutRef.current);
    actionToastTimeoutRef.current = window.setTimeout(() => {
      setActionToast({ status: "idle", message: null });
      actionToastTimeoutRef.current = null;
    }, 4500);
  };

  const creditsRemaining = sessionSignal?.value?.credits?.remaining_last_24h ?? 0;
  const creditsUsed = sessionSignal?.value?.credits?.used_last_24h ?? 0;
  const planName = sessionSignal?.value?.plan?.name || sessionSignal?.value?.plan?.code || "-";
  const userDisplayName = (() => {
    const first = billingState?.customer?.first_name?.trim() || "";
    const last = billingState?.customer?.last_name?.trim() || "";
    const full = `${first} ${last}`.trim();
    if (full) return full;
    return sessionSignal?.value?.user?.first_name || sessionSignal?.value?.user?.email || "-";
  })();
  const billingPeriodRange = (():any => {
    const start = billingState?.subscription?.period_start_date || "";
    const end = billingState?.subscription?.period_end_date || "";
    //if (start && end) return `Du ${start} <br>au ${end}`;
    if (start && end) return {
      start: start,
      end: end
    };
    if (end) return end;
    return "-";
  })();

  const handleCancelSubscription = async () => {
    setCancelSubmitting("loading");
    setCancelMessage(null);
    try {
      const resp = await api.post("/api/subscription/cancel");
      const msg =
        resp?.data?.message && typeof resp.data.message === "string"
          ? resp.data.message
          : t("dashboardPage.subscription.cancelSuccess");
      setCancelMessage(msg);
      setCancelSubmitting("success");
      pushActionToast({ status: "success", message: msg });

      // Refresh billing state to show canceling + access until
      try {
        const st = await api.get("/api/account/billing-account");
        if (st?.data?.success) setBillingState(st.data as any);
      } catch {}
    } catch (e) {
      setCancelSubmitting("error");
      const msg = t("dashboardPage.subscription.cancelError");
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
      const resp = await api.post("/api/subscription/resume");
      const msg =
        resp?.data?.message && typeof resp.data.message === "string"
          ? resp.data.message
          : t("dashboardPage.billing.subscription.resumeSuccess");
      setCancelMessage(msg);
      setCancelSubmitting("success");
      pushActionToast({ status: "success", message: msg });

      try {
        const st = await api.get("/api/account/billing-account");
        if (st?.data?.success) setBillingState(st.data as any);
      } catch {}
    } catch {
      setCancelSubmitting("error");
      const msg = t("dashboardPage.billing.subscription.resumeError");
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
    // Optimistic update
    setBillingState({
      ...billingState,
      marketing: {
        ...billingState.marketing,
        marketing_consent: nextValue,
      },
    });
    try {
      const resp = await api.post("/api/marketing/consent", {
        marketing_consent: nextValue,
      });
      if (resp?.data?.success !== true) throw new Error("marketing_update_failed");
      setMarketingSubmitting("success");
      {
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
      // Rollback by reloading state
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
        pushActionToast({ status: "success", message: msg });
      }

      // Clear local session and redirect to login (account is effectively disabled)
      try {
        localStorage.removeItem("session");
      } catch {}
      try {
        sessionSignal.value = { ...(sessionSignal.value as any), token: null, authentified: false } as any;
      } catch {}

      setTimeout(() => {
        navigateWithLink("/login");
      }, 800);
    } catch {
      setDeletionSubmitting("error");
      {
        const msg = t("dashboardPage.billing.account.deletionError");
        setDeletionMessage(msg);
        pushActionToast({ status: "error", message: msg });
      }
    } finally {
      setTimeout(() => setDeletionSubmitting("idle"), 2500);
    }
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
      const dialog = document.getElementById("plan_change_modal") as HTMLDialogElement | null;
      dialog?.showModal?.();
    }
  };

  const closePlanChangeModal = () => {
    setPlanModalStep("select");
    setSelectedPlan(null);
    setPlanChangeMessage(null);
    setPlanChangeSubmitting("idle");
    const dialog = document.getElementById("plan_change_modal") as HTMLDialogElement | null;
    dialog?.close?.();
  };

  const currentPlanCode =
    billingState?.subscription?.plan_code ||
    sessionSignal?.value?.plan?.code ||
    "";

  const currentPlan = availablePlans.find((p) => p?.name === currentPlanCode) || null;
  const selectablePlans = availablePlans.filter(
    (p) =>
      p?.name &&
      p.name !== currentPlanCode &&
      // Le plan "pro" n'est pas supporté côté produit, on ne l'affiche pas.
      p.name !== "pro",
  );

  const resolveSelectedChangeType = (plan: any): "upgrade" | "downgrade" | "same" => {
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
      if (resp?.data?.redirectUrl && typeof resp.data.redirectUrl === "string") {
        setPlanChangeSubmitting("success");
        setPlanChangeMessage(resp?.data?.message || t("dashboardPage.billing.subscription.checkoutRedirect"));
        setTimeout(() => {
          window.location.assign(resp.data.redirectUrl);
        }, 400);
        return;
      }
      setPlanChangeSubmitting("success");
      setPlanChangeMessage(resp?.data?.message || t("dashboardPage.billing.subscription.changePlanSuccess"));
      try {
        const st = await api.get("/api/account/billing-account");
        if (st?.data?.success) setBillingState(st.data as any);
      } catch {}
      setTimeout(() => {
        const dialog = document.getElementById("plan_change_modal") as HTMLDialogElement | null;
        dialog?.close?.();
      }, 800);
    } catch {
      setPlanChangeSubmitting("error");
      setPlanChangeMessage(t("dashboardPage.billing.subscription.changePlanError"));
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
        <h1 className="text-3xl lg:text-4xl font-bold">
          {t("dashboardPage.title")}
        </h1>
        <p className="text-base-content/70 mt-2">
          {t("dashboardPage.subtitle")}
        </p>
      </div>

      <div className="flex flex-col md:flex-row md:flex-wrap md:justify-center  gap-4">
        <div className="w-[200px] h-[100px] stat bg-base-100 rounded-xl border border-base-300">
          <div className="stat-title">{t("dashboardPage.stats.user")}</div>
          <div className="stat-value text-primary truncate">
            {userDisplayName}
          </div>
        </div>
        <div className="w-[200px] h-[100px] stat bg-base-100 rounded-xl border border-base-300">
          <div className="stat-title">{t("dashboardPage.stats.planTitle")}</div>
          <div className="stat-value text-success">{planName}</div>
        </div>
        <div className="w-[200px] h-[100px] stat bg-base-100 rounded-xl border border-base-300">
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
        <div className="w-[200px] h-[100px] stat bg-base-100 rounded-xl border border-base-300">
          <div className="stat-title">
            {t("dashboardPage.stats.creditsRemainingTitle")}
          </div>
          <div className="stat-value text-primary">{creditsRemaining}</div>
        </div>

        <div className="w-[200px] h-[100px] stat bg-base-100 rounded-xl border border-base-300">
          <div className="stat-title">
            {t("dashboardPage.stats.creditsUsedTitle")}
          </div>
          <div className="stat-value text-info">{creditsUsed}</div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            <div className="mt-4 rounded-xl border border-base-300 p-4">
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
                    className={`${dashboardActionBtn} btn-primary`}
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
                        <span className="loading loading-bars loading-spinner loading-sm" />
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
                        <span className="loading loading-bars loading-spinner loading-sm" />
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
            <div className="mt-4 rounded-xl border border-base-300 p-4">
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
                  className={`${dashboardActionBtn} btn-outline`}
                  disabled={
                    marketingSubmitting === "loading" ||
                    billingState?.account?.account_deletion_requested
                  }
                  onClick={handleToggleMarketingConsent}
                >
                  {marketingSubmitting === "loading" ? (
                    <span className="loading loading-bars loading-sm" />
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
            <div className="mt-4 rounded-xl border border-error/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-error">
                    {t("dashboardPage.billing.account.title")}
                  </h3>
                  <p className="text-base-content/70 text-sm mt-1">
                    {billingState?.account?.account_deletion_requested
                      ? t("dashboardPage.billing.account.deletionRequested")
                      : t("dashboardPage.billing.account.deletionNotRequested")}
                  </p>
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
                  className={`${dashboardActionBtn} btn-error`}
                  disabled={
                    deletionSubmitting === "loading" ||
                    billingState?.account?.account_deletion_requested ||
                    deleteConfirmText !== "SUPPRIMER"
                  }
                  onClick={handleAccountDeletionRequest}
                >
                  {deletionSubmitting === "loading" ? (
                    <span className="loading loading-bars loading-spinner loading-sm" />
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
              <div className="modal-box max-w-5xl">
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
                  <div className="mt-4">
                    <div className="rounded-xl border border-base-300 p-4">
                      <p className="text-sm text-base-content/70">
                        <span className="font-semibold">
                          Abonnement actuel :
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
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {selectablePlans.map((p) => (
                        <div key={p.name} className="flex justify-center">
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
                        </div>
                      ))}
                    </div>
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
                          <span className="loading loading-bars loading-spinner loading-sm" />
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
          </div>
        </section>

        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">{t("dashboardPage.password.title")}</h2>
            <p className="text-base-content/70">
              {t("dashboardPage.password.description")}
            </p>
            <div className="mt-3">
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
