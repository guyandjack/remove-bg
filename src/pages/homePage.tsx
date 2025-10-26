//Page home

//import des librairies
import { useTranslation } from "react-i18next";

//import de compoants enfants
import { Hero } from "@/components/hero/hero";

function HomePage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col justify-center items-center">
      <div>
        <h1>Effacer l'arriere plan de vos images gratuitement</h1>
        <p>Vous avez juste a faire glisser ou recuperer votre fichier jpeg ou png.</p>
      </div>
      <div className={"w-200 h-200 overflow-hidden border-with-2 "}>
        <Hero />
      </div>
    </div>
  );
}

export { HomePage };
