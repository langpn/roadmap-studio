"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import type Hls from "hls.js";
import { Check, ChevronLeft, ChevronRight, Expand, Minimize, Pause, Play, RotateCcw, RotateCw, Settings, Volume2, VolumeX, X } from "lucide-react";
import styles from "./lesson-media-player.module.css";

type Quality = { index: number; label: string };
type Feedback = { id: number; side: "left" | "center" | "right"; content: React.ReactNode };

const rates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const rateLabel = (value: number) => (value === 1 ? "Bình thường" : `${value}×`);

type Props = {
  lessonId: string;
  title: string;
  embedUrl: string;
  onFallback: (reason: "error" | "manual") => void;
};

function formatTime(value: number): string {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

export default function BunnyDirectPlayer({ lessonId, title, embedUrl, onFallback }: Props) {
  const headingId = useId();
  const settingsId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLInputElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<number | undefined>(undefined);
  const settingsOpenRef = useRef(false);
  const hoveringControlsRef = useRef(false);
  const draggingRef = useRef(false);
  const touchWasVisibleRef = useRef(false);
  const pointerTypeRef = useRef("mouse");
  const lastTapRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(true);
  const [started, setStarted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [quality, setQuality] = useState(-1);
  const [activeLevel, setActiveLevel] = useState(-1);
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<"main" | "speed" | "quality">("main");
  const [hover, setHover] = useState<{ ratio: number; time: number } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimerRef.current);
    if (videoRef.current && !videoRef.current.paused) {
      hideTimerRef.current = window.setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused && !settingsOpenRef.current && !hoveringControlsRef.current
          && !draggingRef.current && !surfaceRef.current?.querySelector(":focus-visible")) setControlsVisible(false);
      }, 2500);
    }
  }, []);

  useEffect(() => {
    function updateFullscreen() { setFullscreen(document.fullscreenElement === surfaceRef.current); }
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    const menu = settingsMenuRef.current;
    if (!settingsOpen || !menu) return;
    const target = menu.querySelector<HTMLElement>('[aria-pressed="true"], [data-first]');
    target?.focus({ preventScroll: true });
    menu.scrollIntoView({ block: "nearest", inline: "nearest" });
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [settingsOpen, settingsView]);

  useEffect(() => {
    function finishDragging() {
      if (draggingRef.current) { draggingRef.current = false; revealControls(); }
    }
    window.addEventListener("pointerup", finishDragging);
    window.addEventListener("pointercancel", finishDragging);
    return () => {
      window.clearTimeout(hideTimerRef.current);
      window.removeEventListener("pointerup", finishDragging);
      window.removeEventListener("pointercancel", finishDragging);
    };
  }, [revealControls]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    let player: Hls | null = null;
    const controller = new AbortController();

    function fallback() {
      if (!active) return;
      active = false;
      window.clearTimeout(timer);
      controller.abort();
      player?.destroy();
      player = null;
      hlsRef.current = null;
      onFallback("error");
    }

    const timer = window.setTimeout(fallback, 12000);
    void (async () => {
      try {
        const [response, { default: HlsPlayer }] = await Promise.all([
          fetch(`/api/lesson-media/${encodeURIComponent(lessonId)}/stream`, { signal: controller.signal, cache: "no-store" }),
          import("hls.js"),
        ]);
        if (!active) return;
        if (!response.ok || !HlsPlayer.isSupported()) { fallback(); return; }
        const result: unknown = await response.json();
        if (!active) return;
        if (!result || typeof result !== "object" || !("url" in result) || typeof result.url !== "string") { fallback(); return; }
        const url = new URL(result.url);
        if (url.protocol !== "https:" || !url.hostname.endsWith(".b-cdn.net") || url.port || url.username || url.password) { fallback(); return; }
        const poster = new URL(url.href);
        poster.pathname = poster.pathname.replace(/\/playlist\.m3u8$/, "/thumbnail.jpg");
        if (poster.pathname !== url.pathname) video.poster = poster.href;

        // Tải trước tối thiểu một đoạn, rồi mở rộng bộ đệm khi người học bấm phát.
        player = new HlsPlayer({ maxBufferLength: 1, maxMaxBufferLength: 1 });
        hlsRef.current = player;
        player.on(HlsPlayer.Events.MANIFEST_PARSED, (_event, data) => {
          if (!active) return;
          window.clearTimeout(timer);
          const levels = data.levels.map((level, index) => ({
            index,
            resolution: level.height && level.width ? Math.min(level.height, level.width) : level.height,
            bitrate: level.bitrate,
          })).filter((level) => level.resolution || level.bitrate);
          setQualities(levels.sort((a, b) => b.resolution - a.resolution || b.bitrate - a.bitrate).map((level) => ({
            index: level.index,
            label: level.resolution ? `${level.resolution}p` : `${Math.round(level.bitrate / 1000)} kbps`,
          })));
          setReady(true);
        });
        player.on(HlsPlayer.Events.LEVEL_SWITCHED, (_event, data) => { if (active) setActiveLevel(data.level); });
        player.on(HlsPlayer.Events.ERROR, (_event, data) => { if (data.fatal) fallback(); });
        player.loadSource(url.href);
        player.attachMedia(video);
      } catch {
        fallback();
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
      player?.destroy();
      if (hlsRef.current === player) hlsRef.current = null;
      video.pause();
    };
  }, [lessonId, onFallback]);

  function updateTime(video: HTMLVideoElement) {
    setTime(video.currentTime);
    setDuration(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0);
    for (let index = 0; index < video.buffered.length; index += 1) {
      if (video.buffered.start(index) <= video.currentTime && video.currentTime <= video.buffered.end(index)) {
        setBuffered(video.buffered.end(index));
        return;
      }
    }
    setBuffered(0);
  }

  function flash(side: Feedback["side"], content: React.ReactNode) {
    setFeedback((previous) => ({ id: (previous?.id ?? 0) + 1, side, content }));
  }

  function closeSettings() {
    settingsOpenRef.current = false;
    setSettingsOpen(false);
    setSettingsView("main");
    settingsButtonRef.current?.focus();
    revealControls();
  }

  function changeVolume(next: number, withFeedback = false) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = next;
    video.muted = false;
    if (withFeedback) flash("center", <>{next === 0 ? <VolumeX size={22} aria-hidden="true" /> : <Volume2 size={22} aria-hidden="true" />}{Math.round(next * 100)}%</>);
  }

  function toggleMute(withFeedback = false) {
    const video = videoRef.current;
    if (!video) return;
    if (video.volume === 0) { video.volume = 0.7; video.muted = false; }
    else video.muted = !video.muted;
    if (withFeedback) flash("center", video.muted ? <VolumeX size={28} aria-hidden="true" /> : <Volume2 size={28} aria-hidden="true" />);
  }

  function togglePlayback(withFeedback = false) {
    const video = videoRef.current;
    if (!video) return;
    if (withFeedback) flash("center", video.paused ? <Play size={28} fill="currentColor" aria-hidden="true" /> : <Pause size={28} fill="currentColor" aria-hidden="true" />);
    if (!video.paused) { video.pause(); return; }
    void video.play().catch(() => setMessage("Không thể phát video. Hãy thử lại hoặc dùng trình phát gốc."));
  }

  function seekBy(seconds: number, withFeedback = false) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    if (withFeedback) {
      flash(seconds < 0 ? "left" : "right", <>
        {seconds < 0 ? <RotateCcw size={20} aria-hidden="true" /> : <RotateCw size={20} aria-hidden="true" />}
        {`${seconds < 0 ? "−" : "+"}${Math.abs(seconds)} giây`}
      </>);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && settingsOpenRef.current) {
      event.preventDefault();
      event.stopPropagation();
      closeSettings();
      return;
    }
    const target = event.target;
    const video = videoRef.current;
    // Thanh âm lượng và menu cài đặt giữ phím mũi tên mặc định của trình duyệt.
    if (!ready || !video || event.altKey || event.ctrlKey || event.metaKey
      || (target instanceof HTMLInputElement && target !== timelineRef.current)
      || (target instanceof Node && settingsMenuRef.current?.contains(target))) return;
    const key = event.key.toLowerCase();
    if (key === "k" || (key === " " && !(target instanceof HTMLButtonElement)) || (key === "enter" && target === video)) togglePlayback(true);
    else if (key === "arrowleft" || key === "arrowright") seekBy(key === "arrowleft" ? -5 : 5, true);
    else if (key === "j" || key === "l") seekBy(key === "j" ? -10 : 10, true);
    else if (key === "arrowup" || key === "arrowdown") {
      changeVolume(Math.min(1, Math.max(0, Math.round(((video.muted ? 0 : video.volume) + (key === "arrowup" ? 0.05 : -0.05)) * 20) / 20)), true);
    } else if (key === "m") toggleMute(true);
    else if (key === "f") void toggleFullscreen();
    else if (/^[0-9]$/.test(key) && duration) video.currentTime = (duration * Number(key)) / 10;
    else return;
    event.preventDefault();
    revealControls();
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === surfaceRef.current) await document.exitFullscreen();
      else await surfaceRef.current?.requestFullscreen();
    } catch {
      setMessage("Không thể mở toàn màn hình trên trình duyệt này.");
    }
  }

  const selectedQuality = qualities.find((item) => item.index === quality);
  const activeQuality = qualities.find((item) => item.index === activeLevel);
  const qualityLabel = quality >= 0 ? selectedQuality?.label ?? "Tự động"
    : activeQuality ? `Tự động (${activeQuality.label})` : "Tự động";
  const options = settingsView === "speed"
    ? rates.map((value) => ({ value, label: rateLabel(value), selected: value === rate }))
    : [{ index: -1, label: "Tự động" }, ...qualities].map((item) => ({ value: item.index, label: item.label, selected: item.index === quality }));

  function chooseOption(value: number) {
    if (settingsView === "speed") {
      setRate(value);
      if (videoRef.current) videoRef.current.playbackRate = value;
    } else {
      setQuality(value);
      // nextLevel đổi chất lượng ở đoạn kế tiếp nên video không bị khựng.
      if (hlsRef.current) hlsRef.current.nextLevel = value;
    }
    setSettingsView("main");
  }

  return (
    <section className={styles.section} aria-labelledby={headingId} data-lesson-id={lessonId}>
      <h3 id={headingId} className={styles.heading}>Video bài học</h3>
      <div
        ref={surfaceRef}
        className={`${styles.playerSurface} ${styles.directSurface}`}
        data-controls-visible={controlsVisible || paused || settingsOpen}
        onPointerMove={revealControls}
        onPointerDownCapture={(event) => {
          if (event.target instanceof HTMLInputElement && event.target.type === "range") draggingRef.current = true;
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse" && videoRef.current && !videoRef.current.paused && !settingsOpenRef.current && !draggingRef.current
            && !surfaceRef.current?.querySelector(":focus-visible")) setControlsVisible(false);
        }}
        onFocusCapture={revealControls}
        onBlurCapture={revealControls}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.frameWrap}>
          <video
            ref={videoRef}
            className={`${styles.frame} ${styles.video}`}
            aria-label={`${paused ? "Phát" : "Tạm dừng"} video: ${title.trim() || "bài học"}`}
            role="button"
            tabIndex={0}
            playsInline
            preload="metadata"
            onTimeUpdate={(event) => updateTime(event.currentTarget)}
            onDurationChange={(event) => updateTime(event.currentTarget)}
            onProgress={(event) => updateTime(event.currentTarget)}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            onCanPlay={() => setBuffering(false)}
            onVolumeChange={(event) => { setVolume(event.currentTarget.volume); setMuted(event.currentTarget.muted); }}
            onRateChange={(event) => setRate(event.currentTarget.playbackRate)}
            onPlay={() => {
              if (hlsRef.current) {
                hlsRef.current.config.maxBufferLength = 30;
                hlsRef.current.config.maxMaxBufferLength = 600;
              }
              setPaused(false); setStarted(true); setMessage(""); revealControls();
            }}
            onPause={() => { setPaused(true); setBuffering(false); revealControls(); }}
            onEnded={() => { setPaused(true); revealControls(); }}
            onError={() => onFallback("error")}
            onPointerDown={(event) => { pointerTypeRef.current = event.pointerType; touchWasVisibleRef.current = controlsVisible; }}
            onClick={(event) => {
              if (!ready) return;
              if (settingsOpenRef.current) { closeSettings(); return; }
              if (pointerTypeRef.current !== "touch") { togglePlayback(true); return; }
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = (event.clientX - rect.left) / rect.width;
              // Chạm đúp vào hai bên để tua như ứng dụng YouTube.
              if (event.timeStamp - lastTapRef.current < 300 && (ratio < 1 / 3 || ratio > 2 / 3)) {
                lastTapRef.current = 0;
                seekBy(ratio < 1 / 3 ? -10 : 10, true);
                return;
              }
              lastTapRef.current = event.timeStamp;
              if (videoRef.current?.paused) togglePlayback();
              else if (touchWasVisibleRef.current) { window.clearTimeout(hideTimerRef.current); setControlsVisible(false); }
              else revealControls();
            }}
          />
          {buffering && !paused && <span className={styles.spinner} aria-hidden="true" />}
          {feedback && <span key={feedback.id} className={styles.feedback} data-side={feedback.side} aria-hidden="true"
            onAnimationEnd={() => setFeedback((current) => (current?.id === feedback.id ? null : current))}>{feedback.content}</span>}
          {paused && ready && <button type="button" className={styles.centerPlay} data-started={started} aria-label="Phát video" onClick={() => togglePlayback()}>
            <Play size={28} fill="currentColor" aria-hidden="true" />
          </button>}
        </div>
        <div
          className={`${styles.controls} ${styles.overlayControls}`}
          data-visible={controlsVisible || paused || settingsOpen}
          role="group"
          aria-label="Điều khiển video"
          onPointerEnter={(event) => { if (event.pointerType === "mouse") hoveringControlsRef.current = true; }}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") { hoveringControlsRef.current = false; revealControls(); } }}
        >
          <div
            className={styles.timeline}
            onPointerMove={(event) => {
              if (!duration) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
              setHover({ ratio, time: ratio * duration });
            }}
            onPointerLeave={() => setHover(null)}
          >
            {hover && <span className={styles.timeTooltip} style={{ left: `clamp(24px, ${hover.ratio * 100}%, calc(100% - 24px))` }} aria-hidden="true">
              {formatTime(hover.time)}
            </span>}
            <input
              ref={timelineRef}
              aria-label="Vị trí video" aria-valuetext={`${formatTime(time)} / ${formatTime(duration)}`} type="range" min={0} max={duration || 1} step="0.1"
              value={Math.min(time, duration || 1)} disabled={!ready || !duration}
              style={{
                "--played": `${duration ? Math.min(100, (time / duration) * 100) : 0}%`,
                "--buffered": `${duration ? Math.min(100, (Math.max(buffered, time) / duration) * 100) : 0}%`,
              } as React.CSSProperties}
              onChange={(event) => { if (videoRef.current) videoRef.current.currentTime = Number(event.currentTarget.value); }}
            />
          </div>
          <div className={styles.controlButtons}>
            <button type="button" aria-label={paused ? "Phát" : "Tạm dừng"} title={paused ? "Phát (K)" : "Tạm dừng (K)"} disabled={!ready} onClick={() => togglePlayback()}>
              {paused ? <Play size={20} fill="currentColor" aria-hidden="true" /> : <Pause size={20} fill="currentColor" aria-hidden="true" />}
            </button>
            <button type="button" className={styles.seekButton} aria-label="Tua lùi 10 giây" title="Tua lùi 10 giây (J)" disabled={!ready || !duration} onClick={() => seekBy(-10)}>
              <RotateCcw size={18} aria-hidden="true" /><span>10</span>
            </button>
            <button type="button" className={styles.seekButton} aria-label="Tua tới 10 giây" title="Tua tới 10 giây (L)" disabled={!ready || !duration} onClick={() => seekBy(10)}>
              <RotateCw size={18} aria-hidden="true" /><span>10</span>
            </button>
            <div className={styles.overlayVolume}>
              <button type="button" aria-label={muted || volume === 0 ? "Bật tiếng" : "Tắt tiếng"} title={muted || volume === 0 ? "Bật tiếng (M)" : "Tắt tiếng (M)"} disabled={!ready}
                onClick={() => toggleMute()}>
                {muted || volume === 0 ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
              </button>
              <input aria-label="Âm lượng" type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} disabled={!ready}
                style={{ "--level": `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
                onChange={(event) => changeVolume(Number(event.currentTarget.value))} />
            </div>
            <span className={styles.timeDisplay}>{formatTime(time)}<span> / {formatTime(duration)}</span></span>
            <div className={styles.overlaySpacer} />
            <button ref={settingsButtonRef} type="button" aria-label="Cài đặt video" title="Cài đặt video" aria-expanded={settingsOpen} aria-controls={settingsOpen ? settingsId : undefined} disabled={!ready}
                onClick={() => { if (settingsOpenRef.current) closeSettings(); else { settingsOpenRef.current = true; setSettingsOpen(true); revealControls(); } }}>
              <Settings size={20} aria-hidden="true" />
            </button>
            <button type="button" aria-label={fullscreen ? "Thoát toàn màn hình" : "Bật toàn màn hình"} title={fullscreen ? "Thoát toàn màn hình (F)" : "Bật toàn màn hình (F)"} onClick={toggleFullscreen}>
              {fullscreen ? <Minimize size={20} aria-hidden="true" /> : <Expand size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {settingsOpen && <div ref={settingsMenuRef} id={settingsId} className={styles.settingsMenu} role="group" aria-label="Cài đặt video">
          {settingsView === "main" ? <>
            <div className={styles.settingsHeader}>
              <span>Cài đặt</span>
              <button type="button" aria-label="Đóng cài đặt" onClick={closeSettings}><X size={18} aria-hidden="true" /></button>
            </div>
            <button type="button" className={styles.settingsRow} data-first onClick={() => setSettingsView("speed")}>
              <span>Tốc độ phát</span><span className={styles.settingsValue}>{rateLabel(rate)}<ChevronRight size={16} aria-hidden="true" /></span>
            </button>
            <button type="button" className={styles.settingsRow} disabled={qualities.length === 0} onClick={() => setSettingsView("quality")}>
              <span>Chất lượng</span><span className={styles.settingsValue}>{qualityLabel}<ChevronRight size={16} aria-hidden="true" /></span>
            </button>
            <label className={styles.mobileVolume}>Âm lượng
              <input aria-label="Âm lượng" type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} disabled={!ready}
                onChange={(event) => changeVolume(Number(event.currentTarget.value))} />
            </label>
          </> : <>
            <button type="button" className={styles.settingsBack} data-first onClick={() => setSettingsView("main")}
              aria-label={`Quay lại: ${settingsView === "speed" ? "Tốc độ phát" : "Chất lượng"}`}>
              <ChevronLeft size={18} aria-hidden="true" />{settingsView === "speed" ? "Tốc độ phát" : "Chất lượng"}
            </button>
            <div role="group" aria-label={settingsView === "speed" ? "Tốc độ phát" : "Chất lượng video"}>
              {options.map((option) => (
                <button key={option.value} type="button" className={styles.settingsOption} aria-pressed={option.selected} onClick={() => chooseOption(option.value)}>
                  <Check size={16} aria-hidden="true" />{option.label}
                </button>
              ))}
            </div>
          </>}
        </div>}
      </div>
      {!ready && <p className={styles.note} role="status">Đang chuẩn bị video…</p>}
      {message && <p className={styles.fallback} role="status">{message}</p>}
      <p className={styles.note}>Video phát trực tiếp; ứng dụng không lưu tệp video. Nếu cần phụ đề, hãy dùng trình phát gốc.</p>
      <div className={styles.fallbackActions}>
        <button type="button" onClick={() => onFallback("manual")}>Dùng trình phát gốc</button>
        <a href={embedUrl} target="_blank" rel="noopener noreferrer">Mở trong thẻ mới</a>
      </div>
    </section>
  );
}
