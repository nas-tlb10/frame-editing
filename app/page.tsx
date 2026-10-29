"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Asset = {
  file: string;
  name: string;
  kind: "video" | "image" | "audio" | "other";
  bytes: number;
  duration?: number;
  width?: number;
  height?: number;
};

type PresetInfo = {
  id: string;
  label: string;
  tagline: string;
  version: string;
  width: number;
  height: number;
  fps: number;
};

type Job = {
  id: string;
  status: "transcribing" | "planning" | "rendering" | "done" | "error";
  progress: number;
  stage: string;
  detail?: string;
  mode?: "reel" | "montage";
  presetId?: string;
  file?: string;
  instruction?: string;
  planSource?: "claude" | "mock" | "transcript";
  model?: string;
  notice?: string;
  transcript?: { files: number; words: number; engine: string | null; model?: string; language?: string };
  outline?: Array<{ id: string; start: number; end: number; source: number; text: string }>;
  fxSummary?: { cuts: number; pops: number; sfx: number; hook: string | null };
  captionCount?: number;
  usage?: { inputTokens: number; outputTokens: number; costUsd: number };
  video?: { url: string; bytes: number; duration: number };
  timings: { planningMs?: number; renderMs?: number; totalMs?: number };
  error?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tone?: "warning" | "danger";
  tools?: string[];
  retry?: string;
};

const STAGE_LABEL: Record<string, string> = {
  transcribe: "Transcription de la parole",
  plan: "Director : coupes, accroche, mots-clés",
  compile: "Compilation de la composition",
  capture: "Rendu des images",
  encode: "Encodage",
  assemble: "Mixage et assemblage",
  done: "Terminé",
  error: "Erreur",
};

const SUGGESTIONS = ["Accroche plus courte", "Mets en avant les chiffres", "Ton plus sobre"];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function engineLabel(engine?: string | null): string {
  if (engine === "parakeet") return "Parakeet (local)";
  if (engine === "whisper") return "Whisper (local)";
  return engine ?? "—";
}

/** Résumé du Director quand un montage se termine : ce qui a été fait, et par qui. */
function summarize(job: Job, presetLabel: string): Message[] {
  if (job.status === "error") {
    return [
      {
        id: `${job.id}-error`,
        role: "assistant",
        tone: "danger",
        text: `Le montage a échoué : ${job.error ?? "erreur inconnue"}`,
        retry: job.instruction ?? "",
      },
    ];
  }
  const out: Message[] = [];
  const fx = job.fxSummary;
  const lines = [
    `Montage prêt · ${presetLabel} · ${job.video ? `${job.video.duration.toFixed(1)} s` : ""}`,
    job.transcript
      ? `Sous-titres : ${job.transcript.words} mots transcrits par ${engineLabel(job.transcript.engine)}${
          job.transcript.language === "auto"
            ? ", langue détectée automatiquement"
            : job.transcript.language
              ? `, langue ${job.transcript.language}`
              : ""
        }.`
      : null,
    fx ? `${fx.cuts} coupe${fx.cuts > 1 ? "s" : ""}, ${fx.pops} mot${fx.pops > 1 ? "s" : ""}-clé${fx.pops > 1 ? "s" : ""}, ${fx.sfx} son${fx.sfx > 1 ? "s" : ""}.` : null,
    fx?.hook ? `Accroche : « ${fx.hook} »` : null,
    job.planSource === "claude"
      ? `Accroche et mots-clés choisis par Claude (${job.model}).`
      : "Accroche et mots-clés choisis automatiquement (sans Claude).",
  ].filter(Boolean);
  out.push({
    id: `${job.id}-done`,
    role: "assistant",
    text: lines.join("\n"),
    tools: ["transcribe", "cutSilences", "captions", ...(fx?.hook ? ["hook"] : []), ...(fx?.pops ? ["keywords"] : []), ...(fx?.sfx ? ["sfx"] : []), "render"],
  });
  if (job.notice) out.push({ id: `${job.id}-notice`, role: "assistant", tone: "warning", text: job.notice });
  return out;
}

