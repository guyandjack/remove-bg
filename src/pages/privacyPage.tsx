//page politique de confidentialitées

import { useTranslation } from "react-i18next";

function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <div className=" p-[10px] flex flex-col justify-center items-center gap-8 w-full max-w-[1000px] mx-auto">
      <div className={"flex flex-col justify-center items-center gap-3"}>
        <h1 className={"text-3xl text-primary text-center py-[20px]"}>{t("privacy.title")}</h1>
        <p className={"mt-[20px]"}>{t("privacy.intro")}</p>
      </div>
      <ul className={"flex flex-col justify-start items-left gap-10"}>
        <li className="card">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article1_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("privacy.article1_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article2_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("privacy.article2_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article3_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("privacy.article3_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article4_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("privacy.article4_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article5_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("privacy.article5_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article6_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("privacy.article6_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article7_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("privacy.article7_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article8_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("privacy.article8_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article9_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("privacy.article9_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article10_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("privacy.article10_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article11_title")}
          </h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t("privacy.article11_text").replace(/\n/g, "<br/>"),
            }}
          />
        </li>
      </ul>
      <p className={"mb-[20px]"}>{t("privacy.conclusion")}</p>
    </div>
  );
}

export { PrivacyPage };

