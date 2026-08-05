import type { AppTheme } from './theme';

declare module 'styled-components' {
  // Widening the library's DefaultTheme to our own theme shape.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}