export default function Page() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [presetId, setPresetId] = useState("instagram");
  const [videoFile, setVideoFile] = useState("");
  const [tab, setTab] = useState<"media" | "scenes">("media");
  const [job, setJob] = useState<Job | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const reportedRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const preset = presets.find((p) => p.id === presetId);
  const videos = assets.filter((a) => a.kind === "video");
  const selected = videos.find((a) => a.file === videoFile);
  const busy = submitting || (job !== null && job.status !== "done" && job.status !== "error");

  const loadAssets = useCallback(async () => {
    try {
      const response = await fetch("/api/assets", { cache: "no-store" });
      const data = (await response.json()) as { assets: Asset[]; presets: PresetInfo[] };
      setAssets(data.assets);
      setPresets(data.presets);
      setVideoFile((current) =>
        data.assets.some((a) => a.file === current) ? current : (data.assets.find((a) => a.kind === "video")?.file ?? ""),
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  // Dernier montage, retrouvé après un rechargement de page.
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/jobs", { cache: "no-store" });
        const data = (await response.json()) as { job: Job | null };
        if (!data.job || data.job.mode !== "reel") return;
        if (data.job.status !== "done" && data.job.status !== "error") jobIdRef.current = data.job.id;
        if (data.job.presetId) setPresetId(data.job.presetId);
        setJob(data.job);
      } catch {
        // pas de montage précédent
      }
    })();
  }, []);

  useEffect(() => {
    const id = jobIdRef.current;
    if (!id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Statut ${response.status}`);
        const next = (await response.json()) as Job;
        if (cancelled) return;
        setJob(next);
        if (next.status === "done" || next.status === "error") {
          jobIdRef.current = null;
          return;
        }
      } catch {
        // réseau instable : on réessaie
      }
      timer = setTimeout(poll, 800);
    };
    timer = setTimeout(poll, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [job?.id]);

  // Le Director rend compte à la fin de chaque montage.
  useEffect(() => {
    if (!job || (job.status !== "done" && job.status !== "error")) return;
    if (presets.length === 0 || reportedRef.current === job.id) return;
    reportedRef.current = job.id;
    const label = presets.find((p) => p.id === job.presetId)?.label ?? job.presetId ?? "";
    setMessages((current) => [...current, ...summarize(job, label)]);
    if (job.status === "done") setTab("scenes");
  }, [job, presets]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, job?.detail]);

  const upload = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploadPct(0);
    setUploadError(null);
    const form = new FormData();
    for (const file of files) form.append("files", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setUploadPct(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      setUploadPct(null);
      try {
        const data = JSON.parse(xhr.responseText) as {
          saved?: Array<{ file: string }>;
          assets?: Asset[];
          rejected?: Array<{ name: string; reason: string }>;
          error?: string;
        };
        if (data.assets) setAssets(data.assets);
        const uploadedVideo = data.saved
          ?.map((s) => s.file)
          .find((file) => data.assets?.some((a) => a.file === file && a.kind === "video"));
        if (uploadedVideo) setVideoFile(uploadedVideo);
        if (data.rejected?.length) setUploadError(data.rejected.map((r) => `${r.name} : ${r.reason}`).join(" · "));
        else if (data.error) setUploadError(data.error);
      } catch {
        setUploadError("Réponse du serveur illisible.");
      }
    };
    xhr.onerror = () => {
      setUploadPct(null);
      setUploadError("Envoi interrompu.");
    };
    xhr.send(form);
  };

  const removeAsset = async (file: string) => {
    const response = await fetch(`/api/upload?file=${encodeURIComponent(file)}`, { method: "DELETE" });
    const data = (await response.json()) as { assets?: Asset[]; error?: string };
    if (data.assets) {
      setAssets(data.assets);
      if (file === videoFile) setVideoFile(data.assets.find((a) => a.kind === "video")?.file ?? "");
    }
    if (data.error) setUploadError(data.error);
  };

  const generate = async (instruction = "") => {
    if (!videoFile || busy) return;
    setSubmitting(true);
    if (instruction) {
      setMessages((current) => [...current, { id: `u-${Date.now()}`, role: "user", text: instruction }]);
    }
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "reel", file: videoFile, preset: presetId, instruction }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? "Création du montage impossible.");
      jobIdRef.current = data.id;
      setJob({
        id: data.id,
        status: "transcribing",
        progress: 4,
        stage: "transcribe",
        detail: "Préparation",
        mode: "reel",
        presetId,
        file: videoFile,
        instruction,
        timings: {},
      });
      setDraft("");
    } catch (cause) {
      setMessages((current) => [
        ...current,
        { id: `e-${Date.now()}`, role: "assistant", tone: "danger", text: cause instanceof Error ? cause.message : "Erreur inconnue." },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const status = busy
    ? { tone: "warning", label: "Montage en cours" }
    : job?.status === "error"
      ? { tone: "danger", label: "Échec du montage" }
      : job?.status === "done"
        ? { tone: "success", label: "Montage prêt" }
        : { tone: "idle", label: "Aucun montage" };
  const portrait = preset ? preset.height > preset.width : true;
  const shown = job?.video && !busy ? job : null;

  return (
    <div className="editor">
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo" aria-hidden>
            F
          </span>
          <span className="muted">Frame /</span>
          <span className="crumb" title={selected?.name}>
            {selected?.name ?? "Nouveau montage"}
          </span>
          <span className="pill">
            <span className="dot" data-tone={status.tone} />
            {status.label}
          </span>
        </div>
        <div className="topbar-right">
          {shown?.video && (
            <a className="btn" href={`${shown.video.url}?v=${shown.id}`} download={`frame-${shown.id}.mp4`}>
              Télécharger le MP4 · {formatBytes(shown.video.bytes)}
            </a>
          )}
          <button type="button" className="btn btn-primary" onClick={() => void generate()} disabled={busy || !videoFile}>
            {busy ? "Montage en cours…" : job?.status === "done" ? "Relancer le montage" : "Générer le montage"}
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="side" aria-label="Médias et style">
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "media"} onClick={() => setTab("media")}>
              Médias
            </button>
            <button type="button" role="tab" aria-selected={tab === "scenes"} onClick={() => setTab("scenes")}>
              Scènes
            </button>
          </div>

          {tab === "media" ? (
            <>
              <div
                className="stack drop"
                data-active={dragging || undefined}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  upload(event.dataTransfer.files);
                }}
              >
                {!loaded ? (
                  <p className="muted">Lecture des médias…</p>
                ) : videos.length === 0 ? (
                  <p className="muted">Aucune vidéo. Importe une vidéo où quelqu&apos;un parle.</p>
                ) : (
                  videos.map((asset) => (
                    <div key={asset.file} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <button
                        type="button"
                        className="file"
                        aria-pressed={asset.file === videoFile}
                        onClick={() => setVideoFile(asset.file)}
                        title={asset.file}
                      >
                        <span className="file-thumb" data-kind={asset.kind} />
                        <span className="file-body">
                          <b>{asset.name}</b>
                          <span className="muted num">
                            {asset.duration ? formatTime(asset.duration) : "—"}
                            {asset.width ? ` · ${asset.width}×${asset.height}` : ""}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Supprimer ${asset.name}`}
                        onClick={() => void removeAsset(asset.file)}
                        disabled={busy}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  hidden
                  onChange={(event) => {
                    if (event.target.files) upload(event.target.files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="btn btn-dashed"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploadPct !== null}
                >
                  {uploadPct !== null ? `Envoi ${uploadPct} %` : "+ Ajouter une vidéo"}
                </button>
                {uploadPct !== null && (
                  <div className="progress" style={{ width: "100%" }}>
                    <span style={{ width: `${uploadPct}%` }} />
                  </div>
                )}
                {uploadError && <p style={{ color: "var(--danger)", fontSize: 12 }}>{uploadError}</p>}
              </div>

              <div className="stack" role="radiogroup" aria-label="Style">
                <span className="micro">Style</span>
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={p.id === presetId}
                    className="style-card"
                    onClick={() => setPresetId(p.id)}
                    disabled={busy}
                  >
                    <b>
                      {p.label}
                      <span className="muted">{p.height > p.width ? "9:16" : "16:9"}</span>
                    </b>
                    <span>{p.tagline}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="stack">
              <span className="micro">Scènes du montage</span>
              {job?.outline?.length ? (
                job.outline.map((scene, i) => (
                  <div className="scene-row" key={scene.id}>
                    <header>
                      <span>Plan {i + 1}</span>
                      <span className="muted num">
                        {scene.start.toFixed(1)}–{scene.end.toFixed(1)} s
                      </span>
                    </header>
                    <p>{scene.text || <span className="muted">(sans parole)</span>}</p>
                    <span className="muted num" style={{ fontSize: 11 }}>
                      source à {formatTime(scene.source)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted">Les plans apparaissent ici après le montage.</p>
              )}
              {job?.transcript && (
                <div className="provenance">
                  <b>D&apos;où viennent les sous-titres ?</b>
                  <br />
                  La parole de la vidéo est transcrite sur ta machine par {engineLabel(job.transcript.engine)}
                  {job.transcript.model ? ` (${job.transcript.model})` : ""}, via HyperFrames : {job.transcript.words} mots,
                  chacun avec son instant de début et de fin. Rien n&apos;est envoyé à un service externe pour
                  cette étape.
                </div>
              )}
            </div>
          )}
        </aside>

        <main className="center">
          <div className="center-bar">
            <span className="pill" style={{ color: "var(--accent)" }}>
              Aperçu rendu · MP4 local
            </span>
            {preset && (
              <span className="pill">
                {preset.label} · {preset.width}×{preset.height} · {preset.fps} fps
              </span>
            )}
          </div>

          <div className="player" data-aspect={portrait ? "portrait" : "landscape"}>
            {shown?.video ? (
              <video key={shown.video.url} src={`${shown.video.url}?v=${shown.id}`} controls playsInline />
            ) : busy ? (
              <div className="player-empty" aria-live="polite">
                <div className="progress">
                  <span style={{ width: `${job?.progress ?? 0}%` }} />
                </div>
                <span>
                  {STAGE_LABEL[job?.stage ?? "transcribe"] ?? job?.stage} · <span className="num">{job?.progress ?? 0} %</span>
                </span>
                {job?.detail && <span style={{ fontSize: 12 }}>{job.detail}</span>}
              </div>
            ) : (
              <div className="player-empty">
                {videos.length === 0
                  ? "Ajoute une vidéo où quelqu'un parle."
                  : "Choisis un style, puis « Générer le montage »."}
              </div>
            )}
          </div>

          {shown && (
            <div className="facts">
              <span className="pill num">{shown.video?.duration.toFixed(1)} s</span>
              {shown.fxSummary && <span className="pill num">{shown.fxSummary.cuts} coupes</span>}
              {shown.captionCount !== undefined && <span className="pill num">{shown.captionCount} sous-titres</span>}
              {shown.fxSummary && <span className="pill num">{shown.fxSummary.pops} mots-clés</span>}
              {shown.fxSummary && <span className="pill num">{shown.fxSummary.sfx} sons</span>}
              {shown.timings.totalMs !== undefined && (
                <span className="pill num">rendu en {(shown.timings.totalMs / 1000).toFixed(0)} s</span>
              )}
            </div>
          )}
        </main>

        <aside className="chat" aria-label="Director">
          <div className="chat-head">
            <b>Director</b>
            <div className="muted" style={{ fontSize: 12 }}>
              Une consigne relance le montage complet · retouche ciblée à venir
            </div>
          </div>

          <div className="chat-log" ref={logRef} aria-live="polite">
            {messages.length === 0 && !busy && (
              <div className="bubble">
                Choisis une vidéo et un style. Je coupe les silences, sous-titre la parole et ajoute les effets du
                style. Tu peux me donner une consigne, par exemple sur l&apos;accroche.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div className="bubble" data-role={m.role} data-tone={m.tone}>
                  {m.text}
                </div>
                {m.tools && (
                  <div className="tools">
                    {m.tools.map((tool) => (
                      <span key={tool} className="pill">
                        <span className="dot" />
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
                {m.retry !== undefined && (
                  <button type="button" className="btn" onClick={() => void generate(m.retry)} disabled={busy}>
                    Réessayer
                  </button>
                )}
              </div>
            ))}
            {busy && (
              <div className="bubble muted">
                {STAGE_LABEL[job?.stage ?? "transcribe"] ?? "…"}
                {job?.detail ? ` — ${job.detail}` : ""}
              </div>
            )}
          </div>

          <form
            className="chat-foot"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim()) void generate(draft.trim());
            }}
          >
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="pill" onClick={() => setDraft(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
            <div className="composer">
              <label htmlFor="msg" className="sr-only">
                Consigne pour le Director
              </label>
              <input
                id="msg"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Une consigne pour le Director…"
                maxLength={600}
                disabled={busy}
              />
              <button type="submit" className="send" aria-label="Envoyer" disabled={busy || !draft.trim() || !videoFile}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
