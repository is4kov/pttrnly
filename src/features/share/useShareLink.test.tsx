import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encodePattern } from './codec';
import { ShareBanner } from './ShareBanner';
import { useShareLink } from './useShareLink';
import { makeStore, patternStateFor } from '../../test/render';
import { makeLinearLayer, makePattern, makeSolidLayer } from '../../test/factories';
import { saveSession } from '../persistence/storage';
import { lightTheme } from '../../styles/theme';
import type { Pattern } from '../../domain/types';

function Harness({ store }: { store: ReturnType<typeof makeStore> }) {
  function Inner() {
    const incoming = useShareLink();
    return <ShareBanner incoming={incoming} />;
  }

  return (
    <Provider store={store}>
      <ThemeProvider theme={lightTheme}>
        <Inner />
      </ThemeProvider>
    </Provider>
  );
}

const setHash = (value: string) => {
  window.location.hash = value;
};

beforeEach(() => {
  window.localStorage.clear();
  setHash('');
});

afterEach(() => {
  setHash('');
});

describe('incoming share links', () => {
  it('loads a pattern from the URL', async () => {
    const shared = makePattern([makeSolidLayer({ id: 'shared', name: 'Shared' })]);
    setHash(`#p=${encodePattern(shared)}`);

    const store = makeStore({ pattern: patternStateFor(makePattern([makeLinearLayer()])) });
    render(<Harness store={store} />);

    await waitFor(() => {
      expect(store.getState().pattern.pattern.layers[0]?.id).toBe('shared');
    });
  });

  it('keeps autosaved work and offers a way back to it', async () => {
    const mine: Pattern = makePattern([makeLinearLayer({ id: 'mine', name: 'Mine' })]);
    saveSession(mine);

    const shared = makePattern([makeSolidLayer({ id: 'shared', name: 'Shared' })]);
    setHash(`#p=${encodePattern(shared)}`);

    const store = makeStore({ pattern: patternStateFor(mine) });
    const user = userEvent.setup();
    render(<Harness store={store} />);

    await waitFor(() => {
      expect(store.getState().pattern.pattern.layers[0]?.id).toBe('shared');
    });

    // The link won, but nothing was destroyed.
    await user.click(screen.getByRole('button', { name: 'Go back to my pattern' }));

    expect(store.getState().pattern.pattern.layers[0]?.id).toBe('mine');
  });

  it('says so when a link cannot be decoded', async () => {
    setHash('#p=not-a-real-payload');

    const store = makeStore({ pattern: patternStateFor(makePattern([makeLinearLayer()])) });
    render(<Harness store={store} />);

    expect(await screen.findByText(/invalid or corrupted/)).toBeInTheDocument();
    // The user's own pattern is untouched.
    expect(store.getState().pattern.pattern.layers[0]?.kind).toBe('linear-gradient');
  });

  it('does nothing without a link', () => {
    const store = makeStore({ pattern: patternStateFor(makePattern([makeLinearLayer()])) });
    render(<Harness store={store} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(store.getState().pattern.pattern.layers[0]?.kind).toBe('linear-gradient');
  });

  it('offers no way back when there was no displaced work', async () => {
    const shared = makePattern([makeSolidLayer({ id: 'shared' })]);
    setHash(`#p=${encodePattern(shared)}`);

    const store = makeStore({ pattern: patternStateFor(makePattern([makeLinearLayer()])) });
    render(<Harness store={store} />);

    await waitFor(() => {
      expect(store.getState().pattern.pattern.layers[0]?.id).toBe('shared');
    });
    expect(screen.queryByRole('button', { name: 'Go back to my pattern' })).not.toBeInTheDocument();
  });
});

describe('outgoing URL sync', () => {
  it('writes the pattern into the hash without adding history entries', async () => {
    const before = window.history.length;
    const store = makeStore({ pattern: patternStateFor(makePattern([makeLinearLayer()])) });
    render(<Harness store={store} />);

    await waitFor(
      () => {
        expect(window.location.hash.startsWith('#p=')).toBe(true);
      },
      { timeout: 2000 },
    );

    expect(window.history.length).toBe(before);
  });
});
