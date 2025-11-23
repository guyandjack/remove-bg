//instance personnel d' axios pour tout le projet
//import des librairies
import axios, { AxiosError, AxiosRequestConfig } from "axios";

//import des fonction
import { sessionSignal, setSessionFromApiResponse } from "@/stores/session";
import { localOrProd } from "@/utils/localOrProd";

//const et variable globale
const { urlApi } = localOrProd();

// Normalise l'URL de base: supprime les slash finaux pour éviter les doublons
const normalizedBaseURL = urlApi.replace(/\/+$/, "");

//instance api qui aura des interceptor
const api = axios.create({
  baseURL: normalizedBaseURL,
  timeout: 10000,
});

//instance login sans interceptor
const login = axios.create({
  baseURL: normalizedBaseURL,
  timeout: 10000,
});


// --- Interceptor pour ajouter le token ---
api.interceptors.request.use((config) => {
  const stringSessionObject = localStorage.getItem("session") || "";
  let token = null;
  if (stringSessionObject) {
    const parsedSessionObject = JSON.parse(stringSessionObject) ;
    token = sessionSignal?.value?.token?.trim() || parsedSessionObject.token || null;
    
  }

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

  return config;
});

// ---- Gestion du refresh en cours (pour éviter plusieurs refresh en parallèle) ----
let isRefreshing = false;
let pendingRequests: ((token: string | null) => void)[] = [];

const onRefreshed = (token: string | null) => {
  pendingRequests.forEach((cb) => cb(token));
  pendingRequests = [];
};

/// ---- Instance sans interceptors pour appeler /auth/refresh ----
const refreshClient = axios.create({
  baseURL: normalizedBaseURL,
  timeout: 10000,
  withCredentials: true,
});

// ---- Interceptor de réponse : gère les 401 ----
api.interceptors.response.use(
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
          resolve(api(originalRequest));
        });
      });
    }

    // Sinon, on lance le refresh
    isRefreshing = true;

    try {
      const refreshResponse = await refreshClient.post("/api/auth/refresh", {});

      //si pas de reponse on log une erreur http ou autre
      if (!refreshResponse) {
        console.log("erreur http sur refresh request");
      }

      const data = refreshResponse.data;

      //si refresh client echoue:
      

      if (data.status !== "success") {
        // Cleanup côté front
        localStorage.removeItem("session");
        sessionSignal.value = null;

        // Option : redirection vers la page de login
       return //window.location.href = "/login";
        
      }

      const newAccessToken = (data as any).token as string;

      // 1) On stocke le nouveau token
      const objectSession = localStorage.getItem("session") || "";
      const objectSessionParsed = JSON.parse(objectSession);
      objectSessionParsed.token = newAccessToken;
      //mise a jour de la session dans le localstorage et signalSession
      localStorage.setItem("session", JSON.stringify(objectSessionParsed));
      sessionSignal.value.token = newAccessToken;

      // 2) On réveille toutes les requêtes en attente
      onRefreshed(newAccessToken);
      isRefreshing = false;

      // 3) On rejoue la requête originale
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      isRefreshing = false;

      // On réveille les requêtes en échec (sans token)
      onRefreshed(null);

      // Cleanup côté front
      localStorage.removeItem("session");
      sessionSignal.value = null;

      // Option : redirection vers la page de login
       //window.location.href = "/login";

      return Promise.reject(refreshError);
    }
  }
);

export  {api, login};
