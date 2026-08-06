import { useCallback } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { ColorField } from '../../components/ColorField';
import { NumberField, SelectField, TextField } from '../../components/Field';
import { LengthField, type LengthRange } from '../../components/LengthField';
import { isAllowedImageUrl } from '../../domain/validate';
import { BLEND_MODES, RADIAL_EXTENTS, REPEAT_MODES } from '../../domain/types';
import type {
  BlendMode,
  Layer,
  LayerSize,
  RadialExtent,
  RadialShape,
  RepeatMode,
} from '../../domain/types';
import { pct } from '../../domain/length';
import type { LengthUnit } from '../../domain/length';
import { layerUpdated } from '../pattern/patternSlice';
import { selectLayerById, selectSelectedLayerId } from '../pattern/selectors';

const Panel = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.space.lg}px;
`;

const Group = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.md}px;
`;

const GroupTitle = styled.h3`
  margin: 0;
  font-size: 0.875rem;
`;

const Note = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};
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

const SIZE_KINDS = ['auto', 'cover', 'contain', 'custom'] as const;
type SizeKind = (typeof SIZE_KINDS)[number];

const RADIAL_SHAPES: readonly RadialShape[] = ['circle', 'ellipse'];

/** Slider bounds per unit. Sizes cannot be negative; positions and centres can. */
const SIZE_RANGES: Record<LengthUnit, LengthRange> = {
  '%': { min: 0, max: 400 },
  px: { min: 0, max: 1000 },
};

const OFFSET_RANGES: Record<LengthUnit, LengthRange> = {
  '%': { min: -200, max: 200 },
  px: { min: -1000, max: 1000 },
};

function sizeFromKind(kind: SizeKind, current: LayerSize): LayerSize {
  if (kind !== 'custom') return { kind };
  if (current.kind === 'custom') return current;
  return { kind: 'custom', width: pct(100), height: pct(100) };
}

export function LayerEditor() {
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector(selectSelectedLayerId);
  const layer = useAppSelector((state) => (selectedId ? selectLayerById(state, selectedId) : null));

  const update = useCallback(
    (changes: Partial<Layer>) => {
      if (!layer) return;
      dispatch(layerUpdated({ id: layer.id, changes }));
    },
    [dispatch, layer],
  );

  if (!layer) {
    return (
      <Panel aria-labelledby="editor-heading">
        <h2 id="editor-heading">Layer</h2>
        <Empty>Select a layer to edit it.</Empty>
      </Panel>
    );
  }

  return (
    <Panel aria-labelledby="editor-heading">
      <h2 id="editor-heading">Layer</h2>

      <Group>
        <TextField
          label="Name"
          value={layer.name}
          onChange={(name) => {
            update({ name });
          }}
        />
        <SelectField
          label="Blend mode"
          value={layer.blendMode}
          options={BLEND_MODES}
          onChange={(blendMode: BlendMode) => {
            update({ blendMode });
          }}
        />
      </Group>

      <Group>
        <GroupTitle>Placement</GroupTitle>
        <SelectField
          label="Size"
          value={layer.size.kind}
          options={SIZE_KINDS}
          onChange={(kind: SizeKind) => {
            update({ size: sizeFromKind(kind, layer.size) });
          }}
        />
        {layer.size.kind === 'custom' && (
          <>
            <LengthField
              label="Width"
              value={layer.size.width === 'auto' ? pct(100) : layer.size.width}
              ranges={SIZE_RANGES}
              onChange={(width) => {
                if (layer.size.kind !== 'custom') return;
                update({ size: { ...layer.size, width } });
              }}
            />
            <LengthField
              label="Height"
              value={layer.size.height === 'auto' ? pct(100) : layer.size.height}
              ranges={SIZE_RANGES}
              onChange={(height) => {
                if (layer.size.kind !== 'custom') return;
                update({ size: { ...layer.size, height } });
              }}
            />
          </>
        )}
        <LengthField
          label="Position X"
          value={layer.position.x}
          ranges={OFFSET_RANGES}
          onChange={(x) => {
            update({ position: { ...layer.position, x } });
          }}
        />
        <LengthField
          label="Position Y"
          value={layer.position.y}
          ranges={OFFSET_RANGES}
          onChange={(y) => {
            update({ position: { ...layer.position, y } });
          }}
        />
        <SelectField
          label="Repeat"
          value={layer.repeat}
          options={REPEAT_MODES}
          onChange={(repeat: RepeatMode) => {
            update({ repeat });
          }}
        />
        {layer.repeat !== 'no-repeat' && layer.size.kind !== 'custom' && (
          <Note>
            Repeat has no visible effect while the size fills the canvas. Set size to custom and
            give it fixed dimensions — say 40px by 40px — to see it tile.
          </Note>
        )}
      </Group>

      <KindFields layer={layer} update={update} />
    </Panel>
  );
}

