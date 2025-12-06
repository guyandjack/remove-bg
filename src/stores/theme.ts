import { signal, computed } from "@preact/signals";

// =========================
// 1. Signal global du thème
// =========================
const themeSignal = signal<"winter" | "night">("winter");

// =========================
// 2. Privileges dérivés (computed)
// =========================
const privileges = computed(() => {
  const theme = themeSignal.value;
  return theme ? { theme } : null;
});

// =========================
// 3. Fonction pour mettre à jour la session : à appeler après click user
// =========================
function setThemeFromClickUser(data: string) {
  const html = document.documentElement;

  if (data !== "winter" && data !== "night") {
    data = "winter";
  }

  html.setAttribute("data-theme", data);
  localStorage.setItem("theme", data);
  themeSignal.value = data as "winter" | "night";
}

// =========================
// 4.  initialisation du theme a partir du locale storage au démarrage
// =========================
function initThemeFromLocalStorage() {
  const html = document.documentElement;
  const storedTheme = localStorage.getItem("theme");
  const attrTheme = html.getAttribute("data-theme");

  // 1 Choisir une valeur de référence
  let theme = storedTheme || attrTheme;

  // 2 applique le theme defaut winter si theme trouvé n'est ni winter ni night
  if (theme !== "winter" && theme !== "night") {
    theme = "winter";
  }

  // 3 Appliquer au DOM et synchroniser le stockage
  html.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  themeSignal.value = theme as "winter" | "night";

  return theme;
}

export { initThemeFromLocalStorage, setThemeFromClickUser, themeSignal };
