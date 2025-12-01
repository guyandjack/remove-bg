//page politique de confidentialitées

import { useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";

//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";
import { setDocumentTitle } from "@/utils/setDocumentTitle";

type PropsPage = {
  routeKey: string;
};

const LegalPage = ({routeKey}: PropsPage) => {
  const { t } = useTranslation();

   useEffect(() => {
     setActiveLink();
     setDocumentTitle();
   }, [routeKey]);
  
  return (
    <div className="mx-auto w-full max-w-4xl px-4 md:px-6 lg:px-8 py-10">
      <header className="text-center space-y-3 mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold text-primary">
          {t("legal.title")}
        </h1>
        <p className="text-base-content/70">{t("legal.intro")}</p>
      </header>

      <ul className="space-y-6">
        <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
          <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
            {t("legal.article1_title")}
          </h2>
          <div
            className="text-base-content/80 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: t("legal.article1_text").replace(/\n/g, "<br/>")
            }}
          />
        </li>

        <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
          <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
            {t("legal.article2_title")}
          </h2>
          <div
            className="text-base-content/80 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: t("legal.article2_text").replace(/\n/g, "<br/>")
            }}
          />
        </li>

        <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
          <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
            {t("legal.article3_title")}
          </h2>
          <div
            className="text-base-content/80 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: t("legal.article3_text").replace(/\n/g, "<br/>")
            }}
          />
        </li>

        <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
          <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
            {t("legal.article4_title")}
          </h2>
          <div
            className="text-base-content/80 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: t("legal.article4_text").replace(/\n/g, "<br/>")
            }}
          />
        </li>

        <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
          <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
            {t("legal.article5_title")}
          </h2>
          <div
            className="text-base-content/80 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: t("legal.article5_text").replace(/\n/g, "<br/>")
            }}
          />
        </li>

        <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
          <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
            {t("legal.article6_title")}
          </h2>
          <div
            className="text-base-content/80 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: t("legal.article6_text").replace(/\n/g, "<br/>")
            }}
          />
        </li>

        <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
          <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
            {t("legal.article7_title")}
          </h2>
          <div
            className="text-base-content/80 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: t("legal.article7_text").replace(/\n/g, "<br/>")
            }}
          />
        </li>

        <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
          <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
            {t("legal.article8_title")}
          </h2>
          <div
            className="text-base-content/80 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: t("legal.article8_text").replace(/\n/g, "<br/>")
            }}
          />
        </li>

        <li className="rounded-box bg-base-100 border border-base-200 shadow-sm p-6">
          <h2 className="text-secondary text-lg md:text-xl font-semibold mb-2">
            {t("legal.article9_title")}
          </h2>
          <div
            className="text-base-content/80 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: t("legal.article9_text").replace(/\n/g, "<br/>")
            }}
          />
        </li>
      </ul>

      <p className="mt-8 text-sm text-base-content/70">{t("legal.conclusion")}</p>
    </div>
  );
}

export { LegalPage };

