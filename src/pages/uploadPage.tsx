//import des hooks
import { useState } from "preact/hooks";

//import des composants enfants
import { UploadImg } from "@/components/form/UploadImg";
import { ImgEditor } from "@/components/imgEditor/imgEditor";

//import image example
import img from "/src/assets/images/dessert.jpg";



function UploadPage() {
 const [previewUrl, setPreviewUrl] = useState<string | null>(img);
    return (
      <div className={"px-[10px]"}>
        <h1>Page Upload</h1>
        <UploadImg setPreviewUrl={setPreviewUrl} previewUrl={previewUrl} />
        <ImgEditor src={previewUrl} />
      </div>
    );
    
}

export { UploadPage };
