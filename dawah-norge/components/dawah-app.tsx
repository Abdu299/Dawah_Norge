"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  Activity,
  BarChart3,
  BellRing,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileWarning,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  MessageSquarePlus,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  UserRoundCheck,
  Users,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ContactForm } from "@/components/contact-form";
import { PersonForm } from "@/components/person-form";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { auth, db, firebaseReady } from "@/lib/firebase";
import {
  AppUser,
  ContactEntry,
  ContactFormValues,
  FaithActivity,
  NewMuslim,
  PersonFormValues,
} from "@/lib/types";

type Screen = "overview" | "people" | "statistics" | "alerts" | "register";
type ListFilterValue = "all" | "never" | "once" | "twice" | "threePlus" | "active" | "inactive";

interface CityOption {
  key: string;
  label: string;
  count: number;
}

interface DistributionItem {
  key: string;
  label: string;
  count: number;
  percent: number;
}

interface StatisticsSummary {
  total: number;
  never: number;
  due: number;
  active: number;
  inactive: number;
  unknownActivity: number;
  newThisMonth: number;
  contacted: number;
  contactRate: number;
  totalContacts: number;
  averageContacts: number;
  averageFirstResponseDays: number | null;
  women: number;
  men: number;
  cities: CityOption[];
  genderDistribution: DistributionItem[];
  activityDistribution: DistributionItem[];
  contactDistribution: DistributionItem[];
  monthlyRegistrations: { key: string; label: string; count: number }[];
}

interface ExportPerson {
  person: NewMuslim;
  contacts: ContactEntry[];
}

const activityLabel: Record<FaithActivity, string> = {
  unknown: "Vet ikke",
  active: "Aktiv",
  inactive: "Ikke aktiv",
};

const methodLabel = {
  phone: "Telefonsamtale",
  sms: "SMS",
  whatsapp: "WhatsApp",
  in_person: "Fysisk møte",
  email: "E-post",
};

const outcomeLabel = {
  answered: "Svarte",
  no_answer: "Svarte ikke",
  follow_up_wanted: "Ønsker videre oppfølging",
  invalid_number: "Nummeret virker ikke",
  no_more_contact: "Ønsker ikke mer kontakt",
};

const statusLabel = {
  new: "Ny",
  following_up: "Under oppfølging",
  paused: "Satt på pause",
  closed: "Avsluttet",
};

const consentMethodLabel = {
  verbal: "Muntlig",
  written: "Skriftlig",
  digital: "Digitalt",
};

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function normalizeCity(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word
      ? `${word.slice(0, 1).toLocaleUpperCase("nb-NO")}${word.slice(1).toLocaleLowerCase("nb-NO")}`
      : word)
    .join(" ");
}

function cityKey(value: string): string {
  return value.trim().toLocaleLowerCase("nb-NO");
}

function toExportDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function csvCell(value: string | number | boolean | null | undefined): string {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadFile(contents: BlobPart, type: string, filename: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function asDate(value: unknown, fallback: Date | null = null): Date | null {
  if (!value) return fallback;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return fallback;
}

function localDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function formatDate(value: Date | null): string {
  if (!value) return "Ikke satt";
  return new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric" }).format(value);
}

function formatDateTime(value: Date | null): string {
  if (!value) return "Ikke satt";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function toInputDate(value: Date | null): string {
  if (!value) return "";
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function daysSince(value: Date): number {
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 86_400_000));
}

function isPast(value: Date | null): boolean {
  if (!value) return false;
  const endOfDay = new Date(value);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.getTime() < Date.now();
}

function attentionFor(person: NewMuslim) {
  if (person.followUpStatus === "closed") return null;
  if (person.nextFollowUpAt && isPast(person.nextFollowUpAt)) {
    return { level: "red" as const, text: "Oppfølging er forsinket" };
  }
  if (person.contactCount > 0) return null;
  const days = daysSince(person.createdAt);
  if (days >= 30) return { level: "red" as const, text: `Ikke kontaktet på ${days} dager` };
  if (days >= 14) return { level: "orange" as const, text: `Ikke kontaktet på ${days} dager` };
  if (days >= 7) return { level: "yellow" as const, text: `Ikke kontaktet på ${days} dager` };
  return null;
}

function summarizePeople(people: NewMuslim[]): StatisticsSummary {
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const cityMap = new Map<string, CityOption>();
  for (const person of people) {
    const label = normalizeCity(person.city) || "Ukjent by";
    const key = cityKey(label);
    const current = cityMap.get(key);
    cityMap.set(key, { key, label, count: (current?.count ?? 0) + 1 });
  }

  const cities = [...cityMap.values()].sort((a, b) =>
    b.count - a.count || a.label.localeCompare(b.label, "nb-NO"),
  );
  const total = people.length;
  const women = people.filter((person) => person.gender === "woman").length;
  const men = people.filter((person) => person.gender === "man").length;
  const active = people.filter((person) => person.faithActivity === "active").length;
  const inactive = people.filter((person) => person.faithActivity === "inactive").length;
  const unknownActivity = total - active - inactive;
  const never = people.filter((person) => person.contactCount === 0).length;
  const once = people.filter((person) => person.contactCount === 1).length;
  const twice = people.filter((person) => person.contactCount === 2).length;
  const threePlus = people.filter((person) => person.contactCount >= 3).length;
  const totalContacts = people.reduce((sum, person) => sum + person.contactCount, 0);
  const firstResponseDays = people
    .filter((person) => person.firstContactAt)
    .map((person) => Math.max(0, Math.round(
      ((person.firstContactAt?.getTime() ?? person.createdAt.getTime()) - person.createdAt.getTime()) / 86_400_000,
    )));

  const monthlyRegistrations = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - (5 - index));
    const year = date.getFullYear();
    const month = date.getMonth();
    return {
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("nb-NO", { month: "short" }).format(date).replace(".", ""),
      count: people.filter((person) => {
        const value = person.shahadaDate ?? person.createdAt;
        return value.getFullYear() === year && value.getMonth() === month;
      }).length,
    };
  });

  return {
    total,
    never,
    due: people.filter((person) => attentionFor(person)?.level === "red").length,
    active,
    inactive,
    unknownActivity,
    newThisMonth: people.filter((person) => person.createdAt >= thisMonth).length,
    contacted: total - never,
    contactRate: percentage(total - never, total),
    totalContacts,
    averageContacts: total > 0 ? Math.round((totalContacts / total) * 10) / 10 : 0,
    averageFirstResponseDays: firstResponseDays.length > 0
      ? Math.round((firstResponseDays.reduce((sum, days) => sum + days, 0) / firstResponseDays.length) * 10) / 10
      : null,
    women,
    men,
    cities,
    genderDistribution: [
      { key: "woman", label: "Kvinner", count: women, percent: percentage(women, total) },
      { key: "man", label: "Menn", count: men, percent: percentage(men, total) },
    ],
    activityDistribution: [
      { key: "active", label: "Aktive", count: active, percent: percentage(active, total) },
      { key: "inactive", label: "Ikke aktive", count: inactive, percent: percentage(inactive, total) },
      { key: "unknown", label: "Vet ikke", count: unknownActivity, percent: percentage(unknownActivity, total) },
    ],
    contactDistribution: [
      { key: "never", label: "Aldri kontaktet", count: never, percent: percentage(never, total) },
      { key: "once", label: "Kontaktet 1 gang", count: once, percent: percentage(once, total) },
      { key: "twice", label: "Kontaktet 2 ganger", count: twice, percent: percentage(twice, total) },
      { key: "threePlus", label: "Kontaktet 3+ ganger", count: threePlus, percent: percentage(threePlus, total) },
    ],
    monthlyRegistrations,
  };
}

function personFromSnapshot(id: string, data: Record<string, unknown>): NewMuslim {
  const now = new Date();
  return {
    id,
    name: String(data.name ?? "Uten navn"),
    phone: String(data.phone ?? ""),
    gender: data.gender === "man" ? "man" : "woman",
    city: String(data.city ?? ""),
    shahadaDate: asDate(data.shahadaDate),
    preferredLanguage: String(data.preferredLanguage ?? ""),
    preferredContact: (data.preferredContact as NewMuslim["preferredContact"]) ?? "phone",
    bestContactTime: String(data.bestContactTime ?? ""),
    notes: String(data.notes ?? ""),
    faithActivity: (data.faithActivity as FaithActivity) ?? "unknown",
    followUpStatus: (data.followUpStatus as NewMuslim["followUpStatus"]) ?? "new",
    consentConfirmed: data.consentConfirmed === true,
    consentMethod: (data.consentMethod as NewMuslim["consentMethod"]) ?? "verbal",
    contactCount: Number(data.contactCount ?? 0),
    firstContactAt: asDate(data.firstContactAt),
    lastContactAt: asDate(data.lastContactAt),
    nextFollowUpAt: asDate(data.nextFollowUpAt),
    createdAt: asDate(data.createdAt, now) ?? now,
    createdByUid: String(data.createdByUid ?? ""),
    createdByEmail: String(data.createdByEmail ?? ""),
    updatedAt: asDate(data.updatedAt, now) ?? now,
    updatedByEmail: String(data.updatedByEmail ?? ""),
  };
}

