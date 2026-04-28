import { useEffect, useMemo, useState } from "preact/hooks";

export type BackgroundRemovalFrame = {
  id: string;
  originalSrc: string;
  cutoutSrc: string;
  alt: string;
};

type Props = {
  sequence: BackgroundRemovalFrame[];
  opacity?: number;
  intervalMs?: number;
  className?: string;
};

const BackgroundRemovalAnimation = ({
  sequence,
  opacity = 1,
  intervalMs = 1800,
  className,
}: Props) => {
  const frames = useMemo(() => sequence?.filter(Boolean) || [], [sequence]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!frames.length) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % frames.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [frames.length, intervalMs]);

  if (!frames.length) return null;
  const current = frames[index];

  return (
    <div className={className}>
      <div className="relative w-full overflow-hidden rounded-2xl shadow-card bg-base-100">
        <img
          src={current.originalSrc}
          alt={current.alt}
          className="block w-full h-auto"
          loading="eager"
          decoding="async"
        />
        <img
          src={current.cutoutSrc}
          alt={current.alt}
          className="absolute inset-0 block w-full h-auto"
          style={{ opacity }}
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );
};

export { BackgroundRemovalAnimation };

