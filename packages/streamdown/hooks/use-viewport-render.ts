import { useEffect, useRef, useState } from "react";

type UseViewportRenderOptions = {
  /**
   * Whether to skip viewport-based rendering (e.g., in fullscreen mode)
   * @default false
   */
  skip?: boolean;
  /**
   * Debounce delay in milliseconds before considering element visible
   * @default 300
   */
  debounceMs?: number;
  /**
   * Root margin for Intersection Observer (e.g., "200px" to start loading 200px before viewport)
   * @default "200px"
   */
  rootMargin?: string;
};

/**
 * Hook to optimize rendering performance by only rendering content when it's visible in the viewport.
 * Uses Intersection Observer with debounce to prevent unnecessary renders, especially useful for
 * heavy components like Mermaid diagrams in long conversation histories.
 *
 * This solves performance issues where many Mermaid charts cause page freezes or white screens
 * by deferring rendering until the element is actually visible and the browser is idle.
 *
 * @param ref - React ref to the element to observe
 * @param options - Configuration options
 * @returns Whether the element should be rendered
 */
export const useViewportRender = (
  ref: React.RefObject<HTMLElement | null>,
  options: UseViewportRenderOptions = {}
) => {
  const { skip = false, debounceMs = 300, rootMargin = "200px" } = options;

  const [isVisible, setIsVisible] = useState(skip);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Always render if skip is true (e.g., fullscreen mode)
    if (skip) {
      setIsVisible(true);
      return;
    }

    const container = ref.current;
    if (!container) {
      return;
    }

    // Check if Intersection Observer is supported
    if (typeof IntersectionObserver === "undefined") {
      // Fallback: render immediately if Intersection Observer is not supported
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Clear any existing timer
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }

            // Set a debounce delay before marking as visible
            debounceTimerRef.current = setTimeout(() => {
              setIsVisible(true);
              // Once visible, we can disconnect the observer
              observer.disconnect();
            }, debounceMs);
          } else {
            // If element leaves viewport, cancel the render
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
              debounceTimerRef.current = null;
            }
          }
        });
      },
      {
        rootMargin,
        threshold: 0,
      }
    );

    observer.observe(container);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      observer.disconnect();
    };
  }, [skip, debounceMs, rootMargin, ref]);

  return isVisible;
};

/**
 * Hook to execute a callback during browser idle time using requestIdleCallback.
 * This prevents blocking the main thread and improves page responsiveness, especially
 * when rendering multiple heavy components like Mermaid diagrams.
 *
 * Falls back to setTimeout if requestIdleCallback is not available.
 *
 * @param callback - Function to execute during idle time
 * @param enabled - Whether the callback should be executed
 * @param timeout - Maximum time to wait before executing (in milliseconds)
 * @default 2000
 */
export const useIdleRender = (
  callback: () => void,
  enabled: boolean,
  timeout = 2000
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Use requestIdleCallback to execute during browser idle time
    // This prevents blocking the main thread
    if (typeof requestIdleCallback !== "undefined") {
      const idleCallbackId = requestIdleCallback(
        () => {
          callback();
        },
        {
          timeout,
        }
      );

      return () => {
        cancelIdleCallback(idleCallbackId);
      };
    }

    // Fallback: use setTimeout with 0 delay for browsers that don't support requestIdleCallback
    const timeoutId = setTimeout(() => {
      callback();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [callback, enabled, timeout]);
};
