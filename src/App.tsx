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
import { CanvasEditor, LayerEditor } from './features/editor/LayerEditor';
import { PatternLibrary } from './features/presets/PatternLibrary';
import { useAutosave } from './features/persistence/useAutosave';
import { useShareLink } from './features/share/useShareLink';
import { ShareBanner } from './features/share/ShareBanner';

const Layout = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.xl}px;
  padding: ${({ theme }) => theme.space.lg}px;
  max-width: 90rem;
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

/* Pushes the export control to the far end of the header row. */
const HeaderActions = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.sm}px;
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

/*
  A <main> landmark, not a div: axe requires exactly one, and without it the
  whole editor sits outside any landmark and is unreachable by landmark nav.

  Flex rather than grid, and that is load-bearing: a sticky element inside a
  grid is confined to its own grid area, so as a grid row the preview would
  have no travel and would simply never stick. In a flex column its containing
  block is the whole main, which is what gives it somewhere to go.
*/
const Panes = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xl}px;
`;

/*
  One arrangement at every width, so scrolling can never rearrange anything.
  The editor genuinely passes underneath, so the pane needs its own opaque
  background and has to sit above the content.
*/
const PreviewPane = styled.div`
  position: sticky;
  top: 0;
  z-index: ${({ theme }) => theme.z.sheet};
  /*
    Padding rather than a margin below the preview: it sits inside the sticky
    pane, so the opaque background extends with it and the editor passes under
    a clean band instead of sliding right up to the preview's edge.
  */
  padding-block: ${({ theme }) => theme.space.sm}px ${({ theme }) => theme.space.xl}px;
  background: ${({ theme }) => theme.colors.bg};
`;

/*
  The layer rail and the editor panel, joined. No gap between the columns is
  deliberate: the selected row has to touch the panel for the two to read as
  one shape. Below md the panel drops underneath the rail instead.
*/
const Workbench = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.md}px;

  ${({ theme }) => theme.media.from('md')} {
    grid-template-columns: minmax(0, 17rem) minmax(0, 1fr);
    gap: 0;
    align-items: start;
  }
`;

/** Secondary settings, out of the main editing path. */
const Extras = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.xl}px;

  ${({ theme }) => theme.media.from('lg')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
`;

const Warning = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.space.sm}px ${({ theme }) => theme.space.md}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  font-size: 0.8125rem;
`;

export default function App() {
  const incomingLink = useShareLink();
  const storageProblem = useAutosave();
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
          <HeaderActions>
            <CssOutput />
          </HeaderActions>
        </Header>
        <ShareBanner incoming={incomingLink} />
        {storageProblem ? (
          <Warning role="status" aria-live="polite">
            {storageProblem}
          </Warning>
        ) : null}
        <Panes>
          <PreviewPane>
            <PreviewSurface />
          </PreviewPane>

          <Workbench>
            <LayerList />
            <LayerEditor />
          </Workbench>

          <Extras>
            <CanvasEditor />
            <PatternLibrary />
          </Extras>
        </Panes>
        <UndoDeleteToast />
      </Layout>
    </ThemeProvider>
  );
}
