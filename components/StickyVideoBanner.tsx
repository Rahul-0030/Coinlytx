"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function StickyVideoBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="sticky-video-banner">
      <button
        type="button"
        className="sticky-video-close"
        onClick={() => setVisible(false)}
        aria-label="Close advertisement"
      >
        <X size={16} />
      </button>

      <video
        className="sticky-video-media"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <source
          src="/banners/header-banner.mp4"
          type="video/mp4"
        />
      </video>
    </div>
  );
}