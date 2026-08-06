import { useCallback, useId, useState } from 'react';
import styled from 'styled-components';
import { useAppDispatch } from '../../app/hooks';
import { KIND_NAMES } from '../../domain/defaults';
import { LAYER_KINDS, type LayerKind } from '../../domain/types';
import { layerAdded } from '../pattern/patternSlice';

const Row = styled.div`
  display: flex;
  align-items: end;
  gap: ${({ theme }) => theme.space.sm}px;
`;

const Group = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.xs}px;
  flex: 1 1 auto;
  min-width: 0;
`;

const Label = styled.label`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
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

const Add = styled.button`
  flex: 0 0 auto;
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.lg}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

export function AddLayerMenu() {
  const dispatch = useAppDispatch();
  const id = useId();
  const [kind, setKind] = useState<LayerKind>('linear-gradient');

  const add = useCallback(() => {
    dispatch(layerAdded(kind));
  }, [dispatch, kind]);

  return (
    <Row>
      <Group>
        <Label htmlFor={id}>New layer</Label>
        <Choice
          id={id}
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as LayerKind);
          }}
        >
          {LAYER_KINDS.map((option) => (
            <option key={option} value={option}>
              {KIND_NAMES[option]}
            </option>
          ))}
        </Choice>
      </Group>
      <Add type="button" onClick={add}>
        Add layer
      </Add>
    </Row>
  );
}
