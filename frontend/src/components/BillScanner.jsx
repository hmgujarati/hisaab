import React, { useEffect, useRef, useState } from "react";
import { Camera, RotateCw, Check, X, Image as ImageIcon, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { compressImage, enhanceForScan } from "@/lib/imageUtils";

export default function BillScanner({ open, onClose, onCapture }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null); // File
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!open) {
      setPreview(null); setPreviewUrl(null);
    }
  }, [open]);

  useEffect(() => {
    if (preview) {
      const u = URL.createObjectURL(preview);
      setPreviewUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setPreviewUrl(null);
  }, [preview]);

  const openCamera = () => {
    if (fileRef.current) fileRef.current.click();
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const compressed = await compressImage(f, { maxSize: 1800, quality: 0.82, targetKb: 600 });
      setPreview(compressed);
    } finally { setBusy(false); }
  };

  const enhance = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      let enhanced = await enhanceForScan(preview);
      enhanced = await compressImage(enhanced, { maxSize: 1800, quality: 0.82, targetKb: 600 });
      setPreview(enhanced);
    } finally { setBusy(false); }
  };

  const useBill = () => {
    if (preview && onCapture) onCapture(preview);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Bill / Site Photo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            className="hidden"
          />
          {!preview ? (
            <div className="rounded-xl border-2 border-dashed border-[#E2E0D8] bg-[#F5F4F0] p-8 text-center">
              <Camera size={32} className="mx-auto text-[#2B4C3B]" strokeWidth={1.5} />
              <div className="mt-3 font-display font-semibold text-[#1C2B2D]">Capture bill</div>
              <p className="text-xs text-[#5A6566] mt-1">Camera khol kar bill click karo. Auto crop ke baad image scanned look mein convert hogi.</p>
              <Button data-testid="scanner-open-camera-btn" onClick={openCamera} className="mt-4 bg-[#2B4C3B] hover:bg-[#1F382A]" disabled={busy}>
                <Camera size={14} className="mr-1.5" /> Open Camera
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl overflow-hidden bg-black/5 border border-[#E2E0D8] aspect-[3/4] grid place-items-center">
                {previewUrl && <img src={previewUrl} alt="bill" className="max-h-[60vh] max-w-full object-contain" />}
              </div>
              <div className="text-xs text-[#5A6566]">
                {Math.round(preview.size / 1024)} KB · {preview.type}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={openCamera} data-testid="scanner-retake-btn">
                  <RotateCw size={14} className="mr-1.5" /> Retake
                </Button>
                <Button variant="outline" onClick={enhance} disabled={busy} data-testid="scanner-enhance-btn">
                  <Wand2 size={14} className="mr-1.5" /> Enhance
                </Button>
                <Button onClick={useBill} className="bg-[#2B4C3B] hover:bg-[#1F382A]" data-testid="scanner-use-btn">
                  <Check size={14} className="mr-1.5" /> Use
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
