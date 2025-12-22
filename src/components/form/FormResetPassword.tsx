import { useMemo, useState } from "preact/hooks";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { login } from "@/utils/axiosConfig";
import { axiosError } from "@/utils/axiosError";
import { Loader } from "@/components/loader/Loader";
import { navigateWithLink } from "@/utils/navigateWithLink";

type ResetPasswordFormValues = {
  password: string;
  confirm: string;
};

const PASSWORD_PATTERN =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~])(?=.{8,20}).*$/u;

const getTokenFromLocation = (): string => {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("token")?.trim() ?? "";
  } catch {
    return "";
  }
};

const FormResetPassword = () => {
  const { t } = useTranslation();
  const token = useMemo(() => getTokenFromLocation(), []);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isLoader, setIsLoader] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ResetPasswordFormValues>({
    mode: "onTouched",
    defaultValues: {
      password: "",
      confirm: "",
    },
  });

  const passwordValue = watch("password");
  const confirmValue = watch("confirm");

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) {
      setStatus("error");
      return;
    }

    setIsLoader(true);
    setStatus("idle");

    try {
      const response = await login.post(
        "/api/reset-password",
        { token, password: values.password, confirm: values.confirm },
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        }
      );

      if (response?.data?.status === "success") {
        setStatus("success");
        reset();
        setTimeout(() => {
          navigateWithLink("/login");
        }, 2000);
        return;
      }

      setStatus("error");
    } catch (error) {
      axiosError(setStatus, error);
    } finally {
      setIsLoader(false);
    }
  };

  const submitDisabled =
    isSubmitting ||
    isLoader ||
    !token ||
    !passwordValue ||
    !confirmValue ||
    Object.keys(errors).length > 0;

  return (
    <div className="mx-auto max-w-[500px] min-h-[calc(100svh-70px)] flex flex-col justify-center w-full">
      <div className="rounded-xl bg-base-100/60 backdrop-blur-sm shadow-sm p-6 bg-component md:p-8">
        <h1 className="text-center text-2xl font-bold tracking-tight text-base-content">
          {t("formReset.title")}
        </h1>
        <p className="mt-2 text-center text-base-content/70">
          {t("formReset.info")}
        </p>
        {!token && (
          <p className="mt-4 text-center text-error font-semibold">
            {t("formReset.missingToken")}
          </p>
        )}
        <form className="mt-6 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="label p-0">
                <span className="label-text text-base-content/80">
                  {t("formReset.password")}
                </span>
              </label>
              <button
                type="button"
                className="text-base-content/70"
                onClick={() => setIsPasswordVisible((v) => !v)}
                aria-label="toggle password visibility"
              >
                {!isPasswordVisible ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-5"
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
                    className="size-5"
                  >
                    <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
                    <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
                    <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
                  </svg>
                )}
              </button>
            </div>
            <div className="mt-2">
              <input
                id="password"
                type={isPasswordVisible ? "text" : "password"}
                className="input-clean"
                aria-invalid={!!errors.password || undefined}
                {...register("password", {
                  required: t("formContact.required"),
                  pattern: {
                    value: PASSWORD_PATTERN,
                    message: t("formReset.passwordError"),
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
              <label htmlFor="confirm" className="label p-0">
                <span className="label-text text-base-content/80">
                  {t("formReset.confirm")}
                </span>
              </label>
              <button
                type="button"
                className="text-base-content/70"
                onClick={() => setIsConfirmVisible((v) => !v)}
                aria-label="toggle confirmation visibility"
              >
                {!isConfirmVisible ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-5"
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
                    className="size-5"
                  >
                    <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
                    <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
                    <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
                  </svg>
                )}
              </button>
            </div>
            <div className="mt-2">
              <input
                id="confirm"
                type={isConfirmVisible ? "text" : "password"}
                className="input-clean"
                aria-invalid={!!errors.confirm || undefined}
                {...register("confirm", {
                  required: t("formContact.required"),
                  validate: (value) =>
                    value === passwordValue || t("formReset.confirmError"),
                })}
              />
              {errors.confirm && (
                <p className="absolute mt-1 text-sm text-error">
                  {errors.confirm.message}
                </p>
              )}
            </div>
          </div>

          <div className="relative flex flex-col gap-4">
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={submitDisabled}
            >
              {t("formReset.btnSubmit")}
            </button>
            <a className="btn btn-ghost w-full" href="/login">
              {t("formReset.btnBack")}
            </a>
            {isLoader ? <Loader top="top-[100%]" /> : null}
            <div
              className={`btn w-full transition-all duration-500 transform ${
                status === "idle" ? "opacity-0 translate-y-0" : ""
              } ${
                status === "success"
                  ? "opacity-100 translate-y-3 bg-green-500 text-white px-4 py-2 rounded-lg"
                  : ""
              } ${
                status === "error"
                  ? "opacity-100 translate-y-3 bg-red-500 text-white px-4 py-2 rounded-lg"
                  : ""
              }`}
            >
              {status === "success" ? t("formReset.textSuccess") : ""}
              {status === "error" ? t("formReset.textError") : ""}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export { FormResetPassword };
