"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Expand, Minimize, Pause, Play, RotateCcw, RotateCw, Volume2 } from "lucide-react";
import BunnyDirectPlayer from "./bunny-direct-player";
import styles from "./lesson-media-player.module.css";

export type LessonMediaPlayerProps = {
  lessonId: string;
  title: string;
  kind: "bunny" | "youtube";
  embedUrl: string;
  /** Trang bài gốc đã kiểm tra; dùng khi không nhúng được. */
  sourceUrl?: string;
};

type TimeUpdate = { seconds?: number; duration?: number };
type PlayerEvent = "ready" | "play" | "pause" | "ended" | "timeupdate" | "error" | "playbackratechange";
type BunnyPlayer = {
  on(event: PlayerEvent, callback: (value?: unknown) => void): void;
  off(event: PlayerEvent): void;
  supports(kind: "method" | "event", name: string): boolean;
  play(): void;
  pause(): void;
  getPaused(callback: (value: boolean) => void): void;
  getDuration(callback: (value: number) => void): void;
  getCurrentTime(callback: (value: number) => void): void;
  setCurrentTime(value: number): void;
  getVolume(callback: (value: number) => void): void;
  setVolume(value: number): void;
  setPlaybackRate?(value: number): void;
};
type BunnySdk = { Player: new (iframe: HTMLIFrameElement) => BunnyPlayer };

declare global {
  interface Window { playerjs?: BunnySdk }
}

let sdkPromise: Promise<BunnySdk> | undefined;

function loadBunnySdk(): Promise<BunnySdk> {
  if (window.playerjs?.Player) return Promise.resolve(window.playerjs);
  if (!sdkPromise) {
    sdkPromise = new Promise<BunnySdk>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js";
      script.async = true;
      script.onload = () => {
        if (window.playerjs?.Player) resolve(window.playerjs);
        else { script.remove(); reject(new Error("Player SDK unavailable")); }
      };
      script.onerror = () => { script.remove(); reject(new Error("Player SDK unavailable")); };
      document.head.appendChild(script);
    }).catch((error: unknown) => { sdkPromise = undefined; throw error; });
  }
  return sdkPromise;
}

