import { useCallback, useState } from 'react';
import styled from 'styled-components';
import { useAppDispatch } from '../../app/hooks';
import { Dialog } from '../../components/Dialog';
import { KIND_NAMES } from '../../domain/defaults';
import { CREATABLE_KINDS, type LayerKind } from '../../domain/types';
import { layerAdded } from '../pattern/patternSlice';

const Trigger = styled.button`
  width: 100%;
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.md}px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: none;
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    border-style: solid;
  }
`;

const Choices = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.sm}px;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
`;

const Choice = styled.button`
  min-height: ${({ theme }) => theme.hitTarget};
  padding: ${({ theme }) => theme.space.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    background: ${({ theme }) => theme.colors.surface};
  }
`;

/**
 * Picking a layer type is a one-off decision at creation, so it does not earn
 * permanent space in the rail. A button that opens a dialog also lets the
 * choices be described properly, which a bare <select> cannot do.
 */
export function AddLayerButton() {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const add = useCallback(
    (kind: LayerKind) => {
      dispatch(layerAdded(kind));
      setOpen(false);
    },
    [dispatch],
  );

  return (
    <>
      <Trigger
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Add layer
      </Trigger>

      <Dialog open={open} onClose={close} title="Add a layer">
        <Choices>
          {CREATABLE_KINDS.map((kind) => (
            <Choice
              key={kind}
              type="button"
              onClick={() => {
                add(kind);
              }}
            >
              {KIND_NAMES[kind]}
            </Choice>
          ))}
        </Choices>
      </Dialog>
    </>
  );
}
