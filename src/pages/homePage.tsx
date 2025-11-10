//Page home

//import des librairies
import { useTranslation } from "react-i18next";

//import de compoants enfants
import { Hero } from "@/components/hero/hero";
import { Diff } from "../components/diff/diff";

type Labels = string[];

function HomePage() {
  const { t } = useTranslation();
  const labels: Labels = [
    t("diff.friend_label"),
    t("diff.pet_label"),
    t("diff.sport_label"),
    t("diff.vehicule_label"),
    t("diff.logo_label"),
  ];

  return (
    <div
      className={
        "mx-auto flex flex-col justify-start items-center w-full"
      }
    >
      <div className={"w-full"}>
        <div className={"mx-auto"}>
          <Hero />
        </div>
      </div>
      <div className={"bg-secondary/5 w-full py-[50px]"}>
        <div className={"mx-auto max-w-[1000px]"}>
          <Diff tags={labels} />
        </div>
      </div>
      <div className={"bg-secondary/5 w-full py-[50px]"}>
        <div className={"mx-auto max-w-[1000px]"}>
          <div class="hero bg-base-200 min-h-screen">
            <div class="hero-content text-center">
              <div class="max-w-md">
                <h1 class="text-5xl font-bold">Hello there</h1>
                <p class="py-6">
                  Provident cupiditate voluptatem et in. Quaerat fugiat ut
                  assumenda excepturi exercitationem quasi. In deleniti eaque
                  aut repudiandae et a id nisi.
                </p>
                <button class="btn btn-primary">Get Started</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { HomePage };
