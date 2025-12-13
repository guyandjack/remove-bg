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
      <div
        className={`w-full mx-auto max-w-[1300px] py-[50px] flex flex-col justify-start items-center gap-5 lg:flex-row lg:justify-evenly `}
      >
        <a
          data-id="/pricing"
          href="/pricing"
          className={`w-[200px] py-[15px] text-center font-bold rounded-full text-black bg-success/80 hover:bg-success/50 transition duration-300 ease-in-out`}
          dangerouslySetInnerHTML={{ __html: cta.label_choice }}
          onClick={(e) => {
            setActiveLink(e);
          }}
        ></a>
        <a
          data-id="/upload"
          href="/upload"
          className={`w-[200px] py-[15px] text-center font-bold rounded-full text-black bg-primary/80 hover:bg-primary/50 transition duration-300 ease-in-out`}
          dangerouslySetInnerHTML={{ __html: cta.label_test }}
          onClick={(e) => {
            setActiveLink(e);
          }}
        ></a>
      </div>
    );
};

export{Cta}
