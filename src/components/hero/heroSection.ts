import { useState } from "react";
/* import Icon from "../../../components/AppIcon";
import Image from "../../../components/AppImage";
import Button from "../../../components/ui/Button";
import { BeforeAfterImage } from "../types"; */

interface HeroSectionProps {
  heroImages: BeforeAfterImage[];
  photosProcessed: number;
}

const HeroSection = ({ heroImages, photosProcessed }: HeroSectionProps) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  const currentImage = heroImages[currentImageIndex];

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  return (
    <section id="hero"
      className="relative min-h-screen flex items-center bg-gradient-to-br from-background via-muted to-background pt-[60px]"
    >
      <div className="max-w-[1200px] mx-auto px-6 py-16 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Transform Any Photo Into Professional Marketing Material in{" "}
                <span className="text-primary">3 Seconds</span>
              </h1>
              <p className="text-xl text-muted-foreground">
                No Design Skills Required - Just Upload, AI Does the Rest
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                variant="default"
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-cta"
                iconName="zap"
                iconPosition="left"
                iconSize={20}
              >
                Try Free Now
              </Button>
              <Button
                variant="outline"
                size="lg"
                iconName="play-circle"
                iconPosition="left"
                iconSize={20}
                onClick={() => setShowVideo(true)}
              >
                Watch Demo
              </Button>
            </div>

            <div className="flex items-center gap-8 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Icon
                  name="check-circle"
                  size={20}
                  color="var(--color-success)"
                />
                <span className="text-sm text-muted-foreground">
                  No credit card required
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icon
                  name="shield-check"
                  size={20}
                  color="var(--color-primary)"
                />
                <span className="text-sm text-muted-foreground">
                  SOC2 Certified
                </span>
              </div>
            </div>

            <div className="bg-primary/10 rounded-lg p-4 flex items-center gap-3">
              <Icon name="users" size={24} color="var(--color-primary)" />
              <div>
                <p className="text-2xl font-bold text-primary">
                  {photosProcessed.toLocaleString()}+
                </p>
                <p className="text-sm text-muted-foreground">
                  Photos processed daily
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div
              className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-card cursor-ew-resize select-none"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
              onTouchMove={handleTouchMove}
            >
              <Image
                src={currentImage.after}
                alt={currentImage.afterAlt}
                className="absolute inset-0 w-full h-full object-cover"
              />

              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
              >
                <Image
                  src={currentImage.before}
                  alt={currentImage.beforeAlt}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>

              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center">
                  <Icon
                    name="chevrons-left-right"
                    size={24}
                    color="var(--color-primary)"
                  />
                </div>
              </div>

              <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                Before
              </div>
              <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                After
              </div>
            </div>

            <div className="flex justify-center gap-2 mt-4">
              {heroImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentImageIndex ? "bg-primary w-8" : "bg-border"
                  }`}
                  aria-label={`View example ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {showVideo && (
        <div
          className="fixed inset-0 z-[1000] bg-background/95 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setShowVideo(false)}
        >
          <div className="relative w-full max-w-4xl aspect-video bg-card rounded-2xl overflow-hidden shadow-card">
            <button
              onClick={() => setShowVideo(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-background/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-background transition-colors duration-250"
              aria-label="Close video"
            >
              <Icon name="x" size={24} />
            </button>
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Icon name="play-circle" size={64} />
              <p className="ml-4 text-lg">Demo video would play here</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default HeroSection;
