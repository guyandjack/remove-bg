// src/stores/session.ts
import { signal, computed } from "@preact/signals";

// --- Type du plan renvoyé par l'API ---
export type User = {
  first_name?: string;
  last_name?: string;
  id?: string;
  email: string;
} | null;

// --- Type du plan renvoyé par l'API ---
export type PlanAPI = {
  code?: string;              // ex: "free"
  name: string;              // ex: "Free"
  price_cents: number;       // ex: 0
  currency: string;          // ex: "EUR"
  daily_credit_quota: number; // ex: 2
} | null;

// --- Type des crédits (peut être null) ---
export type CreditsAPI = {
  used_last_24h: number;
  remaining_last_24h: number;
} | null;

// --- Type de la session complète ---
export type SessionData = {
  user: User;
  status: string | null;
  authentified: boolean;
  redirect: boolean;
  redirectUrl: string | null;
  plan: PlanAPI | null;
  token: string | null;
  credits: CreditsAPI;
  subscriptionId: string | null;
  hint: string | null;
};


// =========================
// 1. Objet global de session
// =========================
const sessionSignal = signal<SessionData>({
  user: null,
  status: null,
  authentified: false,
  redirect: false,
  redirectUrl: null,
  token: null,
  plan: null,
  credits: null ,
  subscriptionId: null,
  hint: null
});

// =========================
// 2. Privileges dérivés (computed)
// =========================
const privileges = computed(() => {
  if (!sessionSignal.value.plan) return null;

  const plan = sessionSignal.value.plan;
  const user = sessionSignal.value.user;

  return {
    userId: user?.id,
    user_lastname: user?.last_name,
    user_firstname: user?.first_name,
    user_email: user?.email,
    code: plan.code,
    name: plan.name,
    dailyQuota: plan.daily_credit_quota,
    hasUnlimitedCredits: plan.daily_credit_quota === -1, // exemple
    isFree: plan.code === "free",
    isHobby: plan.code === "hobby",
    isPro: plan.code === "pro",

    // tu peux ajouter ici toutes les déductions utiles pour l’UI
  };
});

// =========================
// 3. Fonction pour mettre à jour la session : à appeler après login/signup
// =========================
function setSessionFromApiResponse(data: SessionData) {
  sessionSignal.value = {
    user: data.user,
    status: data.status,
    authentified: data.authentified,
    redirect: data.redirect,
    redirectUrl: data.redirectUrl,
    token: data.token,
    plan: data.plan,
    credits: data.credits,
    subscriptionId: data.subscriptionId,
    hint: data.hint
  };

  // Optionnel : persister dans localStorage
 //localStorage.setItem("session", JSON.stringify(sessionSignal.value));
}

// =========================
// 4. Re-hydratation locale au démarrage
// =========================
export function initSessionFromLocalStorage() {
  const raw = localStorage.getItem("session");
  if (!raw) return;

  try {
    sessionSignal.value = JSON.parse(raw);
  } catch {
    console.error("Impossible de parser la session du localStorage");
  }
}

export {setSessionFromApiResponse, privileges, sessionSignal}