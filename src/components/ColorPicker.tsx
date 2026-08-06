import { useEffect, useId, useState } from 'react';
import styled from 'styled-components';
import { isOutOfSrgbGamut, makeColor, parseHex, serializeColor, type Color } from '../domain/color';
import { checkerboard } from './Checkerboard';

const Wrapper = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.sm}px;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.sm}px;
`;

const Preview = styled.span`
  position: relative;
  flex: 0 0 auto;
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

const HexInput = styled.input`
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

const Axis = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.xs}px;
`;

const AxisHead = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

/** The track shows the axis it controls, so the choice is visible before you drag. */
const AxisSlider = styled.input<{ $track: string }>`
  width: 100%;
  min-height: ${({ theme }) => theme.hitTarget};
  touch-action: none;
  appearance: none;
  background: ${({ $track }) => $track};
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};

  &::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ffffff;
    border: 2px solid #18181b;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ffffff;
    border: 2px solid #18181b;
    cursor: pointer;
  }
`;

const Note = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ramp = (steps: string[]): string => `linear-gradient(90deg, ${steps.join(', ')})`;

function lightnessTrack(color: Color): string {
  return ramp(
    [0, 0.25, 0.5, 0.75, 1].map((l) => serializeColor(makeColor(l, color.c, color.h), 'hex')),
  );
}

function chromaTrack(color: Color): string {
  return ramp(
    [0, 0.1, 0.2, 0.3, 0.4].map((c) => serializeColor(makeColor(color.l, c, color.h), 'hex')),
  );
}

function hueTrack(color: Color): string {
  const steps: string[] = [];
  for (let hue = 0; hue <= 360; hue += 30) {
    steps.push(serializeColor(makeColor(color.l, Math.max(color.c, 0.12), hue), 'hex'));
  }
  return ramp(steps);
}

function alphaTrack(color: Color): string {
  return ramp([
    serializeColor({ ...color, alpha: 0 }, 'hex'),
    serializeColor({ ...color, alpha: 1 }, 'hex'),
  ]);
}

type Props = {
  label: string;
  value: Color;
  onChange: (color: Color) => void;
};

/**
 * Operates on OKLCH directly rather than round-tripping through HSL, so it can
 * reach colours sRGB cannot express — and say so when it has.
 * The hex field stays the primary text affordance: a picker alone is unusable
 * without sight, and this app is entirely about colour.
 */
export function ColorPicker({ label, value, onChange }: Props) {
  const id = useId();
  const noteId = `${id}-note`;

  const hex = serializeColor({ ...value, alpha: 1 }, 'hex');
  const [draft, setDraft] = useState(hex);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(hex);
    setInvalid(false);
  }, [hex]);

  const commitHex = (next: string) => {
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
      ? 'Outside sRGB. Exporting as hex, rgb or hsl will shift this colour slightly.'
      : undefined;

  return (
    <Wrapper role="group" aria-label={label}>
      <Head>
        <Preview aria-hidden="true">
          <Swatch $color={serializeColor(value, 'hex')} />
        </Preview>
        <HexInput
          id={id}
          type="text"
          value={draft}
          spellCheck={false}
          aria-label={`${label} hex value`}
          aria-invalid={invalid}
          aria-describedby={note ? noteId : undefined}
          onChange={(event) => {
            commitHex(event.target.value);
          }}
        />
      </Head>

      {note ? <Note id={noteId}>{note}</Note> : null}

      <ChannelSlider
        label="Lightness"
        value={Math.round(value.l * 100)}
        min={0}
        max={100}
        track={lightnessTrack(value)}
        display={`${String(Math.round(value.l * 100))}%`}
        onChange={(next) => {
          onChange({ ...value, l: next / 100 });
        }}
      />
      <ChannelSlider
        label="Chroma"
        value={Math.round(value.c * 1000)}
        min={0}
        max={400}
        track={chromaTrack(value)}
        display={value.c.toFixed(3)}
        onChange={(next) => {
          onChange({ ...value, c: next / 1000 });
        }}
      />
      <ChannelSlider
        label="Hue"
        value={Math.round(value.h)}
        min={0}
        max={360}
        track={hueTrack(value)}
        display={`${String(Math.round(value.h))}°`}
        onChange={(next) => {
          onChange({ ...value, h: next });
        }}
      />
      <ChannelSlider
        label="Opacity"
        value={Math.round(value.alpha * 100)}
        min={0}
        max={100}
        track={alphaTrack(value)}
        display={`${String(Math.round(value.alpha * 100))}%`}
        onChange={(next) => {
          onChange({ ...value, alpha: next / 100 });
        }}
      />
    </Wrapper>
  );
}

function ChannelSlider({
  label,
  value,
  min,
  max,
  track,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  track: string;
  display: string;
  onChange: (value: number) => void;
}) {
  const id = useId();

  return (
    <Axis>
      <AxisHead>
        <label htmlFor={id}>{label}</label>
        <span>{display}</span>
      </AxisHead>
      <AxisSlider
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        $track={track}
        aria-valuetext={display}
        onChange={(event) => {
          onChange(event.target.valueAsNumber);
        }}
      />
    </Axis>
  );
}
