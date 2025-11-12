//import des hooks 


//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";

type CtaKey = "label_choice" | "label_test" | "color_choice" | "color_test" | "bg";
type CtaContent = Record<CtaKey, string>;
type CtaProps = {
  cta: CtaContent;
};

const Cta = ({cta}:CtaProps) => {
    return (
      <div className={`${cta.bg} w-full `}>
        <div
          className={`w-full mx-auto max-w-[1300px] py-[50px] flex flex-col justify-start items-center gap-5 lg:flex-row lg:justify-evenly `}
        >
          <a
            data-id="/pricing"
            href="/pricing"
            className={`btn ${cta.color_choice} w-[60%] lg:w-[40%] text-lg`}
            dangerouslySetInnerHTML={{ __html: cta.label_choice }}
            onClick={(e) => {
              setActiveLink(e);
            }}
          ></a>
          <a
            data-id="/upload"
            href="/upload"
            className={`btn ${cta.color_test} w-[60%] lg:w-[40%] text-lg`}
            dangerouslySetInnerHTML={{ __html: cta.label_test }}
            onClick={(e) => {
              setActiveLink(e);
            }}
          ></a>
        </div>
      </div>
    );
};

export{Cta}
