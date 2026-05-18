//import des fonctions
import { pexelsConnect } from "../../function/pexelsConnect.js";
import { buildPexelsCroppedImageUrl } from "../../function/pexelsImageUrl.js";

//import des types
import type { RequestHandler } from "express";


//permet de recuperer un tableau d'images pour les vignettes d'une pallete cote front
const getImages: RequestHandler = async (req, res) => {
    const themeValue = Array.isArray(req.query.theme)
        ? req.query.theme[0]
        : req.query.theme;
    const query = typeof themeValue === "string" ? themeValue : "";

    const langValue = Array.isArray(req.query.lang)
        ? req.query.lang[0]
        : req.query.lang;
    let lang = typeof langValue === "string" ? langValue : "en";
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
            return res.status(500).json("error HTTP code: pex-1")
        }

        // Ajoute une URL custom 2000x2000 (crop) pour chaque photo.
        // Le front peut l'utiliser pour garantir une résolution suffisante.
        const photos = Array.isArray((response as any)?.photos) ? (response as any).photos : [];
        const photosWithCustom = photos.map((photo: any) => {
            const original = photo?.src?.original;
            if (typeof original !== "string") return photo;
            return {
                ...photo,
                customImage: buildPexelsCroppedImageUrl(original, { width: 2000, height: 2000 }),
            };
        });

        return res.status(200).json({
            ...(response as any),
            photos: photosWithCustom,
        });
    } catch (error:any) {
        console.log("error: ", error || error.message);
        res.status(500).json("error server code: pex-2" + error)
    }
    
};

export {getImages}


