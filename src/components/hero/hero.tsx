//composant banner hero
//import desfonctions
import { setActiveLink } from "@/utils/setActiveLink";

//import des images
import heroImg from "@/assets/images/hero-img.jpg";

type HeroContentKey =
  | "title_h1"
  | "title_h2"
  | "info_1"
  | "info_2"
  | "info_list_1"
  | "info_list_1_link"
  | "info_list_2"
  | "info_list_3"
  | "privacy_1"
  | "privacy_1_link"
  | "privacy_2";
  
type Content = Record<HeroContentKey, string>;
type ContentProps = {
  content: Content;
};

const Hero = ({ content }: ContentProps) => {
  return (
    <section className="hero bg-base-200 w-full rounded-[40px]">
      <div className="hero-content rounded-[40px] flex-col lg:flex-row-reverse">
        <img
          src={heroImg}
          alt="exapmle d'image sans arriere plan"
          className="max-w-sm rounded-lg shadow-2xl"
        />
        <div className={"flex flex-col justify-start items-left my-[30px]"}>
          <h1
            className="self-center text-center text-4xl font-bold lg:w-[60%] lg:text-6xl lg:self-start lg:text-left"
            dangerouslySetInnerHTML={{ __html: content.title_h1 }}
          ></h1>
          <h2
            className="self-center text-center py-[20px] text-xl w-[80%] lg:self-start lg:text-left"
            dangerouslySetInnerHTML={{ __html: content.title_h2 }}
          ></h2>
          {/* <p
            className="py-[20px] text-[18px]"
            dangerouslySetInnerHTML={{ __html: content.info_1 }}
          ></p> */}
          <p
            className="py-[20px]"
            dangerouslySetInnerHTML={{ __html: content.info_2 }}
          ></p>
          <ul className={"flex flex-col gap-2"}>
            <li>
              <p>
                <span
                  dangerouslySetInnerHTML={{ __html: content.info_list_1 }}
                ></span>
                <a
                  data-id="/pricing"
                  className={"link"}
                  href={"/pricing"}
                  dangerouslySetInnerHTML={{ __html: content.info_list_1_link }}
                  onClick={(e) => {
                    setActiveLink(e);
                  }}
                ></a>
              </p>
            </li>
            <li dangerouslySetInnerHTML={{ __html: content.info_list_2 }}></li>
            <li dangerouslySetInnerHTML={{ __html: content.info_list_3 }}></li>
          </ul>
          <p className={"mt-[30px] "}>
            <span
              className={""}
              dangerouslySetInnerHTML={{ __html: content.privacy_1 }}
            ></span>

            <a
              data-id="/privacy"
              className={"link"}
              href={"/privacy"}
              dangerouslySetInnerHTML={{ __html: content.privacy_1_link }}
              onClick={(e) => {
                setActiveLink(e);
              }}
            ></a>
          </p>
          <p
            className="mt-[20px]"
            dangerouslySetInnerHTML={{ __html: content.privacy_2 }}
          ></p>
          {/* <div className="mt-[50px] flex flex-col justify-start items-center gap-5 lg:flex-row justify-evenly ">
            <a
              data-id="/pricing"
              href="/pricing"
              className="btn btn-success w-[60%] lg:w-[40%] text-lg"
              dangerouslySetInnerHTML={{ __html: content.btn_choice }}
              onClick={(e) => {
                setActiveLink(e);
              }}
            ></a>
            <a
              data-id="/upload"
              href="/upload"
              className="btn btn-primary w-[60%] lg:w-[40%] text-lg"
              dangerouslySetInnerHTML={{ __html: content.btn_test }}
              onClick={(e) => {
                setActiveLink(e);
              }}
            ></a>
          </div> */}
        </div>
      </div>
    </section>
  );
};

export { Hero };
