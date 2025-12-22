import { useEffect } from "preact/hooks";
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
      <FormResetPassword />
    </div>
  );
}

export { ResetPasswordPage };
