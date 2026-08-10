import { useCallback } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { ColorField } from '../../components/ColorField';
import { StopBar } from './StopBar';
import { StopTabs } from './StopTabs';
import { ColorPicker } from '../../components/ColorPicker';
import { CheckboxField, NumberField, SelectField, TextField } from '../../components/Field';
import { LengthField, type LengthRange } from '../../components/LengthField';
import { isAllowedImageUrl } from '../../domain/validate';
import {
  BLEND_MODES,
  isRepeatingKind,
  RADIAL_EXTENTS,
  REPEAT_MODES,
  toggleRepeatingKind,
} from '../../domain/types';
import type {
  BlendMode,
  GradientStop,
  Layer,
  LayerSize,
  RadialExtent,
  RadialShape,
  RepeatMode,
} from '../../domain/types';
import { pct } from '../../domain/length';
import type { LengthUnit } from '../../domain/length';
import { baseColorChanged, layerUpdated } from '../pattern/patternSlice';
import {
  selectLayerById,
  selectPattern,
  selectSelectedLayerId,
  selectSelectedStopIndex,
} from '../pattern/selectors';

const Panel = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.space.lg}px;
`;

/*
  The other half of the tab illusion. This carries the same surface as the
  selected layer row and drops its left-hand corners, so where the two meet
  there is no seam. See the note on Row in LayerRow.
*/
const EditorPanel = styled(Panel)`
  padding: ${({ theme }) => theme.space.lg}px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface};
  align-content: start;

  ${({ theme }) => theme.media.from('md')} {
    border-radius: 0 ${({ theme }) => theme.radii.md} ${({ theme }) => theme.radii.md}
      ${({ theme }) => theme.radii.md};
  }
`;

const Group = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.md}px;
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
      <EditorPanel aria-label="Layer options">
        <Empty>Select a layer to edit it.</Empty>
      </EditorPanel>
    );
  }

  return (
    /*
      No visible heading: the panel is attached to the selected row, which
      already names the layer, and the Name field below names it again. The
      region still needs an accessible name, so it takes the layer's own —
      more use to a screen reader than the word "Layer" was.
    */
    <EditorPanel aria-label={`Options for ${layer.name}`}>
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
        <h3>Placement</h3>
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
        {/*
          Only shown for a custom size. background-repeat has no visible effect
          while the tile already fills the box, so at any other size this
          control does nothing — which is what made it read as a duplicate of
          the gradient's own Repeat.
        */}
        {layer.size.kind === 'custom' && (
          <SelectField
            label="Tiling"
            value={layer.repeat}
            options={REPEAT_MODES}
            onChange={(repeat: RepeatMode) => {
              update({ repeat });
            }}
          />
        )}
      </Group>

      <RepeatControl layer={layer} update={update} />

      <KindFields layer={layer} update={update} />

      {'stops' in layer && <StopsSection layerId={layer.id} stops={layer.stops} />}
    </EditorPanel>
  );
}

/**
 * Whether the gradient's stops repeat.
 *
 * This flips the layer between a gradient kind and its `repeating-` twin. It is
 * deliberately not the same control as Tiling: `repeating-linear-gradient()`
 * repeats the stops inside one tile, `background-repeat` tiles the whole image,
 * and they compose independently.
 */
function RepeatControl({
  layer,
  update,
}: {
  layer: Layer;
  update: (changes: Partial<Layer>) => void;
}) {
  const flipped = toggleRepeatingKind(layer.kind);
  if (flipped === null) return null;

  return (
    <Group>
      <CheckboxField
        label="Repeat stops"
        checked={isRepeatingKind(layer.kind)}
        note="Repeats the colour stops across the layer, which is what makes stripes and rings."
        onChange={() => {
          // No cast needed: each gradient type's `kind` is a two-member union
          // over the same shape, so flipping it changes no other field.
          update({ kind: flipped });
        }}
      />
    </Group>
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
          <h3>Gradient</h3>
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
          <h3>Gradient</h3>
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
          <h3>Gradient</h3>
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
          <h3>Colour</h3>
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
          <h3>Image</h3>
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

function StopsSection({ layerId, stops }: { layerId: string; stops: GradientStop[] }) {
  const selectedIndex = useAppSelector(selectSelectedStopIndex);
  const index = Math.min(selectedIndex, stops.length - 1);

  return (
    <Group>
      <h3>Stops</h3>
      <StopBar layerId={layerId} stops={stops} selectedIndex={index} />
      <StopTabs layerId={layerId} stops={stops} selectedIndex={index} />
    </Group>
  );
}

/** The colour beneath every layer. It lives on the canvas, not in the stack. */
export function CanvasEditor() {
  const dispatch = useAppDispatch();
  const pattern = useAppSelector(selectPattern);

  return (
    <Panel aria-labelledby="canvas-heading">
      <h2 id="canvas-heading">Canvas</h2>
      <Group>
        <ColorPicker
          label="Base colour"
          value={pattern.canvas.baseColor}
          onChange={(baseColor) => {
            dispatch(baseColorChanged(baseColor));
          }}
        />
        <Note>Painted beneath every layer, so only transparent areas reveal it.</Note>
      </Group>
    </Panel>
  );
}
