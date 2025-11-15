// utils/loadScript.ts
 function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Si déjà chargé → OK
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true; // ← ⚠️ async, pas defer dans ce contexte
    script.onload = () => resolve();
    script.onerror = () => reject(`Erreur chargement script ${src}`);

    document.body.appendChild(script);
  });
}

export {loadScript}