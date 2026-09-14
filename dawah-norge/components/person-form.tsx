"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  FaithActivity,
  FollowUpStatus,
  Gender,
  PersonFormValues,
  emptyPersonForm,
} from "@/lib/types";

interface PersonFormProps {
  initialValues?: PersonFormValues;
  boardMode?: boolean;
  submitLabel?: string;
  onSubmit: (values: PersonFormValues) => Promise<void>;
  onSuccess?: () => void;
  compact?: boolean;
}

function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-[0.9rem] font-semibold text-[#163f38]">
        {label}{required ? <span className="ml-1 text-[#b64f43]">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-5 text-[#6e7c78]">{hint}</p> : null}
    </div>
  );
}

export function PersonForm({
  initialValues,
  boardMode = false,
  submitLabel = "Send inn registrering",
  onSubmit,
  onSuccess,
  compact = false,
}: PersonFormProps) {
  const [form, setForm] = useState<PersonFormValues>(initialValues ?? emptyPersonForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof PersonFormValues>(key: K, value: PersonFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSaved(false);

    if (!form.gender) {
      setError("Velg kjønn før du fortsetter.");
      return;
    }

    if (!form.consentConfirmed) {
      setError("Du må bekrefte at personen har samtykket til registrering og kontakt.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit(form);
      setSaved(true);
      if (!initialValues) setForm(emptyPersonForm);
      onSuccess?.();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Registreringen kunne ikke lagres. Prøv igjen.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div className={`grid gap-5 ${compact ? "sm:grid-cols-2" : "md:grid-cols-2"}`}>
        <Field label="Navn" htmlFor="person-name" required>
          <Input
            id="person-name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Fornavn og eventuelt etternavn"
            autoComplete="off"
            required
          />
        </Field>

        <Field label="Telefonnummer" htmlFor="person-phone" required>
          <Input
            id="person-phone"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            placeholder="For eksempel +47 900 00 000"
            autoComplete="off"
            required
          />
        </Field>

        <Field label="Kjønn" htmlFor="person-gender" required>
          <Select value={form.gender} onValueChange={(value) => update("gender", value as Gender)}>
            <SelectTrigger id="person-gender" className="w-full">
              <SelectValue placeholder="Velg kjønn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="woman">Kvinne</SelectItem>
              <SelectItem value="man">Mann</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="By eller område" htmlFor="person-city" required>
          <Input
            id="person-city"
            value={form.city}
            onChange={(event) => update("city", event.target.value)}
            placeholder="For eksempel Oslo"
            required
          />
        </Field>

        <Field label="Sted for shahada" htmlFor="person-location" required>
          <Input
            id="person-location"
            value={form.shahadaLocation}
            onChange={(event) => update("shahadaLocation", event.target.value)}
            placeholder="Moské, arrangement eller annet sted"
            required
          />
        </Field>

        <Field label="Dato for shahada" htmlFor="person-shahada-date" required>
          <Input
            id="person-shahada-date"
            type="date"
            value={form.shahadaDate}
            onChange={(event) => update("shahadaDate", event.target.value)}
            required
          />
        </Field>

        <Field label="Foretrukket språk" htmlFor="person-language">
          <Input
            id="person-language"
            value={form.preferredLanguage}
            onChange={(event) => update("preferredLanguage", event.target.value)}
            placeholder="For eksempel norsk, engelsk eller arabisk"
          />
        </Field>

        <Field label="Foretrukket kontakt" htmlFor="person-contact-method">
          <Select
            value={form.preferredContact}
            onValueChange={(value) => update("preferredContact", value as PersonFormValues["preferredContact"])}
          >
            <SelectTrigger id="person-contact-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="phone">Telefonsamtale</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">E-post</SelectItem>
              <SelectItem value="in_person">Fysisk møte</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Beste tidspunkt for kontakt" htmlFor="person-contact-time">
          <Input
            id="person-contact-time"
            value={form.bestContactTime}
            onChange={(event) => update("bestContactTime", event.target.value)}
            placeholder="For eksempel hverdager etter kl. 17"
          />
        </Field>

        <Field label="Hvordan ble samtykket gitt?" htmlFor="person-consent-method">
          <Select
            value={form.consentMethod}
            onValueChange={(value) => update("consentMethod", value as PersonFormValues["consentMethod"])}
          >
            <SelectTrigger id="person-consent-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="verbal">Muntlig</SelectItem>
              <SelectItem value="written">Skriftlig</SelectItem>
              <SelectItem value="digital">Digitalt</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {boardMode ? (
        <div className="grid gap-5 rounded-2xl border border-[#d9e6e1] bg-[#f4f9f7] p-5 sm:grid-cols-2">
          <Field label="Aktivitet i islam" htmlFor="person-activity">
            <Select
              value={form.faithActivity}
              onValueChange={(value) => update("faithActivity", value as FaithActivity)}
            >
              <SelectTrigger id="person-activity" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Vet ikke</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="inactive">Ikke aktiv</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Oppfølgingsstatus" htmlFor="person-follow-up-status">
            <Select
              value={form.followUpStatus}
              onValueChange={(value) => update("followUpStatus", value as FollowUpStatus)}
            >
              <SelectTrigger id="person-follow-up-status" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Ny</SelectItem>
                <SelectItem value="following_up">Under oppfølging</SelectItem>
                <SelectItem value="paused">Satt på pause</SelectItem>
                <SelectItem value="closed">Avsluttet</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      ) : null}

      <Field
        label="Kort merknad"
        htmlFor="person-notes"
        hint="Ikke skriv sensitive detaljer som ikke er nødvendige for oppfølgingen."
      >
        <Textarea
          id="person-notes"
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
          placeholder="Bare nødvendig informasjon som styret bør vite"
          rows={4}
        />
      </Field>

      <div className="rounded-2xl border border-[#d8e4df] bg-white p-5 shadow-[0_1px_0_rgba(20,62,54,0.04)]">
        <div className="flex gap-3">
          <Checkbox
            id="person-consent"
            checked={form.consentConfirmed}
            onCheckedChange={(checked) => update("consentConfirmed", checked === true)}
            className="mt-0.5"
          />
          <div>
            <Label htmlFor="person-consent" className="cursor-pointer text-sm font-semibold leading-6 text-[#173f38]">
              Jeg bekrefter at personen uttrykkelig har samtykket
            </Label>
            <p className="mt-1 text-sm leading-6 text-[#677570]">
              Personen har godkjent at Dawah Norge lagrer kontaktopplysninger og informasjon om shahada for å kunne følge opp.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-[#efc7c1] bg-[#fff3f1] px-4 py-3 text-sm text-[#8f3028]">
          {error}
        </div>
      ) : null}

      {saved ? (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-[#b9ddce] bg-[#ecf8f3] px-4 py-3 text-sm font-medium text-[#176448]">
          <CheckCircle2 className="size-4" /> Registreringen er lagret.
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs leading-5 text-[#71807a]">
          <ShieldCheck className="size-4 shrink-0 text-[#2d7363]" /> Opplysningene er bare tilgjengelige for godkjente styremedlemmer.
        </p>
        <Button
          type="submit"
          disabled={saving}
          className="h-11 bg-[#143f37] px-6 text-white hover:bg-[#0e312b]"
        >
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {saving ? "Lagrer …" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
