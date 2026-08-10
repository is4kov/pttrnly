import styled, { css } from 'styled-components';

/**
 * Native select chrome, replaced.
 *
 * The UA-drawn arrow sits hard against the right edge and ignores padding, so
 * the only way to give it room is to turn it off and draw our own. Doing that
 * here rather than per component keeps every dropdown in the app identical.
 */
export const selectChrome = css`
  appearance: none;
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.xxl}px 0 ${({ theme }) => theme.space.sm}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
`;

/**
 * Wraps a select and draws the chevron. Borders rather than a glyph so it
 * inherits a theme colour and stays crisp at any zoom, and `pointer-events:
 * none` so clicking the arrow still opens the menu.
 */
export const SelectShell = styled.div`
  position: relative;
  display: grid;
  min-width: 0;

  &::after {
    content: '';
    position: absolute;
    right: ${({ theme }) => theme.space.md}px;
    top: 50%;
    width: 7px;
    height: 7px;
    border-right: 2px solid ${({ theme }) => theme.colors.textMuted};
    border-bottom: 2px solid ${({ theme }) => theme.colors.textMuted};
    transform: translateY(-70%) rotate(45deg);
    pointer-events: none;
  }
`;
