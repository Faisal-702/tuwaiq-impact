"use client";

import { Download, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { formatDuration } from "@/i18n/format";
import { cn } from "@/lib/utils";

/**
 * Video player with play/pause, timeline, volume and full screen.
 * Never autoplays; plays the original upload at its native resolution.
 */
export function VideoPlayer({
  src,
  poster,
  mimeType,
  title,
}: {
  src: string;
  poster: string | null;
  mimeType: string | null;
  title: string;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [unsupported, setUnsupported] = useState(false);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2600);
  }, []);

  // Metadata can load before hydration attaches React's media listeners.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const sync = () => {
      if (Number.isFinite(v.duration)) setDuration(v.duration);
    };
    if (v.readyState >= 1) queueMicrotask(sync);
    v.addEventListener("loadedmetadata", sync);
    return () => v.removeEventListener("loadedmetadata", sync);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!el || !v) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else {
      v.webkitEnterFullscreen?.(); // iOS Safari
    }
  };

  const seek = (value: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(value)) return;
    v.currentTime = value;
    setTime(value);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const v = videoRef.current;
    if (!v) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      toggle();
    } else if (e.key === "ArrowRight") {
      seek(Math.min(v.currentTime + 5, duration));
    } else if (e.key === "ArrowLeft") {
      seek(Math.max(v.currentTime - 5, 0));
    } else if (e.key === "f") {
      void toggleFullscreen();
    } else if (e.key === "m") {
      v.muted = !v.muted;
    }
    showControls();
  };

  const progress = duration > 0 ? (time / duration) * 100 : 0;
  const visible = controlsVisible || !playing;

  return (
    <div
      ref={containerRef}
      dir="ltr"
      onMouseMove={showControls}
      onKeyDown={onKeyDown}
      className={cn(
        "group/video relative overflow-hidden bg-[#0b0f19] ring-1 ring-line-soft",
        fullscreen ? "flex items-center justify-center" : "aspect-video rounded-2xl",
        playing && !visible && "cursor-none",
      )}
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        preload="metadata"
        playsInline
        aria-label={title}
        onClick={toggle}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          showControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        className="h-full w-full object-contain"
      >
        <source
          src={src}
          type={mimeType === "video/quicktime" ? "video/mp4" : (mimeType ?? undefined)}
          onError={() => setUnsupported(true)}
        />
      </video>

      {unsupported ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0b0f19]/85 p-6 text-center text-white">
          <p className="max-w-sm text-sm text-white/85">{t.project.videoUnsupported}</p>
          <a
            href={src}
            download
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-white/90"
          >
            <Download className="size-4" aria-hidden />
            {t.project.download}
          </a>
        </div>
      ) : null}

      {!started && !unsupported ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={t.project.videoPlay}
          className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/35 via-transparent to-transparent"
        >
          <span className="grid size-[4.5rem] place-items-center rounded-full bg-white/95 text-purple shadow-[0_20px_40px_-12px_rgb(0_0_0/0.5)] transition-transform duration-300 ease-out-soft hover:scale-105">
            <Play className="ms-1 size-7 fill-current" aria-hidden />
          </span>
        </button>
      ) : null}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300",
          started ? (visible ? "opacity-100" : "opacity-0 group-focus-within/video:opacity-100") : "pointer-events-none opacity-0",
        )}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={t.project.videoSeek}
          aria-valuetext={`${formatDuration(time)} / ${formatDuration(duration)}`}
          className="video-range h-1.5 w-full cursor-pointer"
          style={{ ["--fill" as string]: `${progress}%` }}
        />
        <div className="mt-2 flex items-center gap-2 text-white">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? t.project.videoPause : t.project.videoPlay}
            className="grid size-9 place-items-center rounded-lg transition hover:bg-white/15"
          >
            {playing ? <Pause className="size-5 fill-current" aria-hidden /> : <Play className="size-5 fill-current" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => {
              const v = videoRef.current;
              if (v) v.muted = !v.muted;
            }}
            aria-label={muted || volume === 0 ? t.project.videoUnmute : t.project.videoMute}
            className="grid size-9 place-items-center rounded-lg transition hover:bg-white/15"
          >
            {muted || volume === 0 ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = videoRef.current;
              if (!v) return;
              v.volume = Number(e.target.value);
              v.muted = Number(e.target.value) === 0;
            }}
            aria-label={t.project.videoVolume}
            className="video-range hidden h-1 w-20 cursor-pointer sm:block"
            style={{ ["--fill" as string]: `${(muted ? 0 : volume) * 100}%` }}
          />
          <span className="ms-2 text-xs tabular-nums text-white/85">
            {formatDuration(time)} / {formatDuration(duration)}
          </span>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreen ? t.project.videoExitFullscreen : t.project.videoFullscreen}
            className="ms-auto grid size-9 place-items-center rounded-lg transition hover:bg-white/15"
          >
            {fullscreen ? <Minimize className="size-5" aria-hidden /> : <Maximize className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}
