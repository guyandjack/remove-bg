import { useMemo } from "preact/hooks";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";

type LogoSize = "normal" | "tiny";
type LogoTheme = "black" | "white";

type Props = {
  size: LogoSize;
  theme: LogoTheme;
  className?: string;
};

type Palette = {
  st0: string;
  st1: string;
  st2: string;
  st3: string;
  st4: string;
  st5: string;
};

const paletteFor = (theme: LogoTheme): Palette => ({
  st0: theme === "white" ? "#FFFFFF" : "#1D1D1B",
  st1: "#41BEE0",
  st2: "#F39207",
  st3: "#E83081",
  st4: "#57B368",
  st5: "#F1861A",
});

const tinyPaletteFor = (theme: LogoTheme): Pick<Palette, "st0" | "st1"> => ({
  st0: theme === "white" ? "#FFFFFF" : "#010202",
  st1: "#41BEE0",
});

function useDrawProps() {
  const reduce = useReducedMotion();

  const drawTransition = useMemo(
    () => ({
      duration: reduce ? 0 : 1.1,
      ease: "easeInOut" as const,
    }),
    [reduce]
  );

  const fillTransition = useMemo(
    () => ({
      duration: reduce ? 0 : 0.25,
      ease: "easeOut" as const,
      delay: reduce ? 0 : 0.95,
    }),
    [reduce]
  );

  return { reduce, drawTransition, fillTransition };
}

const drawAttrs = {
  pathLength: 1,
  strokeDasharray: 1,
} as const;

