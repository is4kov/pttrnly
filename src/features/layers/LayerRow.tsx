import { memo, useCallback } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import type { LayerKind } from '../../domain/types';
import { LayerSwatch } from './LayerSwatch';
import {
  layerDuplicated,
  layerMoved,
  layerRemoved,
  layerSelected,
  layerVisibilityToggled,
} from '../pattern/patternSlice';
import { selectLayerById, selectSelectedLayerId } from '../pattern/selectors';

const KIND_LABELS: Record<LayerKind, string> = {
  'linear-gradient': 'Linear gradient',
  'repeating-linear-gradient': 'Repeating linear',
  'radial-gradient': 'Radial gradient',
  'repeating-radial-gradient': 'Repeating radial',
  'conic-gradient': 'Conic gradient',
  'repeating-conic-gradient': 'Repeating conic',
  solid: 'Solid colour',
  image: 'Image',
};

const Row = styled.li<{ $selected: boolean; $hidden: boolean; $dragging: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.md}px;
  padding: ${({ theme }) => theme.space.sm}px;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid
    ${({ theme, $selected }) => ($selected ? theme.colors.accent : theme.colors.border)};
  background: ${({ theme }) => theme.colors.bg};
  opacity: ${({ $hidden }) => ($hidden ? 0.55 : 1)};
  position: relative;
  z-index: ${({ $dragging }) => ($dragging ? 1 : 0)};
  box-shadow: ${({ $dragging }) => ($dragging ? '0 8px 24px rgba(0, 0, 0, 0.28)' : 'none')};

  /*
    Only the rows making room animate. The lifted row already tracks the
    pointer, so easing it as well would make it lag behind the finger.
  */
  @media (prefers-reduced-motion: no-preference) {
    transition: ${({ $dragging }) => ($dragging ? 'none' : 'transform 160ms ease')};
  }
`;

/*
  Not focusable and hidden from assistive tech on purpose: the move up/down
  buttons are the accessible reordering path, and a tab stop that does nothing
  on Enter is worse than no tab stop. See CLAUDE.md "Accessibility".
*/
const DragHandle = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: ${({ theme }) => theme.hitTarget};
  min-height: ${({ theme }) => theme.hitTarget};
  margin-right: -${({ theme }) => theme.space.sm}px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.875rem;
  cursor: grab;
  /* Without this the page scrolls instead of the row dragging on touch. */
  touch-action: none;
  user-select: none;

  &:active {
    cursor: grabbing;
  }
`;

const Name = styled.button`
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  gap: 2px;
  justify-items: start;
  text-align: left;
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.sm}px;
  border: 0;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
`;

const Title = styled.span`
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
`;

const Kind = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
`;

const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: ${({ theme }) => theme.hitTarget};
  min-height: ${({ theme }) => theme.hitTarget};
  border: 0;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: none;
  color: ${({ theme }) => theme.colors.textMuted};
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;

type Props = {
  id: string;
  index: number;
  total: number;
  dragging: boolean;
  offset: number;
  onDragStart: (event: React.PointerEvent<HTMLElement>, id: string, index: number) => void;
};

function LayerRowComponent({ id, index, total, dragging, offset, onDragStart }: Props) {
  const dispatch = useAppDispatch();
  const layer = useAppSelector((state) => selectLayerById(state, id));
  const selectedId = useAppSelector(selectSelectedLayerId);

  const select = useCallback(() => {
    dispatch(layerSelected(id));
  }, [dispatch, id]);

  const toggle = useCallback(() => {
    dispatch(layerVisibilityToggled(id));
  }, [dispatch, id]);

  const moveUp = useCallback(() => {
    dispatch(layerMoved({ id, direction: 'up' }));
  }, [dispatch, id]);

  const moveDown = useCallback(() => {
    dispatch(layerMoved({ id, direction: 'down' }));
  }, [dispatch, id]);

  const duplicate = useCallback(() => {
    dispatch(layerDuplicated(id));
  }, [dispatch, id]);

  const remove = useCallback(() => {
    dispatch(layerRemoved(id));
  }, [dispatch, id]);

  const grab = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      onDragStart(event, id, index);
    },
    [onDragStart, id, index],
  );

  if (!layer) return null;

  const kindLabel = KIND_LABELS[layer.kind];

  return (
    <Row
      $selected={layer.id === selectedId}
      $hidden={!layer.visible}
      $dragging={dragging}
      // Inline rather than a styled prop: styled-components would mint a new
      // class for every pixel of travel. See CLAUDE.md "Performance".
      style={offset === 0 ? undefined : { transform: `translateY(${String(offset)}px)` }}
      data-testid="layer-row"
    >
      <DragHandle onPointerDown={grab} aria-hidden="true" data-testid="drag-handle">
        ⠿
      </DragHandle>

      <LayerSwatch layer={layer} />

      <Name
        type="button"
        onClick={select}
        aria-label={`Select ${layer.name}`}
        aria-current={layer.id === selectedId}
      >
        <Title>{layer.name}</Title>
        <Kind>{kindLabel}</Kind>
      </Name>

      <Actions>
        <IconButton
          type="button"
          onClick={toggle}
          aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
          aria-pressed={!layer.visible}
        >
          {layer.visible ? '◉' : '○'}
        </IconButton>
        <IconButton
          type="button"
          onClick={moveUp}
          disabled={index === 0}
          aria-label={`Move ${layer.name} up`}
        >
          ↑
        </IconButton>
        <IconButton
          type="button"
          onClick={moveDown}
          disabled={index === total - 1}
          aria-label={`Move ${layer.name} down`}
        >
          ↓
        </IconButton>
        <IconButton type="button" onClick={duplicate} aria-label={`Duplicate ${layer.name}`}>
          ⧉
        </IconButton>
        <IconButton type="button" onClick={remove} aria-label={`Delete ${layer.name}`}>
          ✕
        </IconButton>
      </Actions>
    </Row>
  );
}

/** Memoized so toggling one layer does not re-render the whole stack. */
export const LayerRow = memo(LayerRowComponent);
