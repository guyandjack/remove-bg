import { WizpixLogoMotion } from "./WizpixLogoMotion";

type Props = { className?: string };

const AnimatedLogoNormalWhite = ({ className }: Props) => (
  <WizpixLogoMotion size="normal" theme="white" className={className} />
);

export { AnimatedLogoNormalWhite };
