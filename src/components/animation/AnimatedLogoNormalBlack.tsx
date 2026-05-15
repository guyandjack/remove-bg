import { WizpixLogoMotion } from "./WizpixLogoMotion";

type Props = { className?: string };

const AnimatedLogoNormalBlack = ({ className }: Props) => (
  <WizpixLogoMotion size="normal" theme="black" className={className} />
);

export { AnimatedLogoNormalBlack };
