//page conditions d' utilisations


import { useTranslation } from "react-i18next";

function CguPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col justify-center items-center gap-8 w-full max-w-[1000px] mx-auto p-10">
      <div className={"flex flex-col justify-center items-center gap-3"}>
        <h1 className={"text-2xl text-primary"}>{t("terms.title")}</h1>
        <p className={"mt-[20px]"}>{t("terms.intro")}</p>
      </div>
      <ul className={"flex flex-col justify-center items-center gap-10"}>
        <li className="card">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("terms.article1_title")}
          </h2>
          <p className="">{t("terms.article1_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("terms.article2_title")}
          </h2>
          <p className="">{t("terms.article2_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("terms.article3_title")}
          </h2>
          <p className="">{t("terms.article3_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("terms.article4_title")}
          </h2>
          <p className="">{t("terms.article4_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("terms.article5_title")}
          </h2>
          <p className="">{t("terms.article5_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("terms.article6_title")}
          </h2>
          <p className="">{t("terms.article6_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("terms.article7_title")}
          </h2>
          <p className="">{t("terms.article7_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("terms.article8_title")}
          </h2>
          <p className="">{t("terms.article8_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("terms.article9_title")}
          </h2>
          <p className="">{t("terms.article9_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("terms.article10_title")}
          </h2>
          <p className="">{t("terms.article10_text")}</p>
        </li>
        <li className="">
          <h2 className="text-secondary text-xl mb-[10px]">
            {t("terms.article11_title")}
          </h2>
          <p className="">{t("terms.article11_text")}</p>
        </li>
      </ul>
      <p className={"mb-[20px]"}>{t("terms.conclusion")}</p>
    </div>
  );
}

export { CguPage };
