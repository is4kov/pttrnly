import { useCallback, useState } from 'react';
import styled from 'styled-components';
import { useAppDispatch } from '../../app/hooks';
import { patternLoaded } from '../pattern/patternSlice';
import type { IncomingLink } from './useShareLink';

const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.md}px;
  padding: ${({ theme }) => theme.space.sm}px ${({ theme }) => theme.space.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
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
 * Explains what an incoming link did, and offers the way back to displaced
 * work. Opening someone's link must never quietly cost you your own pattern.
 */
export function ShareBanner({ incoming }: { incoming: IncomingLink }) {
  const dispatch = useAppDispatch();
  const [dismissed, setDismissed] = useState(false);

  const restore = useCallback(() => {
    if (incoming.kind !== 'loaded' || !incoming.displacedSession) return;
    dispatch(patternLoaded(incoming.displacedSession));
    setDismissed(true);
  }, [dispatch, incoming]);

  if (dismissed) return null;

  if (incoming.kind === 'invalid') {
    return (
      <Bar role="status" aria-live="polite">
        <span>
          That link is invalid or corrupted, so it could not be opened. Your own pattern is
          untouched.
        </span>
        <Action
          type="button"
          onClick={() => {
            setDismissed(true);
          }}
        >
          Dismiss
        </Action>
      </Bar>
    );
  }

  if (incoming.kind !== 'loaded' || !incoming.displacedSession) return null;

  return (
    <Bar role="status" aria-live="polite">
      <span>Opened a shared pattern. Your previous work is still saved.</span>
      <Action type="button" onClick={restore}>
        Go back to my pattern
      </Action>
    </Bar>
  );
}
