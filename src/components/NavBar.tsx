// Component navBar
//import des librairies
import axios from "axios"
//import des hooks
import { useTranslation } from "react-i18next";
import {useState} from "preact/hooks"

//import des composants enfants
import { SelectLanguage } from "./LangSwitcher";
import { ProfileDropDown } from "./profileDropDown/ProfileDropDown";
import { ThemeControler } from "./themeControler/ThemeControler";


//import des data
import { navBarContent } from "@/data/content/components/nav/navBarContent";

//import des functions
import { localOrProd } from "@/utils/localOrProd";
const { urlApi } = localOrProd();


//fonction
const isAuthentified = async() => {
  try {
    const response = await axios.post(`${urlApi}/api/auth/me`, {
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

      return response.data
  } catch (error) {
    throw Error("une erreur est survenu lors de la requete:" + error)
    
    
  }
}



function NavBar() {
  //state qui gere l' affichage du profileDropdown
  const [isDisplay, setIsDisplay] = useState(false);

  const data = isAuthentified();

    const { t } = useTranslation();
  return (
    <div className="navbar bg-base-100 shadow-sm">
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
          tabIndex="-1"
          className="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow"
        >
          {navBarContent.map((link) => {
            const label = t(`navBar.${link.key}`);
            return (
              <li key={link.href}>
                <a
                  className={[
                    //ajout de la tramsition
                    "transition-all duration-300 ease-out",
                    "hover:text-primary",
                  ].join(" ")}
                  href={link.href}
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
      <ul className="menu menu-horizontal px-1">
        {navBarContent.map((link) => {
          const label = t(`navBar.${link.key}`);
          return (
            <li key={link.href}>
              <a
                className={[
                  //ajout de la tramsition
                  "transition-all duration-300 ease-out",
                  "hover:text-primary",
                ].join(" ")}
                href={link.href}
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
      <ProfileDropDown />
    </div>
  </div>
  );
}

export { NavBar };
  
  
  
  
  
  
/*<ul className="menu menu-horizontal px-1">
  {navBarContent.map((link) => {
    const label = t(`navBar.${link.key}`);
    return (
      <li key={link.href}>
        <a href={link.href}>{label}</a>
      </li>
    );
  })}
</ul>;*/