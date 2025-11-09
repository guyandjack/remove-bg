//composant banner hero

//import des images
import heroImg from "@/assets/images/hero-img.jpg";

const Hero = () => {
  return (
    <div className="hero bg-base-200 w-full">
      <div className="hero-content flex-col lg:flex-row-reverse">
        <img
          src={heroImg}
          alt="exapmle d' image sans arriere plan"
          className="max-w-sm rounded-lg shadow-2xl"
        />
        <div>
          <h1 className="text-4xl font-bold">
            Suprimer automatiquement l'arrière plan de vos images, grace à l' IA
          </h1>
          <h2 className="py-[20px] text-xl">
            Pour les professionnels ou les amateurs de retouche photo, faite le
            choix de la simplicité,
            <span className="text-secondary text-2xl"> pour un gain de temps maximum</span>.
          </h2>
          <p className="py-[20px] text-[18px]">
            Vous pouvez utiliser ce service gratuitement jusqu'a 5 images par
            jours.
          </p>
          <p className="py-[20px]">
            Il suffit de vous inscrire, un mail valide, un mot de passe c'est
            tout.<br></br>Aucune donnée personnelle n'est collectée ou partagée à des tiers.
          </p>
          
          <a href="/pricing" className="btn btn-primary">
            C'est parti!
          </a>
        </div>
      </div>
    </div>
  );
};

export { Hero };
