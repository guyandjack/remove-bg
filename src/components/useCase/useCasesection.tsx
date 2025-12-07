import { useState } from "react";
import Icon from "../../../components/AppIcon";
import Image from "../../../components/AppImage";
import { UseCase } from "../types";

interface UseCasesSectionProps {
  useCases: UseCase[];
}

const UseCasesSection = ({ useCases }: UseCasesSectionProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? useCases.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === useCases.length - 1 ? 0 : prev + 1));
  };

  const currentUseCase = useCases[currentIndex];

  return (
    <section id="examples" className="py-20 bg-muted">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Perfect for <span className="text-primary">Every Use Case</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            From e-commerce to social media, see how businesses use PhotoEdit
            Pro
          </p>
        </div>

        <div className="relative">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div className="inline-block bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                {currentUseCase.category}
              </div>

              <h3 className="text-3xl font-bold text-foreground">
                {currentUseCase.title}
              </h3>

              <p className="text-lg text-muted-foreground">
                {currentUseCase.description}
              </p>

              <div className="bg-background rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-3">
                  <Icon
                    name="trending-up"
                    size={24}
                    color="var(--color-success)"
                  />
                  <h4 className="font-semibold text-foreground">Results</h4>
                </div>
                <p className="text-muted-foreground">
                  {currentUseCase.results}
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handlePrevious}
                  className="w-12 h-12 rounded-full bg-background hover:bg-primary hover:text-primary-foreground transition-colors duration-250 flex items-center justify-center shadow-card"
                  aria-label="Previous use case"
                >
                  <Icon name="chevron-left" size={24} />
                </button>
                <button
                  onClick={handleNext}
                  className="w-12 h-12 rounded-full bg-background hover:bg-primary hover:text-primary-foreground transition-colors duration-250 flex items-center justify-center shadow-card"
                  aria-label="Next use case"
                >
                  <Icon name="chevron-right" size={24} />
                </button>
              </div>
            </div>

            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-card">
              <Image
                src={currentUseCase.image}
                alt={currentUseCase.imageAlt}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-8">
            {useCases.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex ? "bg-primary w-8" : "bg-border"
                }`}
                aria-label={`View use case ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export { UseCasesSection }
