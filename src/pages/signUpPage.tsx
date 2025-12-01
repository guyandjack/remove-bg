//import des composants enfants
import { FormSignUp } from "@/components/form/FormSignUp";
import { setActiveLink } from "@/utils/setActiveLink";
import { setDocumentTitle } from "@/utils/setDocumentTitle";
import { useEffect } from "preact/hooks";

type PropsPage = {
  routeKey: string;
};

function SignUpPage({routeKey}: PropsPage) {
 useEffect(() => {
   setActiveLink();
   setDocumentTitle();
 }, [routeKey]);
  return (
    <div className={"px-[10px] w-full mx-auto bg-page lg:px-[0px]"}>
      <FormSignUp />
    </div>
  );
}

export { SignUpPage };
