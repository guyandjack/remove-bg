/* import Icon from "../../../components/AppIcon";
import Image from "../../../components/AppImage"; */

const ProblemSection = () => {
  const problems = [
    {
      id: "1",
      title: "Manual Editing Takes Hours",
      description: "Spending 30+ minutes per photo with complex tools",
      icon: "clock",
      time: "30 min/photo",
    },
    {
      id: "2",
      title: "Expensive Design Services",
      description: "Paying $50-200 per photo for professional editing",
      icon: "dollar-sign",
      time: "$50-200/photo",
    },
    {
      id: "3",
      title: "Inconsistent Results",
      description: "Quality varies between different editors and tools",
      icon: "alert-triangle",
      time: "Variable quality",
    },
  ];

  return (
    <section className="py-20 bg-muted">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            The Old Way of Editing Photos is{" "}
            <span className="text-destructive">Broken</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Small businesses waste thousands of hours and dollars on photo
            editing
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div className="space-y-6">
            {problems?.map((problem) => (
              <div
                key={problem?.id}
                className="bg-background rounded-xl p-6 shadow-card"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    {/* <Icon
                      name={problem?.icon}
                      size={24}
                      color="var(--color-destructive)"
                    /> */}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {problem?.title}
                    </h3>
                    <p className="text-muted-foreground mb-2">
                      {problem?.description}
                    </p>
                    <p className="text-sm font-medium text-destructive">
                      {problem?.time}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-card">
              <img
                src="https://img.rocket.new/generatedImages/rocket_gen_img_199f2ccc8-1764748252968.png"
                alt="Frustrated business owner working late at night on laptop editing photos manually with multiple design software windows open"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 bg-background rounded-xl p-6 shadow-card max-w-xs">
              <div className="flex items-center gap-3">
                {/* <Icon
                  name="trending-down"
                  size={32}
                  color="var(--color-destructive)"
                /> */}
                <div>
                  <p className="text-2xl font-bold text-destructive">
                    40 hours
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Wasted per month
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-8 text-center">
          {/* <Icon
            name="arrow-down"
            size={32}
            className="mx-auto mb-4 text-primary"
          /> */}
          <h3 className="text-2xl font-bold text-foreground mb-2">
            There's a Better Way
          </h3>
          <p className="text-muted-foreground">
            AI-powered editing that delivers professional results in seconds
          </p>
        </div>
      </div>
    </section>
  );
};

export { ProblemSection };
