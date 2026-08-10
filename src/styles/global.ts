import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html {
    color-scheme: ${({ theme }) => theme.name};
  }

  /*
    How much of the viewport the pinned preview occupies. A custom property
    because two unrelated components need to agree on it: the preview sets its
    own height from it, and anything pinned underneath offsets by it.
  */
  :root {
    --preview-pinned: 40dvh;
  }

  body {
    margin: 0;
    min-height: 100dvh;
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.text};
    font-family: system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /*
    Heading level and heading size are decided once, here. Left to browser
    defaults, two h2s sat at wildly different sizes depending on whether a
    component happened to override them, which made same-level headings read
    as different levels.
  */
  h2 {
    margin: 0;
    font-size: 1.125rem;
    line-height: 1.35;
  }

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.35;
  }

  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: 2px;
  }

  ${({ theme }) => theme.media.reducedMotion} {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;
