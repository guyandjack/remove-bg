//import des composants enfants
import { FormSignUp } from "@/components/form/FormSignUp";
import { setDocumentTitle } from "@/utils/setDocumentTitle";
import { useEffect } from "preact/hooks";

function SignUpPage() {
  useEffect(() => {
    setDocumentTitle();
  }, []);
  return (
    <div className={"px-[10px] w-full mx-auto bg-page lg:px-[0px]"}>
      <FormSignUp />
    </div>
  );
}

export { SignUpPage };
