/** The public homepage. "/" always redirects to the entry page (/welcome). */
export const HOME_PATH = "/home";

/** Cookie names shared by the proxy (edge of the app) and server code. */
export const ADMIN_COOKIE = "ti_admin_sid";
export const STUDENT_COOKIE = "ti_student_sid";
/**
 * Cookies from earlier versions: persistent cookies that outlived the browser
 * session, and the guest "visit" marker (guest access no longer exists).
 */
export const LEGACY_COOKIES = ["ti_admin_session", "ti_entry", "ti_visit"] as const;
