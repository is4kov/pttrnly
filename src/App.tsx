import styled, { ThemeProvider } from 'styled-components';
import { GlobalStyle } from './styles/global';
import { darkTheme, lightTheme } from './styles/theme';
import { useAppSelector } from './app/hooks';
import { selectThemePreference } from './features/theme/selectors';
import { usePrefersDark } from './features/theme/usePrefersDark';
import { PreviewSurface } from './features/preview/PreviewSurface';
import { CssOutput } from './features/export/CssOutput';
import { LayerList } from './features/layers/LayerList';
import { UndoDeleteToast } from './features/layers/UndoDeleteToast';

const Layout = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.xl}px;
  padding: ${({ theme }) => theme.space.lg}px;
  max-width: 76rem;
  margin: 0 auto;

  ${({ theme }) => theme.media.from('md')} {
    padding: ${({ theme }) => theme.space.xxl}px;
  }
`;

const Header = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${({ theme }) => theme.space.md}px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 1.5rem;
  letter-spacing: -0.02em;
`;

const Tagline = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.875rem;
`;

const Panes = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.xl}px;

  ${({ theme }) => theme.media.from('lg')} {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: start;
  }
`;

const Stack = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.xl}px;
  align-content: start;
`;

export default function App() {
  const preference = useAppSelector(selectThemePreference);
  const prefersDark = usePrefersDark();
  const isDark = preference === 'system' ? prefersDark : preference === 'dark';

  return (
    <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
      <GlobalStyle />
      <Layout>
        <Header>
          <Title>pttrnly</Title>
          <Tagline>Complex CSS backgrounds from stacked layers.</Tagline>
        </Header>
        <Panes>
          <Stack>
            <PreviewSurface />
            <CssOutput />
          </Stack>
          <LayerList />
        </Panes>
        <UndoDeleteToast />
      </Layout>
    </ThemeProvider>
  );
}
