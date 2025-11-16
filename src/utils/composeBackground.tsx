/**
 * Compose un arrière‑plan (couleur/image) avec un sujet transparent.
 *
 * Entrées
 * - subjectUrl: URL/dataURL de l’image du sujet (sans fond, PNG recommandé)
 * - background: { type: 'color' | 'image', value: string }
 *   - type 'color': value = code hexa (#ffffff…)
 *   - type 'image': value = URL/dataURL d’une image de fond
 *
 * Sortie
 * - Promise<string>: dataURL PNG du rendu final (fond + sujet)
 */
async function composeBackground(
  subjectUrl: string,
  background:
    | { type: "color"; value: string }
    | { type: "image"; value: string }
): Promise<string> {
  // Charge le sujet
  const subjectImg = await loadImage(subjectUrl);

  // Crée un canvas aux dimensions du sujet
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = subjectImg.width;
  canvas.height = subjectImg.height;

  // Dessine le fond (couleur unie ou image)
  if (background.type === "color") {
    ctx.fillStyle = background.value; // ex: "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const bgImg = await loadImage(background.value);
    // Étire l’image de fond sur la surface du canvas
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
  }

  // Dessine le sujet par‑dessus le fond
  ctx.drawImage(subjectImg, 0, 0, canvas.width, canvas.height);

  // Retourne une dataURL PNG (transparence conservée si présente)
  return canvas.toDataURL("image/png");
}

/**
 * Charge une image et renvoie une balise HTMLImageElement une fois prête.
 * Gestion CORS: crossOrigin = 'anonymous' pour permettre toDataURL.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default composeBackground;
