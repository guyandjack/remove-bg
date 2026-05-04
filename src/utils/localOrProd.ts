type Mode = "development" | "preprod" | "production";

interface EnvConfig {
  url: string;
  urlApi: string;
}

interface EnvResult extends EnvConfig {
  mode: Mode;
}

const mode = import.meta.env.MODE as Mode;

const envConfig: Record<Mode, EnvConfig> = {
  development: {
    url: import.meta.env.VITE_BASE_DEV_URL,
    urlApi: import.meta.env.VITE_API_DEV_URL,
  },
  preprod: {
    url: import.meta.env.VITE_BASE_PRE_PROD_URL,
    urlApi: import.meta.env.VITE_API_PRE_PROD_URL,
  },
  production: {
    url: import.meta.env.VITE_BASE_PROD_URL,
    urlApi: import.meta.env.VITE_API_PROD_URL,
  },
};

function validateEnvVariables(
  config: EnvConfig | undefined,
): asserts config is EnvConfig {
  if (!mode) {
    throw new Error("Le mode Vite est manquant.");
  }

  if (!config) {
    throw new Error(`Mode Vite non reconnu : ${mode}`);
  }

  if (!config.url || !config.urlApi) {
    throw new Error(
      `Variables d'environnement manquantes pour le mode : ${mode}`,
    );
  }
}

/**
 * ⚡ Garde le même nom que ton ancienne fonction
 */
export function localOrProd(): EnvResult {
  const config = envConfig[mode];

  validateEnvVariables(config);

  return {
    ...config,
    mode,
  };
}
