"use client";

import { useRef } from "react";

type CameraCaptureProps = {
  label: string;
  onCapture(imageDataUrl: string): void;
};

export default function CameraCapture({ label, onCapture }: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onCapture(result);
      }
      event.target.value = "";
    };

    reader.onerror = () => {
      event.target.value = "";
    };

    reader.readAsDataURL(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={openPicker}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-500"
      >
        {label}
      </button>
    </>
  );
}
