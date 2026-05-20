const setDocumentTitle = (): void => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const rawPath: string = window.location.pathname?.trim() || "/";
   // Récupère le premier segment du path, ex : "/pricing/options" → "pricing"
  const segment: string =
    rawPath === "/" ? "home" : rawPath.split("/")[1] || "home";

  document.title = `wizpix-${segment}`;
};

export {setDocumentTitle}
