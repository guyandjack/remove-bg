
//import des fonctions
import { sessionSignal } from "@/stores/session";
import type { SessionData } from "@/stores/session";

//import des instances
import { api } from "@/utils/axiosConfig"



const createFallbackSession = (): SessionData => ({
  user: {
    email: "",
  },
  status: null,
  authentified: false,
  redirect: false,
  redirectUrl: null,
  plan: {
    code: "",
  },
  token: null,
  credits: {
    used_last_24h: 0,
    remaining_last_24h: 0,
  },
  subscriptionId: null,
  hint: null,
});

const isAuthentified = async () => {
  try {
    const response = await api.post(`/api/auth/me`, {});

    if (!response) {
      throw Error("une erreur est survenu lors de la requete. code:1");
    }

    const data = response.data;
    const user = data?.user;
    const baseSession = sessionSignal.value ?? createFallbackSession();

    const updatedSession: SessionData = {
      ...baseSession,
      status: data?.status ?? baseSession.status,
      authentified: user?.authentified ?? baseSession.authentified ?? false,
      user: {
        ...baseSession.user,
        ...user,
      },
    };

    sessionSignal.value = updatedSession;
    localStorage.setItem("session", JSON.stringify(updatedSession));
  } catch (error) {
    throw Error("une erreur est survenu lors de la requete. code:2 :" + error);
  }
};

export {isAuthentified}
