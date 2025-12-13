//import des composants enfants
import { Cta } from "@/components/cta/Cta";

//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";

const FinalCTA = ({content}) => {
  return (
    <section className="py-20 ">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="bg-gradient-to-br from-primary/20 to-success/20 rounded-3xl p-12 md:p-16 text-center shadow-card">
          <div className="max-w-3xl mx-auto space-y-8">
            

            <h2 className="text-3xl md:text-5xl font-bold  leading-tight">
              {content.title}
            </h2>

            <p className="text-xl ">
             {content.intro}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                data-id="/pricing"
                onClick={(e) => setActiveLink(e)}
                href={"/pricing"}
                className={
                  "w-[200px] py-[15px] text-center font-bold rounded-full text-black bg-success/80 hover:bg-success/50 transition duration-300 ease-in-out"
                }
              >
                {content.btn_1}
              </a>
              <a
                data-id="/services"
                onClick={(e) => setActiveLink(e)}
                href={"/services"}
                className={
                  "w-[200px] py-[15px] text-center font-bold rounded-full text-black bg-primary/80 hover:bg-primary/50 transition duration-300 ease-in-out"
                }
              >
                {content.btn_2}
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6 ">
              <div className="flex items-center gap-2">
                {/* <Icon name="check-circle" size={20} /> */}
                <span>{content.info_1}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* <Icon name="check-circle" size={20} /> */}
                <span>{content.info_2}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { FinalCTA };
