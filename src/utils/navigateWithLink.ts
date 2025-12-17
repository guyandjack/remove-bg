/**
 * Navigates by creating a temporary anchor element so the SPA router can handle the change.
 * Falls back silently when executed server-side.
 */
 const navigateWithLink = (href: string, target?: string) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const link = document.createElement("a");
  link.href = href;
  if (target) {
    link.target = target;
    if (target === "_blank") {
      link.rel = "noopener noreferrer";
    }
  }
  link.style.position = "absolute";
  link.style.width = "1px";
  link.style.height = "1px";
  link.style.overflow = "hidden";
  link.style.opacity = "0";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export {navigateWithLink}