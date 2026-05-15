import { WizpixLogoMotion } from "./WizpixLogoMotion";

type Props = { className?: string };

const AnimatedLogoTinyBlack = ({ className }: Props) => (
  <WizpixLogoMotion size="tiny" theme="black" className={className} />
);

export { AnimatedLogoTinyBlack };
