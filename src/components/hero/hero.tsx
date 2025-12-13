//composant banner hero
//import desfonctions
import { setActiveLink } from "@/utils/setActiveLink";



//import des composant enfant
import {Diff} from "@/components/diff/diff";


type HeroContentKey =
  | "title_h1"
  | "title_h2"
  | "info_1"
  | "info_2"
  | "info_list_1"
  | "info_list_1_link"
  | "info_list_2"
  | "info_list_3"
  | "privacy_1"
  | "privacy_1_link"
  | "privacy_2";

type Content = Record<HeroContentKey, string>;
type ContentProps = {
  content: Content;
};

const Hero = ({ content }: ContentProps) => {
  return (
    <section className="w-full">
      <div className="flex flex-col justify-start items-center gap-y-15 lg:flex-row lg:justify-evenly lg:h-[calc(100vh-120px)]">
        <div
          className={
            "w-full lg:w-[50%] flex-shrink flex flex-col justify-start items-center my-[0px]"
          }
        >
          <h1
            className="self-center text-center text-4xl font-bold lg:w-[90%] lg:self-start lg:text-left lg:text-6xl"
            dangerouslySetInnerHTML={{ __html: content.title_h1 }}
          ></h1>
          <h2
            className="self-center text-center py-[20px] text-xl w-[80%] lg:self-start lg:text-left"
            dangerouslySetInnerHTML={{ __html: content.title_h2 }}
          ></h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
            data-id="/pricing" 
            onClick={(e)=> setActiveLink(e)}
            href={"/pricing"} className={"w-[200px] py-[15px] text-center font-bold rounded-full text-black bg-success/80 hover:bg-success/50 transition duration-300 ease-in-out"}>
              je choisi un plan
            </a>
            <a
            data-id="/services" 
            onClick={(e)=> setActiveLink(e)}
            href={"/services"} className={"w-[200px] py-[15px] text-center font-bold rounded-full text-black bg-primary/80 hover:bg-primary/50 transition duration-300 ease-in-out"}>
              je veux tester la qualité
            </a>
          </div>
        </div>
        <div className={"w-full max-w-[450px] lg:w-[50%]"}>
          <Diff tag={[]} />
        </div>
      </div>
    </section>
  );
};

export { Hero };
