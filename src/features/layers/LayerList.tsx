import styled from 'styled-components';
import { useAppSelector } from '../../app/hooks';
import { LayerRow } from './LayerRow';
import { selectLayerIds } from '../pattern/selectors';

const Panel = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.space.md}px;
`;

const Hint = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const List = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${({ theme }) => theme.space.sm}px;
`;

const Empty = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.space.xl}px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.875rem;
`;

export function LayerList() {
  const ids = useAppSelector(selectLayerIds);

  return (
    <Panel aria-labelledby="layers-heading">
      <h2 id="layers-heading">Layers</h2>
      <Hint>The top layer paints over the ones below it, matching the CSS order.</Hint>

      {ids.length === 0 ? (
        <Empty>No layers yet. Only the base colour is showing.</Empty>
      ) : (
        <List>
          {ids.map((id, index) => (
            <LayerRow key={id} id={id} index={index} total={ids.length} />
          ))}
        </List>
      )}
    </Panel>
  );
}
