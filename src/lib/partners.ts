import { isValidEmail, normalizeSaudiPhone } from "./submission";

/*
 * Rules shared by the public partnership form (early feedback) and the server
 * (enforcement). The database repeats the essential ones as constraints.
 */

export const PARTNER_TYPES = ["individual", "organization"] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export const ORGANIZATION_CATEGORIES = ["private", "government", "nonprofit", "education", "other"] as const;
export type OrganizationCategory = (typeof ORGANIZATION_CATEGORIES)[number];

export const SUPPORT_TYPES = ["financial", "technical", "mentorship", "training", "sponsorship", "other"] as const;
export type SupportType = (typeof SUPPORT_TYPES)[number];

export const INTEREST_FIELDS = ["all", "ai", "robotics", "cybersecurity", "programming", "research", "other"] as const;
export type InterestField = (typeof INTEREST_FIELDS)[number];

export const PARTNER_LIMITS = {
  fullName: [2, 120],
  organizationName: [2, 160],
  jobTitle: [2, 120],
  city: [2, 80],
  email: [5, 254],
  proposal: [10, 2000],
} as const;

export type PartnerForm = {
  partnerType: PartnerType | "";
  fullName: string;
  organizationName: string;
  organizationCategory: OrganizationCategory | "";
  jobTitle: string;
  phone: string;
  email: string;
  city: string;
  supportTypes: SupportType[];
  interestFields: InterestField[];
  proposal: string;
  consent: boolean;
};

export type PartnerField = keyof PartnerForm;
export type PartnerError = "required" | "tooShort" | "tooLong" | "phone" | "email" | "choose" | "consent";

export const EMPTY_PARTNER_FORM: PartnerForm = {
  partnerType: "",
  fullName: "",
  organizationName: "",
  organizationCategory: "",
  jobTitle: "",
  phone: "",
  email: "",
  city: "",
  supportTypes: [],
  interestFields: [],
  proposal: "",
  consent: false,
};

/** Order of the fields on the form (used to focus the first error). */
export const PARTNER_FIELD_ORDER: PartnerField[] = [
  "partnerType",
  "fullName",
  "organizationName",
  "organizationCategory",
  "jobTitle",
  "phone",
  "email",
  "city",
  "supportTypes",
  "interestFields",
  "proposal",
  "consent",
];

/** Collapses runs of whitespace (single-line answers). */
export const collapseSpaces = (value: string) => value.replace(/\s+/g, " ").trim();
/** Trims a multi-line answer and drops excess blank lines. */
export const tidyText = (value: string) => value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

export const isOrganization = (form: Pick<PartnerForm, "partnerType">) => form.partnerType === "organization";

const length = (value: string, [min, max]: readonly [number, number]): PartnerError | null =>
  !value ? "required" : value.length < min ? "tooShort" : value.length > max ? "tooLong" : null;

/** Validates the form. Returns the errors per field (empty when valid). */
export function validatePartnerForm(form: PartnerForm): Partial<Record<PartnerField, PartnerError>> {
  const errors: Partial<Record<PartnerField, PartnerError>> = {};
  const set = (field: PartnerField, error: PartnerError | null) => {
    if (error) errors[field] = error;
  };

  set("partnerType", PARTNER_TYPES.includes(form.partnerType as PartnerType) ? null : "choose");
  set("fullName", length(collapseSpaces(form.fullName), PARTNER_LIMITS.fullName));
  if (isOrganization(form)) {
    set("organizationName", length(collapseSpaces(form.organizationName), PARTNER_LIMITS.organizationName));
    set("organizationCategory", ORGANIZATION_CATEGORIES.includes(form.organizationCategory as OrganizationCategory) ? null : "choose");
    set("jobTitle", length(collapseSpaces(form.jobTitle), PARTNER_LIMITS.jobTitle));
  }
  set("phone", !form.phone.trim() ? "required" : normalizeSaudiPhone(form.phone) ? null : "phone");
  const email = form.email.trim();
  set("email", !email ? "required" : isValidEmail(email) ? null : "email");
  set("city", length(collapseSpaces(form.city), PARTNER_LIMITS.city));
  set(
    "supportTypes",
    form.supportTypes.length > 0 && form.supportTypes.every((s) => SUPPORT_TYPES.includes(s)) ? null : "choose",
  );
  set(
    "interestFields",
    form.interestFields.length > 0 && form.interestFields.every((s) => INTEREST_FIELDS.includes(s)) ? null : "choose",
  );
  set("proposal", length(tidyText(form.proposal), PARTNER_LIMITS.proposal));
  set("consent", form.consent ? null : "consent");
  return errors;
}

/**
 * "All fields" stands for every field, so it is exclusive: choosing it
 * clears the others, and choosing another field clears it.
 */
export function toggleInterest(current: InterestField[], value: InterestField): InterestField[] {
  if (current.includes(value)) return current.filter((v) => v !== value);
  if (value === "all") return ["all"];
  return [...current.filter((v) => v !== "all"), value];
}

export function toggleSupport(current: SupportType[], value: SupportType): SupportType[] {
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

/** Keeps the canonical order of a multi-select regardless of click order. */
export const inOrder = <T extends string>(all: readonly T[], values: readonly T[]) => all.filter((v) => values.includes(v));
