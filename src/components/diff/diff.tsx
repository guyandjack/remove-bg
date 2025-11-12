// composant Diff optimisé

//import des hooks
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

//import des fonctions
import { setActiveLink } from "@/utils/setActiveLink";


type PictureKey = "friend" | "pet" | "sport" | "vehicule" | "logo";

type Tags = {
  tag: string[]
};


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

const Diff = ({ tag }: Tags) => {
  const [selectedKey, setSelectedKey] = useState<PictureKey>("vehicule");

  const pictureSrc = pictures[selectedKey];
  const pictureSrcBGRemove = picturesBgRemoved[selectedKey];
  const pictureAlt = pictureLabels[selectedKey];

  return (
    <div className={"flex flex-col justify-start items-center gap-10 w-full max-w-[1300px] "}>


     
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

      { tag.length > 0 ? <ul className="flex flex-row justify-evenly items-center w-full pt-[20px] pb-[20px]">
        {buttonConfig.map(({ id, className }, index) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => setSelectedKey(id)}
              className={className}
            >
              {tag[index]}
            </button>
          </li>
        ))}
      </ul> : null}
       
      
    </div>
  );
};

export { Diff };
