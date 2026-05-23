//instance personnel d' axios pour tout le projet
//import des librairies
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";

//import des fonction
import { sessionSignal } from "@/stores/session";
import { localOrProd } from "@/utils/localOrProd";
import { langSignal } from "@/utils/langSignal";

//const et variable globale
const { urlApi } = localOrProd();

// Normalise l'URL de base: supprime les slash finaux pour éviter les doublons
const normalizedBaseURL = urlApi.replace(/\/+$/, "");
console.log("api url: ", normalizedBaseURL);

function safeParseJson(input: string): any | null {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function readAccessToken(): string | null {
  const fromSignal = sessionSignal?.value?.token?.trim();
  if (fromSignal) return fromSignal;

  const raw =
    typeof window !== "undefined" ? localStorage.getItem("session") || "" : "";
  const parsed = safeParseJson(raw);
  const fromStorage = typeof parsed?.token === "string" ? parsed.token.trim() : "";
  return fromStorage || null;
}

function clearFrontSession() {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("session");
    } catch {
      // ignore
    }
  }
  sessionSignal.value = null;
}

function persistNewAccessToken(newAccessToken: string) {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("session") || "";
    const parsed = safeParseJson(raw) ?? {};
    const next = { ...parsed, token: newAccessToken };
    localStorage.setItem("session", JSON.stringify(next));
  }

  const currentSession = sessionSignal.value;
  if (currentSession) {
    sessionSignal.value = { ...currentSession, token: newAccessToken };
    return;
  }

  // Fallback minimal (ex: session cleared but refresh succeeded)
  sessionSignal.value = {
    user: { email: "" },
    status: null,
    authentified: false,
    redirect: false,
    redirectUrl: null,
    plan: { code: "" },
    token: newAccessToken,
    credits: { used_last_24h: 0, remaining_last_24h: 0 },
    creditRemainingConcerter: 0,
    creditUsedConverter: 0,
    subscriptionId: null,
    hint: null,
  };
}

function attachAuthAndNormalizeUrl(client: ReturnType<typeof axios.create>) {
  client.interceptors.request.use((config) => {
    const token = readAccessToken();

    // S'assure que les chemins relatifs commencent par '/'
    const url = config.url ?? "";
    const isAbsolute = /^(?:[a-z]+:)?\/\//i.test(url); // http://, https:// ou //
    if (url && !isAbsolute && !url.startsWith("/")) {
      config.url = `/${url}`;
    }

    if (token) {
      if (!config.headers) config.headers = {} as any;
      (config.headers as any).Authorization = `Bearer ${token}`;
    }

    // Langue applicative (i18next) : utilisée côté backend pour sélectionner les templates MJML.
    // On envoie uniquement la base ("en", "fr", "de", "it").
    try {
      const raw = String(langSignal.value || "").trim().toLowerCase();
      const base = raw.split("-")[0] || "en";
      if (!config.headers) config.headers = {} as any;
      (config.headers as any)["x-app-locale"] = base;
    } catch {
      // ignore
    }

    return config;
  });
}

//instance api qui aura des interceptor
const api = axios.create({
  baseURL: normalizedBaseURL,
  // Replicate (US) + file d'attente + traitement image => latence possible
  // On garde une marge confortable en prod; les appels sensibles peuvent surcharger via config par requête.
  timeout: 60000,
});

// Instance dédiée aux gros blobs:
// - force l'adapter `fetch` (souvent plus robuste que XHR sur gros downloads)
// - garde une marge de timeout plus large
const apiBlob = axios.create({
  baseURL: normalizedBaseURL,
  timeout: 120000,
  adapter: "fetch" as any,
});

//instance login sans interceptor
const login = axios.create({
  baseURL: normalizedBaseURL,
  timeout: 20000,
});

// --- Interceptor pour ajouter le token ---
attachAuthAndNormalizeUrl(api);
attachAuthAndNormalizeUrl(apiBlob);
attachAuthAndNormalizeUrl(login);

// ---- Gestion du refresh en cours (pour éviter plusieurs refresh en parallèle) ----
let isRefreshing = false;
let pendingRequests: ((token: string | null) => void)[] = [];

const onRefreshed = (token: string | null) => {
  pendingRequests.forEach((cb) => cb(token));
  pendingRequests = [];
};

// ---- Instance sans interceptors pour appeler /auth/refresh ----
const refreshClient = axios.create({
  baseURL: normalizedBaseURL,
  timeout: 20000,
  withCredentials: true,
});

async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshResponse = await refreshClient.post("/api/auth/refresh", {});
    const data = refreshResponse?.data;

    if (!data || data.status !== "success") {
      clearFrontSession();
      return null;
    }

    const newAccessToken = String((data as any).token ?? "").trim();
    if (!newAccessToken) {
      clearFrontSession();
      return null;
    }

    persistNewAccessToken(newAccessToken);
    return newAccessToken;
  } catch {
    clearFrontSession();
    return null;
  }
}

function installRefreshInterceptor(client: AxiosInstance) {
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const status = error.response?.status;
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

      // Si ce n'est pas un 401, ou si on a déjà retenté, on laisse l'erreur passer
      if (status !== 401 || originalRequest._retry) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // Si un refresh est déjà en cours, on met cette requête en attente
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push((newToken) => {
            if (!newToken) {
              reject(error);
              return;
            }
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(client(originalRequest));
          });
        });
      }

      // Sinon, on lance le refresh
      isRefreshing = true;

      try {
        const newAccessToken = await refreshAccessToken();
        if (!newAccessToken) {
          onRefreshed(null);
          isRefreshing = false;
          return Promise.reject(error);
        }

        // Réveille toutes les requêtes en attente
        onRefreshed(newAccessToken);
        isRefreshing = false;

        // Rejoue la requête originale
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshed(null);
        clearFrontSession();
        return Promise.reject(refreshError);
      }
    }
  );
}

// ---- Interceptors de réponse : gère les 401 sur les appels auth ----
installRefreshInterceptor(api);
installRefreshInterceptor(apiBlob);

export { api, apiBlob, login, refreshAccessToken };
