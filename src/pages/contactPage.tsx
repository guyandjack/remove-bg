//import de hooks
import { useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";

//import de fonctions

//import des composants enfant
import { FormContact } from "../components/formContact";

type FormKey = "lastName" |
  "firstName" |
  "subject" |
  "email" |
  "message" |
  "privacy" |
  "link" |
  "required" |
  "minLength" |
  "maxLength" |
  "pattern" |
  "button" |
  "submit" |
  "textSuccess" |
  "textError";

function ContactPage() {
  const { t } = useTranslation();
  useEffect(() => {
    setDocumentTitle();
  }, []);
  const contentForm:Record<FormKey, string> = {
    lastName: t("formContact.lastName"),
    firstName: t("formContact.firstName"),
    subject: t("formContact.subject"),
    email: t("formContact.email"),
    message: t("formContact.message"),
    privacy: t("formContact.privacy"),
    link: t("formContact.link"),
    required: t("formContact.required"),
    minLength: t("formContact.minLength"),
    maxLength: t("formContact.maxLength"),
    pattern: t("formContact.pattern"),
    button: t("formContact.button"),
    submit: t("formContact.submit"),
    textSuccess: t("formContact.textSuccess"),
    textError: t("formContact.textError"),
  };
  return (
    <div className="px-[10px] w-full mx-auto bg-page lg:px-[0px] flex flex-col justify-start items-center gap-[50px]">
      <h1
        dangerouslySetInnerHTML={{
          __html: t("contact.title").replace(/\n/g, "<br/>"),
        }}
        className={
          "mt-[50px] self-center text-center text-4xl font-bold lg:w-[60%] lg:text-6xl lg:text-left"
        }
      >
        
      </h1>
      <p className={"text-xl max-w-[800px]"}>{t("contact.intro")}</p>
      <div className={"w-full max-w-[600px]"}>
        <FormContact content={contentForm} />
      </div>
    </div>
  );
}

export { ContactPage };
