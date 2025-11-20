//page conditions d' utilisations


import { useTranslation } from "react-i18next";

const CgvPage = ()=> {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col justify-center items-center gap-8 w-full max-w-[1000px] mx-auto px-[10px]">
      <div
        className={"flex flex-col justify-center items-center gap-3 py-[20px]"}
      >
        <h1 className={"text-3xl text-primary"}>{t("cgv.title")}</h1>
        <p className={"mt-[20px]"}>{t("cgv.intro")}</p>
      </div>
      <ul className={"flex flex-col justify-center items-center gap-10"}>
        <li className="card">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("cgv.article1_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("cgv.article1_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("cgv.article2_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("cgv.article2_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("cgv.article3_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("cgv.article3_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("cgv.article4_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("cgv.article4_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("cgv.article5_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("cgv.article5_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("cgv.article6_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("cgv.article6_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("cgv.article7_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("cgv.article7_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("cgv.article8_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("cgv.article8_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("cgv.article9_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("cgv.article9_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("cgv.article10_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("cgv.article10_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("cgv.article11_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("cgv.article11_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
      </ul>
      <p className={"mb-[20px]"}>{t("cgv.conclusion")}</p>
    </div>
  );
}

export { CgvPage };

