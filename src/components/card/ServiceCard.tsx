import { useEffect, useRef } from "preact/hooks";

//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";

type Id = "remove" | "social" | "product" | "convert" | string;
type Text = {
  id: Id;
  src: string;
  title: string;
  description: string;
};
type BannerProps = {
  selectService?: React.Dispatch<
    React.SetStateAction<"remove" | "social" | "product" | "convert" | string>
  >;
  content: Text;
};

const ServiceCard = ({ content, selectService }: BannerProps) => {
  const cardContainer = useRef(null);
  const cardElement = useRef(null);
  const serviceHref = `/services?service=${encodeURIComponent(content.id)}`;

  const setReverseAnimation = () => {
    cardElement.current.classList.remove("animation-service-card");
    cardElement.current.classList.add("animation-service-card-reverse");
  };
  const setAnimation = () => {
    cardElement.current.classList.remove("animation-service-card-reverse");
    cardElement.current.classList.add("animation-service-card");
  };

  const handleClick = (e: MouseEvent) => {
      setActiveLink(e);
    if (!selectService) return;

    e.preventDefault();
    const target = e.currentTarget as HTMLElement | null;
    if (!target) return;

    const dataId = target.dataset?.service as Id | undefined;
    const id: Id = dataId || "remove";
    selectService(id);
  };

  useEffect(() => {
    if (!cardContainer.current) return;

    const el = cardContainer.current;

    el.addEventListener("mouseleave", setReverseAnimation);
    el.addEventListener("mouseover", setAnimation);

    return () => {
      el.removeEventListener("mouseleave", setReverseAnimation);
      el.removeEventListener("mouseover", setAnimation);
    };
  }, []);

  return (
    <a
      ref={cardContainer}
      data-service={content.id}
      data-id={"/services"}
      href={serviceHref}
      onClick={handleClick}
      className="bg-component block w-[400px] h-[280px] border-service-card rounded-xl group  transition hover:z-[1] hover:shadow-lg hover:shadow-primary/50"
    >
      <div className="space-y-8 py-12 p-8">
        <div className={"flex flex-row justify-end items-center"}>
          <div
            ref={cardElement}
            className={
              "flex flex-row justify-center items-center p-[10px] w-[20%] bg-info rounded-full"
            }
          >
            <img src={content.src} loading="lazy" className="w-12 h-12" />
          </div>
        </div>
        <div className="space-y-2">
          <h5 className="text-xl font-semibold transition group-hover:text-primary">
            {content.title}
          </h5>
          <p className="">{content.description}</p>
        </div>
      </div>
    </a>
  );
};

export { ServiceCard };
