import { WizpixLogoMotion } from "./WizpixLogoMotion";

type Props = { className?: string };

const AnimatedLogoTinyWhite = ({ className }: Props) => (
  <WizpixLogoMotion size="tiny" theme="white" className={className} />
);

export { AnimatedLogoTinyWhite };
