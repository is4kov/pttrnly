import { useEffect, useId, useState, type ReactNode } from 'react';
import styled from 'styled-components';

const Wrapper = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.xs}px;
`;

const Label = styled.label`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.sm}px;
`;

const Slider = styled.input`
  flex: 1 1 auto;
  min-width: 0;
  min-height: ${({ theme }) => theme.hitTarget};
  touch-action: none;
`;

const NumberInput = styled.input`
  flex: 0 0 5.5rem;
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.sm}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
`;

const Text = styled.input`
  flex: 1 1 auto;
  min-width: 0;
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.sm}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
`;

const Choice = styled.select`
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.sm}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
`;

const Note = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

function Labelled({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <Wrapper>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </Wrapper>
  );
}

type NumberFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
};

/** Slider for feel, number input for precision — both drive the same value. */
export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: NumberFieldProps) {
  const id = useId();
  const labelText = suffix ? `${label} (${suffix})` : label;

  /**
   * The number input keeps its own draft so it can be emptied mid-edit.
   * Committing straight from the prop would snap the old value back the
   * moment the field is cleared, making it impossible to type a replacement.
   */
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <Labelled label={labelText} id={id}>
      <Row>
        <Slider
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={`${labelText} slider`}
          onChange={(event) => {
            onChange(event.target.valueAsNumber);
          }}
        />
        <NumberInput
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            const next = event.target.valueAsNumber;
            if (!Number.isNaN(next)) onChange(next);
          }}
          onBlur={() => {
            setDraft(String(value));
          }}
        />
      </Row>
    </Labelled>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  invalid?: boolean;
  note?: string;
  onChange: (value: string) => void;
};

export function TextField({ label, value, placeholder, invalid, note, onChange }: TextFieldProps) {
  const id = useId();
  const noteId = `${id}-note`;

  return (
    <Labelled label={label} id={id}>
      <Text
        id={id}
        type="text"
        value={value}
        placeholder={placeholder ?? ''}
        aria-invalid={invalid ?? false}
        aria-describedby={note ? noteId : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {note ? <Note id={noteId}>{note}</Note> : null}
    </Labelled>
  );
}

type SelectFieldProps<T extends string> = {
  label: string;
  value: T;
  options: readonly T[];
  labels?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
};

export function SelectField<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: SelectFieldProps<T>) {
  const id = useId();

  return (
    <Labelled label={label} id={id}>
      <Choice
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value as T);
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] ?? option}
          </option>
        ))}
      </Choice>
    </Labelled>
  );
}
