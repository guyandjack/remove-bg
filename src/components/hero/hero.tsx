//composant banner hero

//import des images
import heroImg from "@/assets/images/hero-img.jpg";

const Hero = () => {
  return (
    <div className="hero bg-base-200 w-full">
      <div className="hero-content flex-col lg:flex-row-reverse">
        <img
          src={heroImg}
          alt="exapmle d'image sans arriere plan"
          className="max-w-sm rounded-lg shadow-2xl"
        />
        <div className={"flex flex-col justify-start items-left my-[30px]"}>
          <h1 className="self-center text-center text-4xl font-bold lg:w-[60%] lg:text-6xl lg:self-start lg:text-left">
            Suprimer l'arrière plan de vos images grace&nbsp;à&nbsp;l'IA
          </h1>
          <h2 className="self-center text-center py-[20px] text-xl w-[80%] lg:self-start lg:text-left">
            Pour les professionnels ou les amateurs de retouche photo, faite le
            choix de la simplicité,
            <span className="text-secondary text-2xl">
              {" "}
              pour&nbsp;un&nbsp;gain&nbsp;de temps&nbsp;maximum
            </span>
            .
          </h2>
          <p className="py-[20px] text-[18px]">
            Vous pouvez beneficier de ce service gratuitement,<br></br> en
            selectionnant le plan gratuit.(2&nbsp;crédits&nbsp;/&nbsp;jour)
          </p>
          <p className="py-[20px]">Pour ce faire:</p>
          <ul className={"flex flex-col gap-2"}>
            <li>
              1-Selectionnez un plan sur la page des{" "}
              <a className="link" href="/pricing">
                abonnements
              </a>
            </li>
            <li>2-Créez votre compte via le formulaire</li>
            <li>3-Une fois connecté vous pouvez utiliser le service</li>
          </ul>
          <p className={"my-[20px]"}>
            Aucune donnée personnelle n'est collectée ou partagée à des tiers.
            <br></br>
            Vous pouvez consulter notre{" "}
            <a className="link" href="/privacy">
              politique&nbsp;de&nbsp;confidentialité
            </a>
          </p>
          <a href="/pricing" className="my-[10px] btn btn-primary w-[100%]">
            Je choisi un plan
          </a>
          <a href="/upload" className="my-[10px] btn btn-secondary w-[100%]">
            Je veux tester la qualité
          </a>
        </div>
      </div>
    </div>
  );
};

export { Hero };
