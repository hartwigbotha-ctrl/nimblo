"use client";

import { useState } from "react";

const ALIGN_OPTIONS: { value: "left" | "center" | "right"; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const justifyForAlign: Record<string, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

export function LogoControls({
  logoUrl,
  initialHeight,
  initialAlign,
}: {
  logoUrl: string | null;
  initialHeight: number;
  initialAlign: string;
}) {
  const [height, setHeight] = useState(initialHeight || 40);
  const [align, setAlign] = useState(
    initialAlign === "center" || initialAlign === "right" ? initialAlign : "left"
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(logoUrl);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>

      {previewUrl && (
        <div
          className="mb-3 flex border border-gray-200 rounded-md bg-gray-50 p-3"
          style={{ justifyContent: justifyForAlign[align] }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Logo preview"
            style={{ height: `${height}px` }}
            className="object-contain"
          />
        </div>
      )}

      <input
        type="file"
        name="logo"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setPreviewUrl(URL.createObjectURL(file));
        }}
        className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-gray-100 file:text-sm file:font-medium hover:file:bg-gray-200"
      />
      {logoUrl && (
        <label className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <input
            type="checkbox"
            name="removeLogo"
            value="1"
            onChange={(e) => setPreviewUrl(e.target.checked ? null : logoUrl)}
          />
          Remove current logo
        </label>
      )}
      <p className="text-xs text-gray-400 mt-1">PNG or JPG, under 500KB. Appears on invoice PDFs.</p>

      {previewUrl && (
        <div className="mt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="logoHeight" className="text-sm font-medium text-gray-700">
                Logo size
              </label>
              <span className="text-xs text-gray-500">{height}px</span>
            </div>
            <input
              id="logoHeight"
              name="logoHeight"
              type="range"
              min={20}
              max={150}
              step={1}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">Logo position</span>
            <div className="flex gap-2">
              {ALIGN_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex-1 text-center rounded-md border px-3 py-1.5 text-sm cursor-pointer ${
                    align === opt.value ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="logoAlign"
                    value={opt.value}
                    checked={align === opt.value}
                    onChange={() => setAlign(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
