//import des hook
import { useEffect } from "preact/hooks";

const initDefaultTheme = () => {
  const html = document.documentElement;
  const attrTheme = html.getAttribute("data-theme");
  const storedTheme = localStorage.getItem("theme");

  // 1 Choisir une valeur de référence
    let theme = attrTheme || storedTheme || "winter"; // fallback par défaut
    
    if (theme !== "winter" && theme !== "night") {
        theme = "winter"
    }

  // 2 Appliquer au DOM et synchroniser le stockage
  if (attrTheme !== theme) html.setAttribute("data-theme", theme);
  if (storedTheme !== theme) localStorage.setItem("theme", theme);
};

const handleTheme = () => {
    const html = document.documentElement;
    const attrTheme = html.getAttribute("data-theme");
    const storedTheme = localStorage.getItem("theme");

    if (attrTheme !== storedTheme) {
        initDefaultTheme();
       
    }
    if (attrTheme === "night") {
        html.setAttribute("data-theme", "winter");
        localStorage.setItem("theme", "winter");
    }
    if (attrTheme === "winter") {
        html.setAttribute("data-theme", "night");
        localStorage.setItem("theme", "night");
    }

    
    
};



const ThemeControler = () => {
  
    useEffect(() => {
        initDefaultTheme()
    },[])

  return (
    <label className="flex cursor-pointer gap-2" onClick={handleTheme}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
      </svg>
      <input
        type="checkbox"
        value="synthwave"
        className="toggle theme-controller"
       />       
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    </label>
  );
};

export { ThemeControler };

