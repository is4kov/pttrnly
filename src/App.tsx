import styled, { ThemeProvider } from 'styled-components';
import { GlobalStyle } from './styles/global';
import { darkTheme, lightTheme } from './styles/theme';
import { useAppSelector } from './app/hooks';
import { selectThemePreference } from './features/theme/selectors';
import { usePrefersDark } from './features/theme/usePrefersDark';

const Layout = styled.main`
  display: grid;
  gap: ${({ theme }) => theme.space.lg}px;
  padding: ${({ theme }) => theme.space.xl}px;
  max-width: 60rem;
  margin: 0 auto;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 1.5rem;
  letter-spacing: -0.02em;

  ${({ theme }) => theme.media.from('md')} {
    font-size: 2rem;
  }
`;

const Lede = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  max-width: 48ch;
`;

export default function App() {
  const preference = useAppSelector(selectThemePreference);
  const prefersDark = usePrefersDark();
  const isDark = preference === 'system' ? prefersDark : preference === 'dark';

  return (
    <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
      <GlobalStyle />
      <Layout>
        <Title>pttrnly</Title>
        <Lede>
          Compose complex CSS backgrounds from stacked gradient layers. The editor lands in a later
          task — this is the application shell.
        </Lede>
      </Layout>
    </ThemeProvider>
  );
}
