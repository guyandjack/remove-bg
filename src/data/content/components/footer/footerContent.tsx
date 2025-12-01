//Contenu textuel des liens de navigation du composant "NavBar"

//declaration des types
type NavLink = {
  key: string;
  href: string;
};

//declaration des data

const footerContent: NavLink[] = [
  { key: "legal", href: "/legal" },
  { key: "terms", href: "/terms" },
  { key: "privacy", href: "/privacy" },
  { key: "cgv", href: "/cgv" },

  { key: "contact", href: "/contact" },
];

export { footerContent };
