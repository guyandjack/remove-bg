//page politique de confidentialitées


import { useTranslation } from "react-i18next";

function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col justify-center items-center gap-8 w-full max-w-[1000px] mx-auto p-10">
      <div className={"flex flex-col justify-center items-center gap-3"}>
        <h1 className={"text-2xl text-primary"}>{t("privacy.title")}</h1>
        <p className={"mt-[20px]"}>{t("privacy.intro")}</p>
      </div>
      <ul className={"flex flex-col justify-center items-center gap-10"}>
        <li className="card">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article1_title")}
          </h2>
          <p className="">{t("privacy.article1_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article2_title")}
          </h2>
          <p className="">{t("privacy.article2_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article3_title")}
          </h2>
          <p className="">{t("privacy.article3_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article4_title")}
          </h2>
          <p className="">{t("privacy.article4_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article5_title")}
          </h2>
          <p className="">{t("privacy.article5_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article6_title")}
          </h2>
          <p className="">{t("privacy.article6_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article7_title")}
          </h2>
          <p className="">{t("privacy.article7_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article8_title")}
          </h2>
          <p className="">{t("privacy.article8_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article9_title")}
          </h2>
          <p className="">{t("privacy.article9_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article10_title")}
          </h2>
          <p className="">{t("privacy.article10_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("privacy.article11_title")}
          </h2>
          <p className="">{t("privacy.article11_text")}</p>
        </li>
      </ul>
      <p className={"mb-[20px]"}>{t("privacy.conclusion")}</p>
    </div>
  );
}

export { PrivacyPage };

