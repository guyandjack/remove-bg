
//import des fonctions
import { setSessionFromApiResponse, sessionSignal } from "@/stores/session";
import axios from "axios";

//import des instances
import { api } from "@/utils/axiosConfig"



/** True only when the API has explicitly rejected the current session. */
const isAuthenticationRejected = (error: unknown): boolean =>
  axios.isAxiosError(error) && error.response?.status === 401;

const isAuthentified = async () => {
  try {
    const response = await api.get(`/api/auth/me`);

    if (!response) {
      throw Error("une erreur est survenu lors de la requete. code:1");
    }

    const data = response.data;
    setSessionFromApiResponse({
      ...data,
      authentified: data?.user?.authentified === true,
    });
    return sessionSignal.value;
  } catch (error) {
    // Do not turn a transient API, CORS, or rate-limit failure into a logout.
    // Only the server can establish that the cookie-based session is invalid.
    if (isAuthenticationRejected(error)) {
      sessionSignal.value = null;
    }
    throw error;
  }
};

export { isAuthentified, isAuthenticationRejected };
