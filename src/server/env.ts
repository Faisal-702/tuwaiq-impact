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
  /**
   * Key sent as `apikey` to Supabase Auth for administrator sign-in. The
   * publishable/anon key is enough; the service-role key is used when no
   * anon key is configured. Server-side only either way.
   */
  get supabaseAuthKey() {
    return process.env.SUPABASE_ANON_KEY || required("SUPABASE_SERVICE_ROLE_KEY");
  },
  /**
   * Optional allowlist (comma-separated). When set, only these Supabase Auth
   * users may open the dashboard; when empty, any user in the project may.
   */
  get adminEmails(): string[] {
    return (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
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
