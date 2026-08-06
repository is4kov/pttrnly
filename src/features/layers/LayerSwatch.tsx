import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useAppSelector } from '../../app/hooks';
import { checkerboard } from '../../components/Checkerboard';
import { generateCss } from '../../domain/css';
import type { Layer } from '../../domain/types';
import { makeSwatchPattern, selectColorFormat, selectPattern } from '../pattern/selectors';

const Frame = styled.span`
  display: block;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
  ${checkerboard}
`;

const Fill = styled.span`
  display: block;
  width: 100%;
  height: 100%;
`;

/** Renders this layer alone through the same generator the preview uses. */
export function LayerSwatch({ layer }: { layer: Layer }) {
  const pattern = useAppSelector(selectPattern);
  const colorFormat = useAppSelector(selectColorFormat);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.cssText = generateCss(makeSwatchPattern(pattern, layer), {
      mode: 'longhand',
      colorFormat,
    });
  }, [colorFormat, layer, pattern]);

  return (
    <Frame aria-hidden="true">
      <Fill ref={ref} />
    </Frame>
  );
}
