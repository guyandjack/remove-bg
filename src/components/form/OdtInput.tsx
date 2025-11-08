// OtpInput.tsx (ou .jsx)
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

//import des librairies
import axios from "axios";
import { FormSubmitHandler, useForm } from "react-hook-form";
import { signal, computed, effect } from "@preact/signals";

//import des composnta enfants
import { Loader } from "@/components/loader/Loader";

//import des fonctions
import { axiosError } from "@/utils/axiosError";
import { localOrProd } from "@/utils/localOrProd";

type callback = {
  email: string;
  password: string;
  confirm: string;
  lang: string;
  id?: string;
}


//Création d'un signal global pour être importé dans n'importe quel composant
const user = signal(false);
const isSignUp = computed(() => user.value === true);

const tokenAcces = signal(null);
const tokenAccesComputed = computed(() => tokenAcces.value);






type OtpInputProps = {
  length?: number; // par défaut 6
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  question: string;
  action: string;
  title: string;
    dataUser: FormValues;
    errorRequire: string;
    errorPattern: string;
    onSubmit: FormSubmitHandler<FormValues>;
  className?: string; // classes wrapper
  textSuccess: string;
  textError: string;
};

type FormValues = {
  otp: string;
  email?: string;
  id?: string;
};

const { urlApi } = localOrProd();

