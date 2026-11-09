"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  MediaControlBar,
  MediaController,
  MediaDurationDisplay,
  MediaFullscreenButton,
  MediaMuteButton,
  MediaPlaybackRateButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
} from "media-chrome/react";
import { addTranslation, setLanguage } from "media-chrome/utils/i18n";
import styles from "./lesson-player.module.css";

addTranslation("vi", {
  "video player": "Trình phát video",
  "playback time": "Thời gian phát",
  seek: "Vị trí video",
  Play: "Phát",
  Pause: "Tạm dừng",
  play: "Phát",
  pause: "Tạm dừng",
  Mute: "Tắt tiếng",
  Unmute: "Bật tiếng",
  mute: "Tắt tiếng",
  unmute: "Bật tiếng",
  "Seek backward": "Tua lùi",
  "Seek forward": "Tua tới",
  "seek back {seekOffset} seconds": "Tua lùi {seekOffset} giây",
  "seek forward {seekOffset} seconds": "Tua tới {seekOffset} giây",
  "Playback rate": "Tốc độ phát",
  "Playback rate {playbackRate}": "Tốc độ phát {playbackRate}",
  "Enter fullscreen mode": "Bật toàn màn hình",
  "Exit fullscreen mode": "Thoát toàn màn hình",
  "enter fullscreen mode": "Bật toàn màn hình",
  "exit fullscreen mode": "Thoát toàn màn hình",
  "{currentTime} of {totalTime}": "{currentTime} trên {totalTime}",
});
setLanguage("vi");

/** Synthetic video only; real lessons use the provider's own player. */
export default function LessonPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    return () => { video?.pause(); };
  }, []);

  return (
    <section className={styles.section} aria-label="Xem video bài học">
      <h3 className={styles.heading}>Xem video</h3>
      <p className={styles.description}>Video mẫu giả lập để thử trình phát, không phải bài giảng.</p>
      <MediaController className={styles.controller} lang="vi" noAutohide aria-label="Trình phát video bài học">
        <video
          ref={videoRef}
          slot="media"
          src="/demo/player-sample.mp4"
          playsInline
          preload="metadata"
          className={styles.video}
          aria-label="Video bài học"
          onError={() => setError("Không phát được video mẫu. Hãy tải lại trang.")}
        />
        <MediaControlBar className={styles.timeline}>
          <MediaTimeDisplay aria-label="Thời gian phát" />
          <MediaTimeRange aria-label="Vị trí video" />
          <MediaDurationDisplay aria-label="Thời lượng video" />
        </MediaControlBar>
        <MediaControlBar className={styles.controls}>
          <MediaPlayButton aria-label="Phát hoặc tạm dừng" />
          <MediaSeekBackwardButton seekOffset={10} aria-label="Tua lùi 10 giây" />
          <MediaSeekForwardButton seekOffset={10} aria-label="Tua tới 10 giây" />
          <MediaMuteButton aria-label="Bật hoặc tắt tiếng" />
          <MediaPlaybackRateButton aria-label="Tốc độ phát" />
          <MediaFullscreenButton aria-label="Bật hoặc tắt toàn màn hình" />
        </MediaControlBar>
      </MediaController>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.hint}>Phím cách: phát/tạm dừng · ←/→: tua 10 giây · F: toàn màn hình</p>
    </section>
  );
}
