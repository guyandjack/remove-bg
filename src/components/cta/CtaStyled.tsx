//import des composants enfants
import {DesignPaternPoint} from "@/components/disignPatern/designPaternPoint"

//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";

type CtaContent = {
  title_home_1: string;
  title_home_2: string;
  label_choice: string;
  label_test: string;
  color_choice: string;
  color_test: string;
  bg: string;
  isBtn_2: boolean;
};
type CtaProps = {
  content: CtaContent;
};

const CtaStyled = ({ content }: CtaProps) => {
  return (
    <section class="relative z-10 w-full overflow-hidden py-16 px-8">
      
        <DesignPaternPoint
          width={80}
        height={80}
        color={"info"}
          styled={"absolute top-[0px] left-[0px] hidden lg:block "}
        />
      
      <div class="mx-auto">
        <div class="mx-auto flex flex-col justify-center items-center gap-y-10 lg:flex-row lg:justify-between">
          <div class="relative w-full lg:max-w-[60%]">
            <h1
              class="mt-0 mb-3 text-3xl text-center font-bold leading-tight sm:text-4xl sm:leading-tight md:text-[40px] md:leading-tight text-white lg:text-left lg:ml-[40px] "
              dangerouslySetInnerHTML={{ __html: content.title_home_1 }}
            ></h1>
          </div>
          <div class="w-full lg:max-w-[40%]">
            <div class="flex flex-col justify-center items-center gap-5 lg:flex-row justify-end">
              <a
                /* class="font-semibold rounded-lg mx-auto inline-flex items-center justify-center bg-white py-4 px-9 hover:bg-opacity-90" */
                data-id="/pricing"
                href="/pricing"
                className={` ${content.color_choice} w-[200px] py-[15px] text-center font-bold rounded-full text-black bg-success/80 hover:bg-success/50 transition duration-300 ease-in-out `}
                dangerouslySetInnerHTML={{ __html: content.label_choice }}
                onClick={(e) => {
                  setActiveLink(e);
                }}
              ></a>
              {content.isBtn_2 ? (
                <a
                  data-id="/services"
                  href="/services"
                  className={` ${content.color_test} w-[200px] py-[15px] text-center font-bold rounded-full text-black bg-primary/80 hover:bg-primary/50 transition duration-300 ease-in-out `}
                  dangerouslySetInnerHTML={{ __html: content.label_test }}
                  onClick={(e) => {
                    setActiveLink(e);
                  }}
                ></a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { CtaStyled };
