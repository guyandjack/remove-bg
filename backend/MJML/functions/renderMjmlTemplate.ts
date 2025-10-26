import mjml2html from "mjml";
import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../../logger.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "..", "template");

export type TemplateData = Record<string, unknown>;

/**
 * Rend un template MJML (avec Handlebars) et renvoie l'HTML.
 * @param templateFile Nom du fichier dans backend/MJML/template (ex: "email.validation.mjml")
 * @param data Données dynamiques pour Handlebars
 */
export async function renderMjmlTemplate(
  templateFile: string,
  data: TemplateData = {},
  lang: string
): Promise<{ html: string; errors: unknown[] }> {
  try {
    const filePath = path.join(TEMPLATES_DIR, lang, templateFile);
    const mjmlTemplate = await readFile(filePath, "utf-8");

    const template = Handlebars.compile(mjmlTemplate);
    const finalMjml = template(data);

    const { html, errors } = mjml2html(finalMjml, { validationLevel: "soft" });
    return { html, errors };
  } catch (err) {
    logger.error("MJML render failed", {
      templateFile,
      message: err instanceof Error ? err.message : String(err),
    });
    return { html: "", errors: [err] };
  }
}
