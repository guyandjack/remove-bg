//import des hooks
import { useTranslation } from "react-i18next";
import {themeSignal} from "@/stores/theme";

//import des composant enfant
import { FooterBottom } from "./FooterBottom";
import { ThemeControler } from "@/components/themeControler/ThemeControler";

//import des data
import { navBarContent } from "@/data/content/components/nav/navBarContent";
import { footerContent } from "@/data/content/components/footer/footerContent";

//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";

//import des images
import shape_1 from "@/assets/images/shape-1.svg";
import shape_2 from "@/assets/images/shape-3.svg";
import logo from "@/assets/images/logo/logo_9.svg";
import logo_white from "@/assets/images/logo/logo_9_white.svg";

const Footer = () => {
  const { t } = useTranslation();

  //Content title footer
  const services = t(`footer.services`);
  const company = t(`footer.company`);
  const legal = t(`footer.legal`);

  const terms = t("footer.terms");
  const privacy = t(`footer.privacy`);
  const cookie = t(`footer.cookie`);

  return (
    <div className={"relative overflow-hidden"}>
      <nav className="footer md:footer-horizontal bg-base-300 p-10">
        <aside className={"relative z-10"}>
          <a href={"/"}>
            {themeSignal.value === "winter" ? (
              <img src={logo} alt={"logo wizpix"} className={"w-[200px]"} />
            ) : (
              <img src={logo_white} alt={"logo wizpix"} className={"w-[200px]"} />
            )}
          </a>
          <p>L’intelligence artificielle au service de vos visuels.</p>
          <ThemeControler />
        </aside>
        <div className={"relative z-10"}>
          <h6 className="text-lg footer-title opacity-100 text-secondary">
            {services}
          </h6>
          <ul>
            {navBarContent.map((link) => {
              const label = t(`navBar.${link.key}`);
              return link.key !== "contact" ? (
                <li key={link.href}>
                  <a
                    data-id={link.href}
                    className="pb-[5px] text-lg hover:text-primary"
                    href={link.href}
                    onClick={(e) => {
                      setActiveLink(e);
                    }}
                  >
                    {label}
                  </a>
                </li>
              ) : null;
            })}
          </ul>
        </div>
        <div className={"relative z-10"}>
          <h6 className="text-lg footer-title opacity-100 text-secondary">
            {company}
          </h6>
          <ul>
            {footerContent.map((link) => {
              const label = t(`navBar.${link.key}`);
              return link.key === "contact" || link.key === "aboutus" ? (
                <li key={link.href}>
                  <a
                    data-id={link.href}
                    className="py-[5] text-lg hover:text-primary"
                    href={link.href}
                    onClick={(e) => {
                      setActiveLink(e);
                    }}
                  >
                    {label}
                  </a>
                </li>
              ) : null;
            })}
          </ul>
        </div>

        <div className={"relative z-10"}>
          <h6 className="text-lg footer-title opacity-100 text-secondary">
            {legal}
          </h6>
          <ul>
            {footerContent.map((link) => {
              const label = t(`footer.${link.key}`);
              return link.key !== "contact" && link.key !== "aboutus" ? (
                <li key={link.href}>
                  <a
                    data-id={link.href}
                    className="pb-[5px] text-lg hover:text-primary"
                    href={link.href}
                    onClick={(e) => {
                      setActiveLink(e);
                    }}
                  >
                    {label}
                  </a>
                </li>
              ) : null;
            })}
          </ul>
        </div>
      </nav>
      <div>
        <FooterBottom />
      </div>

      <img
        className={"absolute top-0 left-0 "}
        src={shape_1}
        alt="decoration footer"
      />
      <img
        className={"absolute bottom-[0px] right-[0%]"}
        src={shape_2}
        alt="decoration footer"
      />
    </div>
  );
};
export { Footer };
