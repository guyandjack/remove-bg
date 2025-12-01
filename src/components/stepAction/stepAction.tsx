import { Fragment } from "react";

type StepsNumber = {
  title: string;
  description: string;
};
type StepsContent = {
  title: string;
  intro: string;
  step_1: StepsNumber;
  step_2: StepsNumber;
  step_3: StepsNumber;
};

const StepAction = ( {content} : StepsContent) => {
  return (
    <section class="w-full py-10 bg-component sm:py-16 lg:py-24">
      <div class="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div class="max-w-2xl mx-auto text-center">
          <h2 class="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {content.title}
          </h2>
          <p class="max-w-lg mx-auto mt-4 text-m leading-relaxed">
            {content.intro}
          </p>
        </div>

        <div class="relative mt-12 lg:mt-20">
          <div class=" relative flex flex-col justify-start items-center text-center gap-y-12 lg:flex-row lg:justify-between">
            <div class=" w-full absolute inset-x-0 hidden  top-2 lg:block  lg:px-[125px]">
              <img
                class="w-full "
                src="https://cdn.rareblocks.xyz/collection/celebration/images/steps/2/curved-dotted-line.svg"
                alt=""
              />
            </div>
            <div className={"relative z-10 w-[80%] lg:w-[250px]"}>
              <div class="flex items-center justify-center w-16 h-16 mx-auto bg-page border-2 border-secondary rounded-full shadow">
                <span class="text-xl font-semibold text-secondary"> 1 </span>
              </div>
              <h3 class="mt-6 text-xl font-semibold leading-tight text-secondary md:mt-10">
                {content.step_1.title}
              </h3>
              <p class="mt-4 text-base">{content.step_1.description}</p>
            </div>

            <div className={"relative z-10 w-[80%] lg:w-[250px]"}>
              <div class="flex items-center justify-center w-16 h-16 mx-auto bg-page border-2 border-info rounded-full shadow">
                <span class="text-xl font-semibold text-info"> 2 </span>
              </div>
              <h3 class="mt-6 text-xl font-semibold leading-tight text-info md:mt-10">
                {content.step_2.title}
              </h3>
              <p class="mt-4 text-base">{content.step_2.description}</p>
            </div>

            <div className={"relative z-10 w-[80%] lg:w-[250px]"}>
              <div class="flex items-center justify-center w-16 h-16 mx-auto bg-page border-2 border-success rounded-full shadow">
                <span class="text-xl font-semibold text-success"> 3 </span>
              </div>
              <h3 class="mt-6 text-xl font-semibold leading-tight text-success md:mt-10">
                {content.step_3.title}
              </h3>
              <p class="mt-4 text-base">{content.step_3.description}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { StepAction };
