
import { initSessionFromLocalStorage, sessionSignal } from "@/stores/session";
import { api } from "@/utils/axiosConfig";
import { langSignal } from "@/utils/langSignal";
import { isAuthentified } from "@/utils/request/isAuthentified";
import { useEffect, useState } from "preact/hooks";

type SubmitState = "idle" | "loading" | "success" | "error";

const DashboardPage = () => {
  const [email, setEmail] = useState<string>("");
  const [pwSubmitting, setPwSubmitting] = useState<SubmitState>("idle");
  const [cancelSubmitting, setCancelSubmitting] = useState<SubmitState>("idle");

  useEffect(() => {
    setDocumentTitle();
  }, []);

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
        window.location.href = `/login?redirect=${redirect}`;
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
      } catch {
        if (!mounted) return;
        const redirect = encodeURIComponent("/dashboard");
        window.location.href = `/login?redirect=${redirect}`;
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
    // Placeholder: to be wired to a backend endpoint
    setCancelSubmitting("loading");
    setTimeout(() => setCancelSubmitting("success"), 800);
    setTimeout(() => setCancelSubmitting("idle"), 2200);
  };

  return (
    <div className="px-4 mx-auto w-full max-w-[1200px] py-8">
      <div className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold">Tableau de bord</h1>
        <p className="text-base-content/70 mt-2">Gérez votre compte et vos abonnements.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat bg-base-100 rounded-xl border border-base-300">
          <div className="stat-figure text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v12m6-6H6" />
            </svg>
          </div>
          <div className="stat-title">Crédits restants (24h)</div>
          <div className="stat-value text-primary">{creditsRemaining}</div>
          <div className="stat-desc">Dernières 24 heures</div>
        </div>

        <div className="stat bg-base-100 rounded-xl border border-base-300">
          <div className="stat-figure text-info">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3v18h18" />
            </svg>
          </div>
          <div className="stat-title">Crédits utilisés (24h)</div>
          <div className="stat-value text-info">{creditsUsed}</div>
          <div className="stat-desc">Sur la période glissante</div>
        </div>

        <div className="stat bg-base-100 rounded-xl border border-base-300">
          <div className="stat-figure text-success">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
            </svg>
          </div>
          <div className="stat-title">Abonnement</div>
          <div className="stat-value text-success">{planName}</div>
          <div className="stat-desc">Gérez votre offre</div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Gestion de l'abonnement</h2>
            <p className="text-base-content/70">Changez d'offre ou annulez votre abonnement.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="/pricing" className="btn btn-primary">Changer d'abonnement</a>
              <button onClick={handleCancelSubscription} className="btn btn-outline btn-error" disabled={cancelSubmitting === "loading"}>
                {cancelSubmitting === "loading" ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : null}
                Annuler l'abonnement
              </button>
            </div>
            {cancelSubmitting === "success" ? (
              <div role="alert" className="alert alert-success mt-4">
                <span>Demande d'annulation enregistrée (exemple). À connecter à l'API.</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Mot de passe</h2>
            <p className="text-base-content/70">Recevez un email pour réinitialiser votre mot de passe.</p>
            <form className="mt-2 flex flex-col gap-3" onSubmit={requestPasswordReset as any}>
              <label className="form-control w-full">
                <div className="label"><span className="label-text">Email</span></div>
                <input type="email" className="input input-bordered w-full" value={email} onInput={(e: any) => setEmail(e.currentTarget.value)} required />
              </label>
              <button type="submit" className="btn btn-success" disabled={pwSubmitting === "loading"}>
                {pwSubmitting === "loading" ? <span className="loading loading-spinner loading-sm" /> : null}
                Envoyer le lien de réinitialisation
              </button>
            </form>
            {pwSubmitting === "success" ? (
              <div role="alert" className="alert alert-success mt-3">
                <span>Si un compte existe, un email a été envoyé.</span>
              </div>
            ) : null}
            {pwSubmitting === "error" ? (
              <div role="alert" className="alert alert-error mt-3">
                <span>Erreur lors de la demande. Réessayez.</span>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card bg-base-100 border border-base-300 shadow-sm">
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
        </section>

        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Clé API</h2>
            <p className="text-base-content/70">Générez et gérez votre clé API (prochainement).</p>
            <div className="join mt-2">
              <input className="input input-bordered join-item w-full" type="password" value="****************" readOnly />
              <button className="btn join-item btn-ghost" onClick={(e) => e.preventDefault()}>Afficher</button>
              <button className="btn join-item btn-outline" onClick={(e) => e.preventDefault()}>Régénérer</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export { DashboardPage };
