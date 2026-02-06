//import des hooks
import { useRef, useState } from "preact/hooks";
import { set, useForm } from "react-hook-form";

//import des librairies
import axios from "axios";
import { useTranslation } from "react-i18next";

//import des composants enfants
import { BtnGoogleLogin } from "@/components/button/loginGoogle";
import { OtpInput } from "@/components/form/OtpInput";
import { Loader } from "@/components/loader/Loader";

//import des fonctions
import { axiosError } from "@/utils/axiosError";
import { localOrProd } from "@/utils/localOrProd";


//declarations des types
export type FormValues = {
  email: string;
  password: string;
  confirm: string;
  lang: string;
  id?: string;
  plan: string | null;
  currency: string | null;
};

type BgColor = {
  free: string | "";
  hobby: string | "";
  pro: string | "";
};

//constante et variable globales
const { urlApi } = localOrProd();

//declarations des fonctions

//recupere la valeur du parametre "plan"
const getPlan = (): string | null => {
  // Récupérer la chaîne de requête
  const queryString = window.location.search;

  // Analyser la chaîne de requête
  const urlParams = new URLSearchParams(queryString);

  // Récupérer la valeur d'un paramètre spécifique
  const plan = urlParams.get("plan") || null;

  return plan;
};
const getCurrency = (): string => {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  const currency = urlParams.get("currency") || "CHF";
  const normalized = currency.toUpperCase();
  return ["CHF", "EUR", "USD"].includes(normalized) ? normalized : "CHF";
};
const FormSignUp = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language;
  //state qui gere l' validite de la reponse.
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>("null");

  //gere en partie l' affichage du loader
  const [isLoader, setIsLoader] = useState(false);

  //state qui gere l'affichge des icon "eye" et le display des input password
  const [eyePass, setEyePass] = useState(false);
  const [eyeConfirm, setEyeConfirm] = useState(false);

  //state qui gere l'affichage de la fentetre code verification
  const [displayOtp, setDisplayOtp] = useState(false);

  //reference qui stocke les data user a transmetre au form OTP
  const dataUser = useRef<FormValues>();

  const plan = getPlan();
  const currency = getCurrency();
  //class css dynamique
  let bgColor: string | null = null;
  if (plan) {
    bgColor =
      {
        free: "bg-secondary/80",
        hobby: "bg-success/80",
        pro: "bg-info/80",
      }[plan] || null;
  }

  

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FormValues>({
    mode: "onTouched",
    defaultValues: {
      email: "guillaume-d@tutanota.com",
      password: "qwertzuioP!789",
      confirm: "qwertzuioP!789",
      lang: lang,
      plan: plan,
      currency: currency,
    },
  });

  //recupere les valeurs des inputs passwors via un observeur
  const pw = watch("password");
  const cpw = watch("confirm");
  const email = watch("email");

  //permet la soumission du formulaire
  const onSubmit = async (data: FormValues) => {
    //afficha du loader
    setIsLoader(true);

    dataUser.current = data;

    try {
      const response = await axios.post(
        `${urlApi}/api/signup/check/user`,
        data,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      if (!response) {
        setErrorMessage(
          t("formSignup.httpError")
        );
        setStatus("error");
        return;
      }

      const Data = response.data;
      if (Data.error) {
        setErrorMessage(Data.message);
        setStatus("error");
        return;
      }

      setIsLoader(false);
      setStatus("success");
      setDisplayOtp(true);
    } catch (error) {
      setIsLoader(false);
      setStatus("error");
      setDisplayOtp(false);
    } finally {
      setTimeout(() => {
        setStatus("idle");
      }, 5000);
    }
  };

  return (
    <>
      <div className="mx-auto max-w-[500px] h-[calc(100svh-70px)] flex flex-col justify-center py-15">
        <div className="sm:mx-auto sm:w-full sm:max-w-xl">
          <h1 className="text-center text-2xl font-bold">
            {t("formSignUp.title")}
            <span
              className={`ml-[10px] p-[5px] text-black rounded ${bgColor} capitalize`}
              style={{ textTransform: "capitalize" }}
            >
              {plan}
            </span>
            <span className="ml-2 text-sm uppercase text-info">{currency}</span>
          </h1>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
          <div className="rounded-xl bg-base-100/60 backdrop-blur-sm shadow-sm p-6 bg-component md:p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label htmlFor="email" className="label p-0">
                  <span className="label-text text-base-content/80">
                    {t("formSignUp.email")}
                  </span>
                </label>
                <div className="mt-2">
                  <input
                    id="email"
                    type="email"
                    className="input-clean"
                    aria-invalid={!!errors.email || undefined}
                    {...register("email", {
                      required: t("formContact.required"),
                      pattern: {
                        value: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,80}$/,
                        message: t("formContact.pattern"),
                      },
                    })}
                  />
                  {errors.email && (
                    <p className="absolute mt-1 text-sm text-error">
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="label p-0">
                    <span className="label-text text-base-content/80">
                      {t("formSignUp.password")}
                    </span>
                  </label>
                  <div className="text-sm">
                    <button
                      id="pw"
                      type="button"
                      className={"cursor-pointer"}
                      onClick={(e) => setEyePass(!eyePass)}
                    >
                      {!eyePass ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="size-6"
                        >
                          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                          <path
                            fillRule="evenodd"
                            d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="size-6"
                        >
                          <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
                          <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
                          <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <input
                    id="password"
                    type={!eyePass ? "password" : "text"}
                    className="input-clean"
                    aria-invalid={!!errors.password || undefined}
                    {...register("password", {
                      required: t("formContact.required"),
                      pattern: {
                        value:
                          /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~])(?=.{8,20}).*$/u,
                        message: t("formSignUp.passwordError"),
                      },
                    })}
                  />
                  {errors.password && (
                    <p className="absolute mt-1 text-sm text-error">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="label p-0">
                    <span className="label-text text-base-content/80">
                      {t("formSignUp.passwordConfirm")}
                    </span>
                  </label>
                  <div className="text-sm">
                    <button
                      id="cpw"
                      type="button"
                      className={"cursor-pointer"}
                      onClick={(e) => setEyeConfirm(!eyeConfirm)}
                    >
                      {!eyeConfirm ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="size-6"
                        >
                          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                          <path
                            fillRule="evenodd"
                            d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="size-6"
                        >
                          <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
                          <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
                          <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <input
                    id="confirm"
                    type={!eyeConfirm ? "password" : "text"}
                    className="input-clean"
                    {...register("confirm", {
                      required: t("formContact.required"),
                      pattern: {
                        value:
                          /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~])(?=.{8,20}).*$/u,
                        message: t("formSignUp.passwordError"),
                      },
                    })}
                  />
                  {errors.confirm && (
                    <p className="absolute mt-1 text-sm text-error">
                      {errors.confirm.message}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <div className="mt-2">
                  <input
                    id="plan"
                    type="text"
                    hidden
                    readOnly
                    className="input input-bordered w-full bg-base-200 text-base-content placeholder:text-base-content/60"
                    {...register("plan")}
                  />
                </div>
              </div>
              <div>
                <div className="mt-2">
                  <input
                    id="lang"
                    type="text"
                    hidden
                    readOnly
                    className="input input-bordered w-full bg-base-200 text-base-content placeholder:text-base-content/60"
                    {...register("lang")}
                  />
                </div>
              </div>
              <div>
                <div className="mt-2">
                  <input
                    id="currency"
                    type="text"
                    hidden
                    readOnly
                    {...register("currency")}
                  />
                </div>
              </div>
              <div className="relative flex flex-col justify-center items-center">
                <button
                  type="submit"
                  className="btn btn-primary w-full mt-10"
                  disabled={
                    pw !== cpw || //password differents
                    isSubmitting || //soumission du formulaire
                    !email || //si formulaire pas rempli entierement
                    !pw ||
                    !cpw ||
                    Object.keys(errors).length > 0 || //si erreur de hook form detecté
                    displayOtp || //si fenetre otp et btn resend affiché
                    status !== "idle" //si le status est en cours
                  }
                >
                  {t("formSignUp.btnSubmit")}
                </button>

                <div class="mt-5 h-[1px] w-full bg-gray-500 "></div>

                <div className="relative w-full flex flex-col justify-center items-center mt-4">
                  <BtnGoogleLogin
                    text={t("formSignUp.btnGoogle")}
                    disabled={
                      isLoader || status !== "idle" || displayOtp || true
                    }
                  />
                  {isLoader ? <Loader top="top-20" /> : null}
                </div>
                <div
                  className={`btn w-100 transition-all duration-500 transform 
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
                  {status === "success"
                    ? t("formSignUp.textSuccess")
                    : !errorMessage ? t("formSignUp.textError"): errorMessage}
                </div>
              </div>
              {
                <p className="mt-6 text-center text-sm text-base-content/70">
                  {t("formSignUp.question")}
                  <a href="/login" className="ml-1 link link-primary">
                    {t("formSignUp.link")}
                  </a>
                </p>
              }
            </form>
            {displayOtp ? (
              <OtpInput
                errorPattern={t("otpInput.errorPattern")}
                errorRequire={t("otpInput.errorRequire")}
                title={t("otpInput.title")}
                question={t("otpInput.question")}
                action={t("otpInput.btnResend")}
                emailUser={email}
                onSubmit={onSubmit}
                dataUser={dataUser.current}
                textSuccess={t("otpInput.textSuccess")}
                textError={t("otpInput.textError")}
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};

export { FormSignUp };
