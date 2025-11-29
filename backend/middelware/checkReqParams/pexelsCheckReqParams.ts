import type { RequestHandler } from "express";

const pexelsCheckReqParams: RequestHandler = (req, res, next) => {
  const allowedKeys = ["theme", "id", "lang", "page"] as const;
  const themeRegex = /^[a-zA-Z0-9 .\-_,'`]{1,50}$/;
  const idRegex = /^[0-9]{1,10}$/;
  const langRegex = /^(fr|en|de|it)$/;
  const pageRegex = /^[0-9]{1,3}$/;

  const tabError: string[] = [];
  const queryKeys = Object.keys(req.query);

  // 1) Deux paramètres obligatoires (ex: theme + lang)
  if (queryKeys.length < 2) {
    tabError.push("nombre de parametre incorrect code 8");
    return res.status(400).json({ tabError });
  }

  // 2)test le nom des params
  queryKeys.forEach((item) => {
    if (!allowedKeys.includes(item as any)) {
      tabError.push(`error on item Name ${item} code 9`);
    }
  });

  // 3) test la valeur des params, et leur type
  const themeValue = Array.isArray(req.query.theme)
    ? req.query.theme[0]
    : req.query.theme;
  const langValue = Array.isArray(req.query.lang)
    ? req.query.lang[0]
    : req.query.lang;
  const pageValue = Array.isArray(req.query.page)
    ? req.query.page[0]
    : req.query.page;
  const idValue = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

  if (!themeValue || !themeRegex.test(themeValue)) {
    tabError.push("error on value param theme code 10");
  }

  if (!langValue || !langRegex.test(langValue)) {
    tabError.push("error on value param lang code 11");
  }

  if (pageValue && !pageRegex.test(pageValue)) {
    tabError.push("error on value param page code 12");
  }

  if (idValue && !idRegex.test(idValue)) {
    tabError.push("error on value param id code 13");
  }

  if (tabError.length > 0) {
    return res.status(400).json({ tabError });
  }

  // 5) Tout est ok, on passe au middleware suivant
  return next();
};

export { pexelsCheckReqParams };
