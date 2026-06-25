import { useEffect, useState } from "react";

/**
 * Manages the PWA install state.
 * - Captures `beforeinstallprompt` for Chrome/Edge/Android.
 * - Detects iOS Safari (no install prompt available — needs manual instructions).
 * - Detects if app is already running in standalone mode.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || "";
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    setIsInstalled(standalone);
    setIsIos(/iPad|iPhone|iPod/.test(ua) && !window.MSStream);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return { outcome: "unavailable" };
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice; // { outcome: "accepted" | "dismissed" }
  };

  return {
    canInstall: !!deferredPrompt,
    isInstalled,
    isIos,
    promptInstall,
  };
}
