/** The public homepage. "/" always redirects to the entry page (/welcome). */
export const HOME_PATH = "/home";

/** Cookie names shared by the proxy (edge of the app) and server code. */
export const ADMIN_COOKIE = "ti_admin_sid";
export const ENTRY_COOKIE = "ti_visit";
/** Cookies from earlier versions that persisted across browser restarts. */
export const LEGACY_COOKIES = ["ti_admin_session", "ti_entry"] as const;
