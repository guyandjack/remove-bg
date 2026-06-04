import { FormLogin } from "@/components/form/formLogin";
import { SEO } from "@/components/SEO";
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
      <SEO
        content={{
          title: "Connexion | WizPix",
          description: "Page de connexion WizPix.",
        }}
      />
      <FormLogin />
    </div>
  );
}

export { LoginPage };
