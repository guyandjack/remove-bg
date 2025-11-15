//import des types
import type { RequestHandler } from "express";

//import des fonctions
import { pexelsConnect } from "../../function/pexelsConnect";

const getOneImage: RequestHandler = async (req, res) => {
  const idImg = Number(req.params.id);
  const client = await pexelsConnect();

  try {
    const response = await client.photos.show({ id: idImg });
    if (!response) {
      res.status(500).json("error HTTP code: pex-3");
    }
    res.status(200).json(response);
  } catch (error: any) {
    console.log("error: ", error || error.message);
    res.status(500).json("error server code: pex-4" + error);
  }
};

export { getOneImage };
