import { WizpixLogoMotion } from "./WizpixLogoMotion";
import { LazyMotion, domAnimation } from "motion/react";

type Props = { className?: string };

const AnimatedLogoNormalBlack = ({ className }: Props) => (
  <LazyMotion features={domAnimation}>
    <WizpixLogoMotion size="normal" theme="black" className={className} />
  </LazyMotion>
);

export { AnimatedLogoNormalBlack };