const WizpixLogoMotion = ({ size, theme, className }: Props) => {
  const { reduce, drawTransition, fillTransition } = useDrawProps();

  if (size === "tiny") {
    const colors = tinyPaletteFor(theme);
    return (
      <m.svg
        className={className}
        viewBox="0 0 29.4 12.8"
        role="img"
        aria-label="Wizpix"
        xmlns="http://www.w3.org/2000/svg"
      >
        <m.g>
          <m.path
            d="M16.8,0l-2.1,11.8c0,0.2-0.2,0.4-0.3,0.6s-0.4,0.3-0.6,0.3c-0.2,0-0.5,0-0.7-0.1s-0.4-0.2-0.5-0.4L8.4,5.4l-4.2,6.9c-0.1,0.2-0.2,0.3-0.4,0.4s-0.4,0.1-0.6,0.1c-0.3,0-0.5-0.1-0.7-0.3s-0.3-0.4-0.4-0.7L0,0h2.3l1.5,8.3l3.6-5.7c0.1-0.2,0.2-0.3,0.4-0.4S8.2,2,8.4,2S8.8,2,9,2.1s0.3,0.2,0.4,0.4L13,8.3L14.5,0H16.8z"
            fill={colors.st0}
            stroke={colors.st0}
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{
              strokeDashoffset: reduce ? 0 : 1,
              fillOpacity: reduce ? 1 : 0,
            }}
            animate={{
              strokeDashoffset: 0,
              fillOpacity: 1,
            }}
            transition={{
              strokeDashoffset: drawTransition,
              fillOpacity: fillTransition,
            }}
            {...drawAttrs}
          />
          <m.polygon
            points="2.3,0 0,0 0.7,3.9 3.4,5.9"
            fill={colors.st1}
            stroke={colors.st1}
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{
              strokeDashoffset: reduce ? 0 : 1,
              fillOpacity: reduce ? 1 : 0,
            }}
            animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
            transition={{
              strokeDashoffset: drawTransition,
              fillOpacity: fillTransition,
            }}
            {...drawAttrs}
          />
        </m.g>

        <m.path
          d="M29.4,5.3c0,0.5-0.1,1-0.2,1.4s-0.3,0.8-0.5,1.1c-0.2,0.3-0.5,0.6-0.8,0.8S27.4,9,27,9.1c-0.3,0.1-0.6,0.2-0.9,0.3s-0.6,0.1-0.9,0.1H20V7.2h5.2c0.3,0,0.6-0.1,0.8-0.2c0.2-0.1,0.4-0.2,0.6-0.4S26.9,6.2,27,6s0.1-0.5,0.1-0.8v-1c0-0.3-0.1-0.6-0.2-0.8S26.7,3,26.6,2.8c-0.2-0.2-0.4-0.3-0.6-0.4s-0.5-0.1-0.8-0.1H20c-0.3,0-0.5,0.1-0.7,0.2s-0.2,0.4-0.2,0.7v9.4h-2.3V3.2c0-0.6,0.1-1.1,0.3-1.5c0.2-0.4,0.5-0.7,0.8-1s0.7-0.4,1-0.5S19.7,0,20,0h5.2c0.5,0,1,0.1,1.4,0.2s0.8,0.3,1.1,0.5s0.6,0.5,0.8,0.8c0.2,0.3,0.4,0.6,0.5,0.9c0.1,0.3,0.2,0.6,0.3,0.9s0.1,0.6,0.1,0.9V5.3z"
          fill={colors.st0}
          stroke={colors.st0}
          strokeWidth={0.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: drawTransition,
            fillOpacity: fillTransition,
          }}
          {...drawAttrs}
        />
        <m.polygon
          points="20,7.2 20,9.5 22.6,9.5 25.5,7.2"
          fill={colors.st1}
          stroke={colors.st1}
          strokeWidth={0.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: drawTransition,
            fillOpacity: fillTransition,
          }}
          {...drawAttrs}
        />
        <m.polygon
          points="19.1,12.6 16.8,5.8 16.8,12.6"
          fill={colors.st1}
          stroke={colors.st1}
          strokeWidth={0.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: drawTransition,
            fillOpacity: fillTransition,
          }}
          {...drawAttrs}
        />
      </m.svg>
    );
  }

  const colors = paletteFor(theme);
  return (
    <m.svg
      className={className}
      viewBox="0 0 70 13.7"
      role="img"
      aria-label="Wizpix"
      xmlns="http://www.w3.org/2000/svg"
    >
      <m.g>
        <m.path
          d="M16.8,0.9l-2.1,11.8c0,0.2-0.2,0.4-0.3,0.6s-0.4,0.3-0.6,0.3c-0.2,0-0.5,0-0.7-0.1s-0.4-0.2-0.5-0.4L8.4,6.3l-4.2,6.9c-0.1,0.2-0.2,0.3-0.4,0.4s-0.4,0.1-0.6,0.1c-0.3,0-0.5-0.1-0.7-0.3S2.2,13,2.1,12.7L0,0.9h2.3l1.5,8.3l3.6-5.7c0.1-0.2,0.2-0.3,0.4-0.4S8.2,3,8.4,3S8.8,3,9,3.1s0.3,0.2,0.4,0.4L13,9.2l1.5-8.3C14.5,0.9,16.8,0.9,16.8,0.9z"
          fill={colors.st0}
          stroke={colors.st0}
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: drawTransition,
            fillOpacity: fillTransition,
          }}
          {...drawAttrs}
        />
        <m.path
          d="M20.8,2h-2.3V0h2.3v0.1V2z M20.8,13.5h-2.3V4h2.3V13.5z"
          fill={colors.st1}
          stroke={colors.st1}
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: { ...drawTransition, delay: reduce ? 0 : 0.05 },
            fillOpacity: { ...fillTransition, delay: reduce ? 0 : 1.0 },
          }}
          {...drawAttrs}
        />
        <m.path
          d="M31.9,4.7C32,4.9,32.1,5.2,32,5.4S31.9,5.8,31.7,6l-5.3,5.3h5.5v2.3h-8.2c-0.2,0-0.4-0.1-0.6-0.2s-0.3-0.3-0.4-0.5s-0.1-0.4-0.1-0.7s0.2-0.4,0.3-0.6l5.3-5.3h-5.5V4H31c0.2,0,0.4,0.1,0.6,0.2S31.9,4.5,31.9,4.7z"
          fill={colors.st0}
          stroke={colors.st0}
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: { ...drawTransition, delay: reduce ? 0 : 0.1 },
            fillOpacity: { ...fillTransition, delay: reduce ? 0 : 1.05 },
          }}
          {...drawAttrs}
        />
        <m.path
          d="M52.4,6.2c0,0.5-0.1,1-0.2,1.4s-0.3,0.8-0.5,1.1s-0.5,0.6-0.8,0.8S50.4,9.9,50,10c-0.3,0.1-0.6,0.2-0.9,0.3c-0.3,0.1-0.6,0.1-0.9,0.1H43V8.1h5.2c0.3,0,0.6-0.1,0.8-0.2c0.2-0.1,0.4-0.2,0.6-0.4S49.9,7.2,50,7s0.1-0.5,0.1-0.8v-1c0-0.3-0.1-0.6-0.2-0.8S49.7,4,49.5,3.8c-0.2-0.2-0.4-0.3-0.6-0.4s-0.5-0.1-0.8-0.1H43c-0.3,0-0.5,0.1-0.7,0.2s-0.2,0.4-0.2,0.7v9.4h-2.3V4.1c0-0.6,0.1-1.1,0.3-1.5s0.5-0.7,0.8-1s0.7-0.4,1-0.5s0.7-0.2,1-0.2h5.2c0.5,0,1,0.1,1.4,0.2s0.8,0.3,1.1,0.5s0.6,0.5,0.8,0.8C51.7,2.7,51.9,3,52,3.3s0.2,0.6,0.3,0.9s0.1,0.6,0.1,0.9C52.4,5.1,52.4,6.2,52.4,6.2z"
          fill={colors.st0}
          stroke={colors.st0}
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: { ...drawTransition, delay: reduce ? 0 : 0.15 },
            fillOpacity: { ...fillTransition, delay: reduce ? 0 : 1.1 },
          }}
          {...drawAttrs}
        />
        <m.path
          d="M56.4,2.1h-2.3V0h2.3V2.1z M56.4,13.5h-2.3V4h2.3V13.5z"
          fill={colors.st2}
          stroke={colors.st2}
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: { ...drawTransition, delay: reduce ? 0 : 0.2 },
            fillOpacity: { ...fillTransition, delay: reduce ? 0 : 1.15 },
          }}
          {...drawAttrs}
        />
        <m.path
          d="M69.5,4l-4.1,4.5l4.6,5h-3.1l-3-3.3l-3,3.3h-3.2l4.6-5L58.1,4h3.1l2.5,2.8L66.3,4H69.5z"
          fill={colors.st0}
          stroke={colors.st0}
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: { ...drawTransition, delay: reduce ? 0 : 0.25 },
            fillOpacity: { ...fillTransition, delay: reduce ? 0 : 1.2 },
          }}
          {...drawAttrs}
        />

        <m.rect
          x="18.5"
          width="2.3"
          height="2"
          fill={colors.st3}
          stroke={colors.st3}
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: { ...drawTransition, delay: reduce ? 0 : 0.3 },
            fillOpacity: { ...fillTransition, delay: reduce ? 0 : 1.25 },
          }}
          {...drawAttrs}
        />
        <m.rect
          x="54.1"
          width="2.3"
          height="2.1"
          fill={colors.st3}
          stroke={colors.st3}
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: { ...drawTransition, delay: reduce ? 0 : 0.35 },
            fillOpacity: { ...fillTransition, delay: reduce ? 0 : 1.3 },
          }}
          {...drawAttrs}
        />
        <m.polygon
          points="2.3,0.9 0,0.9 0.7,4.8 3.4,6.8"
          fill={colors.st4}
          stroke={colors.st4}
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: { ...drawTransition, delay: reduce ? 0 : 0.4 },
            fillOpacity: { ...fillTransition, delay: reduce ? 0 : 1.35 },
          }}
          {...drawAttrs}
        />
        <m.polygon
          points="31.9,11.3 27.6,11.3 25.8,13.6 31.9,13.6"
          fill={colors.st5}
          stroke={colors.st5}
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: { ...drawTransition, delay: reduce ? 0 : 0.45 },
            fillOpacity: { ...fillTransition, delay: reduce ? 0 : 1.4 },
          }}
          {...drawAttrs}
        />
        <m.polygon
          points="43,8.1 43,10.4 45.6,10.4 48.5,8.1"
          fill={colors.st1}
          stroke={colors.st1}
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: { ...drawTransition, delay: reduce ? 0 : 0.5 },
            fillOpacity: { ...fillTransition, delay: reduce ? 0 : 1.45 },
          }}
          {...drawAttrs}
        />
        <m.polygon
          points="42.1,13.6 39.8,6.8 39.8,13.6"
          fill={colors.st4}
          stroke={colors.st4}
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            strokeDashoffset: reduce ? 0 : 1,
            fillOpacity: reduce ? 1 : 0,
          }}
          animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
          transition={{
            strokeDashoffset: { ...drawTransition, delay: reduce ? 0 : 0.55 },
            fillOpacity: { ...fillTransition, delay: reduce ? 0 : 1.5 },
          }}
          {...drawAttrs}
        />
      </m.g>

      <m.polygon
        points="66.9,13.5 64.9,11.3 68,11.3 70,13.5"
        fill={colors.st4}
        stroke={colors.st4}
        strokeWidth={0.85}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{
          strokeDashoffset: reduce ? 0 : 1,
          fillOpacity: reduce ? 1 : 0,
        }}
        animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
        transition={{
          strokeDashoffset: { ...drawTransition, delay: reduce ? 0 : 0.6 },
          fillOpacity: { ...fillTransition, delay: reduce ? 0 : 1.55 },
        }}
        {...drawAttrs}
      />
    </m.svg>
  );
};

export { WizpixLogoMotion };
export type { LogoSize, LogoTheme };
