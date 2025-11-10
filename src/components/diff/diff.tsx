// composant Diff optimisé

import { useState } from "preact/hooks";

// import des images originales
import friendImg from "@/assets/images/friend.jpg";
import petImg from "@/assets/images/pet.jpg";
import sportImg from "@/assets/images/sport.jpg";
import vehiculeImg from "@/assets/images/vehicule.jpg";
import logoImg from "@/assets/images/logo.jpg";

//import des images sans back ground
import friendImgBGRemove from "@/assets/images/friend-removebg-preview.png";
import petImgBGRemove from "@/assets/images/pet-removebg-preview.png";
import sportImgBGRemove from "@/assets/images/sport-removebg-preview.png";
import vehiculeImgBGRemove from "@/assets/images/vehicule-removebg-preview.png";
import logoImgBGRemove from "@/assets/images/logo-removebg-preview.png";

//import image de fond
import bgImg from "@/assets/images/dessert.jpg";

type PictureKey = "friend" | "pet" | "sport" | "vehicule" | "logo";

type Labels = string[];

const pictures: Record<PictureKey, string> = {
  friend: friendImg,
  pet: petImg,
  sport: sportImg,
  vehicule: vehiculeImg, // à compléter plus tard
  logo: logoImg, // à compléter plus tard
};

const picturesBgRemoved: Record<PictureKey, string> = {
  friend: friendImgBGRemove,
  pet: petImgBGRemove,
  sport: sportImgBGRemove,
  vehicule: vehiculeImgBGRemove, // à compléter plus tard
  logo: logoImgBGRemove, // à compléter plus tard
};

const pictureLabels: Record<PictureKey, string> = {
  friend: "Amis",
  pet: "Animaux",
  sport: "Sport",
  vehicule: "Véhicule",
  logo: "Logo",
};

const buttonConfig: { id: PictureKey; className: string }[] = [
  { id: "friend", className: "btn btn-dash btn-primary" },
  { id: "pet", className: "btn btn-dash btn-secondary" },
  { id: "sport", className: "btn btn-dash btn-accent" },
  { id: "vehicule", className: "btn btn-dash btn-info" },
  { id: "logo", className: "btn btn-dash btn-success" },
];

const Diff = ({ tags }) => {
  const [selectedKey, setSelectedKey] = useState<PictureKey>("vehicule");

  const pictureSrc = pictures[selectedKey];
  const pictureSrcBGRemove = picturesBgRemoved[selectedKey];
  const pictureAlt = pictureLabels[selectedKey];

  return (
    <div className={"relative p-[20px]"}>
      <span class="absolute top-[-50px] left-[30px] z-10 inline-flex items-center rounded-md bg-green-400/5 px-2 py-1 text-xl font-medium text-green-400 inset-ring inset-ring-green-500/20">
        Essayer par vous même...
      </span>

      <div className={""}>
        <figure className="diff aspect-16/9 mx-auto" tabIndex={0}>
          <div className="diff-item-1" role="img" tabIndex={0}>
            <img alt={pictureAlt} src={pictureSrc} />
          </div>
          <div className="diff-item-2 bg-white" role="img">
            <img alt="Image de référence floutée" src={pictureSrcBGRemove} />
          </div>

          <div className="diff-resizer">
            <div className={"bg-info p-[20px]"}></div>
          </div>
        </figure>

        <ul className="flex flex-row justify-evenly items-center pt-[20px] pb-[20px]">
          {buttonConfig.map(({ id, className }, index) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setSelectedKey(id)}
                className={className}
              >
                {tags[index]}
              </button>
            </li>
          ))}
        </ul>
        <a className="btn btn-info mt-[10px]" href="/auth">
          Je m'inscris pour benificier du service gratuitement
        </a>
      </div>
    </div>
  );
};

export { Diff };
