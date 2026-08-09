import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { COLOR_FORMATS, type ColorFormat } from '../../domain/color';
import type { OutputMode } from '../../domain/css';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Dialog } from '../../components/Dialog';
import { colorFormatChanged, outputModeChanged } from '../pattern/patternSlice';
import { selectColorFormat, selectGeneratedCss, selectOutputMode } from '../pattern/selectors';
import { useShareUrl } from '../share/useShareLink';

const Panel = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.space.md}px;
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.md}px;
  align-items: center;
`;

/*
  A read-only textarea rather than a <pre>: it is focusable and scrollable
  without extra work, select-all behaves the way people expect in a code box,
  and it gives a manual path when the clipboard API is blocked.
*/
const Code = styled.textarea`
  width: 100%;
  min-height: 14rem;
  margin: 0;
  padding: ${({ theme }) => theme.space.lg}px;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8125rem;
  line-height: 1.6;
  white-space: pre;
  tab-size: 2;
  resize: vertical;
`;

const Open = styled.button`
  justify-self: start;
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.lg}px;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const CopyRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.md}px;
`;

const CopyButton = styled.button`
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.lg}px;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const Status = styled.span`
  font-size: 0.8125rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const MODE_LABELS: Record<OutputMode, string> = {
  longhand: 'Longhand',
  shorthand: 'Shorthand',
};

const OUTPUT_MODES: readonly OutputMode[] = ['longhand', 'shorthand'];

const FORMAT_LABELS: Record<ColorFormat, string> = {
  oklch: 'oklch',
  hex: 'hex',
  rgb: 'rgb',
  hsl: 'hsl',
};

export function CssOutput() {
  const dispatch = useAppDispatch();
  const css = useAppSelector(selectGeneratedCss);
  const mode = useAppSelector(selectOutputMode);
  const colorFormat = useAppSelector(selectColorFormat);

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const timeoutRef = useRef<number | undefined>(undefined);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setStatus('');
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  // A silent copy button feels broken, so the result is always announced.
  const announce = useCallback((message: string) => {
    setStatus(message);
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setStatus('');
    }, 2500);
  }, []);

  const shareUrl = useShareUrl();

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(
      () => {
        announce('Share link copied');
      },
      () => {
        announce('Copy failed — select the link and copy manually');
      },
    );
  }, [announce, shareUrl]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(css).then(
      () => {
        announce('Copied to clipboard');
      },
      () => {
        announce('Copy failed — select the text and copy manually');
      },
    );
  }, [announce, css]);

  const handleMode = useCallback(
    (next: OutputMode) => {
      dispatch(outputModeChanged(next));
    },
    [dispatch],
  );

  const handleFormat = useCallback(
    (next: ColorFormat) => {
      dispatch(colorFormatChanged(next));
    },
    [dispatch],
  );

  return (
    <>
      <Open type="button" onClick={openDialog}>
        Show CSS
      </Open>

      <Dialog open={open} onClose={closeDialog} title="Generated CSS">
        <Panel>
          <Controls>
            <SegmentedControl
              legend="Output"
              name="output-mode"
              value={mode}
              options={OUTPUT_MODES}
              labels={MODE_LABELS}
              onChange={handleMode}
            />
            <SegmentedControl
              legend="Colours"
              name="color-format"
              value={colorFormat}
              options={COLOR_FORMATS}
              labels={FORMAT_LABELS}
              onChange={handleFormat}
            />
          </Controls>

          <Code readOnly value={css} spellCheck={false} aria-label="Generated CSS" />

          <CopyRow>
            <CopyButton type="button" onClick={copy}>
              Copy CSS
            </CopyButton>
            <CopyButton type="button" onClick={copyLink}>
              Copy share link
            </CopyButton>
            <Status role="status" aria-live="polite">
              {status}
            </Status>
          </CopyRow>
        </Panel>
      </Dialog>
    </>
  );
}
