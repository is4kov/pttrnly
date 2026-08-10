import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useAppSelector } from '../../app/hooks';
import { checkerboard } from '../../components/Checkerboard';
import { selectGeneratedCss, selectVisibleLayerCount } from '../pattern/selectors';

const Frame = styled.div`
  position: relative;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
  ${checkerboard}
`;

const Surface = styled.div`
  width: 100%;
  aspect-ratio: 16 / 10;
  min-height: 220px;
  /*
    The cap wins over the ratio, leaving a wider preview rather than a taller
    page. It is pinned above the editor at every size, so it has to leave
    enough of the viewport to actually work in.
  */
  max-height: var(--preview-pinned);
`;

const EmptyState = styled.p`
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  margin: 0;
  padding: ${({ theme }) => theme.space.lg}px;
  text-align: center;
  color: #52525b;
  background: rgba(255, 255, 255, 0.82);
  font-size: 0.875rem;
`;

/**
 * Renders by applying the generated CSS string itself — never a parallel
 * implementation. If this could diverge from what the copy button gives you,
 * the output stops being trustworthy. See CLAUDE.md "Architecture".
 */
export function PreviewSurface() {
  const css = useAppSelector(selectGeneratedCss);
  const visibleLayers = useAppSelector(selectVisibleLayerCount);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;
    element.style.cssText = css;
  }, [css]);

  return (
    <Frame>
      <Surface
        ref={surfaceRef}
        data-testid="preview-surface"
        role="img"
        aria-label="Pattern preview"
      />
      {visibleLayers === 0 && (
        <EmptyState>
          Every layer is hidden. Only the base colour is showing — turn a layer back on to see the
          pattern.
        </EmptyState>
      )}
    </Frame>
  );
}
