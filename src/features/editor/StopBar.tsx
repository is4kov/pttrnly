import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { checkerboard } from '../../components/Checkerboard';
import { serializeColor } from '../../domain/color';
import { formatLength } from '../../domain/length';
import {
  colorAtFraction,
  fractionToLength,
  MAX_STOPS,
  MIN_STOPS,
  stopFraction,
  trackSpan,
} from '../../domain/stops';
import type { GradientStop } from '../../domain/types';
import {
  stopAdded,
  stopMoved,
  stopRemoved,
  stopSelected,
  stopsNormalised,
} from '../pattern/patternSlice';
import { selectColorFormat } from '../pattern/selectors';

const Wrapper = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.xs}px;
`;

const Head = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Track = styled.div`
  position: relative;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
  cursor: copy;
  ${checkerboard}
`;

const Ramp = styled.div<{ $image: string }>`
  position: absolute;
  inset: 0;
  background-image: ${({ $image }) => $image};
  /* Decorative, and it covers the whole track — let clicks reach the track. */
  pointer-events: none;
`;

/**
 * The visual handle is small, but the hit area is a full 44px so it stays
 * usable on touch — see CLAUDE.md "Mobile".
 */
const Handle = styled.button<{ $fraction: number; $selected: boolean }>`
  position: absolute;
  top: 50%;
  left: ${({ $fraction }) => $fraction * 100}%;
  transform: translate(-50%, -50%);
  width: ${({ theme }) => theme.hitTarget};
  height: ${({ theme }) => theme.hitTarget};
  padding: 0;
  border: 0;
  background: none;
  cursor: grab;
  touch-action: none;

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 16px;
    height: 24px;
    border-radius: 4px;
    background: ${({ $selected }) => ($selected ? '#18181b' : '#ffffff')};
    border: 2px solid ${({ $selected }) => ($selected ? '#ffffff' : '#18181b')};
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
  }

  &:active {
    cursor: grabbing;
  }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.sm}px;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Action = styled.button`
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const Live = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`;

const NUDGE = 1;
const COARSE_NUDGE = 10;

type Props = {
  layerId: string;
  stops: readonly GradientStop[];
  selectedIndex: number;
};

export function StopBar({ layerId, stops, selectedIndex }: Props) {
  const dispatch = useAppDispatch();
  const colorFormat = useAppSelector(selectColorFormat);
  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const [announcement, setAnnouncement] = useState('');

  const span = trackSpan(stops);

  useEffect(
    () => () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const rampImage = `linear-gradient(90deg, ${stops
    .map((stop) => `${serializeColor(stop.color, colorFormat)} ${formatLength(stop.position)}`)
    .join(', ')})`;

  const fractionFromEvent = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;

    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return (clientX - rect.left) / rect.width;
  }, []);

  /** Drag updates go through rAF so a fast pointer cannot outpace React. */
  const moveTo = useCallback(
    (index: number, fraction: number) => {
      const stop = stops[index];
      if (!stop) return;

      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        dispatch({
          ...stopMoved({
            layerId,
            index,
            position: fractionToLength(fraction, stop.position.unit, span),
          }),
        });
      });
    },
    [dispatch, layerId, span, stops],
  );

  const handlePointerDown = useCallback(
    (index: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
      // preventDefault stops text selection and the native drag, but it also
      // suppresses the focus a click would normally give the button — so focus
      // it explicitly, or click-then-arrow-key does nothing.
      event.preventDefault();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      dispatch(stopSelected(index));
    },
    [dispatch],
  );

  const handlePointerMove = useCallback(
    (index: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      moveTo(index, fractionFromEvent(event.clientX));
    },
    [fractionFromEvent, moveTo],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      dispatch(stopsNormalised({ layerId }));
    },
    [dispatch, layerId],
  );

  const handleKeyDown = useCallback(
    (index: number) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const stop = stops[index];
      if (!stop) return;

      const step = event.shiftKey ? COARSE_NUDGE : NUDGE;
      let next: number | null = null;

      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = stop.position.value - step;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = stop.position.value + step;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = span.value;

      if (next !== null) {
        event.preventDefault();
        const clamped = Math.min(Math.max(next, 0), span.value);
        dispatch(stopMoved({ layerId, index, position: { ...stop.position, value: clamped } }));
        setAnnouncement(`Stop ${String(index + 1)} at ${String(clamped)}${stop.position.unit}`);
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && stops.length > MIN_STOPS) {
        event.preventDefault();
        dispatch(stopRemoved({ layerId, index }));
        setAnnouncement(`Stop ${String(index + 1)} removed`);
      }
    },
    [dispatch, layerId, span, stops],
  );

  const addAt = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Anything but a handle counts as a click on the track. Comparing target
      // to currentTarget looks equivalent but is not: the ramp overlays the
      // track, so in a real browser the target is never the track itself.
      if ((event.target as Element).closest('[role="slider"]')) return;

      if (stops.length >= MAX_STOPS) {
        setAnnouncement(`A gradient can hold at most ${String(MAX_STOPS)} stops`);
        return;
      }

      const fraction = Math.min(Math.max(fractionFromEvent(event.clientX), 0), 1);
      const unit = stops[0]?.position.unit ?? '%';

      dispatch(
        stopAdded({
          layerId,
          stop: {
            color: colorAtFraction(stops, fraction),
            position: fractionToLength(fraction, unit, span),
          },
        }),
      );
      setAnnouncement('Stop added');
    },
    [dispatch, fractionFromEvent, layerId, span, stops],
  );

  const removeSelected = useCallback(() => {
    dispatch(stopRemoved({ layerId, index: selectedIndex }));
    setAnnouncement('Stop removed');
  }, [dispatch, layerId, selectedIndex]);

  return (
    <Wrapper>
      <Head>
        <span id={`${layerId}-stops-label`}>Stops</span>
        <span>0 to {formatLength(span)}</span>
      </Head>

      <Track ref={trackRef} onClick={addAt} data-testid="stop-track">
        <Ramp $image={rampImage} aria-hidden="true" />
        {stops.map((stop, index) => (
          <Handle
            key={`${String(index)}-${stop.position.unit}`}
            type="button"
            role="slider"
            aria-label={`Stop ${String(index + 1)}`}
            aria-valuemin={0}
            aria-valuemax={span.value}
            aria-valuenow={stop.position.value}
            aria-valuetext={`${formatLength(stop.position)}, ${serializeColor(stop.color, 'hex')}`}
            $fraction={stopFraction(stop, span)}
            $selected={index === selectedIndex}
            onPointerDown={handlePointerDown(index)}
            onPointerMove={handlePointerMove(index)}
            onPointerUp={handlePointerUp}
            onKeyDown={handleKeyDown(index)}
            onFocus={() => {
              dispatch(stopSelected(index));
            }}
          />
        ))}
      </Track>

      <Row>
        <span>Click the bar to add a stop. Arrow keys nudge, Delete removes.</span>
        <Action type="button" onClick={removeSelected} disabled={stops.length <= MIN_STOPS}>
          Remove stop
        </Action>
      </Row>

      <Live role="status" aria-live="polite">
        {announcement}
      </Live>
    </Wrapper>
  );
}
