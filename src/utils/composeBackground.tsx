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
    const gradientFill = createGradientFill(
      ctx,
      canvas.width,
      canvas.height,
      background.value
    );
    ctx.fillStyle = gradientFill || background.value; // ex: "#ffffff" ou gradient
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

type GradientStopInput = { color: string; position?: number };
type GradientStop = { color: string; position: number };
type NormalizedPoint = { x: number; y: number };
type RadialSizeKeyword =
  | "closest-side"
  | "closest-corner"
  | "farthest-side"
  | "farthest-corner";
type RadialGradientConfig = {
  shape: "circle" | "ellipse";
  size: RadialSizeKeyword;
  center: NormalizedPoint;
  stops: GradientStop[];
};

/**
 * Transforme un CSS linear-gradient en CanvasGradient si possible.
 */
function createGradientFill(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  value: string
): CanvasGradient | null {
  if (!value || !value.includes("gradient")) return null;
  const linear = parseLinearGradient(value);
  if (linear) {
    const gradient = buildLinearGradient(ctx, width, height, linear.angle);
    linear.stops.forEach((stop) =>
      gradient.addColorStop(stop.position, stop.color)
    );
    return gradient;
  }
  const radial = parseRadialGradient(value);
  if (radial) {
    const gradient = buildRadialGradient(ctx, width, height, radial);
    radial.stops.forEach((stop) =>
      gradient.addColorStop(stop.position, stop.color)
    );
    return gradient;
  }
  return null;
}

function parseLinearGradient(value: string):
  | { angle: number; stops: GradientStop[] }
  | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^linear-gradient\((.*)\)$/i);
  if (!match) return null;
  const tokens = splitGradientTokens(match[1]);
  if (tokens.length < 2) return null;
  const direction = parseDirectionToDegrees(tokens[0]);
  const stopTokens = direction !== null ? tokens.slice(1) : tokens;
  const stops = stopTokens
    .map(parseGradientStop)
    .filter((stop): stop is GradientStopInput => Boolean(stop));
  if (stops.length < 2) return null;
  return {
    angle: direction ?? 180,
    stops: normalizeStops(stops),
  };
}

function splitGradientTokens(value: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of value) {
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      tokens.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

function parseDirectionToDegrees(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (t.endsWith("deg")) {
    const deg = parseFloat(t);
    return Number.isFinite(deg) ? deg : null;
  }
  if (t.endsWith("rad")) {
    const rad = parseFloat(t);
    return Number.isFinite(rad) ? (rad * 180) / Math.PI : null;
  }
  if (t.endsWith("turn")) {
    const turns = parseFloat(t);
    return Number.isFinite(turns) ? turns * 360 : null;
  }
  const directionMap: Record<string, number> = {
    "to top": 0,
    "to top right": 45,
    "to right top": 45,
    "to right": 90,
    "to right bottom": 135,
    "to bottom right": 135,
    "to bottom": 180,
    "to bottom left": 225,
    "to left bottom": 225,
    "to left": 270,
    "to left top": 315,
    "to top left": 315,
  };
  return directionMap[t] ?? null;
}

function parseGradientStop(token: string): GradientStopInput | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\s(-?\d*\.?\d+%?)$/);
  let color = trimmed;
  let position: number | undefined;
  if (match) {
    const raw = match[1];
    color = trimmed.slice(0, trimmed.length - match[0].length).trim();
    const numeric = parseFloat(raw);
    if (Number.isFinite(numeric)) {
      if (raw.endsWith("%")) {
        position = clamp(numeric / 100);
      } else {
        position = clamp(numeric);
      }
    }
  }
  if (!color) return null;
  return { color, position: typeof position === "number" ? position : undefined };
}

function normalizeStops(stops: GradientStopInput[]): GradientStop[] {
  const cloned = stops.map((stop) => ({ ...stop }));
  const total = cloned.length;
  const hasDefined = cloned.some((stop) => typeof stop.position === "number");
  if (!hasDefined) {
    return cloned.map((stop, index) => ({
      color: stop.color,
      position: total === 1 ? 0 : index / (total - 1),
    }));
  }

  let lastDefinedIndex = -1;
  for (let i = 0; i < total; i++) {
    if (typeof cloned[i].position === "number") {
      const currentPos = clamp(cloned[i].position!);
      cloned[i].position = currentPos;
      if (lastDefinedIndex >= 0 && i - lastDefinedIndex > 1) {
        const prevPos = cloned[lastDefinedIndex].position!;
        const gap = i - lastDefinedIndex;
        for (let step = 1; step < gap; step++) {
          cloned[lastDefinedIndex + step].position =
            prevPos + ((currentPos - prevPos) * step) / gap;
        }
      } else if (lastDefinedIndex === -1 && i > 0) {
        const stepValue = currentPos / i;
        for (let k = 0; k < i; k++) {
          cloned[k].position = stepValue * k;
        }
      }
      lastDefinedIndex = i;
    }
  }

  if (lastDefinedIndex < total - 1) {
    const startPos = cloned[lastDefinedIndex].position!;
    const remaining = total - lastDefinedIndex - 1;
    const stepValue = remaining === 0 ? 0 : (1 - startPos) / remaining;
    for (let i = 1; i <= remaining; i++) {
      cloned[lastDefinedIndex + i].position = startPos + stepValue * i;
    }
  }

  return cloned.map((stop, index) => ({
    color: stop.color,
    position: clamp(
      typeof stop.position === "number" ? stop.position : total === 1 ? 0 : index / (total - 1)
    ),
  }));
}

function buildLinearGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  angle: number
): CanvasGradient {
  const normalizedAngle = ((angle % 360) + 360) % 360;
  const rad = ((normalizedAngle - 90) * Math.PI) / 180;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const radius = Math.sqrt(width * width + height * height) / 2;
  const x0 = halfWidth - Math.cos(rad) * radius;
  const y0 = halfHeight - Math.sin(rad) * radius;
  const x1 = halfWidth + Math.cos(rad) * radius;
  const y1 = halfHeight + Math.sin(rad) * radius;
  return ctx.createLinearGradient(x0, y0, x1, y1);
}

function parseRadialGradient(value: string): RadialGradientConfig | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^radial-gradient\((.*)\)$/i);
  if (!match) return null;
  const tokens = splitGradientTokens(match[1]);
  if (tokens.length < 2) return null;
  const descriptorPattern = /(circle|ellipse|closest|farthest|side|corner| at )/;
  let descriptorToken: string | undefined;
  let stopTokens = tokens;
  if (descriptorPattern.test(tokens[0].toLowerCase())) {
    descriptorToken = tokens[0];
    stopTokens = tokens.slice(1);
  }
  const stops = stopTokens
    .map(parseGradientStop)
    .filter((stop): stop is GradientStopInput => Boolean(stop));
  if (stops.length < 2) return null;
  const descriptor = parseRadialDescriptor(descriptorToken);
  return {
    ...descriptor,
    stops: normalizeStops(stops),
  };
}

function parseRadialDescriptor(token?: string): Omit<RadialGradientConfig, "stops"> {
  const defaults: Omit<RadialGradientConfig, "stops"> = {
    shape: "ellipse",
    size: "farthest-corner",
    center: { x: 0.5, y: 0.5 },
  };
  if (!token) return defaults;
  let descriptor = token.trim().toLowerCase();
  if (!descriptor) return defaults;
  let shape: "circle" | "ellipse" = descriptor.includes("circle")
    ? "circle"
    : descriptor.includes("ellipse")
    ? "ellipse"
    : defaults.shape;
  descriptor = descriptor.replace("circle", "").replace("ellipse", "").trim();
  let sizePart = descriptor;
  const atIndex = descriptor.indexOf(" at ");
  let center = defaults.center;
  if (atIndex >= 0) {
    sizePart = descriptor.slice(0, atIndex).trim();
    const positionPart = descriptor.slice(atIndex + 4).trim();
    if (positionPart) center = parseRadialPosition(positionPart);
  }
  const size = parseRadialSizeKeyword(sizePart) ?? defaults.size;
  return { shape, size, center };
}

function parseRadialPosition(value: string): NormalizedPoint {
  const defaults: NormalizedPoint = { x: 0.5, y: 0.5 };
  if (!value) return defaults;
  const tokens = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return defaults;
  let x: number | null = null;
  let y: number | null = null;
  tokens.forEach((token) => {
    const percent = parsePercentageToken(token);
    if (percent !== null) {
      if (x === null) {
        x = percent;
        return;
      }
      if (y === null) {
        y = percent;
        return;
      }
    }
    const horizontal = parseHorizontalKeyword(token);
    if (horizontal !== null) x = horizontal;
    const vertical = parseVerticalKeyword(token);
    if (vertical !== null) y = vertical;
  });
  return { x: x ?? defaults.x, y: y ?? defaults.y };
}

function parsePercentageToken(token: string): number | null {
  if (!token.endsWith("%")) return null;
  const numeric = parseFloat(token);
  return Number.isFinite(numeric) ? clamp(numeric / 100) : null;
}

function parseHorizontalKeyword(token: string): number | null {
  const t = token.toLowerCase();
  if (t === "left") return 0;
  if (t === "center") return 0.5;
  if (t === "right") return 1;
  return null;
}

function parseVerticalKeyword(token: string): number | null {
  const t = token.toLowerCase();
  if (t === "top") return 0;
  if (t === "center") return 0.5;
  if (t === "bottom") return 1;
  return null;
}

function parseRadialSizeKeyword(value?: string): RadialSizeKeyword | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, "-");
  const map: Record<string, RadialSizeKeyword> = {
    "closest-side": "closest-side",
    "closest-corner": "closest-corner",
    "farthest-side": "farthest-side",
    "farthest-corner": "farthest-corner",
  };
  return map[normalized] ?? null;
}

function buildRadialGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: RadialGradientConfig
): CanvasGradient {
  const cx = clamp(config.center.x) * width;
  const cy = clamp(config.center.y) * height;
  const radius = computeRadiusForSize(config.size, width, height, cx, cy);
  return ctx.createRadialGradient(cx, cy, 0, cx, cy, radius || Math.max(width, height) / 2);
}

function computeRadiusForSize(
  size: RadialSizeKeyword,
  width: number,
  height: number,
  cx: number,
  cy: number
): number {
  const corners = [
    Math.hypot(cx, cy),
    Math.hypot(width - cx, cy),
    Math.hypot(cx, height - cy),
    Math.hypot(width - cx, height - cy),
  ];
  const horizontalDistances = [cx, width - cx];
  const verticalDistances = [cy, height - cy];
  switch (size) {
    case "closest-side":
      return Math.min(
        Math.min(...horizontalDistances),
        Math.min(...verticalDistances)
      );
    case "farthest-side":
      return Math.max(
        Math.max(...horizontalDistances),
        Math.max(...verticalDistances)
      );
    case "closest-corner":
      return Math.min(...corners);
    case "farthest-corner":
    default:
      return Math.max(...corners);
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export default composeBackground;
