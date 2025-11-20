
    //Contenu textuel des liens de navigation du composant "NavBar"

//declaration des types
type NavLink = {
  key: string;
  href: string;
};

//declaration des data

const footerContent: NavLink[] = [
  { key: "legal", href: "/legal" },
  { key: "terms", href: "/cgu" },
  { key: "privacy", href: "/privacy" },
  { key: "cgv", href: "/cgv" },
  { key: "cookie", href: "/cookie" },
  { key: "contact", href: "/contactPage" },
  { key: "auth", href: "/authPage" },
];


export {footerContent}
