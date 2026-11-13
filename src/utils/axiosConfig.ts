import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { sessionSignal } from "@/stores/session";
import { localOrProd } from "@/utils/localOrProd";
import { langSignal } from "@/utils/langSignal";

const { urlApi } = localOrProd();
const normalizedBaseURL = urlApi.replace(/\/+$/, "");

function clearClientSession() {
  if (typeof window !== "undefined") {
    // Removes only the legacy bearer-token storage left by older deployments.
    // Session credentials now live exclusively in HttpOnly cookies.
    try {
      localStorage.removeItem("session");
    } catch {
      // Storage can be unavailable in privacy-restricted contexts.
    }
  }
  sessionSignal.value = null;
}

function attachRequestDefaults(client: ReturnType<typeof axios.create>) {
  client.interceptors.request.use((config) => {
    const url = config.url ?? "";
    const isAbsolute = /^(?:[a-z]+:)?\/\//i.test(url);
    if (url && !isAbsolute && !url.startsWith("/")) {
      config.url = `/${url}`;
    }

    try {
      const raw = String(langSignal.value || "").trim().toLowerCase();
      const locale = raw.split("-")[0] || "en";
      config.headers = config.headers ?? {};
      (config.headers as any)["x-app-locale"] = locale;
    } catch {
      // Locale is an optional presentation hint.
    }

    return config;
  });
}

const commonConfig = {
  baseURL: normalizedBaseURL,
  // Auth is cookie-only. Cross-origin API calls must explicitly carry cookies.
  withCredentials: true,
};

const api = axios.create({ ...commonConfig, timeout: 60000 });
const apiBlob = axios.create({
  ...commonConfig,
  timeout: 120000,
  adapter: "fetch" as any,
});
const login = axios.create({ ...commonConfig, timeout: 20000 });
const refreshClient = axios.create({ ...commonConfig, timeout: 20000 });

attachRequestDefaults(api);
attachRequestDefaults(apiBlob);
attachRequestDefaults(login);

let isRefreshing = false;
let pendingRequests: ((succeeded: boolean) => void)[] = [];

function notifyRefreshWaiters(succeeded: boolean) {
  pendingRequests.forEach((callback) => callback(succeeded));
  pendingRequests = [];
}

/** Refreshes HttpOnly cookies only. No credential is exposed to JavaScript. */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await refreshClient.post("/api/auth/refresh", {});
    if (response.data?.status !== "success") {
      clearClientSession();
      return false;
    }
    return true;
  } catch {
    clearClientSession();
    return false;
  }
}

function installRefreshInterceptor(client: AxiosInstance) {
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
      if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push((succeeded) => {
            if (!succeeded) {
              reject(error);
              return;
            }
            resolve(client(originalRequest));
          });
        });
      }

      isRefreshing = true;
      try {
        const succeeded = await refreshAccessToken();
        notifyRefreshWaiters(succeeded);
        if (!succeeded) return Promise.reject(error);
        return client(originalRequest);
      } finally {
        isRefreshing = false;
      }
    },
  );
}

installRefreshInterceptor(api);
installRefreshInterceptor(apiBlob);

export { api, apiBlob, clearClientSession, login, refreshAccessToken };
