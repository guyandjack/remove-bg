//Contenu textuel des liens de navigation du composant "NavBar"

//declaration des types
type NavLink = {
  key: string;
  href: string;
};

//declaration des data

const navBarContent: NavLink[] = [
  { key: "home", href: "/" },
  { key: "service", href: "/services" },
  { key: "pricing", href: "/pricing" },
  { key: "signup", href: "/pricing/signup" },
  { key: "login", href: "/login" },
  //only footer link
  /* { key: "privacy", href: "/privacy" },
  { key: "legal", href: "/legal" },
  { key: "terms", href: "/terms" },
  { key: "cgv", href: "/cgv" }, */

];


export {navBarContent}