function OtpInput({
  length = 6,
  onSubmit,
  autoFocus = true,
  title,
  question,
  action,
    dataUser,
    errorRequire,
  errorPattern,
  className = "",
  textSuccess,
  textError,
}: OtpInputProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    getValues,
    trigger,
  } = useForm<FormValues>({ mode: "onChange", defaultValues: { otp: "" } });

  const [values, setValues] = useState<string[]>(() => Array(length).fill(""));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  

  //state qui gere l' validite de la reponse.
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  //gere en partie l' affichage du loader
  const [isLoader, setIsLoader] = useState(false);

  // Initialise le tableau de refs
  const slots = useMemo(() => Array.from({ length }, (_, i) => i), [length]);

  
  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      inputsRef.current[0].focus();
      inputsRef.current[0].select?.();
    }
  }, [autoFocus]);

  //fonction apppeler lors du resend des infos users
  const resend = (e:any) => {
    const idBtn: string = e.target.id.toString();
    //verif
    if (idBtn !== "resend") {
      return
    }
    const payload = { ...dataUser, id: idBtn };
    onSubmit(payload);
    
  }

  const focusIndex = (i: number) => {
    const el = inputsRef.current[i];
    if (el) {
      el.focus();
      el.select?.();
    }
  };

 const setAt = (i: number, val: string) => {
   setValues((prev) => {
     const next = [...prev];
     next[i] = val;
     const code = next.join("");

     // Quand les 6 cases sont remplies, on met otp + on valide + on soumet
     if (next.every((v) => v !== "")) {
       setValue("otp", code, { shouldValidate: true, shouldDirty: true });
       // Option 1: valider puis soumettre si valide
       trigger("otp").then((valid) => {
         if (valid) handleSubmit(onSubmitOtp)(); // <-- ICI on APPELLE la fonction retournée
       });
     } else {
       // sinon on garde otp partiel (optionnel)
       setValue("otp", code, { shouldDirty: true });
     }
     return next;
   });
 };

  const handleChange = (i: number, v: string) => {
    // garde uniquement le premier chiffre
    const digit = v.replace(/\D/g, "").slice(0, 1);
    if (!digit) {
      setAt(i, "");
      return;
    }
    setAt(i, digit);
    // focus suivant
    if (i < length - 1) focusIndex(i + 1);
  };

  const handleKeyDown = (
    i: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    const key = e.key;

    if (key === "Backspace") {
      if (values[i]) {
        // efface la case courante
        setAt(i, "");
      } else if (i > 0) {
        // va à la case précédente et efface
        focusIndex(i - 1);
        setAt(i - 1, "");
      }
      e.preventDefault();
    }

    if (key === "ArrowLeft" && i > 0) {
      focusIndex(i - 1);
      e.preventDefault();
    }
    if (key === "ArrowRight" && i < length - 1) {
      focusIndex(i + 1);
      e.preventDefault();
    }
    if (key === "Home") {
      focusIndex(0);
      e.preventDefault();
    }
    if (key === "End") {
      focusIndex(length - 1);
      e.preventDefault();
    }
  };

  const handlePaste = (
    i: number,
    e: React.ClipboardEvent<HTMLInputElement>
  ) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;

    setValues((prev) => {
      const next = [...prev];
      let idx = i;
      for (const ch of text) {
        if (idx >= length) break;
        next[idx] = ch;
        idx++;
      }
      // focus dernier rempli (ou suivant)
      const last = Math.min(i + text.length - 1, length - 1);
      focusIndex(last < length - 1 ? last + 1 : last);

     
      return next;
    });
  };

  const onSubmitOtp = async (data: FormValues) => {
    setIsLoader(true);
    try {
        const mailUser: any  = dataUser.email;
        const payload = {...data, email:mailUser}
        
      const response = await axios.post(`${urlApi}/api/signup/check/otp`, payload, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      });

      const result = response.data;
      if (result.status === "success") {
        //modifie la valeur du signal et stockage du token
        tokenAcces.value = result.token
        console.log("tokenAcces Values dans response odtinputs: ", tokenAcces.value);
        setIsLoader(false);
        setStatus("success");
        user.value = true;
        setTimeout(() => {
          
          window.location.href = "/upload";
        }, 2000);
        
        
      } else {
        setIsLoader(false);
        setStatus("error");
        
      }
    } catch (error) {
      setIsLoader(false);
      setStatus("error");
      axiosError(setStatus, error);
    } finally {
      //get token?
      setTimeout(() => {
        setStatus("idle");
        
      },3000);
    }
  };
  

  return (
    <form className={`flex flex-col items-center gap-3 ${className}`}>
      <label className="text-sm opacity-70">{title}</label>

      <div className="relative flex items-center gap-2">
        {slots.map((idx) => (
          <input
            key={idx}
            ref={(el) => (inputsRef.current[idx] = el)}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d*"
            maxLength={1}
            value={values[idx]}
            onChange={(e) => handleChange(idx, e.currentTarget.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={(e) => handlePaste(idx, e)}
            disabled={values.length < 6}
            aria-label={`Code ${idx + 1}`}
            readOnly={isSubmitting || isLoader || status !== "idle"}
            className={[
              // DaisyUI + Tailwind : case carrée, centrée
              "input input-bordered",
              "w-12 h-12 md:w-14 md:h-14",
              "text-center text-2xl font-semibold tracking-wider",
              "focus:outline-none focus:ring-2 focus:ring-primary",
              "disabled:opacity-50",
            ].join(" ")}
          />
        ))}

        {/* champ caché validé par RHF */}
        <input
          id="otp"
          type="hidden"
          {...register("otp", {
            required: errorRequire,
            pattern: {
              value: /^\d{6}$/,
              message: errorPattern,
            },
          })}
          className="input input-bordered w-full bg-base-200 text-base-content"
        />

        {/* message d’erreur global */}
        {errors.otp && (
          <p className="absolute top-[100%] text-error text-sm">
            {errors.otp.message as string}
          </p>
        )}
      </div>

      {/* Exemple d'aide / actions */}
      <p className="relative text-xs opacity-80 text-center">
        {question}
        <button
          disabled={isLoader || status !== "idle"}
          id="resend"
          type="button"
          className="btn btn-primary ml-5"
          onClick={(e) => {
            resend(e);
          }}
        >
          {action}
        </button>
        <span
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
          {status === "success" ? textSuccess: null}
          {status === "error" ? textError: null}

        </span>
      </p>
      {isLoader ? <Loader top="top-[100%]" /> : null}
    </form>
  );
}

export { OtpInput, isSignUp, tokenAccesComputed };

