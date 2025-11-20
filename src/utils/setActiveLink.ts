import { navBarContent } from "@/data/content/components/nav/navBarContent";

const setActiveLink = (e?: any) => {
  const pageName = e?.currentTarget.dataset.id || window.location.pathname;

  const element = navBarContent.filter((el) => el.href.includes(pageName));

  if (!element) {
    return;
  }
  const data_id: string = element[0]["href"];

  const allLinksInNav = document.querySelectorAll("nav a");

  //suprime la couleur actif de tous les liens
  if (allLinksInNav.length > 0) {
    allLinksInNav.forEach((el) => {
      el.classList.remove("text-secondary");
    });
  }
  const elementLinks = document.querySelectorAll(`a[data-id="${data_id}"]`);
  // ajoute la couleur uniquement aux liens actifs
  if (elementLinks.length > 0) {
    elementLinks.forEach((el) => {
      el.classList.add("text-secondary");
    });
  }
};

export { setActiveLink };