function KindFields({
  layer,
  update,
}: {
  layer: Layer;
  update: (changes: Partial<Layer>) => void;
}) {
  switch (layer.kind) {
    case 'linear-gradient':
    case 'repeating-linear-gradient':
      return (
        <Group>
          <GroupTitle>Gradient</GroupTitle>
          <NumberField
            label="Angle"
            value={layer.angle}
            min={0}
            max={360}
            suffix="deg"
            onChange={(angle) => {
              update({ angle });
            }}
          />
          <NumberField
            label="Layer opacity"
            value={Math.round(layer.opacity * 100)}
            min={0}
            max={100}
            suffix="%"
            onChange={(value) => {
              update({ opacity: value / 100 });
            }}
          />
        </Group>
      );

    case 'radial-gradient':
    case 'repeating-radial-gradient':
      return (
        <Group>
          <GroupTitle>Gradient</GroupTitle>
          <SelectField
            label="Shape"
            value={layer.shape}
            options={RADIAL_SHAPES}
            onChange={(shape: RadialShape) => {
              update({ shape });
            }}
          />
          <SelectField
            label="Extent"
            value={layer.radialSize.kind === 'extent' ? layer.radialSize.extent : 'farthest-corner'}
            options={RADIAL_EXTENTS}
            onChange={(extent: RadialExtent) => {
              update({ radialSize: { kind: 'extent', extent } });
            }}
          />
          <LengthField
            label="Centre X"
            value={layer.center.x}
            ranges={OFFSET_RANGES}
            onChange={(x) => {
              update({ center: { ...layer.center, x } });
            }}
          />
          <LengthField
            label="Centre Y"
            value={layer.center.y}
            ranges={OFFSET_RANGES}
            onChange={(y) => {
              update({ center: { ...layer.center, y } });
            }}
          />
          <NumberField
            label="Layer opacity"
            value={Math.round(layer.opacity * 100)}
            min={0}
            max={100}
            suffix="%"
            onChange={(value) => {
              update({ opacity: value / 100 });
            }}
          />
        </Group>
      );

    case 'conic-gradient':
    case 'repeating-conic-gradient':
      return (
        <Group>
          <GroupTitle>Gradient</GroupTitle>
          <NumberField
            label="From angle"
            value={layer.fromAngle}
            min={0}
            max={360}
            suffix="deg"
            onChange={(fromAngle) => {
              update({ fromAngle });
            }}
          />
          <LengthField
            label="Centre X"
            value={layer.center.x}
            ranges={OFFSET_RANGES}
            onChange={(x) => {
              update({ center: { ...layer.center, x } });
            }}
          />
          <LengthField
            label="Centre Y"
            value={layer.center.y}
            ranges={OFFSET_RANGES}
            onChange={(y) => {
              update({ center: { ...layer.center, y } });
            }}
          />
          <NumberField
            label="Layer opacity"
            value={Math.round(layer.opacity * 100)}
            min={0}
            max={100}
            suffix="%"
            onChange={(value) => {
              update({ opacity: value / 100 });
            }}
          />
        </Group>
      );

    case 'solid':
      return (
        <Group>
          <GroupTitle>Colour</GroupTitle>
          <ColorField
            label="Fill"
            value={layer.color}
            onChange={(color) => {
              update({ color });
            }}
          />
          <NumberField
            label="Layer opacity"
            value={Math.round(layer.opacity * 100)}
            min={0}
            max={100}
            suffix="%"
            onChange={(value) => {
              update({ opacity: value / 100 });
            }}
          />
        </Group>
      );

    case 'image': {
      const empty = layer.url.length === 0;
      const allowed = empty || isAllowedImageUrl(layer.url);

      return (
        <Group>
          <GroupTitle>Image</GroupTitle>
          <TextField
            label="URL"
            value={layer.url}
            placeholder="https://example.com/texture.png"
            invalid={!allowed}
            note={
              allowed
                ? 'Only https: and base64 data:image URLs are accepted.'
                : 'Rejected — this layer will not render. Use an https: or data:image URL.'
            }
            onChange={(url) => {
              update({ url });
            }}
          />
        </Group>
      );
    }
  }
}
