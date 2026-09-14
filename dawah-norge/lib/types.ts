export type UserRole = "member" | "board";

export type Gender = "woman" | "man";
export type FaithActivity = "unknown" | "active" | "inactive";
export type FollowUpStatus = "new" | "following_up" | "paused" | "closed";
export type ContactMethod = "phone" | "sms" | "whatsapp" | "in_person" | "email";
export type ContactOutcome =
  | "answered"
  | "no_answer"
  | "follow_up_wanted"
  | "invalid_number"
  | "no_more_contact";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface NewMuslim {
  id: string;
  name: string;
  phone: string;
  gender: Gender;
  city: string;
  shahadaLocation: string;
  shahadaDate: Date | null;
  preferredLanguage: string;
  preferredContact: ContactMethod;
  bestContactTime: string;
  notes: string;
  faithActivity: FaithActivity;
  followUpStatus: FollowUpStatus;
  consentConfirmed: boolean;
  consentMethod: "verbal" | "written" | "digital";
  contactCount: number;
  firstContactAt: Date | null;
  lastContactAt: Date | null;
  nextFollowUpAt: Date | null;
  createdAt: Date;
  createdByUid: string;
  createdByEmail: string;
  updatedAt: Date;
  updatedByEmail: string;
}

export interface ContactEntry {
  id: string;
  contactedAt: Date;
  method: ContactMethod;
  outcome: ContactOutcome;
  notes: string;
  nextFollowUpAt: Date | null;
  createdByUid: string;
  createdByEmail: string;
  createdAt: Date;
}

export interface PersonFormValues {
  name: string;
  phone: string;
  gender: Gender | "";
  city: string;
  shahadaLocation: string;
  shahadaDate: string;
  preferredLanguage: string;
  preferredContact: ContactMethod;
  bestContactTime: string;
  notes: string;
  faithActivity: FaithActivity;
  followUpStatus: FollowUpStatus;
  consentConfirmed: boolean;
  consentMethod: "verbal" | "written" | "digital";
}

export interface ContactFormValues {
  contactedAt: string;
  method: ContactMethod;
  outcome: ContactOutcome;
  notes: string;
  nextFollowUpAt: string;
}

export const emptyPersonForm: PersonFormValues = {
  name: "",
  phone: "",
  gender: "",
  city: "",
  shahadaLocation: "",
  shahadaDate: "",
  preferredLanguage: "Norsk",
  preferredContact: "phone",
  bestContactTime: "",
  notes: "",
  faithActivity: "unknown",
  followUpStatus: "new",
  consentConfirmed: false,
  consentMethod: "verbal",
};

export const emptyContactForm = (): ContactFormValues => ({
  contactedAt: new Date().toISOString().slice(0, 10),
  method: "phone",
  outcome: "answered",
  notes: "",
  nextFollowUpAt: "",
});
