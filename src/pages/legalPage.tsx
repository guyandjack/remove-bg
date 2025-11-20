//page politique de confidentialitées

import { useTranslation } from "react-i18next";

const LegalPage = ()=> {
  const { t } = useTranslation();
  return (
    <div className="px-[10px] flex flex-col justify-center items-center gap-8 w-full max-w-[1000px] mx-auto p-10">
      <div
        className={"flex flex-col justify-center items-center gap-3 py-[20px]"}
      >
        <h1 className={"text-3xl text-primary"}>{t("legal.title")}</h1>
        <p className={"mt-[20px]"}>{t("legal.intro")}</p>
      </div>
      <ul className={"flex flex-col justify-start items-left gap-10"}>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("legal.article1_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("legal.article1_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("legal.article2_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("legal.article2_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("legal.article3_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("legal.article3_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("legal.article4_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("legal.article4_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("legal.article5_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("legal.article5_text").replace(/\n/g, "<br />"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("legal.article6_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("legal.article6_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("legal.article7_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("legal.article7_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("legal.article8_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("legal.article8_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("legal.article9_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("legal.article9_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
      </ul>
      <p className={"mb-[20px]"}>{t("legal.conclusion")}</p>
    </div>
  );
}

export { LegalPage };
