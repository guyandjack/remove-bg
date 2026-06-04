//import des composants enfants
import { FormSignUp } from "@/components/form/FormSignUp";
import { SEO } from "@/components/SEO";
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
    <div className={"page-container"}>
      <SEO
        content={{
          title: "Inscription | WizPix",
          description: "Page d'inscription WizPix.",
        }}
      />
      <FormSignUp />
    </div>
  );
}

export { SignUpPage };
