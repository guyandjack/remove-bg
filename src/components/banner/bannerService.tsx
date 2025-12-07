import iconSocial from "@/assets/images/icon/grouper.png";
import iconConvert from "@/assets/images/icon/convertir.png";


type Id = "remove" | "social" | "product" | "convert";
type Text = {
  id: Id;
  url: string;
  title: string;
  description: string;
}

type BannerProps = {
  selectService: React.Dispatch<
    React.SetStateAction<"remove" | "social" | "product" | "convert">
  >;
  content: Text
};

const BannerService = ({ content, selectService }: BannerProps) => {

  

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-6">
      <div className="mt-16 w-full max-w-[1300px] flex flex-col justify-start items-center gap-y-5 lg:flex-row lg:flex-wrap lg:justify-evenly lg:gap-x-5">
        <a
          data-id="remove"
          href={"/services"}
          onClick={(e) => {
            handleClick(e);
          }}
          className="w-[400px] h-[250px] group relative bg-component transition hover:z-[1] hover:shadow-2xl  hover:shadow-gray-600/10"
        >
          <div className="relative space-y-8 py-12 p-8">
            <img
              src={iconSocial}
              loading="lazy"
              width="200"
              height="200"
              className="w-12 h-12"
              style="color:transparent"
            />
            <div className="space-y-2">
              <h5 className="text-xl font-semibold transition group-hover:text-primary">
                Remove BG
              </h5>
              <p className="">Suprime l'arriere plan de vos image</p>
            </div>
          </div>
        </a>
        <a
          data-id="social"
          href={"/services"}
          onClick={(e) => {
            handleClick(e);
          }}
          className="w-[400px] h-[250px] group relative bg-component transition hover:z-[1] hover:shadow-2xl  hover:shadow-gray-600/10"
        >
          <div className="relative space-y-8 py-12 p-8">
            <img
              src={iconSocial}
              loading="lazy"
              width="200"
              height="200"
              className="w-12 h-12"
              style="color:transparent"
            />
            <div className="space-y-2">
              <h5 className="text-xl font-semibold transition group-hover:text-primary">
                Social media
              </h5>
              <p className="">
                Converti et formate vos images pour tes réseaux sociaux
                prefereés.
              </p>
            </div>
          </div>
        </a>
        <a
          data-id="product"
          href={"/services"}
          onClick={(e) => {
            handleClick(e);
          }}
          className="w-[400px] h-[250px] group relative bg-component transition hover:z-[1] hover:shadow-2xl  hover:shadow-gray-600/10"
        >
          <div className="relative space-y-8 py-12 p-8">
            <img
              src={iconSocial}
              loading="lazy"
              width="200"
              height="200"
              className="w-12 h-12"
              style="color:transparent"
            />
            <div className="space-y-2">
              <h5 className="text-xl font-semibold transition group-hover:text-primary">
                Showcase
              </h5>
              <p className="">
                Utilise l'iA pour mettre vos produits en situation.
              </p>
            </div>
          </div>
        </a>

        <a
          data-id="convert"
          href={"/services"}
          onClick={(e) => {
            handleClick(e);
          }}
          className="w-[400px] h-[250px] group relative bg-component transition hover:z-[1] hover:shadow-2xl hover:shadow-gray-600/10"
        >
          <div className="relative space-y-8 py-12 p-8">
            <img
              src={iconConvert}
              loading="lazy"
              width="200"
              height="200"
              className="w-12 h-12"
              style="color:transparent"
            />
            <div className="space-y-2">
              <h5 className="text-xl font-semibold transition group-hover:text-primary">
                Convert images file
              </h5>
              <p className="">
                Converti tout type d'image au format et à l'extension desirée.
              </p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
};

export { BannerService };
