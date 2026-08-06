import { useCallback, useRef } from 'react';
import styled from 'styled-components';
import { useAppDispatch } from '../../app/hooks';
import { checkerboard } from '../../components/Checkerboard';
import { ColorPicker } from '../../components/ColorPicker';
import { LengthField, type LengthRange } from '../../components/LengthField';
import { serializeColor, type Color } from '../../domain/color';
import type { Length, LengthUnit } from '../../domain/length';
import { MIN_STOPS, trackSpan } from '../../domain/stops';
import type { GradientStop } from '../../domain/types';
import {
  stopColorChanged,
  stopMoved,
  stopRemoved,
  stopSelected,
  stopsNormalised,
} from '../pattern/patternSlice';

const Wrapper = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.md}px;
`;

const TabList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.xs}px;
`;

const Tab = styled.button<{ $selected: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.xs}px;
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.md}px;
  border: 1px solid
    ${({ theme, $selected }) => ($selected ? theme.colors.accent : theme.colors.border)};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme, $selected }) => ($selected ? theme.colors.surface : theme.colors.bg)};
  color: ${({ theme, $selected }) => ($selected ? theme.colors.text : theme.colors.textMuted)};
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
`;

const Chip = styled.span`
  position: relative;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
  ${checkerboard}
`;

const ChipFill = styled.span<{ $color: string }>`
  position: absolute;
  inset: 0;
  background: ${({ $color }) => $color};
`;

const Panel = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.md}px;
  padding: ${({ theme }) => theme.space.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
`;

const Remove = styled.button`
  justify-self: start;
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

function rangesFor(span: Length): Record<LengthUnit, LengthRange> {
  return {
    '%': { min: 0, max: Math.max(100, span.unit === '%' ? span.value : 100) },
    px: { min: 0, max: Math.max(100, span.unit === 'px' ? span.value : 100) },
  };
}

type Props = {
  layerId: string;
  stops: readonly GradientStop[];
  selectedIndex: number;
};

/**
 * Tabs rather than a list: only one stop's properties are relevant at a time,
 * and stops that overlap on the bar are still individually reachable here.
 * Follows the APG tabs pattern — roving tabindex, arrows to move.
 */
export function StopTabs({ layerId, stops, selectedIndex }: Props) {
  const dispatch = useAppDispatch();
  const listRef = useRef<HTMLDivElement>(null);
  const ranges = rangesFor(trackSpan(stops));
  const stop = stops[selectedIndex];

  const select = useCallback(
    (index: number) => {
      dispatch(stopSelected(index));
    },
    [dispatch],
  );

  const focusTab = useCallback((index: number) => {
    const tabs = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[index]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const last = stops.length - 1;
      let next: number | null = null;

      if (event.key === 'ArrowRight') next = selectedIndex === last ? 0 : selectedIndex + 1;
      if (event.key === 'ArrowLeft') next = selectedIndex === 0 ? last : selectedIndex - 1;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = last;

      if (next === null) return;

      event.preventDefault();
      select(next);
      focusTab(next);
    },
    [focusTab, select, selectedIndex, stops.length],
  );

  const move = useCallback(
    (position: Length) => {
      dispatch(stopMoved({ layerId, index: selectedIndex, position }));
    },
    [dispatch, layerId, selectedIndex],
  );

  const recolour = useCallback(
    (color: Color) => {
      dispatch(stopColorChanged({ layerId, index: selectedIndex, color }));
    },
    [dispatch, layerId, selectedIndex],
  );

  const commit = useCallback(() => {
    dispatch(stopsNormalised({ layerId }));
  }, [dispatch, layerId]);

  const remove = useCallback(() => {
    dispatch(stopRemoved({ layerId, index: selectedIndex }));
  }, [dispatch, layerId, selectedIndex]);

  const panelId = `${layerId}-stop-panel`;

  return (
    <Wrapper>
      <TabList ref={listRef} role="tablist" aria-label="Colour stops" onKeyDown={onKeyDown}>
        {stops.map((candidate, index) => (
          <Tab
            key={`${String(index)}-${candidate.position.unit}`}
            type="button"
            role="tab"
            id={`${layerId}-stop-tab-${String(index)}`}
            aria-selected={index === selectedIndex}
            aria-controls={panelId}
            // Roving tabindex keeps the whole strip a single tab stop.
            tabIndex={index === selectedIndex ? 0 : -1}
            $selected={index === selectedIndex}
            onClick={() => {
              select(index);
            }}
          >
            <Chip aria-hidden="true">
              <ChipFill $color={serializeColor(candidate.color, 'hex')} />
            </Chip>
            Stop {index + 1}
          </Tab>
        ))}
      </TabList>

      {stop ? (
        <Panel
          role="tabpanel"
          id={panelId}
          aria-labelledby={`${layerId}-stop-tab-${String(selectedIndex)}`}
          tabIndex={0}
          onBlur={commit}
        >
          <LengthField
            label={`Stop ${String(selectedIndex + 1)} position`}
            value={stop.position}
            ranges={ranges}
            onChange={move}
          />
          <ColorPicker
            label={`Stop ${String(selectedIndex + 1)} colour`}
            value={stop.color}
            onChange={recolour}
          />
          <Remove type="button" disabled={stops.length <= MIN_STOPS} onClick={remove}>
            Remove stop {selectedIndex + 1}
          </Remove>
        </Panel>
      ) : null}
    </Wrapper>
  );
}
