//page conditions d' utilisations

import { useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";

//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";
import { setDocumentTitle } from "@/utils/setDocumentTitle";

type PropsPage = {
  routeKey: string;
};


const TermsPage = ({routeKey}: PropsPage) => {
  const { t } = useTranslation();
  useEffect(() => {
     setActiveLink();
     setDocumentTitle();
   }, [routeKey]);
  return (
    <div className="page-container">
      <div className={"max-w-4xl"}>
        <header className="text-center space-y-3 mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold text-primary">
            {t("terms.title")}
          </h1>
          <p className="text-base-content/70">{t("terms.intro")}</p>
        </header>

        <ul className="space-y-6">
          <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
            <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
              {t("terms.article1_title")}
            </h2>
            <div
              className="text-base-content/80 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t("terms.article1_text").replace(/\n/g, "<br/>"),
              }}
            />
          </li>

          <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
            <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
              {t("terms.article2_title")}
            </h2>
            <div
              className="text-base-content/80 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t("terms.article2_text").replace(/\n/g, "<br/>"),
              }}
            />
          </li>

          <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
            <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
              {t("terms.article3_title")}
            </h2>
            <div
              className="text-base-content/80 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t("terms.article3_text").replace(/\n/g, "<br/>"),
              }}
            />
          </li>

          <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
            <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
              {t("terms.article4_title")}
            </h2>
            <div
              className="text-base-content/80 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t("terms.article4_text").replace(/\n/g, "<br/>"),
              }}
            />
          </li>

          <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
            <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
              {t("terms.article5_title")}
            </h2>
            <div
              className="text-base-content/80 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t("terms.article5_text").replace(/\n/g, "<br/>"),
              }}
            />
          </li>

          <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
            <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
              {t("terms.article6_title")}
            </h2>
            <div
              className="text-base-content/80 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t("terms.article6_text").replace(/\n/g, "<br/>"),
              }}
            />
          </li>

          <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
            <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
              {t("terms.article7_title")}
            </h2>
            <div
              className="text-base-content/80 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t("terms.article7_text").replace(/\n/g, "<br/>"),
              }}
            />
          </li>

          <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
            <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
              {t("terms.article8_title")}
            </h2>
            <div
              className="text-base-content/80 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t("terms.article8_text").replace(/\n/g, "<br/>"),
              }}
            />
          </li>

          <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
            <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
              {t("terms.article9_title")}
            </h2>
            <div
              className="text-base-content/80 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t("terms.article9_text").replace(/\n/g, "<br/>"),
              }}
            />
          </li>

          <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
            <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
              {t("terms.article10_title")}
            </h2>
            <div
              className="text-base-content/80 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t("terms.article10_text").replace(/\n/g, "<br/>"),
              }}
            />
          </li>

          <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
            <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
              {t("terms.article11_title")}
            </h2>
            <div
              className="text-base-content/80 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t("terms.article11_text").replace(/\n/g, "<br/>"),
              }}
            />
          </li>
        </ul>

        <p className="mt-8 text-sm text-base-content/70">
          {t("terms.conclusion")}
        </p>
      </div>
    </div>
  );
};

export { TermsPage };

