import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import styled from 'styled-components';

/*
  Built on the native <dialog> rather than a hand-rolled overlay. `showModal()`
  gives us the focus trap, Escape handling, the top layer and focus restoration
  for free — all of which are easy to get subtly wrong by hand, and all of which
  are load-bearing for keyboard and screen reader users.

  jsdom implements none of it (see src/test/setup.ts), so the modal behaviour
  itself is asserted in Playwright.
*/
const Surface = styled.dialog`
  width: min(46rem, calc(100vw - ${({ theme }) => theme.space.xl}px));
  max-height: min(40rem, calc(100dvh - ${({ theme }) => theme.space.xxl}px));
  padding: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};

  &::backdrop {
    background: rgb(0 0 0 / 0.5);
  }
`;

const Frame = styled.div`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  max-height: inherit;
`;

const Head = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.md}px;
  padding: ${({ theme }) => theme.space.md}px ${({ theme }) => theme.space.lg}px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1rem;
`;

const Close = styled.button`
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
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Body = styled.div`
  overflow-y: auto;
  padding: ${({ theme }) => theme.space.lg}px;
`;

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Dialog({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  /*
    A click that lands on the dialog element itself came from the backdrop —
    anything inside the frame targets a descendant instead.
  */
  const onSurfaceClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target !== event.currentTarget) return;
      onClose();
    },
    [onClose],
  );

  return (
    <Surface ref={ref} aria-labelledby={titleId} onClose={onClose} onClick={onSurfaceClick}>
      <Frame>
        <Head>
          <Title id={titleId}>{title}</Title>
          <Close type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
            ✕
          </Close>
        </Head>
        <Body>{children}</Body>
      </Frame>
    </Surface>
  );
}
