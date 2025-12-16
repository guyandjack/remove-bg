//composant pricCard

//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";

type PlanKey =
  | "remove_bg"
  | "tag"
  | "price"
  | "credit"
  | "gomme_magique"
  | "Image_pexels"
  | "api"
  | "bundle"
  | "subscribe";

type PlanText = Record<PlanKey, string>;

type PlanOption = {
  name: string;
  price: number;
  prices?: Record<"CHF" | "EUR" | "USD", number>;
  credit: number;
  format: string;
  remove_bg: boolean;
  change_bg_color: boolean;
  tools_qt: string;
  tool_name: string[];
  model_IA_ressource: string;
  gomme_magique: boolean;
  img_pexels: boolean;
  delay_improved: boolean;
  bg_IA_generation: boolean;
  bundle: boolean;
  bundle_qt: number;
  api: boolean;
  api_external: boolean;
};

type CurrencyCode = "CHF" | "EUR" | "USD";

type PriceCardProps = {
  lang: PlanText; // contenu textuel traduit (titres, libellés, CTA)
  option: PlanOption; // données dynamiques issues du backend
  currency: CurrencyCode;
};

const currencySymbols: Record<CurrencyCode, string> = {
  CHF: "CHF",
  EUR: "€",
  USD: "$",
};

const PriceCard = ({ lang, option, currency }: PriceCardProps) => {
  const borderColor =
    {
      hobby: "border-success",
      pro: "border-info",
    }[option.name] || "border-secondary";

  const bgColor =
    {
      hobby: "bg-success/90",
      pro: "bg-info/90",
    }[option.name] || "bg-secondary/90";

  const priceValue =
    option.prices?.[currency] ?? option.price ?? option.prices?.CHF ?? 0;
  const symbol = currencySymbols[currency] || currency;

  return (
    <div
      className={`card w-full h-[350px] bg-base-100 shadow-sm border ${borderColor} bg-component`}
    >
      <div className="relative card-body">
        {option.name === "hobby" ? (
          <span className="absolute top-[-15px] badge badge-s badge-warning">
            {lang.tag}
          </span>
        ) : null}

        <div className="flex justify-between">
          <h2 className="text-3xl font-bold capitalize">{option.name}</h2>
          <span className="text-xl">{`${symbol} ${priceValue} ${lang.price}`}</span>
        </div>
        <ul className="mt-6 flex flex-col gap-2 text-s">
          <li>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-4 me-2 inline-block text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{lang.remove_bg}</span>
          </li>
          <li>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-4 me-2 inline-block text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{`${lang.credit}: ${option.credit}`}</span>
          </li>
          {option.gomme_magique ? (
            <li>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-4 me-2 inline-block text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>{`${lang.gomme_magique}`}</span>
            </li>
          ) : null}
          {option.img_pexels ? (
          <li>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-4 me-2 inline-block text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{`${lang.Image_pexels}`}</span>
          </li>) : null}
          {option.api ? (
            <li>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-4 me-2 inline-block text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>{`${lang.api}`}</span>
            </li>) : null}
          {option.bundle ? (
            <li>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-4 me-2 inline-block text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>{`${lang.bundle}: ${option.bundle_qt}`}</span>
            </li>) : null}
        </ul>
        <div className="absolute bottom-[10px] left-[50%] w-[80%] translate-x-[-50%]  ">
          <a
            data-id={"/signup"}
            href={`/signup?plan=${option.name}&currency=${currency}`}
            className={`transition-all btn ${bgColor} btn-block text-base text-black hover:opacity-60`}
            onClick={(e) => setActiveLink(e)}
          >
            {lang.subscribe}
          </a>
        </div>
      </div>
    </div>
  );
};

export { PriceCard };