function contactFromSnapshot(id: string, data: Record<string, unknown>): ContactEntry {
  const now = new Date();
  return {
    id,
    contactedAt: asDate(data.contactedAt, now) ?? now,
    method: (data.method as ContactEntry["method"]) ?? "phone",
    outcome: (data.outcome as ContactEntry["outcome"]) ?? "answered",
    notes: String(data.notes ?? ""),
    nextFollowUpAt: asDate(data.nextFollowUpAt),
    createdByUid: String(data.createdByUid ?? ""),
    createdByEmail: String(data.createdByEmail ?? ""),
    createdAt: asDate(data.createdAt, now) ?? now,
  };
}

function dateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function dateDaysAhead(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

const demoPeople: NewMuslim[] = [
  {
    id: "demo-1",
    name: "Amina H.",
    phone: "+47 900 00 001",
    gender: "woman",
    city: "Oslo",
    shahadaDate: dateDaysAgo(38),
    preferredLanguage: "Norsk",
    preferredContact: "phone",
    bestContactTime: "Etter kl. 17",
    notes: "Ønsker informasjon om søsteraktiviteter.",
    faithActivity: "unknown",
    followUpStatus: "new",
    consentConfirmed: true,
    consentMethod: "written",
    contactCount: 0,
    firstContactAt: null,
    lastContactAt: null,
    nextFollowUpAt: null,
    createdAt: dateDaysAgo(35),
    createdByUid: "demo-member",
    createdByEmail: "medlem@demo.no",
    updatedAt: dateDaysAgo(35),
    updatedByEmail: "medlem@demo.no",
  },
  {
    id: "demo-2",
    name: "Yusuf M.",
    phone: "+47 900 00 002",
    gender: "man",
    city: "Drammen",
    shahadaDate: dateDaysAgo(24),
    preferredLanguage: "Engelsk",
    preferredContact: "whatsapp",
    bestContactTime: "Kveld",
    notes: "",
    faithActivity: "active",
    followUpStatus: "following_up",
    consentConfirmed: true,
    consentMethod: "verbal",
    contactCount: 2,
    firstContactAt: dateDaysAgo(20),
    lastContactAt: dateDaysAgo(8),
    nextFollowUpAt: dateDaysAhead(7),
    createdAt: dateDaysAgo(23),
    createdByUid: "demo-member",
    createdByEmail: "medlem@demo.no",
    updatedAt: dateDaysAgo(8),
    updatedByEmail: "styret@demo.no",
  },
  {
    id: "demo-3",
    name: "Sara L.",
    phone: "+47 900 00 003",
    gender: "woman",
    city: "Bergen",
    shahadaDate: dateDaysAgo(76),
    preferredLanguage: "Norsk",
    preferredContact: "sms",
    bestContactTime: "Helg",
    notes: "Deltar på ukentlig samling.",
    faithActivity: "active",
    followUpStatus: "following_up",
    consentConfirmed: true,
    consentMethod: "digital",
    contactCount: 3,
    firstContactAt: dateDaysAgo(70),
    lastContactAt: dateDaysAgo(32),
    nextFollowUpAt: dateDaysAgo(2),
    createdAt: dateDaysAgo(74),
    createdByUid: "demo-member",
    createdByEmail: "medlem@demo.no",
    updatedAt: dateDaysAgo(32),
    updatedByEmail: "styret@demo.no",
  },
  {
    id: "demo-4",
    name: "Adam R.",
    phone: "+47 900 00 004",
    gender: "man",
    city: "Trondheim",
    shahadaDate: dateDaysAgo(5),
    preferredLanguage: "Engelsk",
    preferredContact: "phone",
    bestContactTime: "Ettermiddag",
    notes: "",
    faithActivity: "unknown",
    followUpStatus: "new",
    consentConfirmed: true,
    consentMethod: "written",
    contactCount: 0,
    firstContactAt: null,
    lastContactAt: null,
    nextFollowUpAt: null,
    createdAt: dateDaysAgo(4),
    createdByUid: "demo-member",
    createdByEmail: "medlem@demo.no",
    updatedAt: dateDaysAgo(4),
    updatedByEmail: "medlem@demo.no",
  },
];

const demoContactSeed: Record<string, ContactEntry[]> = {
  "demo-2": [
    {
      id: "contact-2",
      contactedAt: dateDaysAgo(8),
      method: "whatsapp",
      outcome: "follow_up_wanted",
      notes: "Ønsker invitasjon til neste aktivitet.",
      nextFollowUpAt: dateDaysAhead(7),
      createdByUid: "demo-board",
      createdByEmail: "styret@demo.no",
      createdAt: dateDaysAgo(8),
    },
    {
      id: "contact-1",
      contactedAt: dateDaysAgo(20),
      method: "phone",
      outcome: "answered",
      notes: "Første samtale gjennomført.",
      nextFollowUpAt: dateDaysAgo(8),
      createdByUid: "demo-board",
      createdByEmail: "styret@demo.no",
      createdAt: dateDaysAgo(20),
    },
  ],
};

function valuesFromPerson(person: NewMuslim): PersonFormValues {
  return {
    name: person.name,
    phone: person.phone,
    gender: person.gender,
    city: person.city,
    shahadaDate: toInputDate(person.shahadaDate),
    preferredLanguage: person.preferredLanguage,
    preferredContact: person.preferredContact,
    bestContactTime: person.bestContactTime,
    notes: person.notes,
    faithActivity: person.faithActivity,
    followUpStatus: person.followUpStatus,
    consentConfirmed: person.consentConfirmed,
    consentMethod: person.consentMethod,
  };
}

function personPayload(values: PersonFormValues, user: AppUser) {
  return {
    name: values.name.trim(),
    phone: values.phone.trim(),
    gender: values.gender,
    city: normalizeCity(values.city),
    shahadaDate: Timestamp.fromDate(localDate(values.shahadaDate)),
    preferredLanguage: values.preferredLanguage.trim(),
    preferredContact: values.preferredContact,
    bestContactTime: values.bestContactTime.trim(),
    notes: values.notes.trim(),
    faithActivity: values.faithActivity,
    followUpStatus: values.followUpStatus,
    consentConfirmed: values.consentConfirmed,
    consentMethod: values.consentMethod,
    updatedAt: serverTimestamp(),
    updatedByEmail: user.email,
  };
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[#143f37] text-sm font-bold tracking-[-0.04em] text-white shadow-[0_7px_18px_rgba(20,63,55,0.2)]">
        DN
      </div>
      {!compact ? (
        <div>
          <p className="text-[0.98rem] font-bold leading-tight tracking-[-0.02em] text-[#143f37]">Dawah Norge</p>
          <p className="text-xs text-[#6d7b76]">Oppfølging</p>
        </div>
      ) : null}
    </div>
  );
}

function LoginScreen({
  onDemo,
  onDemoMember,
}: {
  onDemo: () => void;
  onDemoMember: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!firebaseReady || !auth) {
      setError("Firebase er ikke koblet til ennå. Bruk demoversjonen mens oppsettet fullføres.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setError("E-post eller passord er feil. Kontroller opplysningene og prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setError("");
    setMessage("");
    if (!firebaseReady || !auth) {
      setError("Firebase må kobles til før passord kan tilbakestilles.");
      return;
    }
    if (!email.trim()) {
      setError("Skriv inn e-postadressen din først.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("Vi har sendt en lenke for å lage nytt passord.");
    } catch {
      setError("Vi kunne ikke sende e-posten. Kontroller adressen.");
    }
  };

  return (
    <main className="login-shell min-h-dvh">
      <div className="login-grid" aria-hidden="true" />
      <section className="relative z-10 mx-auto grid min-h-dvh w-full max-w-[1180px] items-center gap-12 px-5 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-10">
        <div className="hidden max-w-xl lg:block">
          <BrandMark />
          <p className="mt-16 text-sm font-semibold uppercase tracking-[0.18em] text-[#307866]">Trygg oppfølging</p>
          <h1 className="mt-5 text-[clamp(2.7rem,5vw,4.7rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-[#123a33]">
            Ingen skal bli glemt etter sin shahada.
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-[#586c65]">
            Ett samlet og sikkert sted for registrering, kontakt og videre oppfølging i Dawah Norge.
          </p>
          <div className="mt-12 flex gap-7 border-t border-[#cddbd6] pt-7 text-sm text-[#536760]">
            <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#2f7b68]" /> Personlig innlogging</span>
            <span className="flex items-center gap-2"><UserRoundCheck className="size-4 text-[#2f7b68]" /> Begrenset tilgang</span>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 lg:hidden"><BrandMark /></div>
          <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_26px_80px_rgba(18,58,51,0.13)] backdrop-blur sm:p-9">
            <div className="mb-8">
              <p className="text-sm font-semibold text-[#307866]">Kun for godkjente brukere</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#153e37]">Logg inn</h2>
              <p className="mt-2 text-sm leading-6 text-[#6b7975]">Bruk kontoen du har fått fra Dawah Norge.</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-semibold text-[#264c45]">E-post</label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="navn@eksempel.no"
                  autoComplete="email"
                  className="h-12"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-semibold text-[#264c45]">Passord</label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Skriv inn passord"
                    autoComplete="current-password"
                    className="h-12 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#70807b] hover:bg-[#eef4f1]"
                    aria-label={showPassword ? "Skjul passord" : "Vis passord"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error ? <p role="alert" className="rounded-xl bg-[#fff0ee] px-4 py-3 text-sm leading-5 text-[#993c33]">{error}</p> : null}
              {message ? <p role="status" className="rounded-xl bg-[#edf8f3] px-4 py-3 text-sm leading-5 text-[#19644a]">{message}</p> : null}

              <Button type="submit" disabled={loading} className="h-12 w-full bg-[#143f37] text-base text-white hover:bg-[#0f312b]">
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {loading ? "Logger inn …" : "Logg inn"}
              </Button>
              <button type="button" onClick={resetPassword} className="w-full text-sm font-medium text-[#356e61] hover:underline">
                Glemt passord?
              </button>
            </form>

            {!firebaseReady ? (
              <div className="mt-7 border-t border-[#e1e9e6] pt-6">
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#85918d]">Forhåndsvisning</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={onDemo} className="border-[#c9d9d4] text-[#24584c]">
                    Se styredemo
                  </Button>
                  <Button type="button" variant="outline" onClick={onDemoMember} className="border-[#c9d9d4] text-[#24584c]">
                    Se medlemsskjema
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <p className="mt-6 text-center text-xs leading-5 text-[#73817c]">Ikke del innloggingen din med andre.</p>
        </div>
      </section>
    </main>
  );
}

function AccessPending({ email, onLogout }: { email: string; onLogout: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f2f6f4] px-5">
      <div className="w-full max-w-md rounded-[26px] border border-[#dce7e3] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff3e2] text-[#a66321]">
          <FileWarning className="size-6" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[#173f38]">Kontoen mangler tilgang</h1>
        <p className="mt-3 text-sm leading-6 text-[#687873]">
          Kontoen <strong>{email}</strong> finnes, men er ikke godkjent som medlem eller styremedlem ennå. Be systemansvarlig legge kontoen til i Firebase.
        </p>
        <Button variant="outline" onClick={onLogout} className="mt-6">Logg ut</Button>
      </div>
    </main>
  );
}

function MemberRegistration({ user, onLogout, demo }: { user: AppUser; onLogout: () => void; demo: boolean }) {
  const [complete, setComplete] = useState(false);

  const createPerson = async (values: PersonFormValues) => {
    if (demo) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      setComplete(true);
      return;
    }
    if (!db) throw new Error("Databasen er ikke tilgjengelig.");
    await addDoc(collection(db, "newMuslims"), {
      ...personPayload(values, user),
      contactCount: 0,
      firstContactAt: null,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: serverTimestamp(),
      createdByUid: user.uid,
      createdByEmail: user.email,
    });
    setComplete(true);
  };

  return (
    <div className="min-h-dvh bg-[#f2f6f4]">
      <header className="border-b border-[#dce7e3] bg-white">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5 sm:px-8">
          <BrandMark />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="max-w-[190px] gap-2 text-[#375b53]">
                <span className="truncate">{user.displayName}</span>
                <Menu className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onLogout}><LogOut className="size-4" /> Logg ut</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        {demo ? (
          <div className="mb-5 rounded-xl border border-[#ecd8ae] bg-[#fff9e9] px-4 py-3 text-sm text-[#76531d]">
            Dette er en demoversjon. Ingenting blir lagret.
          </div>
        ) : null}
        <div className="mb-8">
          <p className="text-sm font-semibold text-[#357363]">Ny registrering</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#143f37] sm:text-4xl">Registrer en ny muslim</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#64736e]">
            Fyll inn opplysningene personen har samtykket til å dele. Styret vil ta over oppfølgingen etter innsending.
          </p>
        </div>

        {complete ? (
          <div className="mb-7 flex items-start gap-3 rounded-2xl border border-[#b9ddce] bg-[#eaf7f1] p-5 text-[#175e47]">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Registreringen er sendt til styret</p>
              <p className="mt-1 text-sm leading-6">Takk. Styret kan nå se opplysningene og følge opp personen.</p>
            </div>
          </div>
        ) : null}

        <section className="rounded-[24px] border border-[#dce7e3] bg-white p-5 shadow-[0_12px_35px_rgba(22,63,56,0.05)] sm:p-8">
          <PersonForm onSubmit={createPerson} onSuccess={() => setComplete(true)} />
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "green",
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "green" | "red" | "amber" | "blue";
  onClick?: () => void;
}) {
  const tones = {
    green: "bg-[#e9f5f0] text-[#216a57]",
    red: "bg-[#fff0ee] text-[#a84439]",
    amber: "bg-[#fff5df] text-[#a66a18]",
    blue: "bg-[#edf4f8] text-[#416d83]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-[20px] border border-[#dce6e2] bg-white p-5 text-left shadow-[0_8px_25px_rgba(20,63,55,0.045)] transition hover:-translate-y-0.5 hover:border-[#bfd3cc] hover:shadow-[0_12px_30px_rgba(20,63,55,0.08)]"
    >
      <div className="flex items-start justify-between">
        <span className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}>{icon}</span>
        <ChevronRight className="size-4 text-[#a1aca8] transition group-hover:translate-x-0.5" />
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-[#173f38]">{value}</p>
      <p className="mt-1 text-sm font-medium text-[#697873]">{label}</p>
    </button>
  );
}

function ActivityBadge({ value }: { value: FaithActivity }) {
  const classes = {
    active: "border-[#b6dacd] bg-[#eaf7f1] text-[#1d6a51]",
    inactive: "border-[#ead2ce] bg-[#fff2ef] text-[#9b443a]",
    unknown: "border-[#d9dfdc] bg-[#f3f5f4] text-[#65716d]",
  };
  return <Badge variant="outline" className={classes[value]}>{activityLabel[value]}</Badge>;
}

function ContactBadge({ count }: { count: number }) {
  if (count === 0) return <Badge variant="outline" className="border-[#e7c5c0] bg-[#fff2f0] text-[#9b4137]">Aldri kontaktet</Badge>;
  return <Badge variant="outline" className="border-[#c7ddd5] bg-[#eef7f3] text-[#316b5b]">Kontaktet {count} {count === 1 ? "gang" : "ganger"}</Badge>;
}

function PersonRow({ person, onOpen }: { person: NewMuslim; onOpen: () => void }) {
  const attention = attentionFor(person);
  return (
    <TableRow onClick={onOpen} className="cursor-pointer border-[#e4ebe8] hover:bg-[#f6faf8]">
      <TableCell className="py-4">
        <div className="flex items-center gap-3">
          <span className={`grid size-9 place-items-center rounded-full text-sm font-bold ${person.gender === "woman" ? "bg-[#f4eefa] text-[#72518e]" : "bg-[#eaf3f8] text-[#416b81]"}`}>
            {person.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="font-semibold text-[#1d443d]">{person.name}</p>
            <p className="mt-0.5 text-xs text-[#7b8884]">Registrert {formatDate(person.createdAt)}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-[#50645e]">{person.city}</TableCell>
      <TableCell><ContactBadge count={person.contactCount} /></TableCell>
      <TableCell><ActivityBadge value={person.faithActivity} /></TableCell>
      <TableCell>
        {attention ? (
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${attention.level === "red" ? "text-[#b23f35]" : attention.level === "orange" ? "text-[#aa641a]" : "text-[#91701d]"}`}>
            <CircleAlert className="size-4" /> {attention.text}
          </span>
        ) : (
          <span className="text-sm text-[#73817c]">Ingen varsel</span>
        )}
      </TableCell>
      <TableCell className="text-right"><ChevronRight className="ml-auto size-4 text-[#8b9994]" /></TableCell>
    </TableRow>
  );
}

function PersonCard({ person, onOpen }: { person: NewMuslim; onOpen: () => void }) {
  const attention = attentionFor(person);
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-2xl border border-[#dde7e3] bg-white p-4 text-left shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#1c433b]">{person.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[#6d7c77]"><MapPin className="size-3.5" /> {person.city}</p>
        </div>
        <ChevronRight className="mt-1 size-4 text-[#8a9893]" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ContactBadge count={person.contactCount} />
        <ActivityBadge value={person.faithActivity} />
      </div>
      {attention ? (
        <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${attention.level === "red" ? "bg-[#fff0ee] text-[#a43d34]" : "bg-[#fff7e5] text-[#95631b]"}`}>
          <CircleAlert className="size-4" /> {attention.text}
        </div>
      ) : null}
    </button>
  );
}

function DistributionRow({
  item,
  color,
  onClick,
}: {
  item: DistributionItem;
  color: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[#385950]">{item.label}</span>
        <span className="shrink-0 text-[#697a74]">
          <strong className="font-semibold text-[#244b43]">{item.count}</strong> · {item.percent} %
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf2f0]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${item.percent}%` }} />
      </div>
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className="block w-full rounded-xl p-2 text-left transition hover:bg-[#f4f8f6]">
      {content}
    </button>
  ) : (
    <div className="p-2">{content}</div>
  );
}

function StatisticsView({
  summary,
  loading,
  exporting,
  onExport,
  onCityOpen,
  onFilterOpen,
}: {
  summary: StatisticsSummary;
  loading: boolean;
  exporting: boolean;
  onExport: () => void;
  onCityOpen: (city: CityOption) => void;
  onFilterOpen: (filter: ListFilterValue) => void;
}) {
  const maxMonth = Math.max(1, ...summary.monthlyRegistrations.map((item) => item.count));
  const maxCity = Math.max(1, ...summary.cities.map((item) => item.count));

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-[#357363]">Hele organisasjonen</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[#173f38]">Detaljert statistikk</h2>
          <p className="mt-2 text-sm leading-6 text-[#687873]">Tallene oppdateres automatisk fra personlisten og kontakthistorikken.</p>
        </div>
        <Button variant="outline" onClick={onExport} disabled={exporting || loading} className="gap-2 border-[#c8d9d3] bg-white text-[#285f52]">
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
          Last ned til Excel
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Registrerte totalt", value: summary.total, detail: "personer" },
          { label: "Byer / avdelinger", value: summary.cities.length, detail: "med registreringer" },
          { label: "Har blitt kontaktet", value: `${summary.contactRate} %`, detail: `${summary.contacted} av ${summary.total}` },
          { label: "Gjennomsnittlig kontakt", value: summary.averageContacts.toLocaleString("nb-NO"), detail: `${summary.totalContacts} kontaktforsøk totalt` },
        ].map((item) => (
          <div key={item.label} className="rounded-[20px] border border-[#dce6e2] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6d7d77]">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#173f38]">{item.value}</p>
            <p className="mt-1 text-xs text-[#7b8984]">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[22px] border border-[#dce6e2] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-[#1c453d]">Shahadaer siste seks måneder</h3>
              <p className="mt-1 text-sm text-[#71807b]">Basert på registrert shahada-dato</p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e9f5f0] text-[#276b59]"><BarChart3 className="size-5" /></span>
          </div>
          <div className="mt-8 flex h-52 items-end gap-3 border-b border-[#dfe8e4] px-1">
            {summary.monthlyRegistrations.map((item) => (
              <div key={item.key} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
                <span className="mb-2 text-xs font-semibold text-[#315d53]">{item.count}</span>
                <div
                  className="mx-auto w-full max-w-12 rounded-t-lg bg-[#4f927f] transition-all"
                  style={{ height: item.count > 0 ? `${Math.max(10, (item.count / maxMonth) * 100)}%` : "4px" }}
                />
                <span className="mt-2 pb-2 text-xs capitalize text-[#73817c]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-[#dce6e2] bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-semibold text-[#1c453d]">Kjønnsfordeling</h3>
          <p className="mt-1 text-sm text-[#71807b]">Antall og prosent av alle registrerte</p>
          <div className="mt-6 space-y-4">
            {summary.genderDistribution.map((item, index) => (
              <DistributionRow key={item.key} item={item} color={index === 0 ? "bg-[#8b6caf]" : "bg-[#4f8098]"} />
            ))}
          </div>
          <div className="mt-7 rounded-2xl bg-[#f3f7f5] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#74837e]">Første kontakt</p>
            <p className="mt-2 text-2xl font-semibold text-[#214a41]">
              {summary.averageFirstResponseDays === null ? "Ikke nok data" : `${summary.averageFirstResponseDays.toLocaleString("nb-NO")} dager`}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#74837e]">Gjennomsnitt fra registrering til første registrerte kontakt.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[22px] border border-[#dce6e2] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-[#1c453d]">Byer og avdelinger</h3>
              <p className="mt-1 text-sm text-[#71807b]">Klikk på en by for å åpne personlisten</p>
            </div>
            <Building2 className="size-5 text-[#4b7f71]" />
          </div>
          <div className="mt-5 space-y-1">
            {summary.cities.map((city, index) => (
              <button key={city.key} type="button" onClick={() => onCityOpen(city)} className="group block w-full rounded-xl p-2 text-left transition hover:bg-[#f4f8f6]">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[#385950]"><span className="mr-2 text-xs text-[#96a39e]">{index + 1}</span>{city.label}</span>
                  <span className="shrink-0 text-[#697a74]"><strong className="font-semibold text-[#244b43]">{city.count}</strong> · {percentage(city.count, summary.total)} %</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf2f0]">
                  <div className="h-full rounded-full bg-[#5d9887]" style={{ width: `${(city.count / maxCity) * 100}%` }} />
                </div>
              </button>
            ))}
            {summary.cities.length === 0 ? <p className="py-10 text-center text-sm text-[#74827e]">Ingen byer er registrert ennå.</p> : null}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[22px] border border-[#dce6e2] bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-lg font-semibold text-[#1c453d]">Kontaktoppfølging</h3>
            <p className="mt-1 text-sm text-[#71807b]">Klikk på en gruppe for å åpne listen</p>
            <div className="mt-5 space-y-1">
              {summary.contactDistribution.map((item) => (
                <DistributionRow key={item.key} item={item} color="bg-[#d09238]" onClick={() => onFilterOpen(item.key as ListFilterValue)} />
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-[#dce6e2] bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-lg font-semibold text-[#1c453d]">Aktivitet i islam</h3>
            <p className="mt-1 text-sm text-[#71807b]">Status satt av styret</p>
            <div className="mt-5 space-y-1">
              {summary.activityDistribution.map((item) => (
                <DistributionRow
                  key={item.key}
                  item={item}
                  color={item.key === "active" ? "bg-[#42826e]" : item.key === "inactive" ? "bg-[#bf665b]" : "bg-[#97a39f]"}
                  onClick={item.key === "active" || item.key === "inactive" ? () => onFilterOpen(item.key as ListFilterValue) : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PeopleList({
  people,
  total,
  loading,
  search,
  setSearch,
  filter,
  setFilter,
  cities,
  cityFilter,
  setCityFilter,
  exporting,
  onExport,
  onOpen,
}: {
  people: NewMuslim[];
  total: number;
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  filter: ListFilterValue;
  setFilter: (value: ListFilterValue) => void;
  cities: CityOption[];
  cityFilter: string;
  setCityFilter: (value: string) => void;
  exporting: boolean;
  onExport: () => void;
  onOpen: (person: NewMuslim) => void;
}) {
  const filters: { value: ListFilterValue; label: string }[] = [
    { value: "all", label: "Alle" },
    { value: "never", label: "Aldri kontaktet" },
    { value: "once", label: "1 gang" },
    { value: "twice", label: "2 ganger" },
    { value: "threePlus", label: "3+ ganger" },
    { value: "active", label: "Aktive" },
    { value: "inactive", label: "Ikke aktive" },
  ];

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[#173f38]">Personer</h2>
          <p className="mt-1 text-sm text-[#6c7a76]">{people.length} av {total} vises i listen</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#82908b]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Søk navn, telefon eller by"
              className="h-11 bg-white pl-10"
            />
          </div>
          <Button variant="outline" onClick={onExport} disabled={exporting || loading} className="h-11 gap-2 border-[#c8d9d3] bg-white text-[#285f52]">
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
            Eksporter alle
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#d8e4df] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#244b43]">By / avdeling</p>
          <p className="mt-0.5 text-xs text-[#74827e]">Listen inneholder bare byer som finnes i registreringene.</p>
        </div>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-full bg-[#f8faf9] sm:w-64" aria-label="Filtrer etter by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle byer ({total})</SelectItem>
            {cities.slice().sort((a, b) => a.label.localeCompare(b.label, "nb-NO")).map((city) => (
              <SelectItem key={city.key} value={city.key}>{city.label} ({city.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="scrollbar-none mt-5 flex gap-2 overflow-x-auto pb-2">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${filter === item.value ? "border-[#143f37] bg-[#143f37] text-white" : "border-[#d9e4e0] bg-white text-[#5b6d67] hover:border-[#adc7be]"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-5 space-y-3 rounded-2xl border border-[#dce6e2] bg-white p-5">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-14 w-full" />)}
        </div>
      ) : people.length === 0 ? (
        <div className="mt-5 rounded-[22px] border border-dashed border-[#cbdad5] bg-white px-6 py-14 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#edf5f2] text-[#3e7466]"><Search className="size-5" /></div>
          <p className="mt-4 font-semibold text-[#254b44]">Ingen personer funnet</p>
          <p className="mt-1 text-sm text-[#74827e]">Prøv et annet søk eller filter.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 hidden overflow-hidden rounded-[20px] border border-[#dce6e2] bg-white shadow-sm md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-[#e2eae7] bg-[#f7faf9] hover:bg-[#f7faf9]">
                  <TableHead className="pl-5">Navn</TableHead>
                  <TableHead>By / avdeling</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Aktivitet</TableHead>
                  <TableHead>Oppmerksomhet</TableHead>
                  <TableHead><span className="sr-only">Åpne</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => <PersonRow key={person.id} person={person} onOpen={() => onOpen(person)} />)}
              </TableBody>
            </Table>
          </div>
          <div className="mt-5 space-y-3 md:hidden">
            {people.map((person) => <PersonCard key={person.id} person={person} onOpen={() => onOpen(person)} />)}
          </div>
        </>
      )}
    </section>
  );
}

function BoardApp({ user, onLogout, demo }: { user: AppUser; onLogout: () => void; demo: boolean }) {
  const [screen, setScreen] = useState<Screen>("overview");
  const [people, setPeople] = useState<NewMuslim[]>(demo ? demoPeople : []);
  const [loading, setLoading] = useState(!demo);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ListFilterValue>("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [selected, setSelected] = useState<NewMuslim | null>(null);
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [demoContacts, setDemoContacts] = useState<Record<string, ContactEntry[]>>(demoContactSeed);
  const [addOpen, setAddOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (demo || !db) return;
    const peopleQuery = query(collection(db, "newMuslims"), orderBy("createdAt", "desc"));
    return onSnapshot(
      peopleQuery,
      (snapshot) => {
        setPeople(snapshot.docs.map((item) => personFromSnapshot(item.id, item.data())));
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast.error("Listen kunne ikke lastes. Kontroller Firebase-reglene.");
      },
    );
  }, [demo]);

  useEffect(() => {
    if (!selected) {
      setContacts([]);
      return;
    }
    if (demo) {
      setContacts(demoContacts[selected.id] ?? []);
      return;
    }
    if (!db) return;
    const contactsQuery = query(collection(db, "newMuslims", selected.id, "contacts"), orderBy("contactedAt", "desc"));
    return onSnapshot(contactsQuery, (snapshot) => {
      setContacts(snapshot.docs.map((item) => contactFromSnapshot(item.id, item.data())));
    });
  }, [selected, demo, demoContacts]);

  const stats = useMemo(() => summarizePeople(people), [people]);

  useEffect(() => {
    if (cityFilter !== "all" && !stats.cities.some((city) => city.key === cityFilter)) {
      setCityFilter("all");
    }
  }, [cityFilter, stats.cities]);

  const filteredPeople = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("nb-NO");
    return people.filter((person) => {
      const matchesSearch = !term || [person.name, person.phone, person.city]
        .some((value) => value.toLocaleLowerCase("nb-NO").includes(term));
      const personCityKey = cityKey(normalizeCity(person.city) || "Ukjent by");
      const matchesCity = cityFilter === "all" || cityFilter === personCityKey;
      const matchesFilter =
        filter === "all" ||
        (filter === "never" && person.contactCount === 0) ||
        (filter === "once" && person.contactCount === 1) ||
        (filter === "twice" && person.contactCount === 2) ||
        (filter === "threePlus" && person.contactCount >= 3) ||
        (filter === "active" && person.faithActivity === "active") ||
        (filter === "inactive" && person.faithActivity === "inactive");
      return matchesSearch && matchesCity && matchesFilter;
    });
  }, [people, search, filter, cityFilter]);

  const alertPeople = useMemo(
    () => people.filter((person) => attentionFor(person)).sort((a, b) => {
      const aRed = attentionFor(a)?.level === "red" ? 0 : 1;
      const bRed = attentionFor(b)?.level === "red" ? 0 : 1;
      return aRed - bRed || a.createdAt.getTime() - b.createdAt.getTime();
    }),
    [people],
  );

  const navigate = (next: Screen, nextFilter?: ListFilterValue) => {
    setScreen(next);
    if (nextFilter) setFilter(nextFilter);
    setMobileMenuOpen(false);
  };

  const openCity = (city: CityOption) => {
    setSearch("");
    setCityFilter(city.key);
    navigate("people", "all");
  };

  const openFilter = (nextFilter: ListFilterValue) => {
    setSearch("");
    setCityFilter("all");
    navigate("people", nextFilter);
  };

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool(
        {
          name: "start_new_registration",
          title: "Start ny registrering",
          description: "Åpner skjemaet for å registrere en ny muslim. Brukeren må selv fylle inn og bekrefte samtykke før noe lagres.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            navigate("register");
            return { opened: true, screen: "register" };
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: "show_follow_up_alerts",
          title: "Vis oppfølgingsvarsler",
          description: "Åpner listen over personer som trenger oppfølging.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            navigate("alerts");
            return { opened: true, screen: "alerts", alertCount: alertPeople.length };
          },
        },
        { signal: lifecycle.signal },
      );
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [alertPeople.length]);

  const createPerson = async (values: PersonFormValues) => {
    if (demo) {
      const now = new Date();
      const person: NewMuslim = {
        id: `demo-${Date.now()}`,
        ...values,
        gender: values.gender || "woman",
        shahadaDate: localDate(values.shahadaDate),
        preferredLanguage: values.preferredLanguage.trim(),
        name: values.name.trim(),
        phone: values.phone.trim(),
        city: normalizeCity(values.city),
        bestContactTime: values.bestContactTime.trim(),
        notes: values.notes.trim(),
        contactCount: 0,
        firstContactAt: null,
        lastContactAt: null,
        nextFollowUpAt: null,
        createdAt: now,
        createdByUid: user.uid,
        createdByEmail: user.email,
        updatedAt: now,
        updatedByEmail: user.email,
      };
      setPeople((current) => [person, ...current]);
      toast.success("Demoregistreringen er lagt til.");
      return;
    }
    if (!db) throw new Error("Databasen er ikke tilgjengelig.");
    await addDoc(collection(db, "newMuslims"), {
      ...personPayload(values, user),
      contactCount: 0,
      firstContactAt: null,
      lastContactAt: null,
      nextFollowUpAt: null,
      createdAt: serverTimestamp(),
      createdByUid: user.uid,
      createdByEmail: user.email,
    });
    toast.success("Personen er registrert.");
  };

  const updatePerson = async (values: PersonFormValues) => {
    if (!selected) return;
    if (demo) {
      const updated: NewMuslim = {
        ...selected,
        ...values,
        gender: values.gender || selected.gender,
        city: normalizeCity(values.city),
        shahadaDate: localDate(values.shahadaDate),
        updatedAt: new Date(),
        updatedByEmail: user.email,
      };
      setPeople((current) => current.map((person) => person.id === selected.id ? updated : person));
      setSelected(updated);
      toast.success("Endringene er lagret i demoen.");
      return;
    }
    if (!db) throw new Error("Databasen er ikke tilgjengelig.");
    await updateDoc(doc(db, "newMuslims", selected.id), personPayload(values, user));
    setSelected((current) => current ? {
      ...current,
      ...values,
      gender: values.gender || current.gender,
      city: normalizeCity(values.city),
      shahadaDate: localDate(values.shahadaDate),
    } : null);
    toast.success("Endringene er lagret.");
  };

  const addContact = async (values: ContactFormValues) => {
    if (!selected) return;
    const contactedAt = localDate(values.contactedAt);
    const nextFollowUpAt = values.nextFollowUpAt ? localDate(values.nextFollowUpAt) : null;

    if (demo) {
      const contact: ContactEntry = {
        id: `contact-${Date.now()}`,
        contactedAt,
        nextFollowUpAt,
        method: values.method,
        outcome: values.outcome,
        notes: values.notes.trim(),
        createdByUid: user.uid,
        createdByEmail: user.email,
        createdAt: new Date(),
      };
      const updated: NewMuslim = {
        ...selected,
        contactCount: selected.contactCount + 1,
        firstContactAt: selected.firstContactAt ?? contactedAt,
        lastContactAt: contactedAt,
        nextFollowUpAt,
        followUpStatus: values.outcome === "no_more_contact" ? "closed" : "following_up",
        updatedAt: new Date(),
        updatedByEmail: user.email,
      };
      setDemoContacts((current) => ({ ...current, [selected.id]: [contact, ...(current[selected.id] ?? [])] }));
      setPeople((current) => current.map((person) => person.id === selected.id ? updated : person));
      setSelected(updated);
      setContactOpen(false);
      toast.success("Kontakten er registrert i demoen.");
      return;
    }

    if (!db) throw new Error("Databasen er ikke tilgjengelig.");
    const personRef = doc(db, "newMuslims", selected.id);
    const contactRef = doc(collection(db, "newMuslims", selected.id, "contacts"));
    await runTransaction(db, async (transaction) => {
      const personSnapshot = await transaction.get(personRef);
      if (!personSnapshot.exists()) throw new Error("Personen finnes ikke lenger.");
      const personData = personSnapshot.data();
      const currentCount = Number(personData.contactCount ?? 0);
      transaction.set(contactRef, {
        contactedAt: Timestamp.fromDate(contactedAt),
        method: values.method,
        outcome: values.outcome,
        notes: values.notes.trim(),
        nextFollowUpAt: nextFollowUpAt ? Timestamp.fromDate(nextFollowUpAt) : null,
        createdByUid: user.uid,
        createdByEmail: user.email,
        createdAt: serverTimestamp(),
      });
      transaction.update(personRef, {
        contactCount: currentCount + 1,
        firstContactAt: currentCount === 0 ? Timestamp.fromDate(contactedAt) : personData.firstContactAt,
        lastContactAt: Timestamp.fromDate(contactedAt),
        nextFollowUpAt: nextFollowUpAt ? Timestamp.fromDate(nextFollowUpAt) : null,
        followUpStatus: values.outcome === "no_more_contact" ? "closed" : "following_up",
        updatedAt: serverTimestamp(),
        updatedByEmail: user.email,
      });
    });
    setContactOpen(false);
    toast.success("Kontakten er registrert.");
  };

  const loadExportData = async (): Promise<ExportPerson[]> => {
    if (demo) {
      return people.map((person) => ({ person, contacts: demoContacts[person.id] ?? [] }));
    }
    if (!db) throw new Error("Databasen er ikke tilgjengelig.");
    const personSnapshot = await getDocs(query(collection(db, "newMuslims"), orderBy("createdAt", "desc")));
    return Promise.all(personSnapshot.docs.map(async (personDocument) => {
      const contactSnapshot = await getDocs(query(
        collection(db!, "newMuslims", personDocument.id, "contacts"),
        orderBy("contactedAt", "desc"),
      ));
      return {
        person: personFromSnapshot(personDocument.id, personDocument.data()),
        contacts: contactSnapshot.docs.map((entry) => contactFromSnapshot(entry.id, entry.data())),
      };
    }));
  };

  const exportBackup = async () => {
    if (!window.confirm("Sikkerhetskopien inneholder sensitive personopplysninger. Lagre den bare på et sikkert, kryptert sted. Vil du fortsette?")) return;
    setExporting(true);
    try {
      const payload = await loadExportData();
      downloadFile(
        JSON.stringify({
          exportedAt: new Date().toISOString(),
          people: payload.map(({ person, contacts }) => ({ ...person, contacts })),
        }, null, 2),
        "application/json",
        `dawah-norge-sikkerhetskopi-${new Date().toISOString().slice(0, 10)}.json`,
      );
      toast.success("Sikkerhetskopien er lastet ned.");
    } catch {
      toast.error("Sikkerhetskopien kunne ikke opprettes.");
    } finally {
      setExporting(false);
    }
  };

  const exportPeopleCsv = async () => {
    if (!window.confirm("Excel-filen inneholder sensitive personopplysninger og kontakthistorikk. Lagre den bare på et sikkert sted. Vil du fortsette?")) return;
    setExporting(true);
    try {
      const payload = await loadExportData();
      const headers = [
        "ID",
        "Navn",
        "Telefonnummer",
        "Kjønn",
        "By / avdeling",
        "Dato for shahada",
        "Foretrukket språk",
        "Foretrukket kontakt",
        "Beste kontakttid",
        "Aktivitet i islam",
        "Oppfølgingsstatus",
        "Antall kontakter",
        "Første kontakt",
        "Siste kontakt",
        "Neste oppfølging",
        "Kontakthistorikk",
        "Merknad",
        "Samtykke bekreftet",
        "Samtykkemåte",
        "Registrert dato",
        "Registrert av",
        "Sist endret",
        "Sist endret av",
      ];
      const rows = payload.map(({ person, contacts }) => {
        const history = contacts.map((contact) => [
          toExportDate(contact.contactedAt),
          methodLabel[contact.method],
          outcomeLabel[contact.outcome],
          contact.notes,
          contact.nextFollowUpAt ? `neste: ${toExportDate(contact.nextFollowUpAt)}` : "",
        ].filter(Boolean).join(" – ")).join(" | ");
        return [
          person.id,
          person.name,
          person.phone,
          person.gender === "woman" ? "Kvinne" : "Mann",
          person.city,
          toExportDate(person.shahadaDate),
          person.preferredLanguage,
          methodLabel[person.preferredContact],
          person.bestContactTime,
          activityLabel[person.faithActivity],
          statusLabel[person.followUpStatus],
          person.contactCount,
          toExportDate(person.firstContactAt),
          toExportDate(person.lastContactAt),
          toExportDate(person.nextFollowUpAt),
          history,
          person.notes,
          person.consentConfirmed ? "Ja" : "Nei",
          consentMethodLabel[person.consentMethod],
          toExportDate(person.createdAt),
          person.createdByEmail,
          toExportDate(person.updatedAt),
          person.updatedByEmail,
        ];
      });
      const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
      downloadFile(
        csv,
        "text/csv;charset=utf-8",
        `dawah-norge-personliste-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast.success("Excel-filen er lastet ned.");
    } catch {
      toast.error("Excel-filen kunne ikke opprettes.");
    } finally {
      setExporting(false);
    }
  };

  const deletePerson = async () => {
    if (!selected) return;
    try {
      if (demo) {
        setPeople((current) => current.filter((person) => person.id !== selected.id));
        setDemoContacts((current) => {
          const next = { ...current };
          delete next[selected.id];
          return next;
        });
      } else {
        if (!db) throw new Error("Databasen er ikke tilgjengelig.");
        const personRef = doc(db, "newMuslims", selected.id);
        const contactSnapshot = await getDocs(collection(db, "newMuslims", selected.id, "contacts"));
        const batch = writeBatch(db);
        contactSnapshot.docs.forEach((entry) => batch.delete(entry.ref));
        batch.delete(personRef);
        await batch.commit();
      }
      setDeleteOpen(false);
      setSelected(null);
      toast.success("Personen og kontakthistorikken er slettet.");
    } catch {
      toast.error("Personen kunne ikke slettes.");
    }
  };

  const navItems: { value: Screen; label: string; icon: React.ReactNode }[] = [
    { value: "overview", label: "Oversikt", icon: <LayoutDashboard className="size-[18px]" /> },
    { value: "people", label: "Personer", icon: <Users className="size-[18px]" /> },
    { value: "statistics", label: "Statistikk", icon: <BarChart3 className="size-[18px]" /> },
    { value: "alerts", label: "Varsler", icon: <BellRing className="size-[18px]" /> },
    { value: "register", label: "Ny registrering", icon: <UserPlus className="size-[18px]" /> },
  ];

  const screenTitle = {
    overview: "Oversikt",
    people: "Alle personer",
    statistics: "Statistikk",
    alerts: "Varsler og oppfølging",
    register: "Ny registrering",
  }[screen];

  return (
    <div className="min-h-dvh bg-[#f2f6f4] text-[#183f38]">
      <Toaster richColors position="top-center" />
      <aside className={`fixed inset-y-0 left-0 z-40 w-[260px] border-r border-[#d9e5e0] bg-[#f9fbfa] p-5 transition-transform lg:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between">
          <BrandMark />
          <button type="button" onClick={() => setMobileMenuOpen(false)} className="rounded-lg p-2 text-[#61736d] hover:bg-[#edf3f1] lg:hidden" aria-label="Lukk meny">
            <X className="size-5" />
          </button>
        </div>
        <nav className="mt-10 space-y-1.5" aria-label="Hovedmeny">
          {navItems.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => navigate(item.value)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${screen === item.value ? "bg-[#143f37] text-white shadow-[0_7px_18px_rgba(20,63,55,0.16)]" : "text-[#546a63] hover:bg-[#eaf2ef] hover:text-[#204d43]"}`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.value === "alerts" && alertPeople.length > 0 ? (
                <span className={`ml-auto min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs ${screen === item.value ? "bg-white/20 text-white" : "bg-[#fbe7e3] text-[#9e3d34]"}`}>{alertPeople.length}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-5 left-5 right-5">
          {demo ? <div className="mb-3 rounded-xl border border-[#ead8ae] bg-[#fff8e8] px-3 py-2 text-xs font-medium leading-5 text-[#79581f]">Demomodus – ingen ekte data</div> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2 text-left hover:bg-[#edf3f1]">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e5f1ed] text-sm font-bold text-[#2d695a]">{user.displayName.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#264d45]">{user.displayName}</span>
                  <span className="block truncate text-xs font-normal text-[#7a8884]">Styremedlem</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52">
              <DropdownMenuItem onClick={exportPeopleCsv} disabled={exporting}>
                <FileSpreadsheet className="size-4" /> Last ned til Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportBackup} disabled={exporting}>
                <Download className="size-4" /> Last ned sikkerhetskopi
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="size-4" /> Logg ut
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {mobileMenuOpen ? <button type="button" className="fixed inset-0 z-30 bg-[#102d28]/35 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileMenuOpen(false)} aria-label="Lukk meny" /> : null}

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 border-b border-[#dbe6e2] bg-[#f2f6f4]/90 backdrop-blur-xl">
          <div className="flex h-[72px] items-center justify-between px-5 sm:px-8 lg:px-10">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setMobileMenuOpen(true)} className="rounded-lg border border-[#d5e1dd] bg-white p-2 text-[#42655d] lg:hidden" aria-label="Åpne meny">
                <Menu className="size-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold tracking-[-0.03em] text-[#173f38]">{screenTitle}</h1>
                <p className="hidden text-xs text-[#75837e] sm:block">Dawah Norge · intern oppfølging</p>
              </div>
            </div>
            <Button onClick={() => setAddOpen(true)} className="h-10 gap-2 bg-[#143f37] text-white hover:bg-[#0f322b]">
              <Plus className="size-4" /> <span className="hidden sm:inline">Registrer ny</span><span className="sm:hidden">Ny</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-5 py-7 pb-24 sm:px-8 lg:px-10 lg:py-9">
          {demo ? (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-[#e7d2a4] bg-[#fff8e7] px-4 py-3 text-sm font-medium text-[#79581f] lg:hidden">
              <CircleAlert className="size-4" /> Demoversjon – endringer lagres ikke permanent.
            </div>
          ) : null}

          {screen === "overview" ? (
            <div className="space-y-8">
              <section>
                <div className="mb-5 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#347261]">Status akkurat nå</p>
                    <h2 className="mt-1 text-3xl font-semibold tracking-[-0.045em] text-[#153e37]">God {new Date().getHours() < 12 ? "morgen" : new Date().getHours() < 18 ? "ettermiddag" : "kveld"}</h2>
                  </div>
                  <p className="hidden text-sm text-[#75837f] md:block">Sist oppdatert automatisk</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Registrerte totalt" value={stats.total} icon={<Users className="size-5" />} onClick={() => openFilter("all")} />
                  <StatCard label="Aldri kontaktet" value={stats.never} icon={<Phone className="size-5" />} tone="amber" onClick={() => openFilter("never")} />
                  <StatCard label="Krever oppmerksomhet" value={stats.due} icon={<BellRing className="size-5" />} tone="red" onClick={() => navigate("alerts")} />
                  <StatCard label="Registrert aktive" value={stats.active} icon={<Activity className="size-5" />} tone="blue" onClick={() => openFilter("active")} />
                </div>
                <button
                  type="button"
                  onClick={() => navigate("statistics")}
                  className="group mt-3 flex w-full flex-col gap-5 rounded-[20px] border border-[#cfe0da] bg-[#e9f4f0] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#abc9bf] hover:shadow-[0_10px_25px_rgba(20,63,55,0.07)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex items-center gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#143f37] text-white"><BarChart3 className="size-5" /></span>
                    <span>
                      <span className="block font-semibold text-[#1b463d]">Se detaljert statistikk</span>
                      <span className="mt-1 block text-sm text-[#667a73]">Kjønn, byer, aktivitet, kontakt og utvikling</span>
                    </span>
                  </span>
                  <span className="grid grid-cols-3 gap-5 sm:text-right">
                    <span><strong className="block text-lg text-[#173f38]">{percentage(stats.women, stats.total)} %</strong><span className="text-xs text-[#6f7e79]">kvinner</span></span>
                    <span><strong className="block text-lg text-[#173f38]">{percentage(stats.men, stats.total)} %</strong><span className="text-xs text-[#6f7e79]">menn</span></span>
                    <span className="flex items-center gap-3 sm:justify-end"><span><strong className="block text-lg text-[#173f38]">{stats.cities.length}</strong><span className="text-xs text-[#6f7e79]">byer</span></span><ChevronRight className="size-4 text-[#628077] transition group-hover:translate-x-0.5" /></span>
                  </span>
                </button>
              </section>

              <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
                <div className="rounded-[22px] border border-[#dce6e2] bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold tracking-[-0.025em] text-[#1b443c]">Trenger oppfølging</h2>
                      <p className="mt-1 text-sm text-[#71807b]">Forsinket eller ikke kontaktet</p>
                    </div>
                    <Button variant="ghost" onClick={() => navigate("alerts")} className="text-[#347060]">Se alle</Button>
                  </div>
                  <div className="mt-4 divide-y divide-[#e6ecea]">
                    {alertPeople.slice(0, 5).map((person) => {
                      const attention = attentionFor(person)!;
                      return (
                        <button key={person.id} type="button" onClick={() => setSelected(person)} className="flex w-full items-center gap-3 py-4 text-left first:pt-2 last:pb-1">
                          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${attention.level === "red" ? "bg-[#fff0ee] text-[#aa4238]" : "bg-[#fff5df] text-[#a06a1b]"}`}><CircleAlert className="size-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-[#284d45]">{person.name}</span>
                            <span className="mt-0.5 block truncate text-xs text-[#77847f]">{person.city} · {attention.text}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-[#929e9a]" />
                        </button>
                      );
                    })}
                    {alertPeople.length === 0 ? (
                      <div className="py-10 text-center">
                        <CheckCircle2 className="mx-auto size-7 text-[#3f846f]" />
                        <p className="mt-3 text-sm font-semibold text-[#315d53]">Ingen forsinkede oppfølginger</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[22px] bg-[#143f37] p-6 text-white shadow-[0_14px_35px_rgba(20,63,55,0.18)]">
                  <div className="flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-2xl bg-white/10"><CalendarDays className="size-5" /></span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">Denne måneden</span>
                  </div>
                  <p className="mt-9 text-5xl font-semibold tracking-[-0.05em]">{stats.newThisMonth}</p>
                  <p className="mt-2 text-sm font-medium text-white/75">nye registreringer</p>
                  <div className="mt-8 border-t border-white/15 pt-5">
                    <p className="text-sm leading-6 text-white/70">Følg spesielt med på nye personer som ennå ikke har fått sin første kontakt.</p>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#173f38]">Nyeste registreringer</h2>
                    <p className="mt-1 text-sm text-[#71807b]">De fem siste personene</p>
                  </div>
                  <Button variant="outline" onClick={() => navigate("people")} className="border-[#cfddd8] bg-white text-[#37685b]">Åpne listen</Button>
                </div>
                <div className="hidden overflow-hidden rounded-[20px] border border-[#dce6e2] bg-white shadow-sm md:block">
                  <Table>
                    <TableBody>{people.slice(0, 5).map((person) => <PersonRow key={person.id} person={person} onOpen={() => setSelected(person)} />)}</TableBody>
                  </Table>
                </div>
                <div className="space-y-3 md:hidden">{people.slice(0, 5).map((person) => <PersonCard key={person.id} person={person} onOpen={() => setSelected(person)} />)}</div>
              </section>
            </div>
          ) : null}

          {screen === "people" ? (
            <PeopleList
              people={filteredPeople}
              total={people.length}
              loading={loading}
              search={search}
              setSearch={setSearch}
              filter={filter}
              setFilter={setFilter}
              cities={stats.cities}
              cityFilter={cityFilter}
              setCityFilter={setCityFilter}
              exporting={exporting}
              onExport={exportPeopleCsv}
              onOpen={setSelected}
            />
          ) : null}

          {screen === "statistics" ? (
            <StatisticsView
              summary={stats}
              loading={loading}
              exporting={exporting}
              onExport={exportPeopleCsv}
              onCityOpen={openCity}
              onFilterOpen={openFilter}
            />
          ) : null}

          {screen === "alerts" ? (
            <section>
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-[#a4453b]">Må følges opp</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[#173f38]">{alertPeople.length} varsler</h2>
                <p className="mt-3 text-base leading-7 text-[#687873]">Rødt betyr minst 30 dager uten første kontakt, eller at planlagt oppfølging er forsinket.</p>
              </div>
              <div className="mt-7 grid gap-3 lg:grid-cols-2">
                {alertPeople.map((person) => {
                  const attention = attentionFor(person)!;
                  return (
                    <button key={person.id} type="button" onClick={() => setSelected(person)} className={`rounded-[20px] border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${attention.level === "red" ? "border-[#ebc7c1]" : "border-[#ead9b8]"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <span className={`grid size-10 place-items-center rounded-xl ${attention.level === "red" ? "bg-[#fff0ee] text-[#ac4137]" : "bg-[#fff6e3] text-[#9c661b]"}`}><CircleAlert className="size-5" /></span>
                        <ChevronRight className="size-4 text-[#919e99]" />
                      </div>
                      <p className="mt-5 text-lg font-semibold text-[#254a43]">{person.name}</p>
                      <p className={`mt-1 text-sm font-semibold ${attention.level === "red" ? "text-[#a83f36]" : "text-[#96631b]"}`}>{attention.text}</p>
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#6c7b76]">
                        <span className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {person.city}</span>
                        <span className="flex items-center gap-1.5"><Phone className="size-3.5" /> {person.contactCount} kontaktforsøk</span>
                      </div>
                    </button>
                  );
                })}
                {alertPeople.length === 0 ? (
                  <div className="col-span-full rounded-[22px] border border-dashed border-[#cbdad5] bg-white py-16 text-center">
                    <CheckCircle2 className="mx-auto size-8 text-[#3f846f]" />
                    <p className="mt-4 font-semibold text-[#315d53]">Alt er fulgt opp</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {screen === "register" ? (
            <section className="mx-auto max-w-4xl">
              <div className="mb-7">
                <p className="text-sm font-semibold text-[#357363]">Fra styret</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[#173f38]">Registrer en ny muslim</h2>
              </div>
              <div className="rounded-[24px] border border-[#dce7e3] bg-white p-5 shadow-sm sm:p-8">
                <PersonForm boardMode onSubmit={createPerson} />
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ny registrering</DialogTitle>
            <DialogDescription>Legg inn opplysningene personen har samtykket til å dele.</DialogDescription>
          </DialogHeader>
          <PersonForm compact boardMode onSubmit={createPerson} onSuccess={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
          {selected ? (
            <>
              <SheetHeader className="border-b border-[#e0e8e5] bg-[#f7faf9] p-6 pr-14">
                <div className="flex items-center gap-4">
                  <span className={`grid size-12 place-items-center rounded-2xl text-lg font-bold ${selected.gender === "woman" ? "bg-[#f2eafa] text-[#755492]" : "bg-[#e8f2f7] text-[#416d83]"}`}>{selected.name.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <SheetTitle className="text-xl tracking-[-0.03em] text-[#173f38]">{selected.name}</SheetTitle>
                    <SheetDescription className="mt-1 flex items-center gap-1.5"><MapPin className="size-3.5" /> {selected.city}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="p-5 sm:p-6">
                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-[#f3f7f5] p-3">
                    <p className="text-xs text-[#75837e]">Kontakter</p>
                    <p className="mt-1 text-lg font-semibold text-[#234a42]">{selected.contactCount}</p>
                  </div>
                  <div className="rounded-xl bg-[#f3f7f5] p-3">
                    <p className="text-xs text-[#75837e]">Siste kontakt</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#234a42]">{formatDate(selected.lastContactAt)}</p>
                  </div>
                  <div className="rounded-xl bg-[#f3f7f5] p-3">
                    <p className="text-xs text-[#75837e]">Aktivitet</p>
                    <p className="mt-1 text-sm font-semibold text-[#234a42]">{activityLabel[selected.faithActivity]}</p>
                  </div>
                  <div className="rounded-xl bg-[#f3f7f5] p-3">
                    <p className="text-xs text-[#75837e]">Status</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#234a42]">{statusLabel[selected.followUpStatus]}</p>
                  </div>
                </div>

                {attentionFor(selected) ? (
                  <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#efc8c2] bg-[#fff1ef] px-4 py-3 text-sm font-semibold text-[#a33e35]">
                    <CircleAlert className="size-4 shrink-0" /> {attentionFor(selected)?.text}
                  </div>
                ) : null}

                <Button onClick={() => setContactOpen(true)} className="mb-6 w-full gap-2 bg-[#143f37] text-white hover:bg-[#0f322b]">
                  <MessageSquarePlus className="size-4" /> Registrer ny kontakt
                </Button>

                <Tabs defaultValue="details">
                  <TabsList className="grid w-full grid-cols-2 bg-[#edf3f1]">
                    <TabsTrigger value="details">Opplysninger</TabsTrigger>
                    <TabsTrigger value="history">Kontakthistorikk ({selected.contactCount})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="details" className="mt-6">
                    <PersonForm key={selected.id} compact boardMode initialValues={valuesFromPerson(selected)} submitLabel="Lagre endringer" onSubmit={updatePerson} />
                    <div className="mt-6 border-t border-[#e0e8e5] pt-5 text-xs leading-5 text-[#77847f]">
                      <p>Registrert av {selected.createdByEmail || "ukjent"} · {formatDateTime(selected.createdAt)}</p>
                      <p>Sist endret av {selected.updatedByEmail || "ukjent"} · {formatDateTime(selected.updatedAt)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setDeleteOpen(true)}
                      className="mt-5 gap-2 px-0 text-[#a44238] hover:bg-transparent hover:text-[#7e2f28]"
                    >
                      <Trash2 className="size-4" /> Slett personen permanent
                    </Button>
                  </TabsContent>
                  <TabsContent value="history" className="mt-6">
                    {contacts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#ccd9d5] py-12 text-center">
                        <Clock3 className="mx-auto size-7 text-[#6f847d]" />
                        <p className="mt-3 font-semibold text-[#31574f]">Ingen kontakt registrert</p>
                        <p className="mt-1 text-sm text-[#74827e]">Registrer første kontakt når noen har forsøkt å nå personen.</p>
                      </div>
                    ) : (
                      <div className="relative space-y-4 before:absolute before:bottom-5 before:left-[19px] before:top-5 before:w-px before:bg-[#d5e2dd]">
                        {contacts.map((contact, index) => (
                          <article key={contact.id} className="relative flex gap-4">
                            <span className={`relative z-10 mt-1 grid size-10 shrink-0 place-items-center rounded-full border-4 border-white ${index === 0 ? "bg-[#dcefe8] text-[#286a58]" : "bg-[#edf2f0] text-[#64766f]"}`}>
                              <Phone className="size-4" />
                            </span>
                            <div className="flex-1 rounded-2xl border border-[#dde6e3] bg-white p-4">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-[#264d45]">{outcomeLabel[contact.outcome]}</p>
                                  <p className="mt-1 text-xs text-[#75837e]">{methodLabel[contact.method]} · {formatDate(contact.contactedAt)}</p>
                                </div>
                                {index === 0 ? <Badge className="bg-[#e6f4ee] text-[#24664f]">Siste</Badge> : null}
                              </div>
                              {contact.notes ? <p className="mt-3 text-sm leading-6 text-[#5d6f69]">{contact.notes}</p> : null}
                              <div className="mt-3 border-t border-[#edf1ef] pt-3 text-xs text-[#7a8783]">
                                {contact.nextFollowUpAt ? <p>Neste oppfølging: {formatDate(contact.nextFollowUpAt)}</p> : <p>Ingen ny dato satt</p>}
                                <p className="mt-1">Registrert av {contact.createdByEmail}</p>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrer kontakt</DialogTitle>
            <DialogDescription>{selected ? `Legg til et kontaktforsøk for ${selected.name}.` : "Legg til kontakt."}</DialogDescription>
          </DialogHeader>
          <ContactForm onSubmit={addContact} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slette {selected?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Personen og hele kontakthistorikken slettes permanent. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deletePerson}>Slett permanent</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function DawahApp() {
  const [loading, setLoading] = useState(firebaseReady);
  const [user, setUser] = useState<AppUser | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    if (!firebaseReady || !auth || !db) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setPendingEmail("");
        setLoading(false);
        return;
      }
      const profile = await getDoc(doc(db!, "users", firebaseUser.uid));
      if (!profile.exists() || !["member", "board"].includes(profile.data().role)) {
        setPendingEmail(firebaseUser.email ?? "ukjent e-post");
        setUser(null);
        setLoading(false);
        return;
      }
      const profileData = profile.data();
      setPendingEmail("");
      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? "",
        displayName: String(profileData.displayName ?? firebaseUser.email?.split("@")[0] ?? "Bruker"),
        role: profileData.role,
      });
      setLoading(false);
    });
  }, []);

  const logout = async () => {
    if (demo) {
      setDemo(false);
      setUser(null);
      return;
    }
    if (auth) await signOut(auth);
  };

  const enterDemo = (role: AppUser["role"]) => {
    setDemo(true);
    setUser({
      uid: role === "board" ? "demo-board" : "demo-member",
      email: role === "board" ? "styret@demo.no" : "medlem@demo.no",
      displayName: role === "board" ? "Styremedlem" : "Medlem",
      role,
    });
  };

  if (loading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f2f6f4]">
        <div className="text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#143f37] text-white"><Loader2 className="size-5 animate-spin" /></div>
          <p className="mt-4 text-sm font-medium text-[#60716b]">Åpner sikkert område …</p>
        </div>
      </main>
    );
  }

  if (pendingEmail) return <AccessPending email={pendingEmail} onLogout={logout} />;
  if (!user) return <LoginScreen onDemo={() => enterDemo("board")} onDemoMember={() => enterDemo("member")} />;
  if (user.role === "member") return <MemberRegistration user={user} onLogout={logout} demo={demo} />;
  return <BoardApp user={user} onLogout={logout} demo={demo} />;
}
