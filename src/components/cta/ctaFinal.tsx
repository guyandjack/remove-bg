//import Icon from "../../../components/AppIcon";
//import Button from "../../../components/ui/Button";

const FinalCTA = () => {
  return (
    <section className="py-20 ">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="bg-gradient-to-br from-primary/20 to-success/20 rounded-3xl p-12 md:p-16 text-center shadow-card">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-medium">
             
              <span>Limited Time Offer</span>
            </div> */}

            <h2 className="text-3xl md:text-5xl font-bold  leading-tight">
              Start Transforming Your Photos Today
            </h2>

            <p className="text-xl ">
              Join 10,000+ businesses using PhotoEdit Pro to create professional
              marketing materials in seconds
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={"/pricing"} className={"btn btn-success p-5 w-[200px]"}>
              je choisi un plan
              </a>
              <a href={"/services"} className={"btn btn-info p-5 w-[200px]"}>
              je veux tester la qualité
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6 ">
              <div className="flex items-center gap-2">
                {/* <Icon name="check-circle" size={20} /> */}
                <span>No credit card required for free plan</span>
              </div>
              <div className="flex items-center gap-2">
                {/* <Icon name="check-circle" size={20} /> */}
                <span>Cancel anytime</span>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { FinalCTA };
