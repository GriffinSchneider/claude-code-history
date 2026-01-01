import { useState, useMemo, useEffect } from 'react';
import type { KeyEvent } from '@opentui/core';
import { useKeyboard } from '@opentui/react';

export interface UseSelectableListOptions {
  /** Total number of items in the list */
  itemCount: number;
  /** Function to get the height (in lines) of an item at a given index */
  getItemHeight: (index: number) => number;
  /** Available viewport height in lines */
  viewportHeight: number;
  /** Initial selected index */
  initialSelected?: number;
  /** Initial scroll Y offset (in lines) */
  initialScrollY?: number;
  /** Additional keyboard handler for component-specific keys. Return true to prevent default navigation. */
  onKey?: (key: KeyEvent, state: { selectedIndex: number; scrollY: number }) => boolean | void;
}

export interface UseSelectableListResult {
  /** Currently selected item index */
  selectedIndex: number;
  /** Scroll offset in lines (use as negative marginTop) */
  scrollY: number;
  /** Total height of all items in lines */
  totalHeight: number;
  /** Set selection programmatically */
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
  /** Set scroll Y programmatically */
  setScrollY: (y: number | ((prev: number) => number)) => void;
}

export function useSelectableList({
  itemCount,
  getItemHeight,
  viewportHeight,
  initialSelected = 0,
  initialScrollY = 0,
  onKey,
}: UseSelectableListOptions): UseSelectableListResult {
  const [selectedIndex, setSelectedIndex] = useState(initialSelected);
  const [scrollY, setScrollY] = useState(initialScrollY);

  // Clamp selection when itemCount changes
  useEffect(() => {
    if (itemCount > 0 && selectedIndex >= itemCount) {
      setSelectedIndex(itemCount - 1);
    }
  }, [itemCount, selectedIndex]);

  // Calculate Y position of each item (cumulative heights)
  const itemPositions = useMemo(() => {
    const positions: number[] = [];
    let y = 0;
    for (let i = 0; i < itemCount; i++) {
      positions.push(y);
      y += getItemHeight(i);
    }
    return positions;
  }, [itemCount, getItemHeight]);

  // Total content height
  const totalHeight = useMemo(() => {
    if (itemCount === 0) return 0;
    return itemPositions[itemCount - 1] + getItemHeight(itemCount - 1);
  }, [itemCount, itemPositions, getItemHeight]);

  // Estimate visible item count for page up/down
  const avgItemHeight = itemCount > 0 ? totalHeight / itemCount : 1;
  const visibleCount = Math.max(1, Math.floor(viewportHeight / avgItemHeight));

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (itemCount === 0) return;

    const itemY = itemPositions[selectedIndex];
    const itemHeight = getItemHeight(selectedIndex);
    const itemBottom = itemY + itemHeight;

    // Item is above viewport - scroll up
    if (itemY < scrollY) {
      setScrollY(itemY);
    }
    // Item is below viewport - scroll down
    else if (itemBottom > scrollY + viewportHeight) {
      setScrollY(itemBottom - viewportHeight);
    }
  }, [selectedIndex, scrollY, itemCount, itemPositions, getItemHeight, viewportHeight]);

  useKeyboard((key: KeyEvent) => {
    // Let component handle key first
    if (onKey?.(key, { selectedIndex, scrollY })) return;

    // j/k for selection
    if (key.name === 'k' || key.name === 'up') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.name === 'j' || key.name === 'down') {
      setSelectedIndex((prev) => Math.min(itemCount - 1, prev + 1));
    }

    // Page up/down
    if (key.name === 'pageup') {
      setSelectedIndex((prev) => Math.max(0, prev - visibleCount));
    }
    if (key.name === 'pagedown') {
      setSelectedIndex((prev) => Math.min(itemCount - 1, prev + visibleCount));
    }

    // Ctrl+u/d for half-page movement
    if (key.ctrl && key.name === 'u') {
      const halfPage = Math.max(1, Math.floor(visibleCount / 2));
      setSelectedIndex((prev) => Math.max(0, prev - halfPage));
    }
    if (key.ctrl && key.name === 'd') {
      const halfPage = Math.max(1, Math.floor(visibleCount / 2));
      setSelectedIndex((prev) => Math.min(itemCount - 1, prev + halfPage));
    }
  });

  return {
    selectedIndex,
    scrollY,
    totalHeight,
    setSelectedIndex,
    setScrollY,
  };
}
