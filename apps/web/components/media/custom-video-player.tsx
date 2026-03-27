"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type VideoPlaylistItem = {
  id: string;
  title: string;
  src: string;
  description?: string;
  durationLabel?: string;
};

type CustomVideoPlayerProps = {
  title?: string;
  initialVideoId?: string;
  playlist: VideoPlaylistItem[];
};

const RESUME_PREFIX = "knowlense:video-progress:";
const SEEK_SECONDS = 10;

function storageKey(videoId: string) {
  return `${RESUME_PREFIX}${videoId}`;
}

function clampTime(time: number, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, time);
  }

  return Math.min(Math.max(0, time), Math.max(0, duration - 1));
}

export function CustomVideoPlayer({ title = "Video playlist", initialVideoId, playlist }: CustomVideoPlayerProps) {
  const fallbackVideo = playlist[0] ?? null;
  const initialVideo =
    playlist.find((item) => item.id === initialVideoId) ??
    fallbackVideo;

  const [activeVideoId, setActiveVideoId] = useState(initialVideo?.id ?? "");
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSavedSecondRef = useRef<number>(-1);

  const activeVideo = useMemo(
    () => playlist.find((item) => item.id === activeVideoId) ?? fallbackVideo,
    [activeVideoId, fallbackVideo, playlist]
  );

  useEffect(() => {
    if (!activeVideo) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    lastSavedSecondRef.current = -1;
    setIsPlaying(false);
    setPlaylistOpen(false);
  }, [activeVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeVideo) {
      return;
    }

    function handleLoadedMetadata() {
      const savedValue = window.localStorage.getItem(storageKey(activeVideo.id));
      const savedTime = savedValue ? Number(savedValue) : 0;
      const currentVideo = videoRef.current;

      if (!currentVideo || !savedTime || Number.isNaN(savedTime)) {
        return;
      }

      currentVideo.currentTime = clampTime(savedTime, currentVideo.duration);
    }

    function handleTimeUpdate() {
      const currentVideo = videoRef.current;

      if (!currentVideo) {
        return;
      }

      const roundedSecond = Math.floor(currentVideo.currentTime);

      if (roundedSecond === lastSavedSecondRef.current) {
        return;
      }

      lastSavedSecondRef.current = roundedSecond;
      window.localStorage.setItem(storageKey(activeVideo.id), String(roundedSecond));
    }

    function handleEnded() {
      window.localStorage.removeItem(storageKey(activeVideo.id));
      setIsPlaying(false);
    }

    function handlePlay() {
      setIsPlaying(true);
    }

    function handlePause() {
      setIsPlaying(false);
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [activeVideo]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const activeElement = document.activeElement as HTMLElement | null;
      const isTypingTarget =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.tagName === "SELECT" ||
        activeElement?.isContentEditable;

      if (isTypingTarget) {
        return;
      }

      const video = videoRef.current;
      if (!video) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();

        if (video.paused) {
          void video.play();
        } else {
          video.pause();
        }
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        video.currentTime = clampTime(video.currentTime - SEEK_SECONDS, video.duration);
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        video.currentTime = clampTime(video.currentTime + SEEK_SECONDS, video.duration);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!activeVideo) {
    return null;
  }

  return (
    <section className="relative">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Media</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Progress is saved automatically for each video. Use `Space` to play or pause and the left/right arrow keys to
            skip 10 seconds.
          </p>
        </div>

        <button
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 md:hidden"
          onClick={() => setPlaylistOpen(true)}
          type="button"
        >
          Open playlist
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
        <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Now playing</div>
                <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950">{activeVideo.title}</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {isPlaying ? "Playing" : "Paused"}
              </span>
            </div>
            {activeVideo.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{activeVideo.description}</p> : null}
          </div>

          <div className="bg-slate-950">
            <video
              ref={videoRef}
              className="aspect-video w-full bg-black"
              controls
              playsInline
              preload="metadata"
              src={activeVideo.src}
            />
          </div>
        </article>

        <aside className="hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] lg:block">
          <div className="mb-3 px-2">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Playlist</h3>
            <p className="mt-1 text-sm text-slate-600">Select any video. Resume time is tracked independently for each item.</p>
          </div>

          <div className="space-y-2">
            {playlist.map((item, index) => {
              const isActive = item.id === activeVideo.id;

              return (
                <button
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-blue-600 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  key={item.id}
                  onClick={() => setActiveVideoId(item.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Video {index + 1}</span>
                    {item.durationLabel ? <span className="text-xs text-slate-500">{item.durationLabel}</span> : null}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{item.title}</div>
                  {item.description ? <div className="mt-1 text-sm leading-6 text-slate-600">{item.description}</div> : null}
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-slate-950/35 transition-opacity duration-300 lg:hidden ${
          playlistOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setPlaylistOpen(false)}
      />

      <div
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[78vh] rounded-t-[28px] border border-slate-200 bg-white p-4 shadow-[0_-20px_50px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-out lg:hidden ${
          playlistOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Playlist</h3>
            <p className="text-sm text-slate-600">Choose a video and continue from where you left off.</p>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700"
            onClick={() => setPlaylistOpen(false)}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="max-h-[58vh] space-y-2 overflow-y-auto pb-2">
          {playlist.map((item, index) => {
            const isActive = item.id === activeVideo.id;

            return (
              <button
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-blue-600 bg-blue-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
                key={item.id}
                onClick={() => {
                  setActiveVideoId(item.id);
                  setPlaylistOpen(false);
                }}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Video {index + 1}</span>
                  {item.durationLabel ? <span className="text-xs text-slate-500">{item.durationLabel}</span> : null}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{item.title}</div>
                {item.description ? <div className="mt-1 text-sm leading-6 text-slate-600">{item.description}</div> : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
