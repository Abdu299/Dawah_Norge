"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Systemet fungerer fortsatt i nettleseren dersom installering ikke støttes.
      });
    }
  }, []);

  return null;
}
