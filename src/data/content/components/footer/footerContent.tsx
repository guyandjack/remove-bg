
    //Contenu textuel des liens de navigation du composant "NavBar"

//declaration des types
type NavLink = {
  key: string;
  href: string;
};

//declaration des data

const footerContent: NavLink[] = [
  { key: "legal", href: "/legal" },
  { key: "privacy", href: "/src/pages/privacy.tsx" },
  { key: "cookie", href: "/src/pages/cookie.tsx" },
  { key: "contact", href: "/src/pages/contactPage.tsx" },
  { key: "auth", href: "/src/pages/authPage.tsx" },
];


export {footerContent}
