//import de hooks
import { useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";

///import des fonctions
import { setDocumentTitle } from "@/utils/setDocumentTitle";
import { setActiveLink } from "@/utils/setActiveLink";


//import des composants enfant
import { FormContact } from "../components/formContact";

//import des images
import undraw_contact from "@/assets/images/undraw-contact.svg";
import undraw_email from "@/assets/images/undraw-contact-email.svg";
import { DesignPaternPoint } from "@/components/disignPatern/designPaternPoint";

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

type PropsPage = {
  routeKey: string
};

function ContactPage({routeKey}: PropsPage) {
  const { t } = useTranslation();
  useEffect(() => {
    setActiveLink();
    setDocumentTitle();
  }, [routeKey]);

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
    <div className="page-container">
      
      <h1
        dangerouslySetInnerHTML={{
          __html: t("contact.title").replace(/\n/g, "<br/>"),
        }}
        className={
          "mt-[50px] self-center text-center text-4xl font-bold lg:w-[60%] lg:text-6xl lg:text-left"
        }
      ></h1>
      <p
        dangerouslySetInnerHTML={{
          __html: t("contact.intro").replace(/\n/g, "<br/>"),
        }}
        className={"text-xl max-w-[800px]"}
      ></p>
      <div className={"relative w-full max-w-[600px]"}>
        <DesignPaternPoint width={80} height={100} color={"info"} styled={"absolute top-[-40px] right-[-80px] hidden lg:block" } />
        <FormContact content={contentForm} />
      </div>
    </div>
  );
}

export { ContactPage };
