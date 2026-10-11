"use client";

import {
  isTrackReference,
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useSpeakingParticipants,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RosterEntry } from "../rules";

/**
 * Couche média de la salle, derrière une interface unique :
 *  - LiveKit : vidéo de groupe réelle (WebRTC) ;
 *  - démo : sans clés LiveKit, chacun voit sa propre caméra et les autres sous forme d'avatar.
 * L'interface (mosaïque, barre de contrôle) ne dépend que de ce contexte.
 */
export type Tile = {
  id: string;
  userId: string;
  name: string;
  isLocal: boolean;
  isScreen: boolean;
  video: ReactNode | null;
  micOn: boolean;
  speaking: boolean;
};

export type MediaConnection = "connecting" | "connected" | "reconnecting" | "disconnected";

export type Media = {
  mode: "livekit" | "demo";
  connection: MediaConnection;
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
  canScreenShare: boolean;
  setMic: (on: boolean) => Promise<void>;
  setCam: (on: boolean) => Promise<void>;
  setScreen: (on: boolean) => Promise<void>;
  tiles: Tile[];
  /** Clé de traduction d'une erreur de périphérique (caméra/micro refusés…). */
  deviceError: string | null;
};

const MediaContext = createContext<Media | null>(null);

export function useMedia(): Media {
  const media = useContext(MediaContext);
  if (!media) throw new Error("useMedia hors de MediaProvider");
  return media;
}

export type MediaPrefs = { mic: boolean; cam: boolean };

function deviceErrorKey(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "deviceDenied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "deviceMissing";
  if (name === "NotReadableError") return "deviceBusy";
  return "deviceGeneric";
}

// ── LiveKit ──────────────────────────────────────────────────────────────────

export function LiveKitMedia({
  url,
  token,
  prefs,
  canScreenShare,
  onDisconnected,
  children,
}: {
  url: string;
  token: string;
  prefs: MediaPrefs;
  canScreenShare: boolean;
  onDisconnected: () => void;
  children: ReactNode;
}) {
  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect
      audio={prefs.mic}
      video={prefs.cam}
      options={{ adaptiveStream: true, dynacast: true }}
      onDisconnected={onDisconnected}
      style={{ display: "contents" }}
    >
      <RoomAudioRenderer />
      <LiveKitBridge canScreenShare={canScreenShare}>{children}</LiveKitBridge>
    </LiveKitRoom>
  );
}

function LiveKitBridge({ canScreenShare, children }: { canScreenShare: boolean; children: ReactNode }) {
  const state = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const speakers = useSpeakingParticipants();
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const guard = useCallback(async (op: () => Promise<unknown>) => {
    try {
      setDeviceError(null);
      await op();
    } catch (err) {
      setDeviceError(deviceErrorKey(err));
    }
  }, []);

  const media = useMemo<Media>(() => {
    const speaking = new Set(speakers.map((p) => p.identity));
    return {
      mode: "livekit",
      connection:
        state === ConnectionState.Connected
          ? "connected"
          : state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting
            ? "reconnecting"
            : state === ConnectionState.Disconnected
              ? "disconnected"
              : "connecting",
      micOn: isMicrophoneEnabled,
      camOn: isCameraEnabled,
      screenOn: isScreenShareEnabled,
      canScreenShare,
      setMic: (on) => guard(() => localParticipant.setMicrophoneEnabled(on)),
      setCam: (on) => guard(() => localParticipant.setCameraEnabled(on)),
      setScreen: (on) => guard(() => localParticipant.setScreenShareEnabled(on, { audio: true })),
      deviceError,
      tiles: tracks.map((t) => {
        const isScreen = t.source === Track.Source.ScreenShare;
        const live = isTrackReference(t) && !t.publication.isMuted;
        return {
          id: `${t.participant.identity}:${t.source}`,
          userId: t.participant.identity,
          name: t.participant.name || t.participant.identity,
          isLocal: t.participant.isLocal,
          isScreen,
          micOn: t.participant.isMicrophoneEnabled,
          speaking: !isScreen && speaking.has(t.participant.identity),
          video: live ? (
            <VideoTrack
              trackRef={t}
              className={cn("size-full", isScreen ? "object-contain" : "object-cover", t.participant.isLocal && !isScreen && "-scale-x-100")}
            />
          ) : null,
        };
      }),
    };
  }, [state, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled, canScreenShare, localParticipant, tracks, speakers, deviceError, guard]);

  return <MediaContext.Provider value={media}>{children}</MediaContext.Provider>;
}

