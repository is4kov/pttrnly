import { css } from 'styled-components';

/**
 * Alpha checkerboard. Without it, "transparent" and "white" are indistinguishable —
 * a constant source of confusion in this class of tool. See CLAUDE.md "UI foundations".
 */
export const checkerboard = css`
  background-color: #ffffff;
  background-image:
    linear-gradient(45deg, #d8d8d8 25%, transparent 25%),
    linear-gradient(-45deg, #d8d8d8 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #d8d8d8 75%),
    linear-gradient(-45deg, transparent 75%, #d8d8d8 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
`;
