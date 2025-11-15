import type { RequestHandler } from "express";

const pexelsCheckReqParams: RequestHandler = (req, res, next) => {
  const allowedKeys = ["theme", "id", "lang"] as const;
  const themeRegex = /^[a-zA-Z \.-_,'` ]{1,50}$/;
  const idRegex = /^[0-9]{1,10}$/;
  const langRegex = /fr|en|de|it/;
  
  let tabError = [];
  const queryKeys = Object.keys(req.query);
  
  // 1) Deux paramètres obligatoires
  if (queryKeys.length < 2) {
    tabError.push("nombre de parametre incorrect code 8")
    return res.status(400).json({ tabError });
  }

  // 2)test le nom des params, 
  queryKeys.map((item) => {
    const result = allowedKeys.includes(item);
    if (!result) {
      tabError.push(`error on item Name ${item} code 9`)
    }
   

  })

  //3 test la valeur des params, et leur type
  const paramThemeValue = req.query.theme;
  const paramLangValue = req.query.lang;

  
  // 3) Validation selon la regex
  if (!themeRegex.test(paramLangValue) || !langRegex.test(paramLangValue)) {
    tabError.push("error on value param code 10")
  }

  if (tabError.length > 0) {
    return res.status(400).json({ tabError });
  }

  // 5) Tout est ok, on passe au middleware suivant
  return next();
};

export { pexelsCheckReqParams };
