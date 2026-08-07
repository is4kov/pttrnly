import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch } from '../../app/hooks';
import { layerReordered } from '../pattern/patternSlice';

type Rect = { top: number; height: number };

export type DragState = {
  id: string;
  fromIndex: number;
  /** Where the row would land if the pointer were released now. */
  toIndex: number;
  /** How far the lifted row has travelled from its resting place, in px. */
  delta: number;
};

export type DragReorder = {
  listRef: React.RefObject<HTMLOListElement | null>;
  drag: DragState | null;
  /** Translation to apply to the row at `index`, in px. */
  offsetFor: (index: number) => number;
  startDrag: (event: React.PointerEvent<HTMLElement>, id: string, index: number) => void;
};

/**
 * Hand-rolled pointer drag for the layer stack.
 *
 * Two decisions worth keeping:
 *
 * - Geometry is measured once, on pointer down, and never re-read during the
 *   drag. Rows are translating while the drag is live, so `getBoundingClientRect`
 *   would report where they have moved to rather than where they belong, and
 *   the target index would chase itself.
 * - The store is touched exactly once, on drop. Dispatching per crossing would
 *   make the deferred history middleware replay one drag as many undo steps.
 */
export function useDragReorder(): DragReorder {
  const dispatch = useAppDispatch();
  const listRef = useRef<HTMLOListElement | null>(null);

  const [drag, setDrag] = useState<DragState | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const rectsRef = useRef<Rect[]>([]);
  const gapRef = useRef(0);
  const startYRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);

  const apply = useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const startDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, id: string, index: number) => {
      // Primary button or touch contact only — a right-click is not a drag.
      if (event.button !== 0) return;

      const list = listRef.current;
      if (!list) return;

      const rects = Array.from(list.querySelectorAll('li')).map((row) => {
        const box = row.getBoundingClientRect();
        return { top: box.top, height: box.height };
      });
      // Nothing to reorder against.
      if (rects.length < 2) return;

      const first = rects[0];
      const second = rects[1];
      gapRef.current = first && second ? Math.max(second.top - (first.top + first.height), 0) : 0;

      rectsRef.current = rects;
      startYRef.current = event.clientY;

      event.currentTarget.setPointerCapture(event.pointerId);
      // Stops the gesture turning into a text selection or a native drag.
      event.preventDefault();

      apply({ id, fromIndex: index, toIndex: index, delta: 0 });
    },
    [apply],
  );

  const active = drag !== null;

  useEffect(() => {
    if (!active) return;

    const resolve = (current: DragState, clientY: number): DragState => {
      const rects = rectsRef.current;
      const own = rects[current.fromIndex];
      if (!own) return current;

      const delta = clientY - startYRef.current;
      const centre = own.top + delta + own.height / 2;

      let toIndex = current.fromIndex;
      rects.forEach((rect, index) => {
        if (index === current.fromIndex) return;
        const middle = rect.top + rect.height / 2;
        if (index < current.fromIndex && centre < middle) toIndex = Math.min(toIndex, index);
        if (index > current.fromIndex && centre > middle) toIndex = Math.max(toIndex, index);
      });

      return { ...current, delta, toIndex };
    };

    const cancelFrame = () => {
      if (frameRef.current === null) return;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };

    const move = (event: PointerEvent) => {
      pendingRef.current = event.clientY;
      // Pointer events outrun paint, so coalesce them onto the frame.
      if (frameRef.current !== null) return;

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const current = dragRef.current;
        const clientY = pendingRef.current;
        if (!current || clientY === null) return;
        apply(resolve(current, clientY));
      });
    };

    const stop = (commit: boolean) => {
      cancelFrame();
      pendingRef.current = null;

      const current = dragRef.current;
      apply(null);

      if (!commit || !current || current.toIndex === current.fromIndex) return;
      dispatch(layerReordered({ id: current.id, toIndex: current.toIndex }));
    };

    const up = () => {
      stop(true);
    };
    const cancel = () => {
      stop(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      stop(false);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);

    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
      cancelFrame();
    };
  }, [active, apply, dispatch]);

  const offsetFor = useCallback(
    (index: number) => {
      if (!drag) return 0;
      if (index === drag.fromIndex) return drag.delta;

      const own = rectsRef.current[drag.fromIndex];
      if (!own) return 0;

      const shift = own.height + gapRef.current;
      const { fromIndex, toIndex } = drag;

      if (toIndex > fromIndex && index > fromIndex && index <= toIndex) return -shift;
      if (toIndex < fromIndex && index >= toIndex && index < fromIndex) return shift;
      return 0;
    },
    [drag],
  );

  return { listRef, drag, offsetFor, startDrag };
}
