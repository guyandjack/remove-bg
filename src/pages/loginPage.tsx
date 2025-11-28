import { FormLogin } from "@/components/form/formLogin";
import { useEffect } from "preact/hooks";

function LoginPage() {
  useEffect(() => {
    setDocumentTitle();
  }, []);
  return (
    <div className={"px-[10px] w-full mx-auto bg-page lg:px-[0px]"}>
      <FormLogin />
    </div>
  );
}

export { LoginPage };
