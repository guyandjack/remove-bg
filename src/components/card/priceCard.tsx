//composant pricCard

//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";

type PlanKey =
  | "remove_bg"
  | "conversion"
  | "tag"
  | "price"
  | "credit"
  | "conversions_suffix"
  | "unlimited"
  | "size_max"
  | "tools"
  | "gomme_magique"
  | "Image_pexels"
  | "api"
  | "bundle"
  | "subscribe";

type PlanText = Record<PlanKey, string>;

type PlanOption = {
  active?: boolean;
  name: string;
  price: number;
  prices?: Record<"CHF" | "EUR" | "USD", number>;
  lower_plan_option?: string;
  credit_IA: number;
  credit_conversion: string;
  size_max?: string;
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
  lang: PlanText; // contenu textuel traduit (titres, libellÃ©s, CTA)
  option: PlanOption; // donnÃ©es dynamiques issues du backend
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

  const normalizeSizeMax = (sizeMax?: string): string | null => {
    if (!sizeMax) return null;
    const trimmed = sizeMax.trim();
    const mbNormalized = trimmed.replace(/mb/gi, "MB");
    return mbNormalized.replace(/(\d)(MB)\b/i, "$1 $2");
  };

  const sizeMaxDisplay = normalizeSizeMax(option.size_max);

  const parseConversionCredits = (
    value: string
  ): { isUnlimited: boolean; display: string } => {
    const normalized = value.trim().toLowerCase();
    const isUnlimited = [
      "infiny",
      "infinity",
      "infinite",
      "illimite",
      "illimitÃ©",
      "unlimited",
    ].includes(normalized);

    if (isUnlimited) {
      return { isUnlimited: true, display: lang.unlimited };
    }

    return { isUnlimited: false, display: value.trim() };
  };

  const conversionCredits = parseConversionCredits(option.credit_conversion);

  const FeatureItem = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <li className="leading-snug">
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
      <span className="align-middle">
        {title}
        {subtitle ? (
          <span className="block ps-6 text-base-content/70">{subtitle}</span>
        ) : null}
      </span>
    </li>
  );
  const planFeatures = [
    option.remove_bg
      ? {
          key: "remove_bg",
          title: lang.remove_bg,
          subtitle: `→ ${option.credit_IA} ${lang.credit}`,
        }
      : null,
    option.credit_conversion
      ? {
          key: "conversion",
          title: lang.conversion,
          subtitle: conversionCredits.isUnlimited
            ? `→ ${conversionCredits.display}`
            : `→ ${conversionCredits.display} ${lang.conversions_suffix}`,
        }
      : null,
    option.tools_qt || (option.tool_name?.length ?? 0) > 0
      ? {
          key: "tools",
          title: lang.tools,
          subtitle: option.tool_name?.length
            ? `${option.tools_qt} (${option.tool_name.join(", ")})`
            : option.tools_qt,
        }
      : null,
    sizeMaxDisplay
      ? {
          key: "size_max",
          title: `${lang.size_max}: ${sizeMaxDisplay}`,
        }
      : null,
    option.gomme_magique
      ? { key: "gomme_magique", title: lang.gomme_magique }
      : null,
    option.img_pexels ? { key: "img_pexels", title: lang.Image_pexels } : null,
    option.api ? { key: "api", title: lang.api } : null,
    option.bundle
      ? { key: "bundle", title: `${lang.bundle}: ${option.bundle_qt}` }
      : null,
  ].filter(Boolean) as Array<{ key: string; title: string; subtitle?: string }>;

  return (
    <div
      className={`card w-full h-[450px] bg-base-100 shadow-sm border ${borderColor} bg-component`}
    >
      <div className="relative card-body">
        {option.lower_plan_option ? (
          <span className="absolute top-[-15px] badge badge-s badge-warning">
            {lang.tag}
          </span>
        ) : null}

        <div className="flex justify-between">
          <h2 className="text-3xl font-bold capitalize">{option.name}</h2>
          <span className="text-xl">{`${symbol} ${priceValue} ${lang.price}`}</span>
        </div>
        <ul className="mt-6 flex flex-col gap-2 text-s">
          {planFeatures.map((feature) => (
            <FeatureItem
              key={feature.key}
              title={feature.title}
              subtitle={feature.subtitle}
            />
          ))}
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
