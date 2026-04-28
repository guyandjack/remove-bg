import { WizpixLogoMotion } from "./WizpixLogoMotion";
import { LazyMotion, domAnimation } from "motion/react";

type Props = { className?: string };

const AnimatedLogoTinyWhite = ({ className }: Props) => (
  <LazyMotion features={domAnimation}>
    <WizpixLogoMotion size="tiny" theme="white" className={className} />
  </LazyMotion>
);

export { AnimatedLogoTinyWhite };
