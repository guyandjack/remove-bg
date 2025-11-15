async function composeBackground(
  subjectUrl: string,
  background:
    | { type: "color"; value: string }
    | { type: "image"; value: string }
): Promise<string> {
  const subjectImg = await loadImage(subjectUrl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  canvas.width = subjectImg.width;
  canvas.height = subjectImg.height;

  if (background.type === "color") {
    ctx.fillStyle = background.value; // ex: "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const bgImg = await loadImage(background.value);
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(subjectImg, 0, 0, canvas.width, canvas.height);

  // dataURL finale (PNG ou JPEG)
  return canvas.toDataURL("image/png");
}

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
