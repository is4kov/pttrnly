import { useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { lastRemovalDismissed, lastRemovalUndone } from '../pattern/patternSlice';

const UNDO_WINDOW_MS = 8000;

const Bar = styled.div`
  position: sticky;
  bottom: ${({ theme }) => theme.space.md}px;
  z-index: ${({ theme }) => theme.z.toast};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.md}px;
  padding: ${({ theme }) => theme.space.sm}px ${({ theme }) => theme.space.md}px;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  font-size: 0.875rem;
`;

const Action = styled.button`
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
`;

/**
 * Undo/redo is deferred, so deletion would otherwise be unrecoverable.
 * This covers the common misclick without adding friction to every delete.
 */
export function UndoDeleteToast() {
  const dispatch = useAppDispatch();
  const removed = useAppSelector((state) => state.pattern.lastRemoved);
  const name = removed?.layer.name;

  useEffect(() => {
    if (!removed) return undefined;

    const timer = window.setTimeout(() => {
      dispatch(lastRemovalDismissed());
    }, UNDO_WINDOW_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [dispatch, removed]);

  const undo = useCallback(() => {
    dispatch(lastRemovalUndone());
  }, [dispatch]);

  if (!removed) return null;

  return (
    <Bar role="status" aria-live="polite">
      <span>Deleted “{name}”.</span>
      <Action type="button" onClick={undo}>
        Undo
      </Action>
    </Bar>
  );
}
