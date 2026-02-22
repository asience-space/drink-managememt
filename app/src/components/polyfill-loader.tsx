"use client";

import { useEffect } from "react";

/**
 * Polyfill Loader Component
 * Loads polyfills on the client side for legacy browser support
 */
export function PolyfillLoader() {
  useEffect(() => {
    // Import polyfills only on client side
    import("@/lib/polyfills");
  }, []);

  return null;
}
