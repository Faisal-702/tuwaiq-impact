import { isValidEmail, normalizeSaudiPhone } from "./submission";

/*
 * Rules shared by the public partnership form (early feedback) and the server
 * (enforcement). The database repeats the essential ones as constraints.
 */

export const PARTNER_TYPES = ["individual", "organization"] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export const ORGANIZATION_CATEGORIES = ["government", "private", "nonprofit", "education", "other"] as const;
export type OrganizationCategory = (typeof ORGANIZATION_CATEGORIES)[number];

export const SUPPORT_TYPES = ["financial", "technical", "mentorship", "training", "sponsorship", "other"] as const;
export type SupportType = (typeof SUPPORT_TYPES)[number];

/** The approved fields of interest, in the order shown on the form. */
export const INTEREST_FIELDS = [
  "tech_software",
  "ai",
  "electronics",
  "ai_ml",
  "data_science",
  "cybersecurity",
  "software_apps",
  "web_mobile",
  "software_engineering",
  "cloud",
  "networks",
  "robotics_mechatronics",
  "iot",
  "drones",
  "games_xr",
  "ux_ui",
  "design_3d",
  "smart_cities",
  "entrepreneurship",
  "product_management",
  "other",
] as const;
export type InterestField = (typeof INTEREST_FIELDS)[number];
/** Values of the first version of the form (still shown for applications stored then). */
export const LEGACY_INTEREST_FIELDS = ["all", "robotics", "programming", "research"] as const;
export type StoredInterestField = InterestField | (typeof LEGACY_INTEREST_FIELDS)[number];

export const PARTNER_LIMITS = {
  fullName: [2, 120],
  organizationName: [2, 160],
  jobTitle: [2, 120],
  other: [2, 120],
  city: [2, 80],
  email: [5, 254],
  proposal: [10, 2000],
} as const;

export type PartnerForm = {
  partnerType: PartnerType | "";
  fullName: string;
  organizationName: string;
  jobTitle: string;
  organizationCategory: OrganizationCategory | "";
  organizationCategoryOther: string;
  email: string;
  phone: string;
  city: string;
  supportTypes: SupportType[];
  supportOther: string;
  interestFields: InterestField[];
  interestOther: string;
  proposal: string;
  consent: boolean;
};

export type PartnerField = keyof PartnerForm;
export type PartnerError = "required" | "tooShort" | "tooLong" | "phone" | "email" | "choose" | "consent";

export const EMPTY_PARTNER_FORM: PartnerForm = {
  partnerType: "",
  fullName: "",
  organizationName: "",
  jobTitle: "",
  organizationCategory: "",
  organizationCategoryOther: "",
  email: "",
  phone: "",
  city: "",
  supportTypes: [],
  supportOther: "",
  interestFields: [],
  interestOther: "",
  proposal: "",
  consent: false,
};

/** Order of the fields on the form (used to focus the first error). */
export const PARTNER_FIELD_ORDER: PartnerField[] = [
  "partnerType",
  "fullName",
  "organizationName",
  "jobTitle",
  "organizationCategory",
  "organizationCategoryOther",
  "email",
  "phone",
  "city",
  "supportTypes",
  "supportOther",
  "interestFields",
  "interestOther",
  "proposal",
  "consent",
];

/** Collapses runs of whitespace (single-line answers). */
export const collapseSpaces = (value: string) => value.replace(/\s+/g, " ").trim();
/** Trims a multi-line answer and drops excess blank lines. */
export const tidyText = (value: string) => value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

export const isOrganization = (form: Pick<PartnerForm, "partnerType">) => form.partnerType === "organization";
/** Which "please specify" fields apply to the current answers. */
export const otherApplies = (form: Pick<PartnerForm, "partnerType" | "organizationCategory" | "supportTypes" | "interestFields">) => ({
  organizationCategoryOther: isOrganization(form) && form.organizationCategory === "other",
  supportOther: form.supportTypes.includes("other"),
  interestOther: form.interestFields.includes("other"),
});

const length = (value: string, [min, max]: readonly [number, number]): PartnerError | null =>
  !value ? "required" : value.length < min ? "tooShort" : value.length > max ? "tooLong" : null;

/** Validates the form. Returns the errors per field (empty when valid). */
export function validatePartnerForm(form: PartnerForm): Partial<Record<PartnerField, PartnerError>> {
  const errors: Partial<Record<PartnerField, PartnerError>> = {};
  const set = (field: PartnerField, error: PartnerError | null) => {
    if (error) errors[field] = error;
  };
  const other = otherApplies(form);

  set("partnerType", PARTNER_TYPES.includes(form.partnerType as PartnerType) ? null : "choose");
  set("fullName", length(collapseSpaces(form.fullName), PARTNER_LIMITS.fullName));
  if (isOrganization(form)) {
    set("organizationName", length(collapseSpaces(form.organizationName), PARTNER_LIMITS.organizationName));
    set("jobTitle", length(collapseSpaces(form.jobTitle), PARTNER_LIMITS.jobTitle));
    set("organizationCategory", ORGANIZATION_CATEGORIES.includes(form.organizationCategory as OrganizationCategory) ? null : "choose");
    if (other.organizationCategoryOther) set("organizationCategoryOther", length(collapseSpaces(form.organizationCategoryOther), PARTNER_LIMITS.other));
  }
  const email = form.email.trim();
  set("email", !email ? "required" : isValidEmail(email) ? null : "email");
  set("phone", !form.phone.trim() ? "required" : normalizeSaudiPhone(form.phone) ? null : "phone");
  set("city", length(collapseSpaces(form.city), PARTNER_LIMITS.city));
  set(
    "supportTypes",
    form.supportTypes.length > 0 && form.supportTypes.every((s) => SUPPORT_TYPES.includes(s)) ? null : "choose",
  );
  if (other.supportOther) set("supportOther", length(collapseSpaces(form.supportOther), PARTNER_LIMITS.other));
  set(
    "interestFields",
    form.interestFields.length > 0 && form.interestFields.every((s) => INTEREST_FIELDS.includes(s)) ? null : "choose",
  );
  if (other.interestOther) set("interestOther", length(collapseSpaces(form.interestOther), PARTNER_LIMITS.other));
  set("proposal", length(tidyText(form.proposal), PARTNER_LIMITS.proposal));
  set("consent", form.consent ? null : "consent");
  return errors;
}

/** Adds or removes one value of a multi-select. */
export const toggleValue = <T extends string>(current: readonly T[], value: T): T[] =>
  current.includes(value) ? current.filter((v) => v !== value) : [...current, value];

/** Keeps the canonical order of a multi-select regardless of click order. */
export const inOrder = <T extends string>(all: readonly T[], values: readonly T[]) => all.filter((v) => values.includes(v));
