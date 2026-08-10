import styled from 'styled-components';
import { useAppSelector } from '../../app/hooks';
import { LayerRow } from './LayerRow';
import { AddLayerButton } from './AddLayerButton';
import { useDragReorder } from './useDragReorder';
import { selectLayerIds } from '../pattern/selectors';

/**
 * The left rail of the workbench. It stays transparent so the selected row can
 * carry the panel's surface and the two read as one shape — see the note in
 * LayerRow about why the selection is styled there rather than here.
 */
const Rail = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.sm}px;
  align-content: start;

  /*
    Pinned under the preview once the panel sits beside it, so the stack stays
    reachable however far down the options you are. The offset has to clear the
    preview, which is why that height is a shared custom property rather than a
    number repeated in two files.
  */
  ${({ theme }) => theme.media.from('md')} {
    position: sticky;
    top: calc(var(--preview-pinned) + ${({ theme }) => theme.space.xl}px);
    max-height: calc(100dvh - var(--preview-pinned) - ${({ theme }) => theme.space.xxl * 2}px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
`;

/*
  Below md the rail is a plain column and this pins under the preview, so a long
  layer list can be scrolled without losing the heading. It stops helping once
  you scroll past the rail into the options panel; fixing that properly is the
  mobile navigation rework, not this.
*/
const Head = styled.div`
  position: sticky;
  top: calc(var(--preview-pinned) + ${({ theme }) => theme.space.lg}px);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.sm}px;
  padding: ${({ theme }) => theme.space.xs}px ${({ theme }) => theme.space.sm}px;
  background: ${({ theme }) => theme.colors.bg};

  ${({ theme }) => theme.media.from('md')} {
    /* The rail itself is pinned now, so the header rides along with it. */
    position: static;
    background: none;
  }
`;

/* Size and weight come from the global heading rules. */
const Heading = styled.h2``;

const Hint = styled.p`
  margin: 0;
  padding: 0 ${({ theme }) => theme.space.sm}px;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const List = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${({ theme }) => theme.space.xs}px;
`;

const Empty = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.space.lg}px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.8125rem;
`;

export function LayerList() {
  const ids = useAppSelector(selectLayerIds);
  const { listRef, drag, offsetFor, startDrag } = useDragReorder();

  return (
    <Rail aria-labelledby="layers-heading">
      <Head>
        <Heading id="layers-heading">Layers</Heading>
      </Head>
      <Hint>The top layer paints over the ones below it, matching the CSS order.</Hint>

      {ids.length === 0 ? (
        <Empty>No layers yet. Only the base colour is showing.</Empty>
      ) : (
        <List ref={listRef}>
          {ids.map((id, index) => (
            <LayerRow
              key={id}
              id={id}
              index={index}
              total={ids.length}
              dragging={drag?.id === id}
              offset={offsetFor(index)}
              onDragStart={startDrag}
            />
          ))}
        </List>
      )}

      <AddLayerButton />
    </Rail>
  );
}
