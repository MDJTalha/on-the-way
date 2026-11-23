"use client";

import { useEffect, useRef, useState } from "react";

export function PwaRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [offline, setOffline] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const updateReloadPending = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let disposed = false;

    const updateOnlineState = () => setOffline(!navigator.onLine);
    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    const checkForUpdate = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void registration?.update().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", checkForUpdate);

    const onControllerChange = () => {
      if (updateReloadPending.current) {
        updateReloadPending.current = false;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
      if (disposed) return;
      registration = reg;
      if (reg.waiting && navigator.serviceWorker.controller) setWaitingWorker(reg.waiting);

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller && reg.waiting) {
            setWaitingWorker(reg.waiting);
          }
        });
      });
      checkForUpdate();
    }).catch(() => {
      if (!disposed) setUpdateError("App updates could not be checked. You can continue using the current version.");
    });

    return () => {
      disposed = true;
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
      document.removeEventListener("visibilitychange", checkForUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  function applyUpdate() {
    if (!waitingWorker) return;
    setUpdateError("");
    // Reload only after the new worker has actually taken control.
    updateReloadPending.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    setWaitingWorker(null);
  }

  return (
    <>
      {offline && <div className="app-connectivity-banner" role="status">You are offline. Previously opened pages may remain available; live bookings and account actions require a connection.</div>}
      {waitingWorker && <div className="app-update-banner" role="status">
        <span><strong>On the Way has an update.</strong><small>Install the latest improvements to continue.</small></span>
        <button type="button" onClick={applyUpdate}>Update app</button>
      </div>}
      {updateError && <div className="app-update-error" role="status">{updateError}</div>}
    </>
  );
}
