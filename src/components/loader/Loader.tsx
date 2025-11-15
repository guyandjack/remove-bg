import { useTranslation } from "react-i18next";

interface LoaderProps {
  top?: string;
  left?: string;
  translateX?: string;
  translateY?: string;
  direction?: string;
  gap?: string;
  colorText?: string;
  colorLoader?: string;
  classNameWrapper?: string;
  text?: string;
}

function Loader({
  top = "top-1/2",
  left = "left-1/2",
  translateX = "-translate-x-1/2",
  translateY = "-translate-y-1/2",
  colorText = "text-secondary",
  colorLoader = "text-primary",
  classNameWrapper = "",
  text=""
}: LoaderProps) {
  const { t } = useTranslation();

  return (
    <div
      className={[
        `absolute flex flex-col justify-center items-center z-10`,
        `${top} ${left} ${translateX} ${translateY} ${classNameWrapper}`,
      ].join(" ")}
    >
      <span
        className={`loading loading-infinity loading-xl ${colorLoader}`}
      ></span>
      <span className={`${colorText}`}>
        {text == "" ? t("loader.formContact") : text}
      </span>
    </div>
  );
}

export { Loader };
