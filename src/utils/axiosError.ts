import axios from "axios"

const axiosError = (seteur:any, error:any) => {
  // AxiosError typé (si tu utilises axios v1+ avec TS)
  if (axios.isAxiosError(error)) {
    // 🧩 1️⃣ Cas : pas de réponse (serveur down, CORS, réseau, timeout)
    if (error.code === "ECONNABORTED" || !error.response) {
      console.warn("Erreur réseau ou serveur injoignable");
      seteur("error");
    }

    // 🧩 2️⃣ Cas : le serveur a répondu avec un code HTTP ≠ 2xx
    else if (error.response) {
      console.warn("Erreur côté serveur:", error.response.status);
      seteur("error");
    }

    // 🧩 3️⃣ Cas : autre erreur inconnue
    else {
      console.warn("Erreur inconnue Axios:", error.message);
      seteur("error");
    }
  } else {
    // Cas d'erreur non Axios (rare)
    console.error("Erreur inattendue:", error);
    seteur("error");
  }
}

export {axiosError}
