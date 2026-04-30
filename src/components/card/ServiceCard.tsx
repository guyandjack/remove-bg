import { useEffect, useRef } from "preact/hooks";

//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";

type Id = "remove" | "social" | "product" | "convert" | string;
type Text = {
  active: boolean;
  id: Id;
  src: string;
  title: string;
  description: string;
};
type BannerProps = {
  selectService?: (id: Id) => void;
  content: Text;
};

const ServiceCard = ({ content, selectService }: BannerProps) => {
  const cardContainer = useRef<HTMLAnchorElement | null>(null);
  const cardElement = useRef<HTMLDivElement | null>(null);
  //const serviceHref = `/services?service=${encodeURIComponent(content.id)}`;
  const serviceHref = `/services?service=${encodeURIComponent(content.id)}`;

  const setReverseAnimation = () => {
    const el = cardElement.current;
    if (!el) return;
    el.classList.remove("animation-service-card");
    el.classList.add("animation-service-card-reverse");
  };
  const setAnimation = () => {
    const el = cardElement.current;
    if (!el) return;
    el.classList.remove("animation-service-card-reverse");
    el.classList.add("animation-service-card");
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
    if (!content.active) return;
    const el = cardContainer.current;
    if (!el) return;

    el.addEventListener("mouseleave", setReverseAnimation);
    el.addEventListener("mouseover", setAnimation);

    return () => {
      el.removeEventListener("mouseleave", setReverseAnimation);
      el.removeEventListener("mouseover", setAnimation);
    };
  }, []);

  if (!content.active) return null;

  return (
    <a
      ref={cardContainer}
      data-service={content.id}
      data-id={"/services"}
      href={content.active ? serviceHref : ""}
      onClick={content.active ? handleClick : undefined}
      className={
        `relative bg-component block w-[400px] h-[280px] border-service-card rounded-xl ${content.active?"group  transition hover:z-[1] hover:shadow-lg hover:shadow-primary/50":"cursor-default"}`
      }
    >
      {content.active? null :<div className={"soon-service"}>Prochainement service suplementaire</div>}
      <div
        className={
          content.active ? "space-y-8 py-12 p-8" : "space-y-8 py-12 p-8 opacity-[0.4]"
        }
      >
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
