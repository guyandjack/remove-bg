import type { ComponentChildren } from "preact";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

type Props = {
  children: ComponentChildren;
};

function MotionProvider({ children }: Props) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

export { MotionProvider };
