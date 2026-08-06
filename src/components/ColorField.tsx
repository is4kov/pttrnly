import { useEffect, useId, useState } from 'react';
import styled from 'styled-components';
import { isOutOfSrgbGamut, parseHex, serializeColor, type Color } from '../domain/color';
import { checkerboard } from './Checkerboard';
import { NumberField } from './Field';

const Wrapper = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.sm}px;
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

const Preview = styled.span`
  flex: 0 0 auto;
  position: relative;
  width: ${({ theme }) => theme.hitTarget};
  height: ${({ theme }) => theme.hitTarget};
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
  ${checkerboard}
`;

const Swatch = styled.span<{ $color: string }>`
  position: absolute;
  inset: 0;
  background: ${({ $color }) => $color};
`;

const Input = styled.input`
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
  font-family: ui-monospace, monospace;
`;

const Note = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

type Props = {
  label: string;
  value: Color;
  onChange: (color: Color) => void;
};

/**
 * A text field is the primary control, not a convenience: colour pickers alone
 * are unusable without sight, and this app is entirely about colour.
 * Alpha lives on its own because hex pickers cannot express it.
 */
export function ColorField({ label, value, onChange }: Props) {
  const id = useId();
  const noteId = `${id}-note`;

  const canonical = serializeColor({ ...value, alpha: 1 }, 'hex');
  const [draft, setDraft] = useState(canonical);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(canonical);
    setInvalid(false);
  }, [canonical]);

  const commit = (next: string) => {
    setDraft(next);
    const parsed = parseHex(next);

    if (!parsed) {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    onChange({ ...parsed, alpha: value.alpha });
  };

  const clipped = isOutOfSrgbGamut(value);
  const note = invalid
    ? 'Not a hex colour — try #4f46e5.'
    : clipped
      ? 'Outside sRGB. Hex, rgb and hsl output will shift this colour slightly.'
      : undefined;

  return (
    <Wrapper>
      <Label htmlFor={id}>{label}</Label>
      <Row>
        <Preview aria-hidden="true">
          <Swatch $color={serializeColor(value, 'hex')} />
        </Preview>
        <Input
          id={id}
          type="text"
          value={draft}
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={note ? noteId : undefined}
          onChange={(event) => {
            commit(event.target.value);
          }}
        />
      </Row>
      {note ? <Note id={noteId}>{note}</Note> : null}
      <NumberField
        label={`${label} opacity`}
        value={Math.round(value.alpha * 100)}
        min={0}
        max={100}
        suffix="%"
        onChange={(next) => {
          onChange({ ...value, alpha: next / 100 });
        }}
      />
    </Wrapper>
  );
}