function formatTime(value: number): string {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

function IframeLessonMediaPlayer({ lessonId, title, kind, embedUrl, sourceUrl }: LessonMediaPlayerProps) {
  const headingId = useId();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<BunnyPlayer | null>(null);
  const durationRef = useRef(0);
  const [connection, setConnection] = useState<"loading" | "ready" | "unavailable">("loading");
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [volumeSupported, setVolumeSupported] = useState(false);
  const [rate, setRate] = useState(1);
  const [rateSupported, setRateSupported] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function updateFullscreen() { setFullscreen(document.fullscreenElement === surfaceRef.current); }
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    if (kind !== "bunny") return;
    let active = true;
    let player: BunnyPlayer | null = null;
    const events: PlayerEvent[] = ["ready", "play", "pause", "ended", "timeupdate", "error", "playbackratechange"];
    const timer = window.setTimeout(() => { if (active) setConnection("unavailable"); }, 12000);

    void loadBunnySdk().then((sdk) => {
      if (!active || !iframeRef.current) return;
      player = new sdk.Player(iframeRef.current);
      playerRef.current = player;
      const current = player;

      current.on("ready", () => {
        if (!active) return;
        window.clearTimeout(timer);
        const basic = ["play", "pause", "getCurrentTime", "setCurrentTime"].every((name) => current.supports("method", name));
        if (!basic) { setConnection("unavailable"); return; }
        setConnection("ready");
        const canControlVolume = ["getVolume", "setVolume"].every((name) => current.supports("method", name));
        setVolumeSupported(canControlVolume);
        setRateSupported(Boolean(current.setPlaybackRate && current.supports("method", "setPlaybackRate")));
        current.getPaused((value) => { if (active) setPaused(value); });
        if (canControlVolume) current.getVolume((value) => { if (active && Number.isFinite(value)) setVolume(value); });
        current.getDuration((value) => {
          if (active && Number.isFinite(value) && value > 0) { durationRef.current = value; setDuration(value); }
        });
      });
      current.on("play", () => { if (active) { setPaused(false); setMessage(""); } });
      current.on("pause", () => { if (active) setPaused(true); });
      current.on("ended", () => { if (active) setPaused(true); });
      current.on("timeupdate", (value) => {
        if (!active || !value || typeof value !== "object") return;
        const update = value as TimeUpdate;
        if (typeof update.seconds === "number" && Number.isFinite(update.seconds)) setTime(Math.max(0, update.seconds));
        if (typeof update.duration === "number" && Number.isFinite(update.duration) && update.duration > 0) {
          durationRef.current = update.duration;
          setDuration(update.duration);
        }
      });
      current.on("playbackratechange", (value) => { if (active && typeof value === "number") setRate(value); });
      current.on("error", () => { if (active) setMessage("Không thực hiện được thao tác. Hãy thử lại hoặc dùng điều khiển trong video."); });
    }).catch(() => { if (active) { window.clearTimeout(timer); setConnection("unavailable"); } });

    return () => {
      active = false;
      window.clearTimeout(timer);
      if (player) events.forEach((event) => player?.off(event));
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [kind, lessonId, embedUrl]);

  function seekBy(offset: number) {
    const player = playerRef.current;
    player?.getCurrentTime((current) => {
      if (playerRef.current !== player || !Number.isFinite(current)) return;
      player.setCurrentTime(Math.max(0, Math.min(durationRef.current || Infinity, current + offset)));
    });
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === surfaceRef.current) await document.exitFullscreen();
      else await surfaceRef.current?.requestFullscreen();
    } catch {
      setMessage("Không thể mở toàn màn hình. Hãy dùng nút toàn màn hình trong video.");
    }
  }

  const ready = connection === "ready";
  const safeTitle = title.trim() || "bài học";
  const providerLabel = kind === "bunny" ? "Bunny Stream" : "YouTube";
  // Bunny defaults to autoplay when its embed URL has no explicit setting.
  const frameUrl = kind === "bunny" ? `${embedUrl}?autoplay=false` : embedUrl;

  return (
    <section className={styles.section} aria-labelledby={headingId} data-lesson-id={lessonId}>
      <h3 id={headingId} className={styles.heading}>Video bài học</h3>
      <div ref={surfaceRef} className={styles.playerSurface}>
        <div className={styles.frameWrap}>
          <iframe
            ref={iframeRef}
            key={`${lessonId}:${embedUrl}`}
            className={styles.frame}
            src={frameUrl}
            title={`Video bài học: ${safeTitle}`}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        </div>
        {kind === "bunny" && (
          <div className={styles.controls} role="group" aria-label="Điều khiển video">
            <div className={styles.timeline}>
              <span>{formatTime(time)}</span>
              <input
                aria-label="Vị trí video" type="range" min={0} max={duration || 1} step="0.1"
                value={Math.min(time, duration || 1)} disabled={!ready || !duration}
                onChange={(event) => {
                  const next = Number(event.currentTarget.value);
                  setTime(next);
                  playerRef.current?.setCurrentTime(next);
                }}
              />
              <span>{formatTime(duration)}</span>
            </div>
            <div className={styles.controlButtons}>
              <button type="button" aria-label={paused ? "Phát" : "Tạm dừng"} disabled={!ready}
                onClick={() => { if (paused) playerRef.current?.play(); else playerRef.current?.pause(); }}>
                {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
              </button>
              <button type="button" aria-label="Tua lùi 10 giây" disabled={!ready} onClick={() => seekBy(-10)}>
                <RotateCcw size={18} aria-hidden="true" /><span>10</span>
              </button>
              <button type="button" aria-label="Tua tới 10 giây" disabled={!ready} onClick={() => seekBy(10)}>
                <RotateCw size={18} aria-hidden="true" /><span>10</span>
              </button>
              {volumeSupported && <label className={styles.volume}>
                <Volume2 size={18} aria-hidden="true" />
                <input aria-label="Âm lượng" type="range" min={0} max={100} step={1} value={volume} disabled={!ready}
                  onFocus={() => playerRef.current?.getVolume((value) => { if (Number.isFinite(value)) setVolume(value); })}
                  onChange={(event) => { const next = Number(event.currentTarget.value); setVolume(next); playerRef.current?.setVolume(next); }} />
              </label>}
              {rateSupported && <label className={styles.rate}>Tốc độ
                <select value={rate} aria-label="Tốc độ phát" onChange={(event) => playerRef.current?.setPlaybackRate?.(Number(event.currentTarget.value))}>
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => <option key={value} value={value}>{value}×</option>)}
                </select>
              </label>}
              <button type="button" aria-label={fullscreen ? "Thoát toàn màn hình" : "Bật toàn màn hình"} onClick={toggleFullscreen}>
                {fullscreen ? <Minimize size={18} aria-hidden="true" /> : <Expand size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>
        )}
      </div>
      {kind === "bunny" && connection === "unavailable" && (
        <p className={styles.fallback}>Không kết nối được điều khiển riêng. Hãy dùng các nút trong video hoặc mở video trong thẻ mới.</p>
      )}
      {message && <p className={styles.fallback} role="status">{message}</p>}
      <p className={styles.note}>Video phát bằng trình phát chính thức của {providerLabel}; ứng dụng không tải video về.</p>
      <p className={styles.fallback}>
        <a href={embedUrl} target="_blank" rel="noopener noreferrer">Mở trong thẻ mới</a>
        {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Mở trang bài gốc</a>}
      </p>
    </section>
  );
}

export default function LessonMediaPlayer(props: LessonMediaPlayerProps) {
  const [fallback, setFallback] = useState<"error" | "manual" | null>(null);
  const useOriginal = useCallback((reason: "error" | "manual") => setFallback(reason), []);
  if (props.kind === "bunny" && !fallback) {
    return <BunnyDirectPlayer lessonId={props.lessonId} title={props.title} embedUrl={props.embedUrl} onFallback={useOriginal} />;
  }
  return <>
    {fallback === "error" && <p className={styles.fallback} role="status">Không thể dùng trình phát riêng. Đã chuyển sang trình phát gốc.</p>}
    <IframeLessonMediaPlayer {...props} />
  </>;
}
