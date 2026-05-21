//import des hook
import { useState } from "preact/hooks";
import { useLocation } from "preact-iso";

//import des instances perso


//import des composants enfants
import { Loader } from "@/components/loader/Loader";

//import des functions
import { navigateWithLink } from "@/utils/navigateWithLink";
import { logoutClient } from "@/utils/auth/logout";

//constante et variable globale

//declaration des types
//declarations des types
type DisplayState = {
  userName: string | null;
  authentified: boolean;
  credit: number | null;
  textCredit: string | null;
  creditConverter: number | null;
  textCreditConverter: string | null;
  textLogout: string | null;
  textDashboard: string | null;
} | null;

type ProfileDropDownType = {
  content: DisplayState;
};

const ProfileDropDown = ({ content }: ProfileDropDownType) => {
  if (!content) return null;
  const location = useLocation();

  //state qui gere l' affichage du loader
  const [isLoader, setIsLoader] = useState(false);
  const [isStatus, setIsStatus] = useState<"error" | "success" | "idle">(
    "idle",
  );

  const credit = content.credit ?? 0;
  const creditConverter = content.creditConverter ?? 0;

  //declaration des fonctions
  const logOut = async () => {
    await logoutClient({
      onStart: () => {
        setIsLoader(true);
      },
      onFinished: () => {
        setIsLoader(false);
        setIsStatus("success");
        setTimeout(() => {
          setIsStatus("idle");
          navigateWithLink("/");
        }, 2000);
      },
    });
  };

  return (
    <div className="dropdown dropdown-end">
      <button
        tabIndex={0}
        type="button"
        className="btn hover:bg-primary/40"
        aria-label="Profile"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-6"
        >
          <path
            fillRule="evenodd"
            d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <ul
        tabIndex={-1}
        className="menu-sm dropdown-content bg-component rounded-box z-1 mt-3 w-[220px] p-2 shadow"
      >
        <li className="p-1 cursor-pointer rounded-lg hover:bg-base-300 hover:translate-x-1 transition-all">
          <a
            href="/dashboard"
            className="flex flex-row justify-left items-center gap-4"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-6"
            >
              <path
                fillRule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm4.5 0a.75.75 0 0 1 .75-.75h2.25a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75v-6Zm5.25-3.75a.75.75 0 0 0-.75.75V18a.75.75 0 0 0 .75.75h2.25A.75.75 0 0 0 18 18V9a.75.75 0 0 0-.75-.75h-2.25Zm3.75-2.25a.75.75 0 0 0-.75.75v12a.75.75 0 0 0 .75.75h2.25a.75.75 0 0 0 .75-.75V6.75a.75.75 0 0 0-.75-.75H15.75Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{content?.textDashboard}</span>
          </a>
        </li>
        <li className="p-1">
          <div className="flex flex-row justify-left items-center gap-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-6"
            >
              <path
                fillRule="evenodd"
                d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634Zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 0 1-.189-.866c0-.298.059-.605.189-.866Zm2.023 6.828a.75.75 0 1 0-1.06-1.06 3.75 3.75 0 0 1-5.304 0 .75.75 0 0 0-1.06 1.06 5.25 5.25 0 0 0 7.424 0Z"
                clipRule="evenodd"
              />
            </svg>

            <span className={"text-success"}>{content.userName}</span>
          </div>
        </li>
        <li className="p-1">
          <p className="flex flex-row justify-left items-center gap-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-6"
            >
              <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 0 1-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004ZM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 0 1-.921.42Z" />
              <path
                fillRule="evenodd"
                d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v.816a3.836 3.836 0 0 0-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 0 1-.921-.421l-.879-.66a.75.75 0 0 0-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 0 0 1.5 0v-.81a4.124 4.124 0 0 0 1.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 0 0-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 0 0 .933-1.175l-.415-.33a3.836 3.836 0 0 0-1.719-.755V6Z"
                clipRule="evenodd"
              />
            </svg>

            <span className={""}>{content.textCredit ?? ""}</span>
            <span className="text-info">{credit}</span>
          </p>
        </li>
        <li className="p-1">
          <p className="flex flex-row justify-left items-center gap-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-6"
            >
              <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 0 1-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004ZM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 0 1-.921.42Z" />
              <path
                fillRule="evenodd"
                d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v.816a3.836 3.836 0 0 0-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 0 1-.921-.421l-.879-.66a.75.75 0 0 0-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 0 0 1.5 0v-.81a4.124 4.124 0 0 0 1.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 0 0-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 0 0 .933-1.175l-.415-.33a3.836 3.836 0 0 0-1.719-.755V6Z"
                clipRule="evenodd"
              />
            </svg>

            <span className={""}>{content.textCreditConverter ?? ""}</span>
            <span className={"text-secondary"}>{creditConverter}</span>
          </p>
        </li>
        <li className="p-1 rounded-lg hover:bg-base-300 hover:translate-x-1 transition-all">
          <button
            className="cursor-pointer flex flex-row justify-left items-center gap-4"
            onClick={logOut}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-6"
            >
              <path
                fillRule="evenodd"
                d="M16.5 3.75a1.5 1.5 0 0 1 1.5 1.5v13.5a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5V15a.75.75 0 0 0-1.5 0v3.75a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V5.25a3 3 0 0 0-3-3h-6a3 3 0 0 0-3 3V9A.75.75 0 1 0 9 9V5.25a1.5 1.5 0 0 1 1.5-1.5h6ZM5.78 8.47a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 0 0 0 1.06l3 3a.75.75 0 0 0 1.06-1.06l-1.72-1.72H15a.75.75 0 0 0 0-1.5H4.06l1.72-1.72a.75.75 0 0 0 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>

            <span className={"text-warning"}>{content.textLogout ?? ""}</span>
          </button>
        </li>
        {isLoader ? (
          <li className={"relative h-[50px]"}>
            <Loader
              top="top-[50%]"
              left="left-[50%]"
              text={content.textLogout ?? ""}
            />
          </li>
        ) : null}
      </ul>
    </div>
  );
};

export { ProfileDropDown };
