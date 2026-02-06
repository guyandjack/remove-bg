type AppEnv = "dev" | "prod";

const getEnv = (): { valid: boolean; env: AppEnv | null } => {
  const nodeEnv = process.env.NODE_ENV;

  if (!nodeEnv) {
    return { valid: false, env: null };
  }

  return {
    valid: true,
    env: nodeEnv === "development" ? "dev" : "prod",
  };
};

export { getEnv };
