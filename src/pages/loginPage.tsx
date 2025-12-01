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
    <div className={"px-[10px] w-full mx-auto bg-page lg:px-[0px]"}>
      <FormLogin />
    </div>
  );
}

export { LoginPage };
