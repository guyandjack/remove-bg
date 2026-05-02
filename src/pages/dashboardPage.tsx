
import { initSessionFromLocalStorage, sessionSignal } from "@/stores/session";
import { api } from "@/utils/axiosConfig";
import { langSignal } from "@/utils/langSignal";
import { isAuthentified } from "@/utils/request/isAuthentified";
import { useEffect, useState } from "preact/hooks"; 
import { useTranslation } from "react-i18next"; 
import { navigateWithLink } from "@/utils/navigateWithLink"; 
 
//import des fonctions 
import { setActiveLink } from "@/utils/setActiveLink"; 
import { setDocumentTitle } from "@/utils/setDocumentTitle"; 

type SubmitState = "idle" | "loading" | "success" | "error";
type BillingAccountState = {
  subscription: null | {
    subscription_status: string;
    stripe_cancel_at_period_end: boolean;
    plan_access_until_iso: string | null;
    plan_access_until_date: string | null;
    plan_name: string | null;
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
  const [email, setEmail] = useState<string>("");
  const [pwSubmitting, setPwSubmitting] = useState<SubmitState>("idle");
  const [cancelSubmitting, setCancelSubmitting] = useState<SubmitState>("idle");
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [billingSubmitting, setBillingSubmitting] = useState<SubmitState>("idle");
  const [billingState, setBillingState] = useState<BillingAccountState | null>(null);
  const [marketingSubmitting, setMarketingSubmitting] = useState<SubmitState>("idle");
  const [marketingMessage, setMarketingMessage] = useState<string | null>(null);
  const [deletionSubmitting, setDeletionSubmitting] = useState<SubmitState>("idle");
  const [deletionMessage, setDeletionMessage] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>("");
  const { t } = useTranslation();

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
        setEmail(sessionSignal?.value?.user?.email || "");

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

  const creditsRemaining = sessionSignal?.value?.credits?.remaining_last_24h ?? 0;
  const creditsUsed = sessionSignal?.value?.credits?.used_last_24h ?? 0;
  const planName = sessionSignal?.value?.plan?.name || sessionSignal?.value?.plan?.code || "-";

  const requestPasswordReset = async (e: Event) => {
    e.preventDefault();
    if (!email) return;
    setPwSubmitting("loading");
    try {
      const lang = langSignal.value as "fr" | "en" | "de" | "it";
      await api.post("/api/forgot", { email, lang });
      setPwSubmitting("success");
    } catch (e) {
      setPwSubmitting("error");
    } finally {
      setTimeout(() => setPwSubmitting("idle"), 2000);
    }
  };

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

      // Refresh billing state to show canceling + access until
      try {
        const st = await api.get("/api/account/billing-account");
        if (st?.data?.success) setBillingState(st.data as any);
      } catch {}
    } catch (e) {
      setCancelSubmitting("error");
      setCancelMessage(t("dashboardPage.subscription.cancelError"));
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

      try {
        const st = await api.get("/api/account/billing-account");
        if (st?.data?.success) setBillingState(st.data as any);
      } catch {}
    } catch {
      setCancelSubmitting("error");
      setCancelMessage(t("dashboardPage.billing.subscription.resumeError"));
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
      setMarketingMessage(t("dashboardPage.billing.marketing.success"));
      // Refresh from backend (source of truth)
      const st = await api.get("/api/account/billing-account");
      if (st?.data?.success) setBillingState(st.data as any);
    } catch {
      setMarketingSubmitting("error");
      setMarketingMessage(t("dashboardPage.billing.marketing.error"));
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
      setDeletionMessage(t("dashboardPage.billing.account.deletionSuccess"));

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
      setDeletionMessage(t("dashboardPage.billing.account.deletionError"));
    } finally {
      setTimeout(() => setDeletionSubmitting("idle"), 2500);
    }
  };

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold">
          {t("dashboardPage.title")}
        </h1>
        <p className="text-base-content/70 mt-2">
          {t("dashboardPage.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat bg-base-100 rounded-xl border border-base-300">
          <div className="stat-figure text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6v12m6-6H6"
              />
            </svg>
          </div>
          <div className="stat-title">
            {t("dashboardPage.stats.creditsRemainingTitle")}
          </div>
          <div className="stat-value text-primary">{creditsRemaining}</div>
          <div className="stat-desc">
            {t("dashboardPage.stats.billingPeriod")}
          </div>
        </div>

        <div className="stat bg-base-100 rounded-xl border border-base-300">
          <div className="stat-figure text-info">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 3v18h18"
              />
            </svg>
          </div>
          <div className="stat-title">
            {t("dashboardPage.stats.creditsUsedTitle")}
          </div>
          <div className="stat-value text-info">{creditsUsed}</div>
          <div className="stat-desc">
            {t("dashboardPage.stats.billingPeriod")}
          </div>
        </div>

        <div className="stat bg-base-100 rounded-xl border border-base-300">
          <div className="stat-figure text-success">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 14l9-5-9-5-9 5 9 5z"
              />
            </svg>
          </div>
          <div className="stat-title">{t("dashboardPage.stats.planTitle")}</div>
          <div className="stat-value text-success">{planName}</div>
          {/* <div className="stat-desc">Gérez votre offre</div> */}
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
                  <a href="/pricing" className="btn btn-sm btn-primary">
                    {t("dashboardPage.billing.subscription.changeCta")}
                  </a>

                  {billingState?.subscription?.subscription_status ===
                  "canceling" ? (
                    <button
                      className="btn btn-sm btn-outline btn-success"
                      disabled={
                        cancelSubmitting === "loading" ||
                        billingState?.account?.account_deletion_requested
                      }
                      onClick={handleResumeSubscription}
                    >
                      {cancelSubmitting === "loading" ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : null}
                      {t("dashboardPage.billing.subscription.resumeCta")}
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-outline btn-error"
                      disabled={
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
                        <span className="loading loading-spinner loading-sm" />
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

              {cancelSubmitting === "success" ? (
                <div role="alert" className="alert alert-success mt-3">
                  <span>
                    {cancelMessage ||
                      t("dashboardPage.subscription.cancelSuccess")}
                  </span>
                </div>
              ) : null}
              {cancelSubmitting === "error" ? (
                <div role="alert" className="alert alert-error mt-3">
                  <span>
                    {cancelMessage ||
                      t("dashboardPage.subscription.cancelError")}
                  </span>
                </div>
              ) : null}
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
                  className="btn btn-sm"
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
              {marketingSubmitting === "success" ? (
                <div role="alert" className="alert alert-success mt-3">
                  <span>
                    {marketingMessage ||
                      t("dashboardPage.billing.marketing.success")}
                  </span>
                </div>
              ) : null}
              {marketingSubmitting === "error" ? (
                <div role="alert" className="alert alert-error mt-3">
                  <span>
                    {marketingMessage ||
                      t("dashboardPage.billing.marketing.error")}
                  </span>
                </div>
              ) : null}
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
                  className="btn btn-sm btn-error"
                  disabled={
                    deletionSubmitting === "loading" ||
                    billingState?.account?.account_deletion_requested ||
                    deleteConfirmText !== "SUPPRIMER"
                  }
                  onClick={handleAccountDeletionRequest}
                >
                  {deletionSubmitting === "loading" ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : null}
                  {t("dashboardPage.billing.account.deleteCta")}
                </button>
              </div>
              {deletionSubmitting === "success" ? (
                <div role="alert" className="alert alert-success mt-3">
                  <span>
                    {deletionMessage ||
                      t("dashboardPage.billing.account.deletionSuccess")}
                  </span>
                </div>
              ) : null}
              {deletionSubmitting === "error" ? (
                <div role="alert" className="alert alert-error mt-3">
                  <span>
                    {deletionMessage ||
                      t("dashboardPage.billing.account.deletionError")}
                  </span>
                </div>
              ) : null}
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
          </div>
        </section>

        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">{t("dashboardPage.password.title")}</h2>
            <p className="text-base-content/70">
              {t("dashboardPage.password.description")}
            </p>
            <form
              className="mt-2 flex flex-col gap-3"
              onSubmit={requestPasswordReset as any}
            >
              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">
                    {t("dashboardPage.password.emailLabel")}
                  </span>
                </div>
                <input
                  type="email"
                  className="input input-bordered w-full"
                  value={email}
                  onInput={(e: any) => setEmail(e.currentTarget.value)}
                  required
                />
              </label>
              <button
                type="submit"
                className="btn btn-success"
                disabled={pwSubmitting === "loading"}
              >
                {pwSubmitting === "loading" ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : null}
                {t("dashboardPage.password.submitCta")}
              </button>
            </form>
            {pwSubmitting === "success" ? (
              <div role="alert" className="alert alert-success mt-3">
                <span>{t("dashboardPage.password.success")}</span>
              </div>
            ) : null}
            {pwSubmitting === "error" ? (
              <div role="alert" className="alert alert-error mt-3">
                <span>{t("dashboardPage.password.error")}</span>
              </div>
            ) : null}
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
