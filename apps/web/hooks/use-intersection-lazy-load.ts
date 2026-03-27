"use client";

import { useEffect, useRef, useState } from "react";

type UseIntersectionLazyLoadOptions = {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number;
  triggerOnce?: boolean;
};

type UseIntersectionLazyLoadResult<T extends HTMLElement> = {
  isNearViewport: boolean;
  targetRef: React.RefObject<T | null>;
};

export function useIntersectionLazyLoad<T extends HTMLElement>(
  options: UseIntersectionLazyLoadOptions = {}
): UseIntersectionLazyLoadResult<T> {
  const { root = null, rootMargin = "220px", threshold = 0.01, triggerOnce = true } = options;
  const targetRef = useRef<T | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const node = targetRef.current;

    if (!node || (triggerOnce && isNearViewport)) {
      return;
    }

    // Observe the card before it fully enters the viewport so the image can start loading early.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          setIsNearViewport(true);

          if (triggerOnce) {
            observer.unobserve(entry.target);
          }
        } else if (!triggerOnce) {
          setIsNearViewport(false);
        }
      },
      {
        root,
        rootMargin,
        threshold
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [isNearViewport, root, rootMargin, threshold, triggerOnce]);

  return {
    isNearViewport,
    targetRef
  };
}
