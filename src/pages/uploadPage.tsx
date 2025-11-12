//import des composants enfants
import { UploadImg } from "@/components/form/UploadImg"


function UploadPage() {
    return (
      <div className={"px-[10px]"}>
        <h1>Page Upload</h1>
        <UploadImg />
      </div>
    );
    
}

export {UploadPage}