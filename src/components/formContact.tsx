//import des hooks
import { useRef, useState } from "preact/hooks";
import { useForm } from "react-hook-form";

//import des librairies
import axios from "axios";
import { useTranslation } from "react-i18next";

//import des composants enfants
import { Loader } from "@/components/loader/Loader";

//import des fonctions
import { localOrProd } from "@/utils/localOrProd";
import { axiosError } from "@/utils/axiosError";

//declarations des types
type FormValues = {
  firstname: string;
  lastname: string;
  subject: string;
  email: string;
  message: string;
  agree: boolean;
};

type FormKey =
  | "lastName"
  | "firstName"
  | "subject"
  | "email"
  | "message"
  | "privacy"
  | "link"
  | "required"
  | "minLength"
  | "maxLength"
  | "pattern"
  | "button"
  | "submit"
  | "textSuccess"
  | "textError";

  type FormContent = Record<FormKey, string>;
  type FormProps = {
    content: FormContent;
  };

//constante et variable globales
const { urlApi } = localOrProd();

function FormContact({content}:FormProps) {
  const { t } = useTranslation();

  //state qui gere l' validite de la reponse.
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  //gere en partie l' affichage du loader
  const [isLoader, setIsLoader] = useState(false);

  //recuperation des valeurs du localstorage pour initialiser les valeurs du formulaire
  const localSorageValue = localStorage.getItem("formContact");
  let defaultValue = {
    firstname: "",
    lastname: "",
    subject: "",
    email: "",
    message: "",
    agree: "",
  } ;
  if (localSorageValue) {
    //defaultValue = {};
    defaultValue = JSON.parse(localSorageValue);
  }

  console.log("defaultValue: ", defaultValue);

  //objet qui persiste les valeurs des inputs à stoker dans le localstorage
  const objectValueToStore =
    useRef<Record<string, string | boolean>>(defaultValue);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FormValues>({
    mode: "onTouched",
    //attributions des valeurs par defaut du formulaire
    defaultValues: {
      firstname: defaultValue.firstname || "",
      lastname: defaultValue.lastname || "",
      subject: defaultValue.subject || "",
      email: defaultValue.email || "",
      message: defaultValue.message || "",
      //au montage ou remontage du composant, la checkbox "agree" doit passer à false
      //pour forcer la validation par l' utilisateur.
      agree: false,
    },
  });

  //Recuperation de la valeur de la checkbox via un observeur
  const agree = watch("agree");
  console.log("input agree: ", agree);

  //Permet l' enregistrement des valeurs des inputs dans le localstorage
  const storeValue = (e: any) => {
    const key: string = e.target.id.toString();
    let value: string;
    if (key === "agree") {
      value = e.target.checked.toString();
    } else {
      value = e.target.value.toString();
    }
    if (!key || !value) {
      return;
    }
    //persistance des donnée au dans le useref
    objectValueToStore.current[key] = value;
    //persistance des données dans le lolstorage
    localStorage.setItem(
      "formContact",
      JSON.stringify(objectValueToStore.current)
    );

    console.log("object value agree: ", objectValueToStore.current.agree);
  };

  //permet la soumission du formulaire
  const onSubmit = async (data: FormValues) => {
    //afficha du loader
    setIsLoader(true);

    try {
      const response = await axios.post(`${urlApi}/api/contact`, data, {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });

       
      

      let message = "";
      if (response.data.status === "success") {
        setIsLoader(false);
        setStatus("success");
        localStorage.removeItem("formContact");
        reset({
          firstname: "",
          lastname: "",
          subject: "",
          email: "",
          message: "",
          agree: false,
        });
        
      } else {
        setIsLoader(false);
        setStatus("error");
        
      }

    } catch (error) {
      setIsLoader(false);
      axiosError(setStatus, error);
    } finally {
      setTimeout(() => {
        setStatus("idle");
      }, 4000);
      
    }
  };

  console.log("hello eorld");
  console.log("errors: ", errors);
  console.log("is errors : ", Object.keys(errors).length > 0);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto w-full mb-16 p-6 bg-component md:p-8 rounded-xl"
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
        <div className="mb-3">
          <label htmlFor="firstname" className="label p-0">
            <span className="label-text text-base-content/80">
              {content.firstName}
            </span>
          </label>
          <div className="relative mt-2">
            <input
              id="firstname"
              type="text"
              className="input-clean"
              aria-invalid={!!errors.firstname || undefined}
              {...register("firstname", {
                required: content.required,
                minLength: { value: 2, message: content.minLength },
                maxLength: { value: 30, message: content.maxLength },
                pattern: {
                  value: /^[a-zA-Z\-'. \D]{1,30}$/u,
                  message: content.pattern,
                },
                onChange: (e) => storeValue(e),
              })}
            />
            {errors.firstname && (
              <p className="absolute mt-1 text-sm text-error">
                {errors.firstname.message}
              </p>
            )}
          </div>
        </div>

        <div className="mb-3">
          <label htmlFor="lastname" className="label p-0">
            <span className="label-text text-base-content/80">
              {content.lastName}
            </span>
          </label>
          <div className="relative mt-2">
            <input
              id="lastname"
              type="text"
              className="input-clean"
              aria-invalid={!!errors.lastname || undefined}
              {...register("lastname", {
                required: content.required,
                minLength: { value: 2, message: content.minLength },
                maxLength: { value: 30, message: content.maxLength },
                pattern: {
                  value: /^[a-zA-Z\-'. ]{1,30}$/u,
                  message: content.pattern,
                },
                onChange: (e) => storeValue(e),
              })}
            />
            {errors.lastname && (
              <p className="absolute mt-1 text-sm text-error">
                {errors.lastname.message}
              </p>
            )}
          </div>
        </div>

        <div className="mb-3 sm:col-span-2">
          <label htmlFor="subject" className="label p-0">
            <span className="label-text text-base-content/80">
              {content.subject}
            </span>
          </label>
          <div className="relative mt-2">
            <input
              id="subject"
              type="text"
              className="input-clean"
              aria-invalid={!!errors.subject || undefined}
              {...register("subject", {
                minLength: { value: 2, message: content.minLength },
                maxLength: { value: 50, message: content.maxLength },
                pattern: {
                  value: /^[\w\-'. 0-9]{1,50}$/u,
                  message: content.pattern,
                },
                onChange: (e) => storeValue(e),
              })}
            />
            {errors.subject && (
              <p className="absolute mt-1 text-sm text-error">
                {errors.subject.message}
              </p>
            )}
          </div>
        </div>

        <div className="mb-3 sm:col-span-2">
          <label htmlFor="email" className="label p-0">
            <span className="label-text text-base-content/80">
              {content.email}
            </span>
          </label>
          <div className="relative mt-2">
            <input
              id="email"
              type="email"
              className="input-clean"
              aria-invalid={!!errors.email || undefined}
              {...register("email", {
                required: content.required,
                minLength: { value: 10, message: content.minLength },
                maxLength: { value: 80, message: content.maxLength },
                pattern: {
                  value: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,80}$/,
                  message: content.pattern,
                },
                onChange: (e) => storeValue(e),
              })}
            />
            {errors.email && (
              <p className="absolute mt-1 text-sm text-error">
                {errors.email.message}
              </p>
            )}
          </div>
        </div>

        <div className="mb-3 sm:col-span-2">
          <label htmlFor="message" className="label p-0">
            <span className="label-text text-base-content/80">
              {content.message}
            </span>
          </label>
          <div className="relative mt-2">
            <textarea
              id="message"
              rows={4}
              className="input-clean"
              aria-invalid={!!errors.message || undefined}
              {...register("message", {
                required: content.required,
                minLength: { value: 10, message: content.minLength },
                maxLength: { value: 1000, message: content.maxLength },
                pattern: {
                  value: /^[\w\-'.,!?:; ]{10,1000}$/,
                  message: content.pattern,
                },
                onChange: (e) => storeValue(e),
              })}
            />
            {errors.message && (
              <p className="absolute mt-1 text-sm text-error">
                {errors.message.message}
              </p>
            )}
          </div>
        </div>

        <div className="mb-3 relative flex items-center gap-3 sm:col-span-2">
          <input
            id="agree"
            type="checkbox"
            className="toggle toggle-primary"
            aria-invalid={!!errors.agree || undefined}
            {...register("agree", {
              required: content.required,
              onChange: (e) => storeValue(e),
            })}
          />
          <p className="text-sm text-base-content/70">
            {content.privacy}
            <a href="/privacy" className="ml-1 font-semibold link link-primary">
              {content.link}
            </a>
            .
          </p>
          {errors.agree && (
            <p className="absolute top-6 left-0 sm:col-span-2 text-sm text-error">
              {errors.agree.message}
            </p>
          )}
        </div>
      </div>

      <div className="relative mt-8 flex flex-col justify-center items-center">
        <button
          type="submit"
          className="relative z-1 btn btn-primary w-full"
          //si l'objet errors contient au moins une clef le btn est disabled
          //si l'objet contient un nombre de clef < 5 c' est que le formulaire n'est pas rempli entierement, le btn doit etre disabled
          //par defaut au montage du composant la checkbox est false, si false le btn doit etre disabled
          disabled={
            Object.keys(errors).length > 0 ||
            Object.keys(objectValueToStore.current).length < 5 ||
            !agree
          }
        >
          {isLoader ? "" : content.button}
          {isLoader ? <Loader direction="flex-col" top="top-20" /> : null}
        </button>
        <div
         
          className={`btn w-50 transition-all duration-500 transform 
          ${status === "idle" ? "opacity-0 translate-y-0" : ""}
          ${
            status === "success"
              ? "opacity-100 translate-y-3 bg-green-500 text-white px-4 py-2 rounded-lg"
              : ""
          }
          ${
            status === "error"
              ? "opacity-100 translate-y-3 bg-red-500 text-white px-4 py-2 rounded-lg"
              : ""
          }
        `}
        >
          {status === "success" ? content.textSuccess : ""}
          {status === "error" ? content.textError : ""}
        
        </div>
      </div>
    </form>
  );
}

export { FormContact };
