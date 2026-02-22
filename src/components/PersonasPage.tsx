import { useEffect, useId, useState } from "react";
import type { AddPersonaParams, PersonaData, UpdatePersonaParams } from "../shared/timeline";

type Props = {
  onGetPersonas: () => Promise<PersonaData[]>;
  onAddPersona: (p: AddPersonaParams) => Promise<PersonaData>;
  onUpdatePersona: (p: UpdatePersonaParams) => Promise<PersonaData>;
  onDeletePersona: (handle: string) => Promise<{ deleted: boolean }>;
};

type FormState = {
  handle: string;
  name: string;
  description: string;
};

const EMPTY_FORM: FormState = {
  handle: "",
  name: "",
  description: "",
};

function Field({
  label,
  value,
  onChange,
  multiline = false,
  disabled = false,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const fieldId = useId();
  const base =
    "w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50";
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={fieldId}
          className={`${base} min-h-[80px] resize-none`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={fieldId}
          type="text"
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function PersonaForm({
  form,
  isNew,
  saving,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  form: FormState;
  isNew: boolean;
  saving: boolean;
  onChange: (patch: Partial<FormState>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      {isNew && (
        <Field
          label="Handle"
          value={form.handle}
          onChange={(v) => onChange({ handle: v })}
          placeholder="e.g. janedoe"
        />
      )}
      {!isNew && (
        <p className="text-xs text-muted-foreground">
          @{form.handle}
        </p>
      )}
      <Field label="Name" value={form.name} onChange={(v) => onChange({ name: v })} />
      <Field
        label="Description"
        value={form.description}
        onChange={(v) => onChange({ description: v })}
        multiline
        placeholder="SOULS-style note: personality, writing style, and when they post"
      />
      <div className="flex items-center justify-between pt-1">
        <div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/10 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonaCard({
  persona,
  onEdit,
}: {
  persona: PersonaData;
  onEdit: () => void;
}) {
  return (
    <div className="flex gap-3 rounded-md border border-border bg-card p-4">
      <img
        src={persona.avatarUrl}
        alt={persona.name}
        className="h-10 w-10 shrink-0 rounded-full bg-muted"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{persona.name}</p>
            <p className="text-xs text-muted-foreground">@{persona.handle}</p>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Edit
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{persona.description}</p>
      </div>
    </div>
  );
}

export function PersonasPage({ onGetPersonas, onAddPersona, onUpdatePersona, onDeletePersona }: Props) {
  const [personas, setPersonas] = useState<PersonaData[]>([]);
  const [editingHandle, setEditingHandle] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onGetPersonas().then(setPersonas).catch(console.error);
  }, [onGetPersonas]);

  function patchForm(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function startEdit(p: PersonaData) {
    setIsCreating(false);
    setEditingHandle(p.handle);
    setError(null);
    setForm({
      handle: p.handle,
      name: p.name,
      description: p.description,
    });
  }

  function startCreate() {
    setEditingHandle(null);
    setIsCreating(true);
    setError(null);
    setForm(EMPTY_FORM);
  }

  function cancel() {
    setEditingHandle(null);
    setIsCreating(false);
    setError(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (isCreating) {
        const created = await onAddPersona({
          handle: form.handle.trim(),
          name: form.name.trim(),
          description: form.description.trim(),
        });
        setPersonas((prev) => [...prev, created]);
        setIsCreating(false);
        setForm(EMPTY_FORM);
      } else if (editingHandle) {
        const updated = await onUpdatePersona({
          handle: editingHandle,
          name: form.name.trim(),
          description: form.description.trim(),
        });
        setPersonas((prev) => prev.map((p) => (p.handle === editingHandle ? updated : p)));
        setEditingHandle(null);
        setForm(EMPTY_FORM);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(handle: string) {
    setSaving(true);
    setError(null);
    try {
      await onDeletePersona(handle);
      setPersonas((prev) => prev.filter((p) => p.handle !== handle));
      setEditingHandle(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Personas</h2>
        {!isCreating && (
          <button
            type="button"
            onClick={startCreate}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            + Add persona
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
      )}

      {isCreating && (
        <PersonaForm
          form={form}
          isNew
          saving={saving}
          onChange={patchForm}
          onSave={handleSave}
          onCancel={cancel}
        />
      )}

      {personas.map((p) =>
        editingHandle === p.handle ? (
          <PersonaForm
            key={p.handle}
            form={form}
            isNew={false}
            saving={saving}
            onChange={patchForm}
            onSave={handleSave}
            onCancel={cancel}
            onDelete={() => handleDelete(p.handle)}
          />
        ) : (
          <PersonaCard key={p.handle} persona={p} onEdit={() => startEdit(p)} />
        ),
      )}

      {personas.length === 0 && !isCreating && (
        <p className="text-sm text-muted-foreground">No personas yet. Add one to get started.</p>
      )}
    </div>
  );
}
