"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UpdateState = "checking" | "current" | "available" | "offline" | "unsupported" | "error";

export function PwaRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [offline, setOffline] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const updateReloadPending = useRef(false);

  const applyUpdate = useCallback((worker?: ServiceWorker | null) => {
    const target = worker ?? registrationRef.current?.waiting;
    if (!target || updateReloadPending.current) return;
    setBusy(true);
    setMessage("Installing the latest version…");
    updateReloadPending.current = true;
    target.postMessage({ type: "SKIP_WAITING" });
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      setUpdateState("unsupported");
      return;
    }
    if (!navigator.onLine) {
      setUpdateState("offline");
      return;
    }
    const registration = registrationRef.current;
    if (!registration) {
      setUpdateState("checking");
      return;
    }
    setBusy(true);
    setMessage("Checking for the latest version…");
    try {
      await registration.update();
      const waiting = registration.waiting;
      if (waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(waiting);
        setUpdateState("available");
        setMessage("A new version is ready to install.");
      } else {
        setUpdateState("current");
        setMessage("You are using the latest available version.");
      }
    } catch {
      setUpdateState("error");
      setMessage("Could not check for updates. Try again when your connection is stable.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setUpdateState("unsupported");
      return;
    }

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    const updateOnlineState = () => {
      const isOffline = !navigator.onLine;
      setOffline(isOffline);
      if (!isOffline) void checkForUpdates();
      else setUpdateState("offline");
    };
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void checkForUpdates();
    };
    const onControllerChange = () => {
      if (updateReloadPending.current) {
        updateReloadPending.current = false;
        window.location.reload();
      }
    };

    setOffline(!navigator.onLine);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("focus", checkWhenVisible);

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
      if (disposed) return;
      registration = reg;
      registrationRef.current = reg;

      // A previously downloaded update is applied automatically on the next app launch.
      // Updates discovered during an active session remain user-triggered to protect in-progress work.
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
        setUpdateState("available");
        applyUpdate(reg.waiting);
      } else {
        setUpdateState(navigator.onLine ? "current" : "offline");
      }

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller && reg.waiting) {
            setWaitingWorker(reg.waiting);
            setUpdateState("available");
            setMessage("A new version is ready. Update now or it will install automatically next time you open the app.");
          }
        });
      });
      if (navigator.onLine) void checkForUpdates();
    }).catch(() => {
      if (!disposed) {
        setUpdateState("error");
        setMessage("App updates could not be checked. You can continue using the current version.");
      }
    });

    // Periodic update discovery while the app remains open.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void checkForUpdates();
    }, 60 * 60 * 1000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("focus", checkWhenVisible);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (registrationRef.current === registration) registrationRef.current = null;
    };
  }, [applyUpdate, checkForUpdates]);

  const updateLabel = waitingWorker ? "Update now" : busy ? "Checking…" : "Check for updates";

  return (
    <>
      {offline && <div className="app-connectivity-banner" role="status">You are offline. Previously opened pages may remain available; live bookings and account actions require a connection.</div>}
      <div className={waitingWorker ? "app-update-banner app-update-banner-available" : "app-update-banner app-update-banner-compact"} role="status" aria-live="polite">
        <span>
          <strong>{waitingWorker ? "On the Way update ready" : "On the Way app updates"}</strong>
          <small>{message || (updateState === "current" ? "Automatic update checks are enabled." : "The app checks for updates automatically.")}</small>
        </span>
        <button type="button" onClick={() => waitingWorker ? applyUpdate(waitingWorker) : void checkForUpdates()} disabled={busy || updateState === "offline" || updateState === "unsupported"}>
          {updateLabel}
        </button>
      </div>
    </>
  );
}
