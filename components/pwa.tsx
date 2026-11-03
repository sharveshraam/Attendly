"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaContextValue = {
  online: boolean;
  installable: boolean;
  installed: boolean;
  iosGuidance: boolean;
  updateAvailable: boolean;
  promptInstall: () => Promise<void>;
  applyUpdate: () => void;
  dismissBanner: () => void;
  swSupported: boolean;
};

const PwaContext = createContext<PwaContextValue | null>(null);
const DISMISS_KEY = "attendly.install-dismissed.v1";

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [swSupported, setSwSupported] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIos(isIos);
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true,
    );
    setSwSupported("serviceWorker" in navigator);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* ignore */
    }

    const onOnline = () => {
      setOnline(true);
      window.dispatchEvent(new CustomEvent("attendly:online"));
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          if (!cancelled) {
            setWaitingWorker(installing);
            setUpdateAvailable(true);
          }
        }
      });
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting);
          setUpdateAvailable(true);
        }
        reg.addEventListener("updatefound", onUpdateFound);
      })
      .catch(() => {
        /* Service worker unavailable (private mode / unsupported browser). */
      });

    return () => {
      cancelled = true;
      registration?.removeEventListener("updatefound", onUpdateFound);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "dismissed") {
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
      setDismissed(true);
    }
    setInstallEvent(null);
  }, [installEvent]);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) {
      window.location.reload();
      return;
    }
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
    window.setTimeout(reload, 2500);
  }, [waitingWorker]);

  const dismissBanner = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<PwaContextValue>(
    () => ({
      online,
      installable: Boolean(installEvent) && !installed,
      installed,
      iosGuidance: ios && !installed,
      updateAvailable,
      promptInstall,
      applyUpdate,
      dismissBanner,
      swSupported,
    }),
    [online, installEvent, installed, ios, updateAvailable, promptInstall, applyUpdate, dismissBanner, swSupported],
  );

  const showInstall = installEvent && !installed && !dismissed;

  return (
    <PwaContext.Provider value={value}>
      {children}
      {!online && (
        <div className="banner" role="status">
          <WifiOff size={15} />
          <span style={{ flex: 1 }}>
            You are offline. Previously synced data stays available; attendance marks are queued and will sync when you reconnect.
          </span>
        </div>
      )}
      {updateAvailable && (
        <div className="banner" role="status" style={{ top: online ? undefined : 38 }}>
          <RefreshCw size={15} />
          <span style={{ flex: 1 }}>A new version of Attendly is ready.</span>
          <button className="btn btn-sm" onClick={applyUpdate}>Update now</button>
          <button className="btn btn-ghost btn-sm" aria-label="Dismiss update" onClick={() => setUpdateAvailable(false)}>
            <X size={13} />
          </button>
        </div>
      )}
      {showInstall && (
        <div className="banner" role="status" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
          <Download size={15} />
          <span style={{ flex: 1 }}>Install Attendly for quick access and offline support.</span>
          <button className="btn btn-sm btn-primary" onClick={() => void promptInstall()}>Install</button>
          <button className="btn btn-ghost btn-sm" aria-label="Dismiss install prompt" onClick={dismissBanner}>
            <X size={13} />
          </button>
        </div>
      )}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) throw new Error("usePwa must be used inside PwaProvider");
  return context;
}
