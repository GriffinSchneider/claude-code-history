import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { KeyEvent } from '@opentui/core';
import { useKeyboard } from '@opentui/react';

interface Measurable {
  height: number;
}

export interface UseSelectableListOptions {
  /** Total number of items */
  itemCount: number;
  /** Viewport height in lines */
  viewportHeight: number;
  /** Default height for items not yet measured */
  defaultItemHeight?: number;
  /** Additional keyboard handler. Return true to prevent default navigation. */
  onKey?: (key: KeyEvent, state: { selectedIndex: number }) => boolean | void;
  /** Initial selected index (for restoring state) */
  initialSelectedIndex?: number;
  /** Initial scroll position (for restoring state) */
  initialScrollY?: number;
}

export interface UseSelectableListResult {
  selectedIndex: number;
  scrollY: number;
  totalHeight: number;
  setSelectedIndex: (index: number) => void;
  /** Get a ref callback for an item to measure its height */
  getItemRef: (index: number) => (node: Measurable | null) => void;
}

export function useSelectableList({
  itemCount,
  viewportHeight,
  defaultItemHeight = 1,
  onKey,
  initialSelectedIndex = 0,
  initialScrollY = 0,
}: UseSelectableListOptions): UseSelectableListResult {
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [scrollY, setScrollY] = useState(initialScrollY);
  const [heights, setHeights] = useState<Map<number, number>>(new Map());

  // Store refs to nodes
  const nodeRefs = useRef<Map<number, Measurable>>(new Map());
  // Cache ref callbacks to avoid recreating them
  const refCallbacks = useRef<Map<number, (node: Measurable | null) => void>>(new Map());

  // Clamp selection when itemCount changes
  useEffect(() => {
    if (itemCount > 0 && selectedIndex >= itemCount) {
      setSelectedIndex(itemCount - 1);
    }
  }, [itemCount, selectedIndex]);

  // Get height for an item (measured or default)
  const getHeight = useCallback((index: number) => {
    return heights.get(index) ?? defaultItemHeight;
  }, [heights, defaultItemHeight]);

  // Calculate item positions (cumulative heights)
  const { itemPositions, totalHeight } = useMemo(() => {
    const positions: number[] = [];
    let y = 0;
    for (let i = 0; i < itemCount; i++) {
      positions.push(y);
      y += getHeight(i);
    }
    return { itemPositions: positions, totalHeight: y };
  }, [itemCount, getHeight]);

  // Get ref callback for an item
  const getItemRef = useCallback((index: number) => {
    let callback = refCallbacks.current.get(index);
    if (!callback) {
      callback = (node: Measurable | null) => {
        if (node) {
          nodeRefs.current.set(index, node);
          // Measure immediately
          const h = node.height;
          setHeights(prev => {
            if (prev.get(index) === h) return prev;
            const next = new Map(prev);
            next.set(index, h);
            return next;
          });
        } else {
          nodeRefs.current.delete(index);
        }
      };
      refCallbacks.current.set(index, callback);
    }
    return callback;
  }, []);

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (itemCount === 0) return;

    const itemY = itemPositions[selectedIndex] ?? 0;
    const itemH = getHeight(selectedIndex);
    const itemBottom = itemY + itemH;

    if (itemY < scrollY) {
      setScrollY(itemY);
    } else if (itemBottom > scrollY + viewportHeight) {
      setScrollY(itemBottom - viewportHeight);
    }
  }, [selectedIndex, scrollY, itemCount, itemPositions, getHeight, viewportHeight]);

  // Estimate visible count for page navigation
  const avgHeight = itemCount > 0 ? totalHeight / itemCount : defaultItemHeight;
  const visibleCount = Math.max(1, Math.floor(viewportHeight / avgHeight));

  useKeyboard((key: KeyEvent) => {
    if (onKey?.(key, { selectedIndex })) return;

    if (key.name === 'k' || key.name === 'up') {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
    if (key.name === 'j' || key.name === 'down') {
      setSelectedIndex(Math.min(itemCount - 1, selectedIndex + 1));
    }
    if (key.name === 'pageup') {
      setSelectedIndex(Math.max(0, selectedIndex - visibleCount));
    }
    if (key.name === 'pagedown') {
      setSelectedIndex(Math.min(itemCount - 1, selectedIndex + visibleCount));
    }
  });

  return { selectedIndex, scrollY, totalHeight, setSelectedIndex, getItemRef };
}
