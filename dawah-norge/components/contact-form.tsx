"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { ContactFormValues, emptyContactForm } from "@/lib/types";

export function ContactForm({
  onSubmit,
}: {
  onSubmit: (values: ContactFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<ContactFormValues>(emptyContactForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(form);
      setForm(emptyContactForm());
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Kontakten kunne ikke lagres.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-date">Kontaktdato</Label>
          <Input
            id="contact-date"
            type="date"
            value={form.contactedAt}
            onChange={(event) => setForm({ ...form, contactedAt: event.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-method">Kontaktmåte</Label>
          <Select
            value={form.method}
            onValueChange={(value) => setForm({ ...form, method: value as ContactFormValues["method"] })}
          >
            <SelectTrigger id="contact-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="phone">Telefonsamtale</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="in_person">Fysisk møte</SelectItem>
              <SelectItem value="email">E-post</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-outcome">Resultat</Label>
        <Select
          value={form.outcome}
          onValueChange={(value) => setForm({ ...form, outcome: value as ContactFormValues["outcome"] })}
        >
          <SelectTrigger id="contact-outcome" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="answered">Svarte</SelectItem>
            <SelectItem value="no_answer">Svarte ikke</SelectItem>
            <SelectItem value="follow_up_wanted">Ønsker videre oppfølging</SelectItem>
            <SelectItem value="invalid_number">Nummeret virker ikke</SelectItem>
            <SelectItem value="no_more_contact">Ønsker ikke mer kontakt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-next">Neste oppfølging</Label>
        <Input
          id="contact-next"
          type="date"
          value={form.nextFollowUpAt}
          onChange={(event) => setForm({ ...form, nextFollowUpAt: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-notes">Kort notat</Label>
        <Textarea
          id="contact-notes"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          placeholder="Hva ble avtalt? Ikke skriv mer enn nødvendig."
          rows={4}
        />
      </div>

      {error ? <p role="alert" className="text-sm text-[#a53b31]">{error}</p> : null}

      <Button type="submit" disabled={saving} className="w-full bg-[#143f37] text-white hover:bg-[#0e312b]">
        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        {saving ? "Lagrer …" : "Registrer kontakt"}
      </Button>
    </form>
  );
}
