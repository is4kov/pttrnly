import { describe, expect, it } from 'vitest';
import { patternReducer, layerReordered } from './patternSlice';
import { patternStateFor } from '../../test/render';
import { makePattern, makeLinearLayer, makeSolidLayer } from '../../test/factories';

const pattern = makePattern([
  makeLinearLayer({ id: 'a', name: 'A' }),
  makeSolidLayer({ id: 'b', name: 'B' }),
  makeLinearLayer({ id: 'c', name: 'C' }),
]);

const order = (state: ReturnType<typeof patternReducer>) =>
  state.pattern.layers.map((layer) => layer.id);

const reorder = (id: string, toIndex: number) =>
  patternReducer(patternStateFor(pattern), layerReordered({ id, toIndex }));

describe('layerReordered', () => {
  it('moves a layer down the stack', () => {
    expect(order(reorder('a', 2))).toEqual(['b', 'c', 'a']);
  });

  it('moves a layer up the stack', () => {
    expect(order(reorder('c', 0))).toEqual(['c', 'a', 'b']);
  });

  it('moves a layer to an adjacent index', () => {
    expect(order(reorder('a', 1))).toEqual(['b', 'a', 'c']);
  });

  it('leaves the stack alone when the target is where it already is', () => {
    expect(order(reorder('b', 1))).toEqual(['a', 'b', 'c']);
  });

  it('clamps a target past the end of the stack', () => {
    expect(order(reorder('a', 99))).toEqual(['b', 'c', 'a']);
  });

  it('clamps a negative target', () => {
    expect(order(reorder('c', -4))).toEqual(['c', 'a', 'b']);
  });

  it('ignores an unknown layer id', () => {
    expect(order(reorder('nope', 0))).toEqual(['a', 'b', 'c']);
  });

  it('ignores a fractional index rather than dropping the layer', () => {
    expect(order(reorder('a', 1.9))).toEqual(['b', 'a', 'c']);
  });
});
