//Contenu textuel des liens de navigation du composant "NavBar"

//declaration des types
type NavLink = {
  key: string;
  href: string;
};

//declaration des data

const navBarContent: NavLink[] = [
  { key: "home", href: "/" },
  { key: "upload", href: "/upload" },
  { key: "pricing", href: "/pricing" },
  { key: "contact", href: "/contact" },
  { key: "auth", href: "/auth" },
];


export {navBarContent}

