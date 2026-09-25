"use client";

import { FormEvent, useEffect, useState } from "react";
import { Contact, Phone, Plus, Trash2 } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Avatar, Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { employeesApi, getApiErrorMessage } from "@/lib/api";
import type { EmergencyContact } from "@/types/hr";

export default function EmergencyContactsPage() {
  const [items, setItems] = useState<EmergencyContact[]>([]);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = () => employeesApi.listMyEmergencyContacts().then(setItems).catch((caught) => setError(getApiErrorMessage(caught)));
  useEffect(() => { void load(); }, []);
  async function add(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await employeesApi.createMyEmergencyContact({ full_name: name, relationship, phone, is_primary: items.length === 0 });
      setName(""); setRelationship(""); setPhone("");
      load();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Emergency contacts" description="People HR can contact if there is an emergency." icon={Contact} accent="brand" />
      {error && <Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert>}
      {items.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2" aria-label="Your contacts">
          {items.map((item) => (
            <article key={item.id} className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-5 shadow-elevation-1">
              <Avatar name={item.full_name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-ink-strong">{item.full_name}</h2>
                  {item.is_primary && <Badge size="sm" tone="brand">Primary</Badge>}
                </div>
                <p className="text-support text-ink-muted">{item.relationship}</p>
                <p className="mt-3 flex items-center gap-2 text-sm text-ink"><Phone className="h-4 w-4 text-ink-subtle" aria-hidden="true" />{item.phone}</p>
              </div>
              <IconButton size="sm" label={`Remove ${item.full_name}`} className="hover:bg-danger-soft hover:text-danger-ink" onClick={async () => { await employeesApi.deleteMyEmergencyContact(item.id); load(); }}><Trash2 className="h-4 w-4" /></IconButton>
            </article>
          ))}
        </section>
      )}
      <Card as="form" onSubmit={add} title="Add an emergency contact" description={items.length === 0 ? "Your first contact becomes your primary contact." : undefined} icon={Plus} accent="brand">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Full name" required><Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></Field>
          <Field label="Relationship" required><Input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="e.g. Spouse" /></Field>
          <Field label="Phone number" required><Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></Field>
        </div>
        <Button type="submit" className="mt-5" loading={saving} loadingLabel="Adding…" leadingIcon={<Plus className="h-4 w-4" />}>Add contact</Button>
      </Card>
    </div>
  );
}
