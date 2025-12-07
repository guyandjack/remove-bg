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
  const handleClick = (e: MouseEvent) => {
    e.preventDefault();

    const target = e.currentTarget as HTMLElement;
    console.log("target: ", target);
    if (!target) return;
    const id: Id = target.dataset.id || "remove";
    console.log("id: ", id);
    if (!id) return;

    if (window.location.pathname.includes("services")) {
      selectService ? selectService(id) : null;
      return;
    }

    window.location.href = `/services`;
  };
  return (
    <a
      data-id={content.id}
      href={"/services"}
      onClick={(e) => {
        handleClick(e);
      }}
      className="block w-[400px] h-[250px] group relative bg-component transition hover:z-[1] hover:shadow-2xl hover:shadow-gray-600/10"
    >
      <div className="relative space-y-8 py-12 p-8">
        <div className={"flex flex-row justify-end items-center"}>
          <div className={"p-[10px] w-[20%] bg-info rounded-s-full group-hover:w-full group-hover:bg-info/80 transition-all duration-500 "}>
            <img
              src={content.src}
              loading="lazy"
              width="200"
              height="200"
              className="w-12 h-12"
            />
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
