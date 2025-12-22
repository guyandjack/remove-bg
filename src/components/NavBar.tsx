// Component navBar

//import des librairies
import { api } from "@/utils/axiosConfig";

//import des hooks
import { useEffect, useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { themeSignal } from "@/stores/theme";
import { navigateWithLink } from "@/utils/navigateWithLink";

//import des composants enfants
import { SelectLanguage } from "./LangSwitcher";
import { ProfileDropDown } from "./profileDropDown/ProfileDropDown";
import { ThemeControler } from "./themeControler/ThemeControler";
import { AnimatedLogoNormalWhite } from "./animation/AnimatedLogoNormalWhite";
import { AnimatedLogoNormalBlack } from "./animation/AnimatedLogoNormalBlack";
import { AnimatedLogoTinyWhite } from "./animation/AnimatedLogoTinyWhite";
import { AnimatedLogoTinyBlack } from "./animation/AnimatedLogoTinyBlack";

//import des data
import { navBarContent } from "@/data/content/components/nav/navBarContent";

//import des functions
import { isAuthentified } from "@/utils/request/isAuthentified";
import { setActiveLink } from "@/utils/setActiveLink";

//import des signaux de connexion user (signUp, login)
import {
  sessionSignal,
  initSessionFromLocalStorage,
  setSessionFromApiResponse,
} from "@/stores/session";


//declarations des types
type DisplayState = {
  userName: string | null;
  authentified: boolean;
  textCredit: string | null;
  credit: number;
  plan: string | null;
  textLogout: string | null;
} | null;

const NavBar = () => {
  const { t } = useTranslation();
  //state qui gere l'affichage du profileDropdown et son contenu textuel
  const [isDisplay, setIsDisplay] = useState<DisplayState>({
    userName: null,
    authentified: false,
    credit: 0,
    textCredit: t("priceTab.credit"),
    plan: null,
    textLogout: t("navBar.logout"),
  });

  const [tinyLogo, setTinyLogo] = useState(true);
  const [checkoutFeedback, setCheckoutFeedback] = useState<{
    status: "idle" | "pending" | "success" | "error";
    message: string | null;
  }>({ status: "idle", message: null });
  const checkoutHandledRef = useRef(false);
  const toastTimeoutRef = useRef<number | null>(null);

  //active le lien au montage du composant
  useEffect(() => {
    setActiveLink();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const widthScreen = window.innerWidth;
      // On dérive directement l'état depuis la largeur
      setTinyLogo(widthScreen < 1024);
    };

    // Appel initial au montage pour avoir le bon logo directement
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const cleanupCheckoutParams = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    ["userValide", "session_id", "plan", "currency"].forEach((key) =>
      url.searchParams.delete(key)
    );
    window.history.replaceState({}, "", url.toString());
  };

  const scheduleToastReset = (delay = 5000) => {
    if (typeof window === "undefined") return;
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setCheckoutFeedback({ status: "idle", message: null });
      toastTimeoutRef.current = null;
    }, delay);
  };

  const finalizeCheckout = async (sessionId: string, attempt = 0) => {
    try {
      setCheckoutFeedback({
        status: "pending",
        message: "Validation du paiement en cours...",
      });
      const response = await api.post(
        "api/stripe/finalize",
        { sessionId },
        { withCredentials: true }
      );

      const data = response.data;

      if (data?.status === "pending") {
        if (attempt < 5) {
          setTimeout(() => finalizeCheckout(sessionId, attempt + 1), 1500);
        } else {
          setCheckoutFeedback({
            status: "error",
            message:
              "La confirmation Stripe est plus longue que prévu, réessayez dans un instant.",
          });
          scheduleToastReset();
          cleanupCheckoutParams();
        }
        return;
      }

      if (data?.status !== "success") {
        setCheckoutFeedback({
          status: "error",
          message:
            data?.message ||
            "Impossible de confirmer votre paiement. Merci de réessayer.",
        });
        scheduleToastReset();
        cleanupCheckoutParams();
        return;
      }

      //cas de success
      setSessionFromApiResponse(data);
      setCheckoutFeedback({
        status: "success",
        message: "Paiement confirmé ! Préparation de votre espace...",
      });
      cleanupCheckoutParams();
      setTimeout(() => {
        setCheckoutFeedback({ status: "idle", message: null });
        navigateWithLink("/services");
      }, 3000);
    } catch (error) {
      console.error("Erreur finale Stripe:", error);
      setCheckoutFeedback({
        status: "error",
        message:
          "Une erreur est survenue lors de la confirmation du paiement. Merci de réessayer.",
      });
      scheduleToastReset();
      cleanupCheckoutParams();
    }
  };

  const handleCheckoutFailure = async (sessionId: string | null) => {
    try {
      setCheckoutFeedback({
        status: "error",
        message:
          "Le paiement a été annulé. Aucun débit n'a été effectué et votre session est réinitialisée.",
      });
      if (sessionId) {
        await api.post(
          "api/stripe/cleanup",
          { sessionId },
          { withCredentials: true }
        );
      }
    } catch (error) {
      console.error("Erreur lors du nettoyage Stripe:", error);
    } finally {
      cleanupCheckoutParams();
      scheduleToastReset();
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (checkoutHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const statusFlag = params.get("userValide");
    if (!statusFlag) return;
    checkoutHandledRef.current = true;
    const sessionId = params.get("session_id");
    if (statusFlag === "true" && sessionId) {
      finalizeCheckout(sessionId);
    } else if (statusFlag === "false") {
      handleCheckoutFailure(sessionId);
    } else {
      cleanupCheckoutParams();
    }
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isParam = params.get("userValide") || null;
    if (isParam) return;
    initSessionFromLocalStorage();
    isAuthentified().catch((e) => {
      console.error("un bug!", e);
    });
  }, []);

  useEffect(() => {
    const session = sessionSignal?.value;
    // Ensure email is always a string. If session?.user?.email is not null/undefined
    // but also not a string (e.g., a number), convert it to a string.
    const email = String(session?.user?.email || "");
    const emailFallback =
      email && email.includes("@") ? email.split("@")[0] : email || null;

    setIsDisplay({
      userName: session?.user?.first_name || emailFallback,
      authentified: session?.authentified || false,
      credit: session?.credits?.remaining_last_24h || 0,
      textCredit: t("priceTab.credit"),
      plan: session?.plan?.name || session?.plan?.code || null,
      textLogout: t("navBar.logout"),
    });
  }, [sessionSignal?.value, t]);

  return (
    <>
      {checkoutFeedback.status !== "idle" ? (
        <div className="toast toast-top toast-center z-50 mt-16">
          <p
            className={`alert ${
              checkoutFeedback.status === "success"
                ? "alert-success"
                : checkoutFeedback.status === "error"
                ? "alert-error"
                : "alert-info"
            }`}
          >
            <span>{checkoutFeedback.message}</span>
          </p>
        </div>
      ) : null}
      <nav className="navbar bg-navbar shadow-sm backdrop-blur-sm">
        <div className="navbar-start">
          <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
              {
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {" "}
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h8m-8 6h16"
                  />{" "}
                </svg>
              }
            </div>
            <ul
              tabIndex={-1}
              className="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow"
            >
              {navBarContent.map((link) => {
                const label = t(`navBar.${link.key}`);
                return link.key === "home" ||
                  link.key === "pricing" ||
                  link.key === "service" ||
                  (link.key === "signup" && !isDisplay?.authentified) ||
                  (link.key === "login" && !isDisplay?.authentified) ? (
                  <li key={link.href}>
                    <a
                      data-id={link.href}
                      className={[
                        //ajout de la tramsition
                        "transition-all duration-300 ease-out",
                        "hover:text-primary",
                      ].join(" ")}
                      href={link.href}
                      onClick={(e) => setActiveLink(e)}
                    >
                      {label}
                    </a>
                  </li>
                ) : null;
              })}
            </ul>
          </div>

          {tinyLogo ? (
            <a 
            className={"block w-[50px]"}
            href={"/"}>
              {themeSignal.value === "winter" ? (
                <AnimatedLogoTinyBlack />
              ) : (
                <AnimatedLogoTinyWhite />
              )}
            </a>
          ) : (
            <a 
            className={"block w-[200px]"}
            href={"/"}>
                {themeSignal.value === "winter" ? (
                  <AnimatedLogoNormalBlack />
                ) : (
                  <AnimatedLogoNormalWhite />
                )}
            </a>  
          )}
        </div>
        <div className="navbar-center hidden lg:flex">
          <ul className="menu-horizontal gap-5 px-1">
            {navBarContent.map((link) => {
              const label = t(`navBar.${link.key}`);
              return link.key !== "signup" && link.key !== "login" ? (
                <li key={link.href}>
                  <a
                    data-id={link.href}
                    className={[
                      //ajout de la tramsition
                      "transition-all duration-300 ease-out ",
                      "hover:text-primary",
                    ].join(" ")}
                    href={link.href}
                    onClick={(e) => setActiveLink(e)}
                  >
                    {label}
                  </a>
                </li>
              ) : null;
            })}
          </ul>
        </div>
        <div className="navbar-end gap-2 flex flex-row gap-x-5">
          <ul className="menu-horizontal gap-x-5 flex flex-row items-center ">
            {navBarContent.map((link) => {
              const label = t(`navBar.${link.key}`);
              return (link.key === "signup" || link.key === "login") &&
                !isDisplay?.authentified ? (
                <li className={"hidden lg:block shrink-0"} key={link.href}>
                  <a
                    data-id={link.href}
                    className={[
                      //ajout de la tramsition
                      "transition-all duration-300 ease-out ",
                      "hover:text-primary",
                    ].join(" ")}
                    href={link.href}
                    onClick={(e) => setActiveLink(e)}
                  >
                    {label}
                  </a>
                </li>
              ) : null;
            })}
          </ul>
          <ThemeControler />
          <SelectLanguage />
          {isDisplay?.authentified ? (
            <ProfileDropDown
              credit={isDisplay?.credit}
              userName={isDisplay?.userName}
              textCredit={isDisplay?.textCredit}
              plan={isDisplay?.plan}
            />
          ) : null}
        </div>
      </nav>
    </>
  );
};

export { NavBar };