// ── Démo (sans LiveKit) ──────────────────────────────────────────────────────

function StreamVideo({ stream, mirror, contain }: { stream: MediaStream; mirror?: boolean; contain?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={cn("size-full", contain ? "object-contain" : "object-cover", mirror && "-scale-x-100")} />;
}

/** Niveau sonore du micro local (détection « en train de parler »). */
function useSpeakingDetector(stream: MediaStream | null): boolean {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    if (!stream || !track) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let last = false;
    const loop = () => {
      analyser.getByteFrequencyData(data);
      const level = data.reduce((a, b) => a + b, 0) / data.length;
      const now = track.enabled && level > 18;
      if (now !== last) setSpeaking((last = now));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ctx.close().catch(() => {});
      setSpeaking(false);
    };
  }, [stream]);
  return speaking;
}

export function DemoMedia({
  me,
  roster,
  prefs,
  canScreenShare,
  children,
}: {
  me: { userId: string; name: string };
  roster: RosterEntry[];
  prefs: MediaPrefs;
  canScreenShare: boolean;
  children: ReactNode;
}) {
  const [cam, setCamStream] = useState<MediaStream | null>(null);
  const [mic, setMicStream] = useState<MediaStream | null>(null);
  const [screen, setScreenStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const speaking = useSpeakingDetector(mic);
  const streams = useRef({ cam, mic, screen });
  useEffect(() => {
    streams.current = { cam, mic, screen };
  });

  const stop = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

  const setCam = useCallback(async (on: boolean) => {
    setDeviceError(null);
    if (!on) {
      stop(streams.current.cam);
      return setCamStream(null);
    }
    try {
      setCamStream(await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } }));
    } catch (err) {
      setDeviceError(deviceErrorKey(err));
    }
  }, []);

  const setMic = useCallback(async (on: boolean) => {
    setDeviceError(null);
    const current = streams.current.mic;
    if (current) {
      // Couper/rétablir sans redemander l'autorisation (indispensable au « maintenir pour parler »).
      current.getAudioTracks().forEach((t) => (t.enabled = on));
      return setMicOn(on);
    }
    if (!on) return setMicOn(false);
    try {
      setMicStream(await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }));
      setMicOn(true);
    } catch (err) {
      setDeviceError(deviceErrorKey(err));
    }
  }, []);

  const setScreen = useCallback(async (on: boolean) => {
    setDeviceError(null);
    if (!on) {
      stop(streams.current.screen);
      return setScreenStream(null);
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      s.getVideoTracks()[0]?.addEventListener("ended", () => setScreenStream(null));
      setScreenStream(s);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "NotAllowedError")) setDeviceError(deviceErrorKey(err));
    }
  }, []);

  // Préférences choisies dans le hall d'accueil, appliquées une fois à l'entrée.
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    void Promise.resolve().then(() => {
      if (prefs.cam) void setCam(true);
      if (prefs.mic) void setMic(true);
    });
  }, [prefs, setCam, setMic]);

  // Libère caméra et micro en quittant la salle.
  useEffect(
    () => () => {
      const { cam: c, mic: m, screen: s } = streams.current;
      [c, m, s].forEach(stop);
    },
    [],
  );

  const media = useMemo<Media>(() => {
    const tiles: Tile[] = [];
    if (screen) {
      tiles.push({ id: `${me.userId}:screen`, userId: me.userId, name: me.name, isLocal: true, isScreen: true, micOn, speaking: false, video: <StreamVideo stream={screen} contain /> });
    }
    tiles.push({ id: me.userId, userId: me.userId, name: me.name, isLocal: true, isScreen: false, micOn, speaking: micOn && speaking, video: cam ? <StreamVideo stream={cam} mirror /> : null });
    for (const p of roster) {
      if (p.userId !== me.userId) tiles.push({ id: p.userId, userId: p.userId, name: p.name, isLocal: false, isScreen: false, micOn: false, speaking: false, video: null });
    }
    return {
      mode: "demo",
      connection: "connected",
      micOn,
      camOn: Boolean(cam),
      screenOn: Boolean(screen),
      canScreenShare,
      setMic,
      setCam,
      setScreen,
      tiles,
      deviceError,
    };
  }, [cam, screen, micOn, speaking, roster, me, canScreenShare, setMic, setCam, setScreen, deviceError]);

  return <MediaContext.Provider value={media}>{children}</MediaContext.Provider>;
}
