import { useEffect, useId, useState } from 'react';
import styled from 'styled-components';
import type { Length, LengthUnit } from '../domain/length';
import { LENGTH_UNITS } from '../domain/length';

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
  flex: 0 0 4.5rem;
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.sm}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
`;

const Unit = styled.select`
  flex: 0 0 auto;
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.xs}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
`;

export type LengthRange = { min: number; max: number };

type Props = {
  label: string;
  value: Length;
  /** Slider bounds differ per unit — 40% and 40px are not comparable magnitudes. */
  ranges: Record<LengthUnit, LengthRange>;
  onChange: (value: Length) => void;
};

/**
 * A number paired with its unit. Without this the editor could only express
 * percentages, which makes fixed-size tiles — and therefore background-repeat —
 * impossible to reach.
 */
export function LengthField({ label, value, ranges, onChange }: Props) {
  const id = useId();
  const unitId = `${id}-unit`;
  const range = ranges[value.unit];

  const [draft, setDraft] = useState(String(value.value));

  useEffect(() => {
    setDraft(String(value.value));
  }, [value.value]);

  return (
    <Wrapper>
      <Label htmlFor={id}>{label}</Label>
      <Row>
        <Slider
          type="range"
          min={range.min}
          max={range.max}
          step={1}
          value={value.value}
          aria-label={`${label} slider`}
          onChange={(event) => {
            onChange({ value: event.target.valueAsNumber, unit: value.unit });
          }}
        />
        <NumberInput
          id={id}
          type="number"
          min={range.min}
          max={range.max}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            const next = event.target.valueAsNumber;
            if (!Number.isNaN(next)) onChange({ value: next, unit: value.unit });
          }}
          onBlur={() => {
            setDraft(String(value.value));
          }}
        />
        <Unit
          id={unitId}
          value={value.unit}
          aria-label={`${label} unit`}
          onChange={(event) => {
            // Keep the number, change the unit — 40% becomes 40px, which is predictable.
            onChange({ value: value.value, unit: event.target.value as LengthUnit });
          }}
        >
          {LENGTH_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </Unit>
      </Row>
    </Wrapper>
  );
}
