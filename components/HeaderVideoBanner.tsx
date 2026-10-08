export default function HeaderVideoBanner() {
  return (
    <div className="top-video-banner">
      <video
        className="top-video-banner-media"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <source
          src="/banners/Header.mp4"
          type="video/mp4"
        />
      </video>
    </div>
  );
}