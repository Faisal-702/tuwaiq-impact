import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get adminAccessCode() {
    return required("ADMIN_ACCESS_CODE");
  },
  get sessionSecret() {
    const secret = required("SESSION_SECRET");
    if (secret.length < 16) {
      throw new Error("SESSION_SECRET must be at least 16 characters long");
    }
    return secret;
  },
  get storageDriver(): "supabase" | "local" {
    return process.env.STORAGE_DRIVER === "local" ? "local" : "supabase";
  },
  get supabaseUrl() {
    return required("SUPABASE_URL").replace(/\/$/, "");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get storageBucket() {
    return process.env.SUPABASE_STORAGE_BUCKET || "project-media";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
