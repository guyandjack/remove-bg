// Component navBar


//import des librairies
import {api} from "@/utils/axiosConfig";

//import des hooks
import { useEffect, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";

//import des composants enfants
import { SelectLanguage } from "./LangSwitcher";
import { ProfileDropDown } from "./profileDropDown/ProfileDropDown";
import { ThemeControler } from "./themeControler/ThemeControler";

//import des data
import { navBarContent } from "@/data/content/components/nav/navBarContent";

//import des functions
import { isAuthentified } from "@/utils/request/isAuthentified";
import { setActiveLink } from "@/utils/setActiveLink";


//import des signaux de connexion user (signUp, login)
import { sessionSignal, initSessionFromLocalStorage } from "../stores/session";


//declarations des types
type DisplayState = {
  userName: string | null;
  authentified: boolean;
  textCredit: string | null;
  credit: number;
  plan: string | null;
  textLogout: string | null;
}| null;


const NavBar = ()=> {
  const { t } = useTranslation();
  //state qui gere l'affichage du profileDropdown et son contenu textuel
  const [isDisplay, setIsDisplay] = useState<DisplayState>({
    userName: null,
    authentified: false,
    credit: 0,
    textCredit: t("priceTab.credit"),
    plan: null,
    textLogout: t("navBar.logout")
  });



  useEffect(() => {
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
        userName: session?.user?.first_name || emailFallback ,
        authentified: session?.authentified || false,
        credit: session?.credits?.remaining_last_24h || 0,
        textCredit: t("priceTab.credit"),
        plan: session?.plan?.name || session?.plan?.code || null,
        textLogout: t("navBar.logout"),
      });
    }, [sessionSignal?.value, t]);


  //active le lien au montage du composant
  useEffect(() => {
    setActiveLink();
  }, []);

  
  return (
    <nav className="navbar bg-navbar shadow-sm backdrop-blur-sm">
      <div className="navbar-start">
        <div className="dropdown">
          <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
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
          </div>
          <ul
            tabIndex={-1}
            className="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow"
          >
            {navBarContent.map((link) => {
              const label = t(`navBar.${link.key}`);
              return (
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
              );
            })}
          </ul>
        </div>
        <a className="btn btn-ghost text-xl">daisyUI</a>
      </div>
      <div className="navbar-center hidden lg:flex">
        <ul className="menu-horizontal gap-5 px-1">
          {navBarContent.map((link) => {
            const label = t(`navBar.${link.key}`);
            return (
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
            );
          })}
        </ul>
      </div>
      <div className="navbar-end gap-2">
        <ThemeControler />
        <SelectLanguage />
        {isDisplay?.authentified ? (
          <ProfileDropDown
            credit={isDisplay.credit}
            userName={isDisplay.userName}
            textCredit={isDisplay.textCredit}
            plan={isDisplay.plan}
          />
        ) : null}
      </div>
    </nav>
  );
}

export { NavBar };


