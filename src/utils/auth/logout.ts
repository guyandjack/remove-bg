import { api } from "@/utils/axiosConfig";
import { sessionSignal } from "@/stores/session";

type LogoutCallbacks = {
  onStart?: () => void;
  onFinished?: () => void;
};

function clearClientSessionStorage() {
  try {
    localStorage.removeItem("session");
    localStorage.removeItem("wizpix:last_service");
    localStorage.removeItem("wizpix:account_deletion_feedback");
  } catch {
    // ignore
  }
}

/**
 * Logout côté client.
 * - Best-effort call API `/api/logout` (peut échouer si access token déjà expiré)
 * - Nettoie toujours la session locale
 * - La redirection (route) est gérée par l'appelant (afin d'être cohérent avec les composants existants)
 *
 * Note: le backend protège `/api/logout` via `verifyAuth` (access token). Si l'access token est expiré
 * et le refresh token aussi, l'appel peut répondre 401: on nettoie quand même côté client.
 */
async function logoutClient(callbacks?: LogoutCallbacks) {
  callbacks?.onStart?.();

  try {
    await api.post("/api/logout", {});
  } catch {
    // ignore - on veut un logout idempotent côté client
  } finally {
    sessionSignal.value = null;
    clearClientSessionStorage();
    callbacks?.onFinished?.();
  }
}

export { logoutClient };
