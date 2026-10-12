"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function StickyVideoBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="sticky-video-banner">
      <a
        href="https://creatives.excelaffiliates.com/redirect?mid=6090&sid=1019759&affid=1014749"
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
        aria-label="Visit Betrino"
        className="sticky-video-link"
      >
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
      </a>

      <button
        type="button"
        className="sticky-video-close"
        onClick={() => setVisible(false)}
        aria-label="Close advertisement"
      >
        <X size={16} />
      </button>
    </div>
  );
}