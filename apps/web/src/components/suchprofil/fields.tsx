"use client";

import type { ReactNode } from "react";

export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {help ? <div className="fieldhelp">{help}</div> : null}
    </div>
  );
}

export function NumberField({
  label,
  help,
  value,
  onChange,
  unit,
  step,
}: {
  label: string;
  help?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  unit?: string;
  step?: number;
}) {
  return (
    <Field label={label} help={help}>
      <div className="unit-input">
        <input
          type="number"
          step={step ?? "any"}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
    </Field>
  );
}

export function TextField({
  label,
  help,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  help?: string;
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label} help={help}>
      <input type="text" value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function CheckboxField({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="field">
      <label className="checkbox-row" style={{ marginBottom: 0 }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
        {label}
      </label>
      {help ? <div className="fieldhelp">{help}</div> : null}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  help,
  value,
  onChange,
  options,
}: {
  label: string;
  help?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <Field label={label} help={help}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function ChipMultiSelect({
  label,
  help,
  options,
  selected,
  onToggle,
}: {
  label: string;
  help?: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <Field label={label} help={help}>
      <div className="chipselect">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={selected.includes(o.value) ? "selected" : undefined}
            onClick={() => onToggle(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}
