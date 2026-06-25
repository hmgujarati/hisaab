import React, { useState } from "react";
import { Download, Smartphone, Share, Plus, X, Apple } from "lucide-react";
import { useInstallPrompt } from "@/lib/usePWAInstall";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Install-as-PWA button.
 * - Chrome/Edge/Android: native install prompt
 * - iOS Safari: shows step-by-step instructions
 * - Already-installed users: hidden
 *
 * Variant: "button" (in admin/owner headers) or "card" (settings page).
 */
export default function InstallPWAButton({ variant = "button", className = "" }) {
  const { canInstall, isInstalled, isIos, promptInstall } = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);

  // Hide entirely once installed
  if (isInstalled) return null;

  // If neither native prompt available NOR iOS, the browser doesn't support PWA install (e.g. desktop Firefox).
  // We still show the button on iOS so users can see the "Add to Home Screen" steps.
  if (!canInstall && !isIos) return null;

  const handleClick = async () => {
    if (canInstall) {
      await promptInstall();
    } else if (isIos) {
      setIosOpen(true);
    }
  };

  if (variant === "card") {
    return (
      <>
        <button
          data-testid="install-pwa-card"
          onClick={handleClick}
          className={`w-full text-left rxt-card p-5 rxt-hover-lift flex items-start gap-3 ${className}`}
        >
          <div className="h-11 w-11 rounded-xl bg-[#2B4C3B]/10 text-[#2B4C3B] grid place-items-center shrink-0">
            <Smartphone size={20} />
          </div>
          <div className="flex-1">
            <div className="font-display font-semibold text-base">Install Hisaab as app</div>
            <p className="text-sm text-[#5A6566] mt-1">
              {isIos
                ? "Add to your iPhone home screen — works offline, opens like a native app."
                : "One-tap install. Works offline, opens like a native app."}
            </p>
          </div>
          <Download size={16} className="text-[#5A6566] mt-1.5" />
        </button>
        <IosInstructions open={iosOpen} onClose={() => setIosOpen(false)} />
      </>
    );
  }

  return (
    <>
      <Button
        data-testid="install-pwa-btn"
        variant="outline"
        size="sm"
        onClick={handleClick}
        className={`border-[#2B4C3B]/30 text-[#2B4C3B] hover:bg-[#2B4C3B]/5 ${className}`}
      >
        <Download size={14} className="mr-1.5" />
        <span className="hidden sm:inline">Install app</span>
        <span className="sm:hidden">Install</span>
      </Button>
      <IosInstructions open={iosOpen} onClose={() => setIosOpen(false)} />
    </>
  );
}

function IosInstructions({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Apple size={18} /> Install on iPhone / iPad
          </DialogTitle>
          <DialogDescription>
            Safari doesn&apos;t support one-tap install. Just 3 quick steps:
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 mt-2">
          <Step n={1} icon={Share}>
            Tap the <span className="font-semibold">Share</span> icon in Safari&apos;s toolbar
            <span className="text-[#5A6566]"> (the square with the up-arrow)</span>.
          </Step>
          <Step n={2} icon={Plus}>
            Scroll down and tap <span className="font-semibold">&quot;Add to Home Screen&quot;</span>.
          </Step>
          <Step n={3} icon={Smartphone}>
            Tap <span className="font-semibold">Add</span>. Hisaab will appear like any other app on your home screen.
          </Step>
        </ol>
        <div className="bg-[#F5F4F0] rounded-lg p-3 text-xs text-[#5A6566] mt-2">
          <span className="font-semibold text-[#1C2B2D]">Tip:</span> If you opened this page in
          Chrome or another browser on iPhone, please re-open it in <span className="font-semibold">Safari</span> first.
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, icon: Icon, children }) {
  return (
    <li className="flex items-start gap-3">
      <div className="h-7 w-7 rounded-full bg-[#2B4C3B] text-white grid place-items-center text-xs font-display font-semibold shrink-0">
        {n}
      </div>
      <div className="flex-1 pt-0.5 text-sm text-[#1C2B2D] flex items-start gap-2">
        <Icon size={16} className="text-[#2B4C3B] mt-0.5 shrink-0" />
        <span>{children}</span>
      </div>
    </li>
  );
}
