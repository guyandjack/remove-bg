const setDocumentTitle = (): void => {
  const rawPath: string = window.location.pathname?.trim() || "/";
   // Récupère le premier segment du path, ex : "/pricing/options" → "pricing"
  const segment: string =
    rawPath === "/" ? "home" : rawPath.split("/")[1] || "home";

  document.title = `wizpix-${segment}`;
};

export {setDocumentTitle}
