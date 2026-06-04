import { useEffect } from "preact/hooks";
import { SEO } from "@/components/SEO";
import { setActiveLink } from "@/utils/setActiveLink";
import { setDocumentTitle } from "@/utils/setDocumentTitle";
import { FormResetPassword } from "@/components/form/FormResetPassword";

type PropsPage = {
  routeKey: string;
};

function ResetPasswordPage({ routeKey }: PropsPage) {
  useEffect(() => {
    setActiveLink();
    setDocumentTitle();
  }, [routeKey]);

  return (
    <div className="page-container">
      <SEO
        content={{
          title: "Reinitialisation du mot de passe | WizPix",
          description: "Page de reinitialisation du mot de passe WizPix.",
        }}
      />
      <FormResetPassword />
    </div>
  );
}

export { ResetPasswordPage };
