import { useCallback, useRef } from 'react';

export interface LongPressOptions {
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void;
  delay?: number;
}

export const useLongPress = ({ onLongPress, onClick, delay = 500 }: LongPressOptions) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  const targetRef = useRef<EventTarget | null>(null);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Don't intercept right clicks here, let onContextMenu handle it
      if ('button' in e && e.button !== 0) return;
      
      // Prevent long press on interactive elements (links, buttons, etc)
      const target = e.target as HTMLElement;
      if (target.closest('a, button, input, textarea, select, [role="button"], img, video, audio')) {
        return;
      }

      isLongPress.current = false;
      targetRef.current = e.target;
      timerRef.current = setTimeout(() => {
        isLongPress.current = true;
        onLongPress(e);
      }, delay);
    },
    [onLongPress, delay]
  );

  const clear = useCallback(
    (e?: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      if (shouldTriggerClick && !isLongPress.current && onClick && e) {
        // Only trigger click if the target is still the same (wasn't scrolled away)
        if (targetRef.current === e.target) {
            onClick(e);
        }
      }
      isLongPress.current = false;
      targetRef.current = null;
    },
    [onClick]
  );

  return {
    onMouseDown: start,
    onTouchStart: start,
    onMouseUp: clear,
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchEnd: clear,
    onTouchMove: (e: React.TouchEvent) => clear(e, false),
    onContextMenu: (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('a, img, video, audio, input, textarea')) {
        e.preventDefault();
        onLongPress(e);
      }
    }
  };
};
