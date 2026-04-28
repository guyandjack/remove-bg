import { WizpixLogoMotion } from "./WizpixLogoMotion";
import { LazyMotion, domAnimation } from "motion/react";

type Props = { className?: string };

const AnimatedLogoNormalWhite = ({ className }: Props) => (
  <LazyMotion features={domAnimation}>
    <WizpixLogoMotion size="normal" theme="white" className={className} />
  </LazyMotion>
);

export { AnimatedLogoNormalWhite };
