import type { RequestHandler } from "express";

const pexelsCheckReqParams: RequestHandler = (req, res, next) => {
  const allowedKeys = ["theme", "id", "lang", "page"] as const;
  const themeRegex = /^[a-zA-Z0-9 .\-_,'`]{1,50}$/;
  const idRegex = /^[0-9]{1,10}$/;
  const langRegex = /^(fr|en|de|it)$/;
  const pageRegex = /^[0-9]{1,3}$/;

  const tabError: string[] = [];
  const queryKeys = Object.keys(req.query);

  // 1) Paramètres attendus :
  // - /images : theme + lang (page optionnel)
  // - /image  : id (lang optionnel)
  if (queryKeys.length < 1) {
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

  if (themeValue !== undefined && themeValue !== null && typeof themeValue !== "string") {
    tabError.push("error on value param theme code 10");
  }

  if (idValue !== undefined && idValue !== null && typeof idValue !== "string") {
    tabError.push("error on value param id code 13");
  }

  const hasTheme = typeof themeValue === "string" && themeValue.trim().length > 0;
  const hasId = typeof idValue === "string" && idValue.trim().length > 0;

  if (!hasTheme && !hasId) {
    tabError.push("parametre theme ou id manquant code 10/13");
  }

  if (hasTheme && !themeRegex.test(themeValue as string)) {
    tabError.push("error on value param theme code 10");
  }

  const hasLang = typeof langValue === "string" && langValue.trim().length > 0;
  if (hasTheme) {
    // Pour la recherche, la langue est requise car elle est utilisée pour locale.
    if (!hasLang || !langRegex.test(langValue as string)) {
      tabError.push("error on value param lang code 11");
    }
  } else if (hasLang && !langRegex.test(langValue as string)) {
    // Pour /image, lang est optionnel mais si présent il doit être valide.
    tabError.push("error on value param lang code 11");
  }

  if (pageValue !== undefined && pageValue !== null && typeof pageValue !== "string") {
    tabError.push("error on value param page code 12");
  } else if (typeof pageValue === "string" && pageValue && !pageRegex.test(pageValue)) {
    tabError.push("error on value param page code 12");
  }

  if (hasId && !idRegex.test(idValue as string)) {
    tabError.push("error on value param id code 13");
  }

  if (tabError.length > 0) {
    return res.status(400).json({ tabError });
  }

  // 5) Tout est ok, on passe au middleware suivant
  return next();
};

export { pexelsCheckReqParams };
