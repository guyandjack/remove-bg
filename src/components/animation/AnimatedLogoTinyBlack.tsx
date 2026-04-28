import { WizpixLogoMotion } from "./WizpixLogoMotion";
import { LazyMotion, domAnimation } from "motion/react";

type Props = { className?: string };

const AnimatedLogoTinyBlack = ({ className }: Props) => (
  <LazyMotion features={domAnimation}>
    <WizpixLogoMotion size="tiny" theme="black" className={className} />
  </LazyMotion>
);

export { AnimatedLogoTinyBlack };
