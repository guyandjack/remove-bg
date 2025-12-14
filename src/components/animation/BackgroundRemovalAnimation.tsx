import { useEffect, useMemo, useState } from "preact/hooks";

type BackgroundRemovalFrame = {
  id: string;
  originalSrc: string;
  cutoutSrc: string;
  alt: string;
};

type Props = {
  sequence: BackgroundRemovalFrame[];
  opacity?: number;
  interval?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const checkerboardStyle = {
  backgroundSize: "28px 28px",
  backgroundImage:
    "linear-gradient(45deg, #cbd5f5 25%, transparent 25%, transparent 75%, #cbd5f5 75%, #cbd5f5), linear-gradient(45deg, #94a3b8 25%, transparent 25%, transparent 75%, #94a3b8 75%, #94a3b8)",
  backgroundPosition: "0 0, 14px 14px",
};

const DEFAULT_INTERVAL = 5200;

const BackgroundRemovalAnimation = ({
  sequence,
  opacity = 1,
  interval = DEFAULT_INTERVAL,
}: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);

  const safeOpacity = useMemo(() => clamp(opacity, 0, 1), [opacity]);
  const activeFrame = sequence[currentIndex];

  useEffect(() => {
    if (!sequence.length) {
      return;
    }

    setIsRevealed(false);

    const revealTimer = setTimeout(() => {
      setIsRevealed(true);
    }, interval * 0.45);

    const switchTimer = setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % sequence.length);
    }, interval);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(switchTimer);
    };
  }, [currentIndex, interval, sequence.length]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [sequence.length]);

  if (!sequence.length) {
    return (
      <div className="w-full rounded-3xl border border-base-300 bg-base-100 p-8 text-center text-base-content/70">
        No preview available yet.
      </div>
    );
  }

  return (
    <figure
      className="relative w-full max-w-[600px] overflow-hidden rounded-[32px] border border-base-300 bg-base-100 shadow-2xl transition-opacity"
      style={{ opacity: safeOpacity }}
      aria-live="polite"
    >
      <div
        className="relative aspect-[4/3] w-full  overflow-hidden bg-base-200"
        style={checkerboardStyle}
      >
        <img
          src={activeFrame.cutoutSrc}
          alt={activeFrame.alt}
          className="pointer-events-none h-full w-full object-cover"
        />

        <img
          src={activeFrame.originalSrc}
          alt={activeFrame.alt}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{
            clipPath: isRevealed ? "inset(0 100% 0 0)" : "inset(0 0 0 0)",
            transition: "clip-path 1300ms cubic-bezier(0.77, 0, 0.175, 1)",
          }}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-base-100/50 via-transparent to-transparent" />
      </div>

      <figcaption className="flex w-full flex-col gap-4 bg-base-100/90 p-6">
        <div className="text-sm font-semibold uppercase tracking-widest text-secondary">
          {String(activeFrame.id).padStart(2, "0")}
        </div>
        <p className="text-lg font-semibold text-base-content">
          {activeFrame.alt}
        </p>

        <div className="flex gap-2">
          {sequence.map((frame, index) => (
            <span
              key={frame.id}
              className="h-1.5 flex-1 rounded-full bg-base-200"
              style={{
                background:
                  index === currentIndex
                    ? "linear-gradient(90deg, #38bdf8 0%, #6366f1 100%)"
                    : undefined,
                opacity: index === currentIndex ? 1 : 0.35,
                transition: "opacity 300ms ease",
              }}
            />
          ))}
        </div>
      </figcaption>
    </figure>
  );
};

export type { BackgroundRemovalFrame };
export { BackgroundRemovalAnimation };
