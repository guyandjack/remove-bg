//import de hooks
import { useTranslation } from "react-i18next";

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
    <div className="mx-auto my-[100px] flex flex-col justify-start items-center gap-10 w-full max-w-[800px]">
      <h1 className={"text-4xl"}>{t("contact.title")}</h1>
      <p className={"text-xl"}>
       {t("contact.intro")}
      </p>
      <FormContact content={contentForm} />
    </div>
  );
}

export { ContactPage };
