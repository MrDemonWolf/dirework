const REQUIRED_DEPLOY_VALUES = [
  "CLOUDFLARE_API_TOKEN",
  "ALCHEMY_PASSWORD",
  "BETTER_AUTH_SECRET",
  "TWITCH_CLIENT_ID",
  "TWITCH_CLIENT_SECRET",
  "BETTER_AUTH_URL",
  "CORS_ORIGIN",
] as const;

export type DeployEnvironment = Record<string, string | undefined>;

export function isCiRun(env: DeployEnvironment): boolean {
  return env.CI === "true";
}

export function isDevelopmentRun(argv: readonly string[]): boolean {
  return argv.includes("--dev");
}

/**
 * Resolve the two dev-login bindings defensively. Production commands always
 * receive disabled values, even before the stricter environment assertion runs.
 */
export function getDevLoginSettings(env: DeployEnvironment, argv: readonly string[]) {
  const isDevelopment = isDevelopmentRun(argv);
  return {
    server: isDevelopment && env.DEV_LOGIN === "true" ? "true" : "false",
    client: isDevelopment && env.NEXT_PUBLIC_DEV_LOGIN === "true" ? "true" : "",
  } as const;
}

function validateOrigin(name: string, value: string, errors: string[]): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      errors.push(`${name} must use https in production`);
    }
    if (url.username || url.password || url.search || url.hash) {
      errors.push(`${name} must not include credentials, a query, or a fragment`);
    }
    if (value !== url.origin) {
      errors.push(`${name} must be an origin only (for example https://app.example.com)`);
    }
    return url;
  } catch {
    errors.push(`${name} must be a valid absolute URL`);
    return null;
  }
}

function validateOptionalHttpsUrl(name: string, value: string | undefined, errors: string[]): void {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") errors.push(`${name} must use https in production`);
    if (url.username || url.password) errors.push(`${name} must not include URL credentials`);
  } catch {
    errors.push(`${name} must be a valid absolute URL when set`);
  }
}

/** Return redacted validation errors; secret values are never interpolated. */
export function productionEnvironmentErrors(env: DeployEnvironment): string[] {
  const errors: string[] = [];

  for (const name of REQUIRED_DEPLOY_VALUES) {
    if (!env[name]?.trim()) errors.push(`${name} is required`);
  }
  if (isCiRun(env) && !env.ALCHEMY_STATE_TOKEN?.trim()) {
    errors.push("ALCHEMY_STATE_TOKEN is required in CI");
  }

  if (env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length < 32) {
    errors.push("BETTER_AUTH_SECRET must be at least 32 characters");
  }
  if (env.ALCHEMY_PASSWORD && env.ALCHEMY_PASSWORD.length < 32) {
    errors.push("ALCHEMY_PASSWORD must be at least 32 characters");
  }
  if (env.ALCHEMY_STATE_TOKEN && env.ALCHEMY_STATE_TOKEN.length < 32) {
    errors.push("ALCHEMY_STATE_TOKEN must be at least 32 characters");
  }

  if (env.BETTER_AUTH_URL) validateOrigin("BETTER_AUTH_URL", env.BETTER_AUTH_URL, errors);
  if (env.CORS_ORIGIN) validateOrigin("CORS_ORIGIN", env.CORS_ORIGIN, errors);
  if (env.BETTER_AUTH_URL && env.CORS_ORIGIN && env.BETTER_AUTH_URL !== env.CORS_ORIGIN) {
    errors.push("BETTER_AUTH_URL and CORS_ORIGIN must be the same web origin");
  }

  validateOptionalHttpsUrl("DOCS_URL", env.DOCS_URL, errors);
  validateOptionalHttpsUrl("PRIVACY_POLICY_URL", env.PRIVACY_POLICY_URL, errors);
  validateOptionalHttpsUrl("TERMS_OF_SERVICE_URL", env.TERMS_OF_SERVICE_URL, errors);

  if (env.DEV_LOGIN === "true" || env.NEXT_PUBLIC_DEV_LOGIN === "true") {
    errors.push("development login flags must be unset for production deploys");
  }

  return errors;
}

export function assertProductionEnvironment(env: DeployEnvironment): void {
  const errors = productionEnvironmentErrors(env);
  if (errors.length > 0) {
    throw new Error(`Invalid production deployment configuration:\n- ${errors.join("\n- ")}`);
  }
}
