import { useCallback, useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { checkerboard } from '../../components/Checkerboard';
import { generateCss } from '../../domain/css';
import type { Pattern } from '../../domain/types';
import {
  libraryLoaded,
  patternLoaded,
  patternSaved,
  savedPatternRemoved,
} from '../pattern/patternSlice';
import {
  selectColorFormat,
  selectHasUnsavedChanges,
  selectLibrary,
  selectPattern,
} from '../pattern/selectors';
import {
  loadLibrary,
  MAX_SAVED_PATTERNS,
  saveLibrary,
  type SavedPattern,
} from '../persistence/storage';
import { presets } from './presets';

const Panel = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.space.md}px;
`;

const Grid = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: ${({ theme }) => theme.space.sm}px;
`;

const Card = styled.li`
  display: grid;
  gap: ${({ theme }) => theme.space.xs}px;
`;

const Load = styled.button`
  display: grid;
  gap: ${({ theme }) => theme.space.xs}px;
  padding: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bg};
  color: inherit;
  font: inherit;
  text-align: left;
  overflow: hidden;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const Thumb = styled.span`
  display: block;
  height: 72px;
  ${checkerboard}
`;

const Caption = styled.span`
  display: grid;
  gap: 2px;
  padding: ${({ theme }) => theme.space.sm}px;
`;

const Name = styled.span`
  font-size: 0.8125rem;
`;

const Note = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const SaveRow = styled.form`
  display: flex;
  align-items: end;
  gap: ${({ theme }) => theme.space.sm}px;
`;

const FieldGroup = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.xs}px;
  flex: 1 1 auto;
  min-width: 0;
`;

const Label = styled.label`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Input = styled.input`
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.sm}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
`;

const Button = styled.button`
  min-height: ${({ theme }) => theme.hitTarget};
  padding: 0 ${({ theme }) => theme.space.lg}px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const Small = styled.button`
  justify-self: start;
  min-height: 32px;
  padding: 0 ${({ theme }) => theme.space.sm}px;
  border: 0;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: none;
  color: ${({ theme }) => theme.colors.textMuted};
  font: inherit;
  font-size: 0.75rem;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Status = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

function Thumbnail({ pattern }: { pattern: Pattern }) {
  const colorFormat = useAppSelector(selectColorFormat);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.cssText = generateCss(pattern, { mode: 'longhand', colorFormat });
  }, [colorFormat, pattern]);

  return <Thumb ref={ref} aria-hidden="true" />;
}

export function PatternLibrary() {
  const dispatch = useAppDispatch();
  const nameId = useId();
  const pattern = useAppSelector(selectPattern);
  const library = useAppSelector(selectLibrary);
  const dirty = useAppSelector(selectHasUnsavedChanges);

  const [name, setName] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    dispatch(libraryLoaded(loadLibrary()));
  }, [dispatch]);

  /**
   * Undo is deferred, so replacing the working pattern is unrecoverable.
   * The confirm only appears when there is actually something to lose.
   */
  const load = useCallback(
    (next: Pattern, label: string) => {
      if (
        dirty &&
        !window.confirm(
          `Replace the current pattern with “${label}”? Unsaved changes will be lost.`,
        )
      ) {
        return;
      }

      dispatch(patternLoaded(next));
      setStatus(`Loaded “${label}”`);
    },
    [dirty, dispatch],
  );

  const save = useCallback(
    (event: React.SyntheticEvent) => {
      event.preventDefault();

      const trimmed = name.trim();
      if (trimmed.length === 0) return;

      if (library.length >= MAX_SAVED_PATTERNS) {
        setStatus(`You can keep up to ${String(MAX_SAVED_PATTERNS)} patterns. Delete one first.`);
        return;
      }

      const entry: SavedPattern = {
        id: crypto.randomUUID(),
        name: trimmed,
        savedAt: Date.now(),
        pattern,
      };

      const result = saveLibrary([entry, ...library]);

      if (!result.ok) {
        setStatus(
          result.reason === 'quota'
            ? 'Browser storage is full. Delete a saved pattern and try again.'
            : 'Browser storage is unavailable, so this pattern was not saved.',
        );
        return;
      }

      dispatch(patternSaved(entry));
      setName('');
      setStatus(`Saved “${trimmed}”`);
    },
    [dispatch, library, name, pattern],
  );

  const remove = useCallback(
    (entry: SavedPattern) => () => {
      const remaining = library.filter((candidate) => candidate.id !== entry.id);
      const result = saveLibrary(remaining);

      if (!result.ok) {
        setStatus('Browser storage is unavailable, so nothing was deleted.');
        return;
      }

      dispatch(savedPatternRemoved(entry.id));
      setStatus(`Deleted “${entry.name}”`);
    },
    [dispatch, library],
  );

  return (
    <Panel aria-labelledby="library-heading">
      <h2 id="library-heading">Patterns</h2>

      <SaveRow onSubmit={save}>
        <FieldGroup>
          <Label htmlFor={nameId}>Save current pattern as</Label>
          <Input
            id={nameId}
            type="text"
            value={name}
            placeholder="Midnight stripes"
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </FieldGroup>
        <Button type="submit" disabled={name.trim().length === 0}>
          Save
        </Button>
      </SaveRow>

      <Status role="status" aria-live="polite">
        {status}
      </Status>

      <h3>Presets</h3>
      <Grid>
        {presets.map((preset) => (
          <Card key={preset.id}>
            <Load
              type="button"
              onClick={() => {
                load(preset.pattern, preset.name);
              }}
            >
              <Thumbnail pattern={preset.pattern} />
              <Caption>
                <Name>{preset.name}</Name>
                <Note>{preset.description}</Note>
              </Caption>
            </Load>
          </Card>
        ))}
      </Grid>

      <h3>Saved</h3>
      {library.length === 0 ? (
        <Note>Nothing saved yet. Name a pattern above to keep it in this browser.</Note>
      ) : (
        <Grid>
          {library.map((entry) => (
            <Card key={entry.id}>
              <Load
                type="button"
                onClick={() => {
                  load(entry.pattern, entry.name);
                }}
              >
                <Thumbnail pattern={entry.pattern} />
                <Caption>
                  <Name>{entry.name}</Name>
                  <Note>{new Date(entry.savedAt).toLocaleDateString()}</Note>
                </Caption>
              </Load>
              <Small type="button" onClick={remove(entry)}>
                Delete {entry.name}
              </Small>
            </Card>
          ))}
        </Grid>
      )}
    </Panel>
  );
}
