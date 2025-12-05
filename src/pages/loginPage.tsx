import { FormLogin } from "@/components/form/formLogin";
import { useEffect } from "preact/hooks";

//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";
import { setDocumentTitle } from "@/utils/setDocumentTitle";

type PropsPage = {
  routeKey: string;
};

function LoginPage({routeKey}: PropsPage) {
 useEffect(() => {
   setActiveLink();
   setDocumentTitle();
 }, [routeKey]);
  return (
    <div className={"page-container"}>
      <FormLogin />
    </div>
  );
}

export { LoginPage };
