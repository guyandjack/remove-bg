import { navBarContent } from "@/data/content/components/nav/navBarContent";
import { footerContent } from "@/data/content/components/footer/footerContent";

const setActiveLink = (e?: any) => {
  const pageName = e?.currentTarget.dataset.id || window.location.pathname.split("/")[1];
  
  let element = navBarContent.filter((el) => el.href.includes(pageName));
  
  if (element.length < 1) {
    element = footerContent.filter((el) => el.href.includes(pageName));
  }
  

  if (element.length < 1) {
    return;
  }
  const data_id: string = element[0]["href"];

  const allLinksInNav = document.querySelectorAll("nav a");

  //suprime la couleur actif de tous les liens
  if (allLinksInNav.length > 0) {
    allLinksInNav.forEach((el) => {
      el.classList.remove("text-primary");
    });
  }
  const elementLinks = document.querySelectorAll(`nav a[data-id="${data_id}"]`);
  // ajoute la couleur uniquement aux liens actifs navbar et footer
  if (elementLinks.length > 0) {
    elementLinks.forEach((el) => {
      el.classList.add("text-primary");
    });
  }
};

export { setActiveLink };
