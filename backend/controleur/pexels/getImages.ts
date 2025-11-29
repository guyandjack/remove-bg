//import des fonctions
import { pexelsConnect } from "../../function/pexelsConnect";

//import des types
import type { RequestHandler } from "express";


//permet de recuperer un tableau d'images pour les vignettes d'une pallete cote front
const getImages: RequestHandler = async (req, res) => {
    const query = req.query.theme;
    let lang = req.query.lang;
    const MAX_PAGE = 5;
    const rawPage = Array.isArray(req.query.page)
        ? req.query.page[0]
        : req.query.page;
    let pageNumber = parseInt(rawPage as string, 10);
    if (Number.isNaN(pageNumber) || pageNumber < 1) {
        pageNumber = 1;
    }
    pageNumber = Math.min(pageNumber, MAX_PAGE);
    switch (lang) {
        case "fr": 
            lang = "fr-FR"
            break;
        case "en": 
            lang = "en-EN"
            break;
        case "de": 
            lang = "de-DE"
            break;
        case "it": 
            lang = "it-IT"
            break;
    
        default:
            lang = "en-EN"
            break;
    }
    const client = await pexelsConnect();
    
    try {
        
        const response = await client.photos.search({
            query,
            locale:lang,
            page: pageNumber,
        });
        if (!response) {
            res.status(500).json("error HTTP code: pex-1")
        }
        res.status(200).json(response);
    } catch (error:any) {
        console.log("error: ", error || error.message);
        res.status(500).json("error server code: pex-2" + error)
    }
    
};

export {getImages}

// All requests made with the client will be authenticated
