import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { COLOR_FORMATS, type ColorFormat } from '../../domain/color';
import type { OutputMode } from '../../domain/css';
import { SegmentedControl } from '../../components/SegmentedControl';
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

const Code = styled.pre`
  margin: 0;
  padding: ${({ theme }) => theme.space.lg}px;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  overflow-x: auto;
  font-size: 0.8125rem;
  line-height: 1.6;
  white-space: pre;
  tab-size: 2;
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

  const [status, setStatus] = useState('');
  const timeoutRef = useRef<number | undefined>(undefined);

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
    <Panel aria-labelledby="css-output-heading">
      <h2 id="css-output-heading">CSS</h2>

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

      {/*
        The block scrolls when the CSS is long, so it must be focusable or
        keyboard users cannot scroll it at all (WCAG 2.1.1).
      */}
      <Code tabIndex={0}>
        <code>{css}</code>
      </Code>

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
  );
}
