import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

dotenv.config();

const OAUTH_STATE_SECRET =
  process.env.OAUTH_STATE_SECRET || crypto.randomBytes(32).toString("hex");
const COOKIE_SIGNING_SECRET =
  process.env.COOKIE_SIGNING_SECRET || OAUTH_STATE_SECRET;
const SOCIAL_SESSION_COOKIE = "clipforge_social_session";

const execFileAsync = promisify(execFile);

// Ensure local bin directory is in PATH for yt-dlp and ffmpeg
const binDir = path.resolve(process.cwd(), "bin");
process.env.PATH = `${binDir}:${process.env.PATH}`;
const localYtdlpPath = path.join(binDir, "yt-dlp");
const ytdlpBin = fs.existsSync(localYtdlpPath) ? localYtdlpPath : "yt-dlp";

function ensureYtdlpReady(): string {
  if (fs.existsSync(localYtdlpPath)) {
    try {
      fs.chmodSync(localYtdlpPath, 0o755);
    } catch {}
    return localYtdlpPath;
  }
  return ytdlpBin;
}

function isYoutubeBotWallError(err: any): boolean {
  const msg = String(err?.stderr || err?.message || err || "").toLowerCase();
  return (
    msg.includes("sign in to confirm") ||
    msg.includes("not a bot") ||
    msg.includes("login_required") ||
    msg.includes("use --cookies")
  );
}

ensureYtdlpReady();

const publicDir = path.resolve(process.cwd(), "public");
const clipsDir = path.join(publicDir, "clips");
const uploadsDir = path.join(publicDir, "uploads");

if (!fs.existsSync(clipsDir)) {
  fs.mkdirSync(clipsDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const portArgIdx = process.argv.indexOf("--port");
const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
const PORT =
  Number.isFinite(cliPort) && cliPort > 0
    ? cliPort
    : isProduction
    ? Number(process.env.PORT) || 3000
    : 3000;

app.use(express.json({ limit: "50mb" }));

// Configure Multer for real video file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 32);
    cb(null, `up_${Date.now()}_${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1500 * 1024 * 1024 }, // up to 1.5GB
});

// Initialize Gemini Client (Server-side only)
function getGeminiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function isTimeoutError(err: any): boolean {
  const status = Number(err?.status || err?.code || err?.statusCode);
  const msg = String(err?.message || "").toLowerCase();
  return status === 504 || msg.includes("timeout") || msg.includes("etimedout");
}

function isTransientGeminiError(err: any): boolean {
  const status = Number(err?.status || err?.code || err?.statusCode);
  const msg = String(err?.message || "").toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    status === 500 ||
    status === 504 ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("resource_exhausted") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("timeout")
  );
}

// Safely parse JSON returned by Gemini even if wrapped in markdown fences or citations
function parseGeminiJson<T = any>(rawText: string | undefined, fallback: T = {} as T): T {
  const trimmed = String(rawText || "").trim();
  if (!trimmed) return fallback;
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(unfenced) as T;
  } catch {
    // Strip markdown code block anywhere in text first
    const fenceMatch = unfenced.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
      try {
        return JSON.parse(fenceMatch[1].trim()) as T;
      } catch {}
    }
    // Extract first balanced {...} JSON object cleanly (avoids citation brackets like [1])
    const firstBrace = unfenced.indexOf("{");
    const lastBrace = unfenced.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(unfenced.slice(firstBrace, lastBrace + 1)) as T;
      } catch {}
    }
    const firstBracket = unfenced.indexOf("[");
    const lastBracket = unfenced.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(unfenced.slice(firstBracket, lastBracket + 1)) as T;
      } catch {}
    }
    throw new Error("Gemini returned malformed JSON.");
  }
}

// Retry helper with fast backoff ONLY for non-timeout transient glitches
async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 2
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      // Never retry a timeout (504) or 503 on the exact same model; fail over immediately instead
      const status = Number(err?.status || err?.code || err?.statusCode);
      if (isTimeoutError(err) || status === 503 || !isTransientGeminiError(err) || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = 350 * attempt;
      console.warn(`Gemini transient glitch (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms:`, err?.message);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

function withGeminiTimeout<T>(promise: Promise<T>, ms = 12000, label = "Gemini API"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        const err: any = new Error(`${label} timeout after ${ms}ms`);
        err.status = 504;
        reject(err);
      }, ms)
    ),
  ]);
}

// Primary generation helper with instant failover from stalled/busy primary model -> gemini-3.1-flash-lite
// Keeps worst-case total latency comfortably under ~24s so reverse-proxy gateways never 504.
async function generateContentResilient(
  ai: GoogleGenAI,
  params: {
    model?: string;
    contents: any;
    config?: Record<string, any>;
    timeoutMs?: number;
  }
) {
  const primaryModel = params.model || "gemini-4-hydrogen";
  const primaryTimeoutMs = Math.min(params.timeoutMs || 11000, 14000);
  const fallbackTimeoutMs = Math.min(Math.max(params.timeoutMs || 12000, 12000), 15000);
  const t0 = Date.now();
  try {
    return await withGeminiRetry(
      () =>
        withGeminiTimeout(
          ai.models.generateContent({
            model: primaryModel,
            contents: params.contents,
            config: params.config,
          }),
          primaryTimeoutMs,
          primaryModel
        ),
      1
    );
  } catch (err: any) {
    if (isTransientGeminiError(err) && primaryModel !== "gemini-3.1-flash-lite") {
      console.warn(
        `Primary model ${primaryModel} failed over in ${Date.now() - t0}ms (${err?.status || err?.message}); using gemini-3.1-flash-lite`
      );
      const fallbackConfig = params.config ? { ...params.config } : undefined;
      if (fallbackConfig && "thinkingConfig" in fallbackConfig) {
        delete fallbackConfig.thinkingConfig;
      }
      return await withGeminiRetry(
        () =>
          withGeminiTimeout(
            ai.models.generateContent({
              model: "gemini-3.1-flash-lite",
              contents: params.contents,
              config: fallbackConfig,
            }),
            fallbackTimeoutMs,
            "gemini-3.1-flash-lite"
          ),
        2
      );
    }
    throw err;
  }
}

function formatGeminiHttpError(error: any): { status: number; message: string; code: string } {
  const rawMsg = String(error?.message || "Unknown Gemini error");
  const statusNum = Number(error?.status || error?.statusCode) || 500;

  if (!process.env.GEMINI_API_KEY) {
    return {
      status: 500,
      code: "MISSING_API_KEY",
      message: "GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.",
    };
  }
  if (statusNum === 403 || rawMsg.includes("PERMISSION_DENIED")) {
    return {
      status: 403,
      code: "PERMISSION_DENIED",
      message: "Gemini API permission denied. Please verify your API key in Settings > Secrets.",
    };
  }
  if (statusNum === 400 || rawMsg.includes("API_KEY_INVALID")) {
    return {
      status: 400,
      code: "API_KEY_INVALID",
      message: "Gemini API key or request is invalid. Please check your key in Settings > Secrets.",
    };
  }
  if (statusNum === 429 || rawMsg.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      code: "RESOURCE_EXHAUSTED",
      message: "Gemini API rate limit or quota reached. Wait a moment and retry, or check your quota in Settings > Secrets.",
    };
  }
  if (statusNum === 503 || rawMsg.includes("UNAVAILABLE")) {
    return {
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Gemini AI service is temporarily busy. Please click retry in a few seconds.",
    };
  }
  return {
    status: statusNum >= 400 && statusNum < 600 ? statusNum : 500,
    code: "GEMINI_ERROR",
    message: rawMsg,
  };
}

// Probe local video file with ffprobe
async function probeVideoFile(filePath: string): Promise<{
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
      ],
      { timeout: 10000 }
    );
    const parsed = JSON.parse(stdout || "{}");
    const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
    const videoStream = streams.find((s: any) => s.codec_type === "video");
    const audioStream = streams.find((s: any) => s.codec_type === "audio");
    const rawDur =
      Number(parsed.format?.duration) ||
      Number(videoStream?.duration) ||
      120;
    return {
      duration: Math.max(1, Math.round(rawDur)),
      width: Number(videoStream?.width) || 1280,
      height: Number(videoStream?.height) || 720,
      hasAudio: Boolean(audioStream),
    };
  } catch (err) {
    console.warn("ffprobe warning for", filePath, err);
    return { duration: 120, width: 1280, height: 720, hasAudio: true };
  }
}

// Resolve a client videoUrl (/samples/..., /uploads/..., /clips/...) to a verified local path
function resolveLocalVideoPath(videoUrl?: string): string | null {
  if (!videoUrl || typeof videoUrl !== "string") return null;
  if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://") || videoUrl.startsWith("blob:")) {
    return null;
  }
  const cleanUrl = videoUrl.split("?")[0].split("#")[0];
  const cleanRel = cleanUrl.replace(/^\/+/, "");
  if (!cleanRel) return null;
  const candidates = [
    path.resolve(publicDir, cleanRel.replace(/^public\//, "")),
    path.resolve(process.cwd(), cleanRel),
  ];
  for (const candidate of candidates) {
    if (
      (candidate.startsWith(publicDir + path.sep) || candidate.startsWith("/tmp" + path.sep)) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).size > 1000
    ) {
      return candidate;
    }
  }
  return null;
}

// Extract YouTube video ID from URL
function extractYoutubeId(url: string): string {
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  return "";
}

// Parse WebVTT subtitles into clean timestamped transcript lines [MM:SS] Text
function parseVttToTranscript(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const result: string[] = [];
  let currentSec = -1;
  let lastCleanText = "";

  const timeRegex = /^(?:(\d{1,2}):)?(\d{2}):(\d{2})\.\d{3}\s+-->/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === "WEBVTT" || line.startsWith("Kind:") || line.startsWith("Language:")) {
      continue;
    }
    const tMatch = line.match(timeRegex);
    if (tMatch) {
      const hrs = Number(tMatch[1] || 0);
      const mins = Number(tMatch[2] || 0);
      const secs = Number(tMatch[3] || 0);
      currentSec = hrs * 3600 + mins * 60 + secs;
      continue;
    }
    if (/^\d+$/.test(line)) continue;

    // Strip VTT tags like <00:00:05.120><c> and HTML entities
    const cleaned = line
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned || cleaned === lastCleanText) continue;
    // Avoid overlapping rolling YouTube captions where previous line is prefix of current
    if (lastCleanText && cleaned.startsWith(lastCleanText) && cleaned.length - lastCleanText.length < 40) {
      if (result.length > 0) {
        const mm = String(Math.floor(Math.max(0, currentSec) / 60)).padStart(2, "0");
        const ss = String(Math.max(0, currentSec) % 60).padStart(2, "0");
        result[result.length - 1] = `[${mm}:${ss}] ${cleaned}`;
        lastCleanText = cleaned;
        continue;
      }
    }

    lastCleanText = cleaned;
    const mm = String(Math.floor(Math.max(0, currentSec) / 60)).padStart(2, "0");
    const ss = String(Math.max(0, currentSec) % 60).padStart(2, "0");
    result.push(`[${mm}:${ss}] ${cleaned}`);
  }

  return result.slice(0, 400).join("\n");
}

// In-flight deduplication map for YouTube full MP4 caching
const ytCachePromises = new Map<string, Promise<string | null>>();

async function ensureYoutubeCached(
  youtubeUrl: string,
  videoId: string
): Promise<string | null> {
  const safeId = (videoId || "yt_" + Date.now()).replace(/[^a-zA-Z0-9_-]/g, "");
  const outFilename = `yt_${safeId}.mp4`;
  const outPath = path.join(uploadsDir, outFilename);

  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 50000) {
    return `/uploads/${outFilename}`;
  }

  if (ytCachePromises.has(safeId)) {
    return ytCachePromises.get(safeId)!;
  }

  const downloadPromise = (async () => {
    const tmpOut = path.join(uploadsDir, `yt_${safeId}.part.mp4`);
    try {
      await execFileAsync(
        ensureYtdlpReady(),
        [
          "--js-runtimes",
          "node",
          "--no-check-certificates",
          "--no-playlist",
          "-f",
          "best[height<=720][ext=mp4]/best[ext=mp4]/best",
          "--max-filesize",
          "100M",
          "-o",
          tmpOut,
          youtubeUrl,
        ],
        { timeout: 20000, maxBuffer: 10 * 1024 * 1024 }
      );
      if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 50000) {
        fs.renameSync(tmpOut, outPath);
        return `/uploads/${outFilename}`;
      }
      return null;
    } catch (err: any) {
      console.warn("YouTube full cache notice:", err?.message);
      if (fs.existsSync(tmpOut)) {
        fs.unlink(tmpOut, () => {});
      }
      return null;
    } finally {
      ytCachePromises.delete(safeId);
    }
  })();

  ytCachePromises.set(safeId, downloadPromise);
  return downloadPromise;
}

// ---------------------------------------------------------------------------
// 1. Upload Local Video Endpoint
// ---------------------------------------------------------------------------
app.post("/api/upload-video", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file received." });
    }
    const meta = await probeVideoFile(req.file.path);
    const playableSourceUrl = `/uploads/${req.file.filename}`;
    return res.json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      playableSourceUrl,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      hasAudio: meta.hasAudio,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: err.message || "Video upload failed" });
  }
});

// ---------------------------------------------------------------------------
// 2. Real YouTube Metadata + VTT Subtitles + Source Video Caching
// ---------------------------------------------------------------------------
app.post("/api/youtube-info", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "YouTube URL is required" });
    }

    const videoId = extractYoutubeId(url);
    const metaId = videoId || `yt_${Date.now()}`;
    const vttPrefix = `/tmp/yt_sub_${metaId}_${Date.now()}`;

    let info: any = null;
    let transcript = "";
    let ytdlpBotBlocked = false;

    // Run yt-dlp metadata + oEmbed + watch HTML concurrently so YouTube ingestion never stalls sequentially
    const [ytDlpSettled, oembedSettled, watchSettled] = await Promise.allSettled([
      execFileAsync(
        ensureYtdlpReady(),
        [
          "--js-runtimes",
          "node",
          "--socket-timeout",
          "4",
          "--no-check-certificates",
          "--no-playlist",
          "--dump-json",
          "--write-auto-sub",
          "--write-sub",
          "--sub-langs",
          "en.*,en",
          "--sub-format",
          "vtt",
          "-o",
          vttPrefix,
          "--skip-download",
          url,
        ],
        { timeout: 5500, maxBuffer: 15 * 1024 * 1024 }
      ),
      fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      ).then((r) => (r.ok ? r.json() : null)),
      fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+123",
        },
        signal: AbortSignal.timeout(6000),
      }).then((r) => (r.ok ? r.text() : "")),
    ]);

    if (ytDlpSettled.status === "fulfilled" && ytDlpSettled.value?.stdout) {
      const lastJsonLine = ytDlpSettled.value.stdout
        .trim()
        .split("\n")
        .reverse()
        .find((l) => l.trim().startsWith("{"));
      if (lastJsonLine) {
        try {
          info = JSON.parse(lastJsonLine);
        } catch {}
      }
    } else if (ytDlpSettled.status === "rejected") {
      const ytErr = ytDlpSettled.reason;
      console.warn("yt-dlp metadata fetch warning:", ytErr?.message);
      if (isYoutubeBotWallError(ytErr)) {
        ytdlpBotBlocked = true;
      }
    }

    // Look for any written .vtt subtitle file in /tmp matching prefix
    try {
      const tmpFiles = fs.readdirSync("/tmp");
      const basePrefix = path.basename(vttPrefix);
      const vttFiles = tmpFiles.filter((f) => f.startsWith(basePrefix) && f.endsWith(".vtt"));
      if (vttFiles.length > 0) {
        const vttPath = path.join("/tmp", vttFiles[0]);
        const vttRaw = fs.readFileSync(vttPath, "utf-8");
        transcript = parseVttToTranscript(vttRaw);
      }
      for (const f of vttFiles) {
        fs.unlink(path.join("/tmp", f), () => {});
      }
    } catch (vttErr) {
      console.warn("VTT parse warning:", vttErr);
    }

    const oe: any = oembedSettled.status === "fulfilled" ? oembedSettled.value : null;
    const html: string = watchSettled.status === "fulfilled" ? watchSettled.value || "" : "";

    const resolvedId = info?.id || videoId || metaId;
    let resolvedTitle = info?.title || oe?.title || "";
    let resolvedDesc = (info?.description || "").slice(0, 1500);
    let resolvedChannel = info?.uploader || info?.channel || oe?.author_name || "";
    let resolvedThumb =
      info?.thumbnail ||
      oe?.thumbnail_url ||
      (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "");
    let duration = Math.round(Number(info?.duration) || 0);
    let chapters: any[] = Array.isArray(info?.chapters) ? info.chapters.slice(0, 20) : [];

    if (html) {
      if (!duration) {
        const durMatch = html.match(/"lengthSeconds":"(\d+)"/);
        const approxMatch = html.match(/"approxDurationMs":"(\d+)"/);
        if (durMatch?.[1]) {
          duration = Number(durMatch[1]);
        } else if (approxMatch?.[1]) {
          duration = Math.round(Number(approxMatch[1]) / 1000);
        }
      }
      if (!resolvedDesc) {
        const descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
        const metaDescMatch = html.match(/<meta[^>]+(?:name="description"|property="og:description")[^>]+content="([^"]*)"/i);
        if (descMatch?.[1]) {
          try {
            resolvedDesc = JSON.parse(`"${descMatch[1]}"`).slice(0, 1500);
          } catch {}
        } else if (metaDescMatch?.[1]) {
          resolvedDesc = metaDescMatch[1].slice(0, 1500);
        }
      }
      if (!transcript) {
        const capMatch = html.match(/"captionTracks":(\[[^\]]+\])/);
        if (capMatch?.[1]) {
          try {
            const tracks = JSON.parse(capMatch[1]);
            const enTrack =
              tracks.find((t: any) => String(t.languageCode || "").startsWith("en")) || tracks[0];
            if (enTrack?.baseUrl) {
              const vttRes = await fetch(`${enTrack.baseUrl}&fmt=vtt`, {
                signal: AbortSignal.timeout(5000),
              });
              if (vttRes.ok) {
                const vttRaw = await vttRes.text();
                transcript = parseVttToTranscript(vttRaw);
              }
            }
          } catch {}
        }
      }
    }

    // Grounded Gemini Search enrichment when YouTube blocks raw HTML/transcript scraping on datacenter IPs
    if ((!duration || !transcript || !resolvedDesc) && process.env.GEMINI_API_KEY) {
      const ai = getGeminiClient();
      const applyGeminiMeta = (gData: any, rawFallbackText: string) => {
        if (gData && typeof gData === "object") {
          const parsedDur = Number(gData.durationSeconds);
          if (!duration && Number.isFinite(parsedDur) && parsedDur >= 8) {
            duration = Math.round(parsedDur);
          }
          if (!resolvedDesc && gData.summary) {
            resolvedDesc = String(gData.summary).slice(0, 1500);
          }
          if (!transcript && gData.highlightsContext) {
            transcript = String(gData.highlightsContext).slice(0, 6000);
          }
        } else if (rawFallbackText.length > 20) {
          if (!resolvedDesc) resolvedDesc = rawFallbackText.slice(0, 600);
          if (!transcript) transcript = rawFallbackText.slice(0, 4000);
        }
      };

      const searchPrompt = `Look up this real YouTube video: ${url}
Known title: "${resolvedTitle || "Unknown"}"
Known creator: "${resolvedChannel || "Unknown"}"
Return ONLY raw JSON (no markdown fences) with keys:
{
  "durationSeconds": <integer duration in seconds, e.g. 240 or 1541>,
  "summary": "<concise 2-sentence summary of what happens in this video>",
  "highlightsContext": "<timestamped breakdown of key moments e.g. [00:00] intro ... [01:30] climax ...>"
}`;

      let gotSearchMeta = false;
      try {
        const gRes = await generateContentResilient(ai, {
          contents: searchPrompt,
          timeoutMs: 9000,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        const gText = String(gRes.text || "").trim();
        let gData: any = null;
        try {
          gData = parseGeminiJson<any>(gText, null);
        } catch {
          gData = null;
        }
        applyGeminiMeta(gData, gText);
        gotSearchMeta = Boolean(duration && (resolvedDesc || transcript));
      } catch (groundErr: any) {
        console.warn("Gemini grounded YouTube metadata notice:", groundErr?.message);
      }

      // Structured fallback if googleSearch tool is unavailable or returned empty
      if (!gotSearchMeta) {
        try {
          const fallbackRes = await generateContentResilient(ai, {
            contents: `Analyze this YouTube video from its title, creator, and URL:\nURL: ${url}\nTitle: "${resolvedTitle || "YouTube Video"}"\nCreator: "${resolvedChannel || "Creator"}"\nEstimate realistic durationSeconds if known, summarize the video clearly, and provide a structured timestamped highlightsContext outline so clips can be planned accurately.`,
            timeoutMs: 8000,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  durationSeconds: { type: Type.INTEGER },
                  summary: { type: Type.STRING },
                  highlightsContext: { type: Type.STRING },
                },
                required: ["durationSeconds", "summary", "highlightsContext"],
              },
            },
          });
          const fData = parseGeminiJson<any>(fallbackRes.text, null);
          applyGeminiMeta(fData, String(fallbackRes.text || ""));
        } catch (fallbackErr: any) {
          console.warn("Gemini YouTube structured fallback notice:", fallbackErr?.message);
        }
      }
    }

    duration = Math.max(10, duration || 180);

    // Cache full MP4 only when yt-dlp metadata succeeded, not bot-blocked, and duration <= 10 minutes
    let playableSourceUrl: string | null = null;
    if (videoId && ytDlpSettled.status === "fulfilled" && !ytdlpBotBlocked && duration <= 600) {
      playableSourceUrl = await ensureYoutubeCached(url, resolvedId);
    }

    return res.json({
      id: resolvedId,
      title: resolvedTitle || (videoId ? `YouTube Video (${videoId})` : "YouTube Video"),
      description: resolvedDesc,
      duration,
      thumbnail: resolvedThumb,
      channelName: resolvedChannel || "YouTube Creator",
      videoId: resolvedId,
      transcript,
      playableSourceUrl,
      youtubeDownloadBlocked: !playableSourceUrl,
      chapters,
    });
  } catch (error: any) {
    console.error("Error in /api/youtube-info:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch YouTube info" });
  }
});

// ---------------------------------------------------------------------------
// 2B. Universal Direct / Multi-Platform Video URL Ingestion (Unrestricted)
// ---------------------------------------------------------------------------
app.post("/api/ingest-url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Video URL is required" });
    }

    const cleanUrl = url.trim();
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cleanUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return res.status(400).json({ error: "Only http and https video URLs are supported." });
      }
    } catch {
      return res.status(400).json({ error: "Invalid video URL." });
    }

    const outName = `url_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`;
    const outPath = path.join(uploadsDir, outName);

    // 1. Check if URL points directly to a video file (.mp4, .mov, .webm, .m4v, or video/* Content-Type)
    let isDirectMedia = /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(cleanUrl);
    if (!isDirectMedia) {
      try {
        const headRes = await fetch(cleanUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
        const ct = String(headRes.headers.get("content-type") || "").toLowerCase();
        if (headRes.ok && ct.startsWith("video/")) {
          isDirectMedia = true;
        }
      } catch {}
    }

    if (isDirectMedia) {
      const dlRes = await fetch(cleanUrl, { signal: AbortSignal.timeout(45000) });
      if (!dlRes.ok) {
        return res.status(400).json({ error: `Could not download video URL (HTTP ${dlRes.status}).` });
      }
      const contentLen = Number(dlRes.headers.get("content-length") || 0);
      if (contentLen > 250 * 1024 * 1024) {
        return res.status(413).json({ error: "Remote video exceeds the 250MB URL ingestion limit." });
      }
      const arrayBuf = await dlRes.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (buf.length < 5000) {
        return res.status(400).json({ error: "Downloaded URL did not contain valid video data." });
      }
      fs.writeFileSync(outPath, buf);
      const meta = await probeVideoFile(outPath);
      const urlTitle = path.basename(cleanUrl.split("?")[0]).replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ") || "Direct Video URL";
      return res.json({
        success: true,
        id: `url-${Date.now()}`,
        title: urlTitle,
        channelName: parsedUrl.hostname,
        playableSourceUrl: `/uploads/${outName}`,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        hasAudio: meta.hasAudio,
        transcript: "",
      });
    }

    // 2. Otherwise use yt-dlp in a single pass (--write-info-json) to extract metadata + download MP4
    const infoJsonPath = `${outPath}.info.json`;
    let info: any = null;
    try {
      await execFileAsync(
        ensureYtdlpReady(),
        [
          "--js-runtimes",
          "node",
          "--socket-timeout",
          "8",
          "--no-check-certificates",
          "--no-playlist",
          "--write-info-json",
          "--merge-output-format",
          "mp4",
          "-f",
          "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[ext=mp4]/best",
          "--max-filesize",
          "250M",
          "-o",
          outPath,
          cleanUrl,
        ],
        { timeout: 30000, maxBuffer: 12 * 1024 * 1024 }
      );
      if (fs.existsSync(infoJsonPath)) {
        try {
          info = JSON.parse(fs.readFileSync(infoJsonPath, "utf-8"));
        } catch {}
      }
    } finally {
      if (fs.existsSync(infoJsonPath)) {
        fs.unlink(infoJsonPath, () => {});
      }
    }

    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 5000) {
      return res.status(400).json({ error: "Could not download playable video from that URL." });
    }

    const meta = await probeVideoFile(outPath);
    return res.json({
      success: true,
      id: `url-${Date.now()}`,
      title: info?.title || "Imported Web Video",
      description: (info?.description || "").slice(0, 1500),
      thumbnail: info?.thumbnail || "",
      channelName: info?.uploader || info?.channel || new URL(cleanUrl).hostname,
      playableSourceUrl: `/uploads/${outName}`,
      duration: meta.duration || Math.round(Number(info?.duration) || 60),
      width: meta.width,
      height: meta.height,
      hasAudio: meta.hasAudio,
      transcript: "",
    });
  } catch (err: any) {
    console.error("Error in /api/ingest-url:", err);
    return res.status(500).json({ error: err.message || "Failed to ingest video URL" });
  }
});

// Extract sampled JPEG frames in parallel + analyze visual scene sequence with Gemini Vision
async function analyzeVideoKeyframes(localFile: string, duration: number): Promise<string> {
  const framePaths: string[] = [];
  try {
    const safeDur = Math.max(4, duration);
    const frameCount = safeDur < 20 ? 3 : 4;
    const timestamps = Array.from({ length: frameCount }, (_, i) =>
      Math.max(0.5, Math.min(safeDur - 0.5, ((i + 0.5) / frameCount) * safeDur))
    );

    const extracted = await Promise.all(
      timestamps.map(async (ts, i) => {
        const fPath = `/tmp/kf_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}.jpg`;
        framePaths.push(fPath);
        try {
          await execFileAsync(
            "ffmpeg",
            ["-y", "-ss", ts.toFixed(1), "-i", localFile, "-vframes", "1", "-q:v", "6", "-vf", "scale=480:-2", fPath],
            { timeout: 10000 }
          );
          if (fs.existsSync(fPath) && fs.statSync(fPath).size > 500) {
            return { ts, data: fs.readFileSync(fPath).toString("base64") };
          }
        } catch {}
        return null;
      })
    );

    const parts: any[] = [];
    for (const item of extracted) {
      if (!item) continue;
      const mm = String(Math.floor(item.ts / 60)).padStart(2, "0");
      const ss = String(Math.floor(item.ts % 60)).padStart(2, "0");
      parts.push({ text: `Keyframe at [${mm}:${ss}]:` });
      parts.push({ inlineData: { mimeType: "image/jpeg", data: item.data } });
    }

    if (parts.length < 2) return "";
    parts.push({
      text: "Describe each timestamped visual scene briefly, noting speakers, horizontal position (left/center/right), screen content, action peaks, or emotional expressions so an editor can clip and reframe this video accurately.",
    });

    const ai = getGeminiClient();
    const res = await generateContentResilient(ai, {
      contents: { parts },
      timeoutMs: 9000,
      config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    });
    return (res.text || "").trim().slice(0, 4000);
  } catch (err: any) {
    console.warn("Visual keyframe analysis notice:", err?.message);
    return "";
  } finally {
    for (const p of framePaths) {
      if (fs.existsSync(p)) fs.unlink(p, () => {});
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Gemini 3.5 Transcribe + Multimodal Vision — Full-Duration Audio & Visuals
// ---------------------------------------------------------------------------
app.post("/api/transcribe-video", async (req, res) => {
  const tempFiles: string[] = [];
  try {
    const {
      videoUrl,
      playableSourceUrl,
      youtubeUrl,
      youtubeDownloadBlocked = false,
      skipAudio = false,
    } = req.body;

    let localFile =
      resolveLocalVideoPath(playableSourceUrl) || resolveLocalVideoPath(videoUrl);

    if (!localFile && youtubeUrl && !youtubeDownloadBlocked) {
      const ytId = extractYoutubeId(youtubeUrl);
      if (ytId) {
        const cached = await ensureYoutubeCached(youtubeUrl, ytId);
        if (cached) localFile = resolveLocalVideoPath(cached);
      }
    }

    if (!localFile) {
      if (youtubeUrl) {
        return res.json({
          success: false,
          youtubeDownloadBlocked: true,
          transcript: "",
          visualSummary: "",
        });
      }
      return res.status(400).json({
        error: "No locally accessible video source available for audio transcription.",
      });
    }

    const meta = await probeVideoFile(localFile);
    const visualPromise = withGeminiTimeout(
      analyzeVideoKeyframes(localFile, meta.duration),
      18000,
      "Keyframe analysis"
    ).catch(() => "");

    let transcriptText = "";
    let noAudio = !meta.hasAudio;

    if (meta.hasAudio && !skipAudio) {
      const ai = getGeminiClient();

      // Split longer videos into up to 2 parallel chunks (up to ~30 min coverage)
      const chunkLen = meta.duration > 1200 ? 900 : 600;
      const numChunks = Math.min(2, Math.max(1, Math.ceil(meta.duration / chunkLen)));

      const chunkTranscripts = await Promise.all(
        Array.from({ length: numChunks }, async (_, i) => {
          const startOffset = i * chunkLen;
          const tempMp3 = `/tmp/audio_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}.mp3`;
          tempFiles.push(tempMp3);

          await execFileAsync(
            "ffmpeg",
            [
              "-y",
              "-ss",
              String(startOffset),
              "-i",
              localFile!,
              "-t",
              String(chunkLen),
              "-vn",
              "-ac",
              "1",
              "-ar",
              "16000",
              "-b:a",
              "16k",
              "-f",
              "mp3",
              tempMp3,
            ],
            { timeout: 20000 }
          );

          if (!fs.existsSync(tempMp3) || fs.statSync(tempMp3).size < 200) {
            return "";
          }

          const audioBase64 = fs.readFileSync(tempMp3).toString("base64");
          const offsetNote =
            startOffset > 0
              ? ` Note: This audio chunk starts at ${Math.floor(startOffset / 60)}m${startOffset % 60}s into the full video; adjust all [MM:SS] timestamps by adding ${startOffset} seconds.`
              : "";

          const audioContents = {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/mp3",
                  data: audioBase64,
                },
              },
              {
                text: `Transcribe every spoken sentence accurately. Format each line strictly with its timestamp prefix like [MM:SS] Speaker: spoken text. Do not skip comedic pauses, reactions, or key insights.${offsetNote}`,
              },
            ],
          };

          let response;
          try {
            response = await withGeminiTimeout(
              ai.models.generateContent({
                model: "gemini-3.5-transcribe",
                contents: audioContents,
              }),
              13000,
              "gemini-3.5-transcribe"
            );
          } catch (trErr: any) {
            const msg = String(trErr?.message || "");
            if (
              Number(trErr?.status) === 404 ||
              msg.includes("404") ||
              msg.includes("NOT_FOUND") ||
              isTransientGeminiError(trErr)
            ) {
              console.warn(`Audio transcription failover (${trErr?.status || trErr?.message}); using gemini-3.1-flash-lite`);
              response = await withGeminiRetry(
                () =>
                  withGeminiTimeout(
                    ai.models.generateContent({
                      model: "gemini-3.1-flash-lite",
                      contents: audioContents,
                    }),
                    14000,
                    "gemini-3.1-flash-lite"
                  ),
                2
              );
            } else {
              throw trErr;
            }
          }

          return (response.text || "").trim();
        })
      );

      transcriptText = chunkTranscripts.filter(Boolean).join("\n").trim();
      if (transcriptText.length === 0) noAudio = true;
    }

    const visualSummary = await visualPromise;

    return res.json({
      success: true,
      transcript: transcriptText,
      visualSummary,
      duration: meta.duration,
      noAudio,
    });
  } catch (error: any) {
    console.error("Transcription error:", error);
    const formatted = formatGeminiHttpError(error);
    return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  } finally {
    for (const f of tempFiles) {
      if (fs.existsSync(f)) {
        fs.unlink(f, () => {});
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 4. Gemini 4 Hydrogen — Unrestricted AI Video Clipping Director
// ---------------------------------------------------------------------------
app.post("/api/analyze-highlights", async (req, res) => {
  try {
    const {
      title = "Viral Video",
      description = "",
      transcript = "",
      visualSummary = "",
      fullDuration = 180,
      filter = "all",
      targetLength = "auto",
      customPrompt = "",
      clipCount = 0,
      minDurationSec = 0,
      maxDurationSec = 0,
      excludeRanges = [],
      chapters = [],
    } = req.body;

    const totalSec = Math.max(8, Math.round(Number(fullDuration) || 180));
    const requestedCount = Number(clipCount) || 0;
    const desiredClipCount =
      requestedCount > 0
        ? Math.max(1, Math.min(15, requestedCount))
        : totalSec < 45
        ? 2
        : totalSec < 90
        ? 3
        : 5;

    let lengthInstruction = "any optimal natural duration from 8s up to 180s (complete story arc)";
    if (Number(minDurationSec) > 0 || Number(maxDurationSec) > 0) {
      const lo = Math.max(3, Math.round(Number(minDurationSec) || 5));
      const hi = Math.min(totalSec, Math.max(lo + 2, Math.round(Number(maxDurationSec) || 180)));
      lengthInstruction = `${lo} to ${hi} seconds per clip`;
    } else if (targetLength === "5-15s") {
      lengthInstruction = "5 to 15 seconds per clip (ultra-fast micro-hooks & reactions)";
    } else if (targetLength === "<30s") {
      lengthInstruction = "10 to 29 seconds per clip (ultra-punchy fast TikTok hooks)";
    } else if (targetLength === "30-60s") {
      lengthInstruction = "30 to 58 seconds per clip (deep storytelling arc with setup + payoff)";
    } else if (targetLength === "60-180s") {
      lengthInstruction = "60 to 180 seconds per clip (long-form YouTube Shorts / TikTok deep dives)";
    }

    const chaptersHint =
      Array.isArray(chapters) && chapters.length > 0
        ? `\nVideo Chapters:\n${chapters
            .slice(0, 16)
            .map((c: any) => `- [${Math.round(c.start_time || 0)}s - ${Math.round(c.end_time || 0)}s] ${c.title}`)
            .join("\n")}`
        : "";

    const excludeHint =
      Array.isArray(excludeRanges) && excludeRanges.length > 0
        ? `\nAlready Clipped Ranges (avoid exact duplicates; find NEW distinct moments):\n${excludeRanges
            .slice(0, 15)
            .map((r: any) => `- ${Math.round(r.startTime || 0)}s to ${Math.round(r.endTime || 0)}s`)
            .join("\n")}`
        : "";

    const customDirective = customPrompt && String(customPrompt).trim()
      ? `\nHIGHEST PRIORITY USER AI INSTRUCTION:\n"${String(customPrompt).trim()}"\nFollow this instruction strictly when choosing moments, clip lengths, topics, hooks, and captions.`
      : "";

    const systemPrompt = `You are ClipForge AI, an unrestricted, elite multimodal video clipping director and retention strategist.
Analyze the provided video metadata, visual keyframe descriptions, and timestamped transcript, and extract ${desiredClipCount} compelling 9:16 vertical short clips without arbitrary restrictions.${customDirective}

RULES:
1. All clip startTime and endTime values MUST fall strictly between 0 and ${totalSec} seconds. Never exceed ${totalSec}.
2. Target duration per clip: ${lengthInstruction} (or up to ${totalSec}s if the source video itself is shorter).
3. Target Focus: "${filter}" ("all" means a mix of the strongest funny, climax/highlight, educational insights, and heated debate moments, unless overridden by the user's custom AI instruction).
4. Spread clips across distinct moments so the creator gets maximum coverage unless the user specifically asks for overlapping or sequential clips.
5. For each clip, include:
   - Punchy 3-second opening hook & title
   - Virality/Hook/Flow/Emotion scores (75-99)
   - Best 9:16 framing suggestion ("smart_crop", "blur_fit", "split_screen", or "clean_box") and panX (-100 left to +100 right, 0 center) based on visual scene cues
   - Hashtags and synchronized kinetic captions with relative timestamps from 0 up to (endTime - startTime) and per-word tokens.`;

    const userPrompt = `Video Title: "${title}"
Context / Description: ${description || "Video content"}
Exact Total Video Duration: ${totalSec} seconds
Target Category Focus: ${filter}
Requested Clip Count: ${desiredClipCount}
Target Clip Length: ${targetLength}${chaptersHint}${excludeHint}

${visualSummary ? `Visual Keyframe Analysis:\n"""\n${visualSummary.slice(0, 4500)}\n"""\n` : ""}Timestamped Transcript:
"""
${(transcript || `No speech transcript available. Analyze based on title "${title}", description "${description}", and visual keyframe context. Partition the ${totalSec}s timeline into ${desiredClipCount} strongest pacing windows with compelling captions matching what happens in those scenes.`).slice(0, 26000)}
"""

Extract ${desiredClipCount} clips and return strictly valid JSON matching the schema.`;

    const ai = getGeminiClient();

    const response = await generateContentResilient(ai, {
      contents: userPrompt,
      timeoutMs: 13000,
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Concise viral analysis of the source video" },
            clips: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING, description: "Scroll-stopping short title with 1-2 relevant emojis" },
                  hook: { type: Type.STRING, description: "Punchy 3-second on-screen banner hook" },
                  reason: { type: Type.STRING, description: "Specific explanation of why this moment hooks viewers" },
                  category: {
                    type: Type.STRING,
                    description: "One of: funny, highlight, educational, debate",
                  },
                  startTime: { type: Type.NUMBER, description: `Start timestamp in seconds (0 to ${Math.max(0, totalSec - 5)})` },
                  endTime: { type: Type.NUMBER, description: `End timestamp in seconds (strictly <= ${totalSec})` },
                  viralityScore: { type: Type.INTEGER, description: "Overall virality score 75 to 99" },
                  hookScore: { type: Type.INTEGER, description: "Opening 3s hook score 75 to 100" },
                  flowScore: { type: Type.INTEGER, description: "Narrative pacing & payoff score 75 to 100" },
                  emotionScore: { type: Type.INTEGER, description: "Emotional / comedic intensity score 75 to 100" },
                  framingSuggestion: {
                    type: Type.STRING,
                    description: "Recommended 9:16 framing: smart_crop, blur_fit, split_screen, or clean_box",
                  },
                  panX: {
                    type: Type.INTEGER,
                    description: "Horizontal speaker/subject focus offset from -100 (far left) to +100 (far right), 0 center",
                  },
                  visualContext: {
                    type: Type.STRING,
                    description: "Brief visual scene description for this moment",
                  },
                  emojis: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  hashtags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  recommendedMusicTempo: { type: Type.STRING },
                  captions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        start: { type: Type.NUMBER, description: "Relative seconds from clip start (0..clipDuration)" },
                        end: { type: Type.NUMBER, description: "Relative seconds from clip start" },
                        text: { type: Type.STRING },
                        emphasisWord: { type: Type.STRING },
                      },
                      required: ["start", "end", "text"],
                    },
                  },
                },
                required: [
                  "id",
                  "title",
                  "hook",
                  "reason",
                  "category",
                  "startTime",
                  "endTime",
                  "viralityScore",
                  "hashtags",
                  "captions",
                ],
              },
            },
          },
          required: ["summary", "clips"],
        },
      },
    });

    const parsed = parseGeminiJson<any>(response.text, {});
    const rawClips = Array.isArray(parsed.clips) ? parsed.clips : [];
    if (rawClips.length === 0) {
      return res.status(502).json({
        error: "Gemini returned zero clips for this prompt. Try adjusting your AI prompt or clip range.",
        code: "EMPTY_MODEL_RESPONSE",
      });
    }

    // Clamp timestamps & normalize captions strictly against real video duration (unrestricted length up to 300s)
    const allowedCats = new Set(["funny", "highlight", "educational", "debate"]);
    const allowedFraming = new Set(["smart_crop", "split_screen", "blur_fit", "clean_box"]);

    const normalizedClips = rawClips.map((c: any, idx: number) => {
      const minLen = Math.min(Number(minDurationSec) > 0 ? Number(minDurationSec) : 5, totalSec);
      let s = Math.max(0, Math.min(Number(c.startTime) || 0, Math.max(0, totalSec - minLen)));
      let e = Math.min(totalSec, Math.max(s + minLen, Number(c.endTime) || s + 25));
      if (Number(maxDurationSec) > 0 && e - s > Number(maxDurationSec)) {
        e = Math.min(totalSec, s + Number(maxDurationSec));
      } else if (e - s > 300) {
        e = Math.min(totalSec, s + 300);
      }
      s = Math.round(s * 10) / 10;
      e = Math.round(e * 10) / 10;
      const clipDur = Math.max(3, e - s);

      const rawCaptions = Array.isArray(c.captions) && c.captions.length > 0
        ? c.captions
        : [{ start: 0, end: Math.min(4, clipDur), text: c.hook || c.title || "Watch this moment", emphasisWord: "WATCH" }];

      const normalizedCaptions = rawCaptions.map((cap: any, cIdx: number) => {
        const capStart = Math.max(0, Math.min(clipDur - 0.5, Number(cap.start) || cIdx * 3.5));
        const capEnd = Math.max(capStart + 0.5, Math.min(clipDur, Number(cap.end) || capStart + 3.5));
        const textStr = String(cap.text || "").trim() || "Key highlight";
        const tokens =
          Array.isArray(cap.words) && cap.words.length > 0
            ? cap.words.map((wt: any, wIdx: number) => {
                const seg = (capEnd - capStart) / cap.words.length;
                return {
                  w: String(wt.w || ""),
                  start: Math.max(capStart, Math.min(capEnd, Number(wt.start) ?? capStart + wIdx * seg)),
                  end: Math.max(capStart, Math.min(capEnd, Number(wt.end) ?? capStart + (wIdx + 1) * seg)),
                };
              })
            : textStr.split(/\s+/).map((w, wIdx, arr) => {
                const seg = (capEnd - capStart) / Math.max(1, arr.length);
                return {
                  w,
                  start: Math.round((capStart + wIdx * seg) * 10) / 10,
                  end: Math.round((capStart + (wIdx + 1) * seg) * 10) / 10,
                };
              });

        return {
          start: Math.round(capStart * 10) / 10,
          end: Math.round(capEnd * 10) / 10,
          text: textStr,
          emphasisWord: cap.emphasisWord || undefined,
          words: tokens,
        };
      });

      const cat = allowedCats.has(c.category) ? c.category : "highlight";
      const framing = allowedFraming.has(c.framingSuggestion) ? c.framingSuggestion : "smart_crop";
      const clampedPan = Math.max(-100, Math.min(100, Math.round(Number(c.panX) || 0)));

      return {
        id: `clip-${Date.now()}-${idx + 1}`,
        title: String(c.title || `Viral Clip #${idx + 1}`),
        hook: String(c.hook || "Wait till you see what happens next!"),
        reason: String(c.reason || "Strong opening curiosity gap and emotional payoff."),
        category: cat,
        startTime: s,
        endTime: e,
        viralityScore: Math.max(70, Math.min(99, Math.round(Number(c.viralityScore) || 92))),
        hookScore: Math.max(70, Math.min(100, Math.round(Number(c.hookScore) || 94))),
        flowScore: Math.max(70, Math.min(100, Math.round(Number(c.flowScore) || 91))),
        emotionScore: Math.max(70, Math.min(100, Math.round(Number(c.emotionScore) || 90))),
        framingSuggestion: framing,
        panX: clampedPan,
        visualContext: c.visualContext ? String(c.visualContext) : undefined,
        emojis: Array.isArray(c.emojis) && c.emojis.length > 0 ? c.emojis : ["🔥", "👀"],
        hashtags: Array.isArray(c.hashtags) && c.hashtags.length > 0 ? c.hashtags : ["#shorts", "#viral", "#fyp"],
        recommendedMusicTempo: c.recommendedMusicTempo || "upbeat",
        captions: normalizedCaptions,
      };
    });

    return res.json({
      summary: parsed.summary || `Extracted ${normalizedClips.length} viral moments with Gemini AI.`,
      clips: normalizedClips,
    });
  } catch (error: any) {
    console.error("Gemini analyze-highlights error:", error);
    const formatted = formatGeminiHttpError(error);
    return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  }
});

// ---------------------------------------------------------------------------
// 4B. Gemini Vision Auto-Reframe — Detect Speaker/Subject Horizontal Focus
// ---------------------------------------------------------------------------
app.post("/api/ai-reframe", async (req, res) => {
  const framePath = `/tmp/reframe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
  try {
    const { videoUrl, playableSourceUrl, timestamp = 2 } = req.body;
    const localFile = resolveLocalVideoPath(playableSourceUrl) || resolveLocalVideoPath(videoUrl);
    if (!localFile) {
      return res.status(400).json({ error: "A local or uploaded video file is required for AI visual reframing." });
    }

    const seekSec = Math.max(0, Number(timestamp) || 0);
    await execFileAsync(
      "ffmpeg",
      ["-y", "-ss", seekSec.toFixed(1), "-i", localFile, "-vframes", "1", "-q:v", "4", "-vf", "scale=720:-2", framePath],
      { timeout: 15000 }
    );

    if (!fs.existsSync(framePath) || fs.statSync(framePath).size < 500) {
      return res.status(500).json({ error: "Could not sample video frame for AI reframing." });
    }

    const imgBase64 = fs.readFileSync(framePath).toString("base64");
    const ai = getGeminiClient();
    const response = await generateContentResilient(ai, {
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: imgBase64 } },
          {
            text: "Analyze this video frame for vertical 9:16 mobile reframing. Identify where the main speaker, face, or focal action sits horizontally (-100 = far left edge, 0 = center, +100 = far right edge), recommend best framingMode ('smart_crop', 'blur_fit', 'split_screen', or 'clean_box'), and describe what is in frame.",
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            panX: { type: Type.INTEGER },
            recommendedFraming: { type: Type.STRING },
            subjectDescription: { type: Type.STRING },
          },
          required: ["panX", "recommendedFraming", "subjectDescription"],
        },
      },
    });

    const parsed = parseGeminiJson<any>(response.text, {});
    const allowedFraming = new Set(["smart_crop", "split_screen", "blur_fit", "clean_box"]);
    return res.json({
      panX: Math.max(-100, Math.min(100, Math.round(Number(parsed.panX) || 0))),
      recommendedFraming: allowedFraming.has(parsed.recommendedFraming) ? parsed.recommendedFraming : "smart_crop",
      subjectDescription: parsed.subjectDescription || "Centered main subject",
    });
  } catch (error: any) {
    console.error("AI reframe error:", error);
    const formatted = formatGeminiHttpError(error);
    return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  } finally {
    if (fs.existsSync(framePath)) {
      fs.unlink(framePath, () => {});
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Gemini 4 Hydrogen — Re-sync Kinetic Captions
// ---------------------------------------------------------------------------
app.post("/api/generate-captions", async (req, res) => {
  try {
    const { text, duration = 30 } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required to generate captions" });
    }

    const ai = getGeminiClient();
    const response = await generateContentResilient(ai, {
      contents: `Generate viral Hormozi/MrBeast style timed captions for this speech transcript of duration ${duration} seconds:
"""
${text}
"""
Break into natural 3-5 word animated subtitle chunks. Calculate exact relative timestamps (start and end in seconds from 0 to ${duration}) and identify one key high-impact emphasis word per chunk.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            captions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER },
                  text: { type: Type.STRING },
                  emphasisWord: { type: Type.STRING },
                },
                required: ["start", "end", "text"],
              },
            },
          },
          required: ["captions"],
        },
      },
    });

    const parsed = parseGeminiJson<any>(response.text, {});
    const normalizedCaptions = (Array.isArray(parsed.captions) ? parsed.captions : []).map((cap: any, i: number) => {
      const s = Math.max(0, Number(cap.start) || i * 2.5);
      const e = Math.max(s + 0.5, Number(cap.end) || s + 2.5);
      const txt = String(cap.text || "").trim();
      const words = txt.split(/\s+/).filter(Boolean).map((w: string, wi: number, arr: string[]) => {
        const seg = (e - s) / Math.max(1, arr.length);
        return {
          w,
          start: Math.round((s + wi * seg) * 10) / 10,
          end: Math.round((s + (wi + 1) * seg) * 10) / 10,
        };
      });
      return {
        start: Math.round(s * 10) / 10,
        end: Math.round(e * 10) / 10,
        text: txt,
        emphasisWord: cap.emphasisWord || undefined,
        words,
      };
    });
    return res.json({ captions: normalizedCaptions });
  } catch (error: any) {
    console.error("Error generating captions:", error);
    const formatted = formatGeminiHttpError(error);
    return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  }
});

// ---------------------------------------------------------------------------
// 6. Gemini 4 Hydrogen — Viral Hook Rewriter
// ---------------------------------------------------------------------------
app.post("/api/suggest-hooks", async (req, res) => {
  try {
    const { clipTitle, quote, category } = req.body;

    const ai = getGeminiClient();
    const response = await generateContentResilient(ai, {
      contents: `Create 5 ultra-engaging TikTok/Shorts opening hooks (max 10 words each) for this clip:
Title: "${clipTitle || "Viral Short"}"
Key Quote / Current Hook: "${quote || ""}"
Category: "${category || "highlight"}"

Provide 5 distinct psychological angles:
1. Curiosity Gap
2. Contrarian / Debate
3. Comedy / Meme
4. Secret Knowledge
5. Story Climax`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hooks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  angle: { type: Type.STRING },
                  text: { type: Type.STRING },
                  emoji: { type: Type.STRING },
                },
                required: ["angle", "text", "emoji"],
              },
            },
          },
          required: ["hooks"],
        },
      },
    });

    const parsed = parseGeminiJson<any>(response.text, {});
    return res.json(parsed);
  } catch (error: any) {
    console.error("Error suggesting hooks:", error);
    const formatted = formatGeminiHttpError(error);
    return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  }
});

// ---------------------------------------------------------------------------
// 7. Gemini 4 Hydrogen — Platform Social Copy Pack (TikTok / Shorts)
// ---------------------------------------------------------------------------
app.post("/api/ai-social-pack", async (req, res) => {
  try {
    const { title, hook, reason, dialogue, hashtags = [] } = req.body;
    const ai = getGeminiClient();

    const response = await generateContentResilient(ai, {
      contents: `Generate a ready-to-publish short-form social media copy pack for this clipped video segment.
Clip Title: "${title || ""}"
Opening Hook: "${hook || ""}"
Why Viral: "${reason || ""}"
Dialogue Snippet: "${dialogue || ""}"
Existing Tags: ${Array.isArray(hashtags) ? hashtags.join(" ") : ""}

Return tailored titles, captions, pinned comment prompts, thumbnail cover text, and optimal hashtag sets for TikTok and YouTube Shorts.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            coverText: { type: Type.STRING, description: "3-5 punchy ALL-CAPS words for video cover frame" },
            pinnedComment: { type: Type.STRING, description: "Question to pin in comments to boost engagement" },
            tiktokCaption: { type: Type.STRING, description: "TikTok post description + hashtags" },
            shortsTitle: { type: Type.STRING, description: "YouTube Shorts SEO title under 70 chars" },
          },
          required: ["coverText", "pinnedComment", "tiktokCaption", "shortsTitle"],
        },
      },
    });

    const parsed = parseGeminiJson<any>(response.text, {});
    return res.json(parsed);
  } catch (error: any) {
    console.error("Error generating social pack:", error);
    const formatted = formatGeminiHttpError(error);
    return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  }
});

// ---------------------------------------------------------------------------
// 7B. Gemini Vision Auto-Color Grade
// ---------------------------------------------------------------------------
app.post("/api/ai-color-grade", async (req, res) => {
  const framePath = `/tmp/grade_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
  try {
    const {
      videoUrl = "",
      playableSourceUrl = "",
      timestamp = 1,
      title = "",
      hook = "",
    } = req.body;

    const localFile = resolveLocalVideoPath(playableSourceUrl) || resolveLocalVideoPath(videoUrl);
    const parts: any[] = [];

    if (localFile) {
      const seekSec = Math.max(0, Number(timestamp) || 0);
      try {
        await execFileAsync(
          "ffmpeg",
          ["-y", "-ss", seekSec.toFixed(1), "-i", localFile, "-vframes", "1", "-q:v", "4", "-vf", "scale=640:-2", framePath],
          { timeout: 15000 }
        );
        if (fs.existsSync(framePath) && fs.statSync(framePath).size > 500) {
          parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: fs.readFileSync(framePath).toString("base64"),
            },
          });
        }
      } catch {}
    }

    parts.push({
      text: `You are a professional mobile video colorist. ${
        parts.length > 0
          ? "Inspect this video frame's exposure, contrast, skin tones, and atmosphere."
          : `Based on the video title "${title}" and hook "${hook}", recommend an engaging color grade.`
      }
Choose the best CSS filter preset from ["none", "grayscale", "sepia", "high_contrast", "vivid", "noir", "warm", "cool", "vintage"] and subtle fine-tune percentages:
- filterBrightness: 80..125 (100 neutral)
- filterContrast: 90..140 (100 neutral)
- filterSaturate: 0..150 (100 neutral)
Give a concise 1-sentence colorist rationale.`,
    });

    const ai = getGeminiClient();
    const response = await generateContentResilient(ai, {
      contents: { parts },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            videoFilter: { type: Type.STRING },
            filterBrightness: { type: Type.INTEGER },
            filterContrast: { type: Type.INTEGER },
            filterSaturate: { type: Type.INTEGER },
            rationale: { type: Type.STRING },
          },
          required: ["videoFilter", "filterBrightness", "filterContrast", "filterSaturate", "rationale"],
        },
      },
    });

    const parsed = parseGeminiJson<any>(response.text, {});
    const allowedPresets = new Set([
      "none",
      "grayscale",
      "sepia",
      "high_contrast",
      "vivid",
      "noir",
      "warm",
      "cool",
      "vintage",
    ]);

    return res.json({
      videoFilter: allowedPresets.has(parsed.videoFilter) ? parsed.videoFilter : "vivid",
      filterBrightness: Math.max(70, Math.min(135, Math.round(Number(parsed.filterBrightness) || 100))),
      filterContrast: Math.max(75, Math.min(160, Math.round(Number(parsed.filterContrast) || 100))),
      filterSaturate: Math.max(0, Math.min(175, Math.round(Number(parsed.filterSaturate) || 100))),
      rationale: String(parsed.rationale || "Balanced contrast and vibrancy for mobile feeds."),
    });
  } catch (error: any) {
    console.error("AI color grade error:", error);
    const formatted = formatGeminiHttpError(error);
    return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  } finally {
    if (fs.existsSync(framePath)) {
      fs.unlink(framePath, () => {});
    }
  }
});

// ---------------------------------------------------------------------------
// 7C. Gemini AI Caption Translator & Tone Adapter
// ---------------------------------------------------------------------------
app.post("/api/ai-translate-captions", async (req, res) => {
  try {
    const { captions = [], targetLanguage = "Spanish" } = req.body;
    if (!Array.isArray(captions) || captions.length === 0) {
      return res.status(400).json({ error: "Captions array is required." });
    }

    const ai = getGeminiClient();
    const response = await generateContentResilient(ai, {
      contents: `Transform these timed short-form video captions into "${targetLanguage}".
Keep the exact same array length (${captions.length}) and preserve start/end timestamps cleanly while making the text natural, punchy, and native for vertical short-form subtitles. Pick one impact emphasisWord per caption.

Input Captions:
${JSON.stringify(
  captions.map((c: any) => ({
    start: Number(c.start) || 0,
    end: Number(c.end) || 2,
    text: String(c.text || ""),
  }))
)}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            captions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER },
                  text: { type: Type.STRING },
                  emphasisWord: { type: Type.STRING },
                },
                required: ["start", "end", "text"],
              },
            },
          },
          required: ["captions"],
        },
      },
    });

    const parsed = parseGeminiJson<any>(response.text, {});
    const outCaptions = (Array.isArray(parsed.captions) ? parsed.captions : []).map((cap: any, i: number) => {
      const orig = captions[i] || cap;
      const start = Number(orig.start ?? cap.start) || 0;
      const end = Math.max(start + 0.4, Number(orig.end ?? cap.end) || start + 2);
      const text = String(cap.text || orig.text || "").trim();
      const words = text.split(/\s+/).filter(Boolean).map((w: string, idx: number, arr: string[]) => {
        const seg = (end - start) / Math.max(1, arr.length);
        return {
          w,
          start: Math.round((start + idx * seg) * 10) / 10,
          end: Math.round((start + (idx + 1) * seg) * 10) / 10,
        };
      });
      return {
        start,
        end,
        text,
        emphasisWord: cap.emphasisWord ? String(cap.emphasisWord) : undefined,
        words,
      };
    });

    if (outCaptions.length === 0) {
      return res.status(502).json({ error: "Gemini returned empty captions." });
    }

    return res.json({ captions: outCaptions });
  } catch (error: any) {
    console.error("AI caption translate error:", error);
    const formatted = formatGeminiHttpError(error);
    return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  }
});

// ---------------------------------------------------------------------------
// 7D. Gemini Multi-Turn AI Studio Director (Chat + Live Studio Actions)
// ---------------------------------------------------------------------------
app.post("/api/ai-director", async (req, res) => {
  try {
    const {
      messages = [],
      videoContext = {},
      activeClip = null,
      settings = {},
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "A user message is required." });
    }

    const latestMsg = String(messages[messages.length - 1]?.text || "").trim();
    if (!latestMsg) {
      return res.status(400).json({ error: "Message text cannot be empty." });
    }

    const history = messages.slice(0, -1).slice(-8).map((m: any) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [{ text: String(m.text || "") }],
    }));

    const systemInstruction = `You are the ClipForge AI Studio Director — an interactive copilot embedded inside a 9:16 short-form video editor.
You help creators optimize hooks, caption styles, kinetic animations, color grading filters, reframing, trim points, and content strategy.
Current Video Context:
- Title: ${videoContext.title || "Untitled"}
- Duration: ${videoContext.duration || 120}s
- Summary: ${videoContext.aiSummary || "N/A"}
- Visual Context: ${String(videoContext.visualSummary || "").slice(0, 1200) || "N/A"}
- Transcript Excerpt: ${String(videoContext.transcript || "").slice(0, 2500) || "N/A"}

Active Clip: ${
      activeClip
        ? `"${activeClip.title}" (${activeClip.startTime}s - ${activeClip.endTime}s), Hook: "${activeClip.hook}", Score: ${activeClip.viralityScore}%`
        : "None selected"
    }
Current Studio Settings: ${JSON.stringify({
      framingMode: settings.framingMode,
      panX: settings.panX,
      captionPreset: settings.captionPreset,
      captionColor: settings.captionColor,
      captionEntranceAnim: settings.captionEntranceAnim,
      captionExitAnim: settings.captionExitAnim,
      videoFilter: settings.videoFilter,
      showHookBanner: settings.showHookBanner,
    })}

When the user asks you to make visual/style/hook/trim edits, populate ONLY the relevant fields inside "actions" (omit fields that should stay unchanged).
Allowed enum values:
- framingMode: "smart_crop" | "split_screen" | "blur_fit" | "clean_box"
- captionPreset: "opus_box" | "opus_classic" | "hormozi" | "tiktok_neon" | "beast_flame" | "karaoke_fill" | "minimal_cinema"
- captionEntranceAnim: "pop" | "slide_up" | "slide_down" | "fade" | "bounce" | "zoom_in" | "glow_burst"
- captionExitAnim: "fade" | "slide_down" | "slide_up" | "shrink" | "pop_out" | "none"
- videoFilter: "none" | "grayscale" | "sepia" | "high_contrast" | "vivid" | "noir" | "warm" | "cool" | "vintage"
If the user asks to clip new moments from the video, set triggerClipMorePrompt to a clear clipping instruction.`;

    const ai = getGeminiClient();
    const directorSchema = {
      type: Type.OBJECT,
      properties: {
        reply: { type: Type.STRING, description: "Helpful concise studio response explaining advice or changes made" },
        actions: {
          type: Type.OBJECT,
          description: "Optional Studio mutations to apply automatically",
          properties: {
            hookBannerText: { type: Type.STRING },
            showHookBanner: { type: Type.BOOLEAN },
            framingMode: { type: Type.STRING },
            panX: { type: Type.INTEGER },
            captionPreset: { type: Type.STRING },
            captionColor: { type: Type.STRING },
            captionEntranceAnim: { type: Type.STRING },
            captionExitAnim: { type: Type.STRING },
            videoFilter: { type: Type.STRING },
            filterBrightness: { type: Type.INTEGER },
            filterContrast: { type: Type.INTEGER },
            filterSaturate: { type: Type.INTEGER },
            startTime: { type: Type.NUMBER },
            endTime: { type: Type.NUMBER },
            newClipTitle: { type: Type.STRING },
            triggerClipMorePrompt: { type: Type.STRING },
          },
        },
      },
      required: ["reply"],
    };

    let response;
    try {
      const chat = ai.chats.create({
        model: "gemini-4-hydrogen",
        history,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: directorSchema,
        },
      });
      response = await withGeminiTimeout(chat.sendMessage({ message: latestMsg }), 11000, "gemini-4-hydrogen");
    } catch (dirErr: any) {
      if (isTransientGeminiError(dirErr)) {
        const fallbackChat = ai.chats.create({
          model: "gemini-3.1-flash-lite",
          history,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: directorSchema,
          },
        });
        response = await withGeminiRetry(
          () => withGeminiTimeout(fallbackChat.sendMessage({ message: latestMsg }), 14000, "gemini-3.1-flash-lite"),
          2
        );
      } else {
        throw dirErr;
      }
    }
    const parsed = parseGeminiJson<any>(response.text, {});

    return res.json({
      reply: String(parsed.reply || "Updated your Studio settings."),
      actions: parsed.actions || null,
    });
  } catch (error: any) {
    console.error("AI director error:", error);
    const formatted = formatGeminiHttpError(error);
    return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  }
});

// Serve static public folder (samples, uploads, clips) with byte-range seeking support
const staticHeaders = (res: express.Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Accept-Ranges", "bytes");
};
app.use(express.static(publicDir, { setHeaders: staticHeaders }));
app.use("/public", express.static(publicDir, { setHeaders: staticHeaders }));

// ---------------------------------------------------------------------------
// 8. Real FFmpeg 9:16 Video Clipping Engine
// ---------------------------------------------------------------------------
function formatAssTime(sec: number): string {
  const safe = Math.max(0, sec);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const cs = Math.floor((safe % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function hexToAssBgr(hex?: string): string {
  const clean = (hex || "#FACC15").replace("#", "");
  if (clean.length !== 6) return "&H0015CCFA";
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

function applyAssTextCase(text: string, textCase?: string): string {
  if (textCase === "original") return text;
  if (textCase === "titlecase") {
    return text.replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return text.toUpperCase();
}

function buildAssSubtitlesFile(options: {
  captions: any[];
  resolution: string;
  captionColor?: string;
  captionBaseColor?: string;
  captionPosition?: string;
  captionFontSize?: number;
  captionFontFamily?: string;
  captionTextCase?: string;
  captionOutlineWidth?: number;
  captionDropShadow?: boolean;
  playbackSpeed?: number;
  showHookBanner?: boolean;
  hookBannerText?: string;
}): string {
  const {
    captions,
    resolution,
    captionColor = "#22C55E",
    captionBaseColor = "#FFFFFF",
    captionPosition = "lower_third",
    captionFontSize = 34,
    captionFontFamily = "Montserrat",
    captionTextCase = "uppercase",
    captionOutlineWidth = 6,
    captionDropShadow = true,
    playbackSpeed = 1,
    showHookBanner = false,
    hookBannerText = "",
  } = options;
  const speed = Math.max(0.75, Math.min(1.5, Number(playbackSpeed) || 1));
  const playW = resolution === "1080p" ? 1080 : 720;
  const playH = resolution === "1080p" ? 1920 : 1280;
  const fontSize = Math.round((resolution === "1080p" ? 1.5 : 1.0) * (captionFontSize || 34) * 1.45);
  const bannerFontSize = Math.round((resolution === "1080p" ? 1.5 : 1.0) * 32);
  const marginV =
    captionPosition === "top"
      ? Math.round(playH * 0.72)
      : captionPosition === "middle"
      ? Math.round(playH * 0.45)
      : captionPosition === "bottom"
      ? Math.round(playH * 0.12)
      : Math.round(playH * 0.22);

  const baseBgr = hexToAssBgr(captionBaseColor);
  const accentBgr = hexToAssBgr(captionColor);
  const safeOutline = Math.max(0, Math.min(12, Math.round(Number(captionOutlineWidth) ?? 6)));
  const shadowVal = captionDropShadow ? 2 : 0;
  const assFont =
    captionFontFamily === "Rubik Mono One"
      ? "Liberation Sans"
      : captionFontFamily === "Plus Jakarta Sans"
      ? "Noto Sans"
      : "DejaVu Sans";

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${playW}
PlayResY: ${playH}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${assFont},${fontSize},${baseBgr},${accentBgr},&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${safeOutline},${shadowVal},2,48,48,${marginV},1
Style: HookBanner,${assFont},${bannerFontSize},&H000B0909,&H00FFFFFF,&H00FFFFFF,&H00FFFFFF,-1,0,0,0,100,100,0,0,3,16,0,8,54,54,${Math.round(playH * 0.09)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events: string[] = [];

  if (showHookBanner && hookBannerText && hookBannerText.trim()) {
    const maxEndSec = Math.max(
      4,
      captions.reduce((mx, c) => Math.max(mx, Number(c?.end) || 0), 0) / speed
    );
    const cleanBanner = hookBannerText
      .trim()
      .replace(/\r?\n/g, " ")
      .replace(/[{}]/g, "")
      .slice(0, 72);
    events.push(
      `Dialogue: 1,${formatAssTime(0)},${formatAssTime(Math.min(5.5, maxEndSec))},HookBanner,,0,0,0,,${cleanBanner}`
    );
  }

  captions
    .filter((c) => c && c.text)
    .forEach((c) => {
      const scaledStart = (Number(c.start) || 0) / speed;
      const scaledEnd = Math.max(scaledStart + 0.45, (Number(c.end) || 3) / speed);
      const start = formatAssTime(scaledStart);
      const end = formatAssTime(scaledEnd);
      let text = applyAssTextCase(
        String(c.text || "").replace(/\r?\n/g, " ").replace(/[{}]/g, ""),
        captionTextCase
      );
      if (c.emphasisWord) {
        const emp = applyAssTextCase(String(c.emphasisWord).trim(), captionTextCase);
        if (emp) {
          const escaped = emp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          text = text.replace(new RegExp(`(${escaped})`, "i"), `{\\c${accentBgr}\\b1}$1{\\c${baseBgr}}`);
        }
      }
      events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`);
    });

  return `${header}\n${events.join("\n")}\n`;
}

function buildFfmpegColorFilters(options: {
  videoFilter?: string;
  filterBrightness?: number;
  filterContrast?: number;
  filterSaturate?: number;
}): string[] {
  const filters: string[] = [];
  const preset = String(options.videoFilter || "none");

  switch (preset) {
    case "grayscale":
      filters.push("hue=s=0");
      break;
    case "sepia":
      filters.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131");
      break;
    case "high_contrast":
      filters.push("eq=contrast=1.40:saturation=1.10");
      break;
    case "vivid":
      filters.push("eq=saturation=1.50:contrast=1.12:brightness=0.03");
      break;
    case "noir":
      filters.push("hue=s=0,eq=contrast=1.50:brightness=-0.06");
      break;
    case "warm":
      filters.push("colorbalance=rs=0.14:gs=0.04:bs=-0.12,eq=saturation=1.22");
      break;
    case "cool":
      filters.push("colorbalance=rs=-0.10:gs=0.02:bs=0.14,eq=saturation=1.15:contrast=1.06");
      break;
    case "vintage":
      filters.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,eq=contrast=1.12:brightness=-0.04:saturation=0.85");
      break;
    default:
      break;
  }

  const bPct = Number(options.filterBrightness ?? 100);
  const cPct = Number(options.filterContrast ?? 100);
  const sPct = Number(options.filterSaturate ?? 100);
  if (bPct !== 100 || cPct !== 100 || sPct !== 100) {
    const eqBrightness = Math.max(-0.5, Math.min(0.5, (bPct - 100) / 220));
    const eqContrast = Math.max(0.4, Math.min(2.2, cPct / 100));
    const eqSaturate = Math.max(0, Math.min(2.5, sPct / 100));
    filters.push(
      `eq=brightness=${eqBrightness.toFixed(3)}:contrast=${eqContrast.toFixed(2)}:saturation=${eqSaturate.toFixed(2)}`
    );
  }

  return filters;
}

function buildVerticalFilter(
  resolution: string,
  framingMode: string,
  panX: number
): { filter: string; isComplex: boolean } {
  const outW = resolution === "1080p" ? 1080 : 720;
  const outH = resolution === "1080p" ? 1920 : 1280;

  if (framingMode === "blur_fit") {
    return {
      filter: `[0:v]split=2[bg][fg];[bg]scale=180:320:force_original_aspect_ratio=increase,crop=180:320,boxblur=6:2,scale=${outW}:${outH},eq=brightness=-0.12[bgb];[fg]scale=${outW}:-2:force_original_aspect_ratio=decrease[fgb];[bgb][fgb]overlay=(W-w)/2:(H-h)/2,setsar=1`,
      isComplex: true,
    };
  }
  if (framingMode === "split_screen") {
    const halfH = Math.round(outH / 2);
    return {
      filter: `[0:v]split=2[topv][botv];[topv]scale=${outW}:${halfH}:force_original_aspect_ratio=increase,crop=${outW}:${halfH}[t];[botv]scale=180:160:force_original_aspect_ratio=increase,crop=180:160,boxblur=4:2,scale=${outW}:${halfH},eq=saturation=1.25[b];[t][b]vstack=inputs=2,setsar=1`,
      isComplex: true,
    };
  }
  if (framingMode === "clean_box") {
    return {
      filter: `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:color=#09090b,setsar=1`,
      isComplex: false,
    };
  }

  // smart_crop: full 9:16 crop with speaker/subject pan offset
  const clampedPan = Math.max(-100, Math.min(100, Number(panX) || 0));
  const panFactor = (clampedPan + 100) / 200; // 0.0 (left) .. 0.5 (center) .. 1.0 (right)
  return {
    filter: `scale=-2:${outH},crop='min(iw,${outW})':${outH}:'(iw-min(iw,${outW}))*${panFactor.toFixed(3)}':0,scale=${outW}:${outH}:force_original_aspect_ratio=increase,crop=${outW}:${outH},setsar=1`,
    isComplex: false,
  };
}

async function clipVideoSegment(options: {
  videoUrl?: string;
  playableSourceUrl?: string;
  clipVideoUrl?: string;
  youtubeUrl?: string;
  startTime: number;
  duration: number;
  resolution?: string;
  framingMode?: string;
  panX?: number;
  title?: string;
  clipId?: string;
  burnCaptions?: boolean;
  captions?: any[];
  captionColor?: string;
  captionBaseColor?: string;
  captionPosition?: string;
  captionFontSize?: number;
  captionFontFamily?: string;
  captionTextCase?: string;
  captionOutlineWidth?: number;
  captionDropShadow?: boolean;
  videoFilter?: string;
  filterBrightness?: number;
  filterContrast?: number;
  filterSaturate?: number;
  playbackSpeed?: number;
  normalizeAudio?: boolean;
  showHookBanner?: boolean;
  hookBannerText?: string;
  forceUniformAudio?: boolean;
}): Promise<{ downloadUrl: string; filename: string; duration: number }> {
  const {
    videoUrl = "",
    playableSourceUrl = "",
    clipVideoUrl = "",
    youtubeUrl = "",
    startTime = 0,
    duration = 30,
    resolution = "720p",
    framingMode = "smart_crop",
    panX = 0,
    title = "clip",
    clipId = `clip_${Date.now()}`,
    burnCaptions = false,
    captions = [],
    captionColor = "#22C55E",
    captionBaseColor = "#FFFFFF",
    captionPosition = "lower_third",
    captionFontSize = 34,
    captionFontFamily = "Montserrat",
    captionTextCase = "uppercase",
    captionOutlineWidth = 6,
    captionDropShadow = true,
    videoFilter = "none",
    filterBrightness = 100,
    filterContrast = 100,
    filterSaturate = 100,
    playbackSpeed = 1,
    normalizeAudio = false,
    showHookBanner = false,
    hookBannerText = "",
    forceUniformAudio = false,
  } = options;

  const startSec = Math.max(0, Math.floor(startTime));
  const durSec = Math.max(3, Math.min(300, Math.ceil(duration)));
  const endSec = startSec + durSec;
  const safePan = Math.max(-100, Math.min(100, Math.round(Number(panX) || 0)));
  const safeSpeed = Math.max(0.75, Math.min(1.5, Number(playbackSpeed) || 1));
  const hasAdvancedFx =
    (videoFilter && videoFilter !== "none") ||
    filterBrightness !== 100 ||
    filterContrast !== 100 ||
    filterSaturate !== 100 ||
    safeSpeed !== 1 ||
    normalizeAudio ||
    (showHookBanner && Boolean(hookBannerText));

  const safeClipId = clipId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
  const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase().slice(0, 20) || "clip";
  const fxHash = hasAdvancedFx
    ? `_${crypto
        .createHash("md5")
        .update(`${videoFilter}_${filterBrightness}_${filterContrast}_${filterSaturate}_${safeSpeed}_${normalizeAudio}_${showHookBanner}_${hookBannerText}`)
        .digest("hex")
        .slice(0, 6)}`
    : "";
  const subTag = burnCaptions && Array.isArray(captions) && captions.length > 0 ? "_sub" : "";
  const clipFilename = `${safeClipId}_${cleanTitle}_s${startSec}_d${durSec}_p${safePan}_${resolution}_${framingMode}${fxHash}${subTag}.mp4`;
  const finalOut = path.join(clipsDir, clipFilename);

  if (!burnCaptions && !hasAdvancedFx && !forceUniformAudio && fs.existsSync(finalOut) && fs.statSync(finalOut).size > 10000) {
    return {
      downloadUrl: `/clips/${clipFilename}`,
      filename: clipFilename,
      duration: Math.round(duration / safeSpeed),
    };
  }

  // Prefer locally accessible full file (uploads, samples, or cached URL file)
  let localInput =
    resolveLocalVideoPath(playableSourceUrl) || resolveLocalVideoPath(videoUrl);
  let usingPreClipped = false;

  const targetYt =
    youtubeUrl ||
    (videoUrl && (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be"))
      ? videoUrl
      : "");

  if (!localInput && targetYt) {
    const ytId = extractYoutubeId(targetYt);
    if (ytId) {
      const existingCached = resolveLocalVideoPath(`/uploads/yt_${ytId}.mp4`);
      if (existingCached) {
        localInput = existingCached;
      }
    }
  }

  let tempYtDownload: string | null = null;
  const preClippedLocal = resolveLocalVideoPath(clipVideoUrl);

  if (!localInput && targetYt) {
    const rawTemp = `/tmp/yt_sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`;
    try {
      await execFileAsync(
        ensureYtdlpReady(),
        [
          "--js-runtimes",
          "node",
          "--no-check-certificates",
          "--no-playlist",
          "--download-sections",
          `*${startSec}-${endSec}`,
          "-f",
          "best[height<=720][ext=mp4]/best[ext=mp4]/best",
          "-o",
          rawTemp,
          targetYt,
        ],
        { timeout: 20000, maxBuffer: 10 * 1024 * 1024 }
      );
      if (fs.existsSync(rawTemp) && fs.statSync(rawTemp).size >= 1000) {
        tempYtDownload = rawTemp;
        localInput = rawTemp;
      }
    } catch (ytErr: any) {
      if (preClippedLocal) {
        localInput = preClippedLocal;
        usingPreClipped = true;
      } else if (isYoutubeBotWallError(ytErr)) {
        throw new Error("YOUTUBE_BOT_WALL: YouTube restricted raw MP4 download on this server IP.");
      } else {
        throw ytErr;
      }
    }
    if (!localInput) {
      if (preClippedLocal) {
        localInput = preClippedLocal;
        usingPreClipped = true;
      } else {
        throw new Error(`Failed to extract section ${startSec}s-${endSec}s from YouTube source.`);
      }
    }
  }

  if (!localInput && preClippedLocal) {
    localInput = preClippedLocal;
    usingPreClipped = true;
  }

  if (!localInput || !fs.existsSync(localInput)) {
    throw new Error("Source video file is unavailable for server clipping.");
  }

  let tempAssFile: string | null = null;
  try {
    const probe = await probeVideoFile(localInput);
    const skipSeek = Boolean(tempYtDownload || usingPreClipped);
    const actualStartSec = skipSeek
      ? 0
      : Math.min(startSec, Math.max(0, (probe.duration || 120) - 3));
    const actualDurSec = skipSeek
      ? Math.max(2, Math.min(durSec, probe.duration || durSec))
      : Math.max(2, Math.min(durSec, (probe.duration || durSec + actualStartSec) - actualStartSec));

    const { filter: baseFilter, isComplex } = buildVerticalFilter(resolution, framingMode, panX);
    const postVideoSteps: string[] = [];

    const colorSteps = buildFfmpegColorFilters({
      videoFilter,
      filterBrightness,
      filterContrast,
      filterSaturate,
    });
    if (colorSteps.length > 0) {
      postVideoSteps.push(...colorSteps);
    }

    if (safeSpeed !== 1) {
      postVideoSteps.push(`setpts=PTS/${safeSpeed.toFixed(3)}`);
    }

    const shouldWriteAss =
      (burnCaptions && Array.isArray(captions) && captions.length > 0) ||
      (showHookBanner && Boolean(hookBannerText && hookBannerText.trim()));

    if (shouldWriteAss) {
      tempAssFile = `/tmp/sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.ass`;
      fs.writeFileSync(
        tempAssFile,
        buildAssSubtitlesFile({
          captions: burnCaptions && Array.isArray(captions) ? captions : [],
          resolution,
          captionColor,
          captionBaseColor,
          captionPosition,
          captionFontSize,
          captionFontFamily,
          captionTextCase,
          captionOutlineWidth,
          captionDropShadow,
          playbackSpeed: safeSpeed,
          showHookBanner,
          hookBannerText,
        }),
        "utf-8"
      );
      const escapedAss = tempAssFile.replace(/:/g, "\\:");
      postVideoSteps.push(`ass=${escapedAss}`);
    }

    const finalFilter =
      postVideoSteps.length > 0 ? `${baseFilter},${postVideoSteps.join(",")}` : baseFilter;

    const ffArgs: string[] = ["-y", "-threads", "0"];
    if (!skipSeek) {
      ffArgs.push("-ss", String(actualStartSec));
    }
    ffArgs.push("-i", localInput, "-t", String(actualDurSec));

    if (!probe.hasAudio && forceUniformAudio) {
      const targetOutDur = Math.max(1, actualDurSec / safeSpeed);
      ffArgs.push(
        "-f",
        "lavfi",
        "-t",
        targetOutDur.toFixed(2),
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100"
      );
    }

    if (isComplex) {
      ffArgs.push("-filter_complex", `${finalFilter}[outv]`);
      ffArgs.push("-map", "[outv]");
    } else {
      ffArgs.push("-vf", finalFilter);
      ffArgs.push("-map", "0:v:0");
    }

    if (forceUniformAudio) {
      ffArgs.push("-r", "30");
    }

    ffArgs.push(
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p"
    );

    if (probe.hasAudio) {
      ffArgs.push("-map", "0:a:0");
      const audioFilters: string[] = [];
      if (normalizeAudio) {
        audioFilters.push("highpass=f=85", "dynaudnorm=f=150:g=15");
      }
      if (safeSpeed !== 1) {
        audioFilters.push(`atempo=${safeSpeed.toFixed(3)}`);
      }
      if (audioFilters.length > 0) {
        ffArgs.push("-af", audioFilters.join(","));
      }
      if (forceUniformAudio) {
        ffArgs.push("-ar", "44100", "-ac", "2");
      }
      ffArgs.push("-c:a", "aac", "-b:a", "128k");
    } else if (forceUniformAudio) {
      ffArgs.push("-map", "1:a:0", "-c:a", "aac", "-b:a", "128k", "-shortest");
    } else {
      ffArgs.push("-an");
    }

    ffArgs.push("-movflags", "+faststart", finalOut);

    await execFileAsync("ffmpeg", ffArgs, {
      timeout: 85000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (!fs.existsSync(finalOut) || fs.statSync(finalOut).size < 1000) {
      throw new Error("FFmpeg produced an empty clip output.");
    }

    return {
      downloadUrl: `/clips/${clipFilename}`,
      filename: clipFilename,
      duration: Math.max(2, Math.round(actualDurSec / safeSpeed)),
    };
  } finally {
    if (tempYtDownload && fs.existsSync(tempYtDownload)) {
      fs.unlink(tempYtDownload, () => {});
    }
    if (tempAssFile && fs.existsSync(tempAssFile)) {
      fs.unlink(tempAssFile, () => {});
    }
  }
}

// Auto-clip all viral moments into playable 9:16 vertical MP4s (bounded concurrency)
app.post("/api/auto-clip", async (req, res) => {
  try {
    const {
      videoUrl = "",
      playableSourceUrl = "",
      youtubeUrl = "",
      youtubeDownloadBlocked = false,
      clips = [],
    } = req.body;

    if (!Array.isArray(clips) || clips.length === 0) {
      return res.status(400).json({ error: "Clips array is required" });
    }

    const hasLocal = Boolean(
      resolveLocalVideoPath(playableSourceUrl) || resolveLocalVideoPath(videoUrl)
    );
    if (!hasLocal && youtubeDownloadBlocked && youtubeUrl) {
      return res.json({
        success: true,
        youtubeEmbedFallback: true,
        clips,
      });
    }

    const clippedResults: any[] = new Array(clips.length);
    const concurrency = 3;
    const startedAt = Date.now();
    let cursor = 0;
    let botWallHit = false;

    const worker = async () => {
      while (cursor < clips.length) {
        const idx = cursor++;
        if (botWallHit || Date.now() - startedAt > 24000) {
          clippedResults[idx] = { ...clips[idx] };
          continue;
        }
        const clip = clips[idx];
        const dur = Math.max(3, Math.round((clip.endTime || 30) - (clip.startTime || 0)));
        try {
          const result = await clipVideoSegment({
            videoUrl,
            playableSourceUrl,
            youtubeUrl,
            startTime: clip.startTime || 0,
            duration: dur,
            resolution: "720p",
            framingMode: clip.framingSuggestion || "smart_crop",
            panX: Number(clip.panX) || 0,
            title: clip.title || `clip_${idx + 1}`,
            clipId: clip.id || `clip_${Date.now()}_${idx}`,
          });
          clippedResults[idx] = {
            ...clip,
            clipVideoUrl: result.downloadUrl,
            downloadUrl: result.downloadUrl,
          };
        } catch (clipErr: any) {
          console.warn(`Clip #${idx + 1} render warning:`, clipErr?.message);
          if (String(clipErr?.message || "").includes("YOUTUBE_BOT_WALL")) {
            botWallHit = true;
          }
          clippedResults[idx] = {
            ...clip,
            clipError: clipErr?.message || "Clip render failed",
          };
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, clips.length) }, () => worker())
    );

    const validCount = clippedResults.filter((c) => Boolean(c?.clipVideoUrl)).length;
    if (validCount === 0) {
      if (botWallHit && youtubeUrl) {
        return res.json({
          success: true,
          youtubeEmbedFallback: true,
          clips,
        });
      }
      const firstErr = clippedResults.find((c) => c?.clipError)?.clipError || "Unable to clip video segments.";
      return res.status(500).json({ error: firstErr, clips: clippedResults });
    }

    return res.json({ success: true, clips: clippedResults });
  } catch (err: any) {
    console.error("Auto-clip error:", err);
    return res.status(500).json({ error: err.message || "Failed to auto-clip" });
  }
});

// Single 9:16 Video Clipper / Re-clipper endpoint (supports burned ASS captions, color grade, speed, audio mastering, hook banner)
app.post("/api/clip-video", async (req, res) => {
  try {
    const {
      videoUrl = "",
      playableSourceUrl = "",
      clipVideoUrl = "",
      youtubeUrl = "",
      startTime = 0,
      duration = 30,
      resolution = "1080p",
      framingMode = "smart_crop",
      panX = 0,
      title = "clip",
      clipId,
      burnCaptions = false,
      captions = [],
      captionColor = "#22C55E",
      captionBaseColor = "#FFFFFF",
      captionPosition = "lower_third",
      captionFontSize = 34,
      captionFontFamily = "Montserrat",
      captionTextCase = "uppercase",
      captionOutlineWidth = 6,
      captionDropShadow = true,
      videoFilter = "none",
      filterBrightness = 100,
      filterContrast = 100,
      filterSaturate = 100,
      playbackSpeed = 1,
      normalizeAudio = false,
      showHookBanner = false,
      hookBannerText = "",
    } = req.body;

    const result = await clipVideoSegment({
      videoUrl,
      playableSourceUrl,
      clipVideoUrl,
      youtubeUrl,
      startTime,
      duration,
      resolution,
      framingMode,
      panX,
      title,
      clipId: clipId || `clip_${Date.now()}`,
      burnCaptions: Boolean(burnCaptions),
      captions,
      captionColor,
      captionBaseColor,
      captionPosition,
      captionFontSize,
      captionFontFamily,
      captionTextCase,
      captionOutlineWidth,
      captionDropShadow,
      videoFilter,
      filterBrightness: Number(filterBrightness ?? 100),
      filterContrast: Number(filterContrast ?? 100),
      filterSaturate: Number(filterSaturate ?? 100),
      playbackSpeed: Number(playbackSpeed ?? 1),
      normalizeAudio: Boolean(normalizeAudio),
      showHookBanner: Boolean(showHookBanner),
      hookBannerText: String(hookBannerText || ""),
    });

    return res.json({
      success: true,
      downloadUrl: result.downloadUrl,
      filename: result.filename,
      duration: result.duration,
      resolution,
    });
  } catch (err: any) {
    console.error("Clip endpoint error:", err);
    return res.status(500).json({ error: err.message || "Failed to clip video" });
  }
});

// Merge multiple selected clips into a single continuous 9:16 compilation MP4
app.post("/api/merge-clips", async (req, res) => {
  const segmentPaths: string[] = [];
  try {
    const {
      videoUrl = "",
      playableSourceUrl = "",
      youtubeUrl = "",
      clips = [],
      resolution = "1080p",
      framingMode = "smart_crop",
      panX = 0,
      burnCaptions = true,
      captionColor = "#22C55E",
      captionBaseColor = "#FFFFFF",
      captionPosition = "lower_third",
      captionFontSize = 34,
      captionFontFamily = "Montserrat",
      captionTextCase = "uppercase",
      captionOutlineWidth = 6,
      captionDropShadow = true,
      videoFilter = "none",
      filterBrightness = 100,
      filterContrast = 100,
      filterSaturate = 100,
      playbackSpeed = 1,
      normalizeAudio = true,
      title = "compilation",
      platform = "tiktok",
    } = req.body;

    if (!Array.isArray(clips) || clips.length < 2) {
      return res.status(400).json({ error: "Select at least 2 clips to merge into a compilation." });
    }

    const safeRes = resolution === "1080p" ? "1080p" : "720p";
    const {
      showHookBanner = false,
      hookBannerText = "",
    } = req.body;
    const limitedClips = clips.slice(0, 10);
    const renderedSegments: { filepath: string; duration: number }[] = new Array(limitedClips.length);
    const mergeBatchTs = Date.now();
    let mergeCursor = 0;

    const mergeWorker = async () => {
      while (mergeCursor < limitedClips.length) {
        const i = mergeCursor++;
        const c = limitedClips[i];
        const dur = Math.max(3, Math.round((Number(c.endTime) || 15) - (Number(c.startTime) || 0)));
        const segResult = await clipVideoSegment({
          videoUrl,
          playableSourceUrl,
          clipVideoUrl: c.clipVideoUrl || "",
          youtubeUrl,
          startTime: Number(c.startTime) || 0,
          duration: dur,
          resolution: safeRes,
          framingMode: c.framingSuggestion || framingMode,
          panX: typeof c.panX === "number" ? c.panX : panX,
          title: c.title || `part_${i + 1}`,
          clipId: `merge_${mergeBatchTs}_${i}`,
          burnCaptions: Boolean(burnCaptions),
          captions: Array.isArray(c.captions) ? c.captions : [],
          captionColor,
          captionBaseColor,
          captionPosition,
          captionFontSize,
          captionFontFamily,
          captionTextCase,
          captionOutlineWidth,
          captionDropShadow,
          videoFilter,
          filterBrightness: Number(filterBrightness ?? 100),
          filterContrast: Number(filterContrast ?? 100),
          filterSaturate: Number(filterSaturate ?? 100),
          playbackSpeed: Number(playbackSpeed ?? 1),
          normalizeAudio: Boolean(normalizeAudio),
          showHookBanner: Boolean(showHookBanner),
          hookBannerText: String(c.hook || hookBannerText || ""),
          forceUniformAudio: true,
        });

        const localSeg = path.join(clipsDir, segResult.filename);
        segmentPaths.push(localSeg);
        renderedSegments[i] = { filepath: localSeg, duration: segResult.duration };
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(3, limitedClips.length) }, () => mergeWorker())
    );

    const cleanTitle = String(title || "compilation")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase()
      .slice(0, 24) || "compilation";
    const outFilename = `clipforge_${platform}_${cleanTitle}_mashup_${Date.now()}.mp4`;
    const outPath = path.join(clipsDir, outFilename);

    const ffArgs: string[] = ["-y", "-threads", "0"];
    renderedSegments.forEach((seg) => {
      ffArgs.push("-i", seg.filepath);
    });

    const concatInputs = renderedSegments.map((_, idx) => `[${idx}:v][${idx}:a]`).join("");
    ffArgs.push(
      "-filter_complex",
      `${concatInputs}concat=n=${renderedSegments.length}:v=1:a=1[outv][outa]`,
      "-map",
      "[outv]",
      "-map",
      "[outa]",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outPath
    );

    await execFileAsync("ffmpeg", ffArgs, {
      timeout: 95000,
      maxBuffer: 12 * 1024 * 1024,
    });

    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1000) {
      throw new Error("FFmpeg produced an empty merged compilation.");
    }

    const totalDuration = renderedSegments.reduce((sum, s) => sum + s.duration, 0);
    return res.json({
      success: true,
      downloadUrl: `/clips/${outFilename}`,
      filename: outFilename,
      duration: totalDuration,
      clipCount: renderedSegments.length,
    });
  } catch (err: any) {
    console.error("Merge clips error:", err);
    return res.status(500).json({ error: err.message || "Failed to merge clips into compilation" });
  } finally {
    segmentPaths.forEach((p) => {
      if (fs.existsSync(p)) fs.unlink(p, () => {});
    });
  }
});

// Gemini AI Viral Retention Boost: rewrites hook, tightens trim, polishes captions & suggests styling
app.post("/api/ai-optimize-clip", async (req, res) => {
  try {
    const { clip, videoTitle = "", fullDuration = 60, transcript = "" } = req.body;
    if (!clip || !clip.title) {
      return res.status(400).json({ error: "Clip object is required for AI optimization." });
    }

    const ai = getGeminiClient();
    const clipStart = Number(clip.startTime) || 0;
    const clipEnd = Math.max(clipStart + 4, Number(clip.endTime) || clipStart + 25);
    const clipDur = clipEnd - clipStart;
    const existingDialogue = Array.isArray(clip.captions)
      ? clip.captions.map((c: any) => `[${Number(c.start || 0).toFixed(1)}s-${Number(c.end || 2).toFixed(1)}s] ${c.text}`).join("\n")
      : "";

    const prompt = `You are a world-class short-form retention strategist (OpusClip / MrBeast / Hormozi editor).
Audit and SUPERCHARGE this vertical short clip for maximum 3-second hook hold and completion rate on TikTok & YouTube Shorts.

SOURCE VIDEO TITLE: ${videoTitle || "Untitled"}
FULL VIDEO DURATION: ${Math.round(Number(fullDuration) || clipEnd)}s
CURRENT CLIP RANGE: ${clipStart.toFixed(1)}s to ${clipEnd.toFixed(1)}s (${clipDur.toFixed(1)}s)
CURRENT TITLE: ${clip.title}
CURRENT HOOK: ${clip.hook || ""}
CURRENT REASON: ${clip.reason || ""}
VISUAL CONTEXT: ${clip.visualContext || "Speaker / visual action"}
CURRENT CAPTIONS:
${existingDialogue || "(none)"}
SOURCE TRANSCRIPT EXCERPT:
${String(transcript || "").slice(0, 1800)}

YOUR OPTIMIZATION TASK:
1. Rewrite "improvedTitle" (punchy <= 60 chars, curiosity gap, zero clickbait filler).
2. Rewrite "improvedHook" (scroll-stopping 3-second opening hook, <= 12 words).
3. Rewrite "improvedReason" (crisp explanation of the retention curve & payoff).
4. Tighten "recommendedStartTime" and "recommendedEndTime" inside [0, ${Math.max(clipEnd, Number(fullDuration) || clipEnd).toFixed(1)}] (keep between 8s and 58s; shave dead lead-in or trailing fluff if helpful).
5. Rewrite "captions" as rapid-fire 3-6 word rhythmic subtitle chunks spanning 0s to (recommendedEndTime - recommendedStartTime), preserving real meaning while cutting filler words, picking one single UPPERCASE "emphasisWord" per chunk.
6. Recommend the optimal editing stack:
   - "recommendedCaptionPreset": one of "opus_box", "opus_classic", "hormozi", "tiktok_neon", "beast_flame", "minimal_cinema"
   - "recommendedFilter": one of "none", "vivid", "high_contrast", "warm", "cool", "noir"
   - "recommendedSpeed": one of 1, 1.15, 1.25
   - "recommendedFraming": one of "smart_crop", "split_screen", "blur_fit", "clean_box"
7. Output boosted realistic scores (75-99) and a crisp 1-sentence "retentionCritique" + 5 high-signal hashtags.`;

    const response = await generateContentResilient(ai, {
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            improvedTitle: { type: Type.STRING },
            improvedHook: { type: Type.STRING },
            improvedReason: { type: Type.STRING },
            retentionCritique: { type: Type.STRING },
            recommendedStartTime: { type: Type.NUMBER },
            recommendedEndTime: { type: Type.NUMBER },
            recommendedFraming: {
              type: Type.STRING,
              enum: ["smart_crop", "split_screen", "blur_fit", "clean_box"],
            },
            recommendedCaptionPreset: {
              type: Type.STRING,
              enum: ["opus_box", "opus_classic", "hormozi", "tiktok_neon", "beast_flame", "minimal_cinema"],
            },
            recommendedFilter: {
              type: Type.STRING,
              enum: ["none", "vivid", "high_contrast", "warm", "cool", "noir"],
            },
            recommendedSpeed: { type: Type.NUMBER },
            boostedViralityScore: { type: Type.NUMBER },
            boostedHookScore: { type: Type.NUMBER },
            boostedFlowScore: { type: Type.NUMBER },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            captions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER },
                  text: { type: Type.STRING },
                  emphasisWord: { type: Type.STRING },
                },
                required: ["start", "end", "text"],
              },
            },
          },
          required: [
            "improvedTitle",
            "improvedHook",
            "improvedReason",
            "retentionCritique",
            "recommendedStartTime",
            "recommendedEndTime",
            "recommendedFraming",
            "recommendedCaptionPreset",
            "recommendedFilter",
            "recommendedSpeed",
            "boostedViralityScore",
            "boostedHookScore",
            "boostedFlowScore",
            "hashtags",
            "captions",
          ],
        },
      },
    });

    const parsed = parseGeminiJson<any>(response.text, {});
    const maxDur = Math.max(clipEnd, Number(fullDuration) || clipEnd);
    const recStartRaw = Number(parsed.recommendedStartTime);
    const recEndRaw = Number(parsed.recommendedEndTime);
    const nextStart = Math.max(0, Math.min(maxDur - 5, Number.isFinite(recStartRaw) ? recStartRaw : clipStart));
    const nextEnd = Math.min(maxDur, Math.max(nextStart + 5, Number.isFinite(recEndRaw) ? recEndRaw : clipEnd));
    const targetSpan = Math.max(4, nextEnd - nextStart);

    const rawCaps = Array.isArray(parsed.captions) && parsed.captions.length > 0 ? parsed.captions : clip.captions || [];
    const normalizedCaptions = rawCaps.map((c: any, idx: number) => {
      const text = String(c.text || "").trim();
      const s = Math.max(0, Number(c.start) || (idx * targetSpan) / rawCaps.length);
      const e = Math.max(s + 0.6, Math.min(targetSpan, Number(c.end) || ((idx + 1) * targetSpan) / rawCaps.length));
      const tokens = text.split(/\s+/).filter(Boolean);
      const step = (e - s) / Math.max(1, tokens.length);
      return {
        start: Number(s.toFixed(2)),
        end: Number(e.toFixed(2)),
        text,
        emphasisWord: c.emphasisWord ? String(c.emphasisWord).trim() : undefined,
        words: tokens.map((w: string, wi: number) => ({
          w,
          start: Number((s + wi * step).toFixed(2)),
          end: Number((s + (wi + 1) * step).toFixed(2)),
        })),
      };
    });

    const allowedSpeeds = [1, 1.15, 1.25];
    const recSpeed = allowedSpeeds.includes(Number(parsed.recommendedSpeed))
      ? Number(parsed.recommendedSpeed)
      : 1.15;

    return res.json({
      success: true,
      improvedTitle: String(parsed.improvedTitle || clip.title).trim(),
      improvedHook: String(parsed.improvedHook || clip.hook).trim(),
      improvedReason: String(parsed.improvedReason || clip.reason).trim(),
      retentionCritique: String(parsed.retentionCritique || "Tightened pacing and opening hook."),
      recommendedStartTime: Number(nextStart.toFixed(1)),
      recommendedEndTime: Number(nextEnd.toFixed(1)),
      recommendedFraming: parsed.recommendedFraming || clip.framingSuggestion || "smart_crop",
      recommendedCaptionPreset: parsed.recommendedCaptionPreset || "opus_box",
      recommendedFilter: parsed.recommendedFilter || "vivid",
      recommendedSpeed: recSpeed,
      boostedViralityScore: Math.max(70, Math.min(99, Math.round(Number(parsed.boostedViralityScore) || 95))),
      boostedHookScore: Math.max(70, Math.min(99, Math.round(Number(parsed.boostedHookScore) || 96))),
      boostedFlowScore: Math.max(70, Math.min(99, Math.round(Number(parsed.boostedFlowScore) || 94))),
      hashtags: Array.isArray(parsed.hashtags) && parsed.hashtags.length > 0 ? parsed.hashtags.slice(0, 6) : clip.hashtags,
      captions: normalizedCaptions,
    });
  } catch (error: any) {
    console.error("AI optimize clip error:", error);
    const formatted = formatGeminiHttpError(error);
    return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  }
});

// ---------------------------------------------------------------------------
// Social Media Account OAuth & Channel/Post Lookup Routes
// ---------------------------------------------------------------------------

type SocialPlatformId = "shorts" | "tiktok";

interface SessionSocialAccountRecord {
  id: string;
  userId: string;
  platform: SocialPlatformId;
  handle: string;
  displayName: string;
  profileUrl: string;
  avatarUrl: string;
  connectionType: "oauth";
  storageSource: "oauth_session";
  isDefault: boolean;
  followersCount: number;
  postsCount: number;
  notes: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

function isSocialPlatform(val: string): val is SocialPlatformId {
  return val === "shorts" || val === "tiktok";
}

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  cookieHeader.split(";").forEach((part) => {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) return;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  });
  return out;
}

function signSessionAccounts(accounts: SessionSocialAccountRecord[]): string {
  const payload = JSON.stringify({ accounts: accounts.slice(0, 8), v: 1 });
  const encoded = Buffer.from(payload, "utf-8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", COOKIE_SIGNING_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

function readSessionAccountsFromReq(req: express.Request): SessionSocialAccountRecord[] {
  try {
    const cookies = parseCookieHeader(req.headers.cookie);
    const token = cookies[SOCIAL_SESSION_COOKIE];
    if (!token) return [];
    const parts = token.split(".");
    if (parts.length !== 2) return [];
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac("sha256", COOKIE_SIGNING_SECRET)
      .update(encoded)
      .digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return [];
    }
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (!Array.isArray(parsed?.accounts)) return [];
    return parsed.accounts.filter(
      (a: any) => a && isSocialPlatform(String(a.platform || "")) && typeof a.handle === "string"
    );
  } catch {
    return [];
  }
}

function writeSessionAccountsCookie(
  res: express.Response,
  accounts: SessionSocialAccountRecord[]
): void {
  const signed = signSessionAccounts(accounts);
  const maxAgeSec = 30 * 24 * 60 * 60;
  res.append(
    "Set-Cookie",
    `${SOCIAL_SESSION_COOKIE}=${encodeURIComponent(
      signed
    )}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=None; Partitioned`
  );
}

function isSameOriginMutationAllowed(req: express.Request): boolean {
  if (req.headers["x-requested-with"] !== "ClipForge") {
    return false;
  }
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  if (origin) {
    const host = typeof req.headers.host === "string" ? req.headers.host : "";
    try {
      const originHost = new URL(origin).host;
      if (host && originHost !== host) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

function getAppBaseUrl(): string {
  const configured = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (configured && /^https?:\/\//i.test(configured) && !configured.includes("MY_APP_URL")) {
    return configured;
  }
  return `http://localhost:${PORT}`;
}

function signOAuthState(platform: SocialPlatformId): string {
  const payload = JSON.stringify({
    platform,
    ts: Date.now(),
    nonce: crypto.randomBytes(12).toString("hex"),
  });
  const encoded = Buffer.from(payload, "utf-8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", OAUTH_STATE_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyOAuthState(
  stateToken: string,
  expectedPlatform: SocialPlatformId
): boolean {
  try {
    const parts = stateToken.split(".");
    if (parts.length !== 2) return false;
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac("sha256", OAUTH_STATE_SECRET)
      .update(encoded)
      .digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (parsed.platform !== expectedPlatform) return false;
    if (typeof parsed.ts !== "number" || Date.now() - parsed.ts > 10 * 60 * 1000) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function getSocialOAuthConfig(platform: SocialPlatformId) {
  const baseUrl = getAppBaseUrl();
  const redirectUri = `${baseUrl}/api/social/oauth/${platform}/callback`;

  if (platform === "shorts") {
    return {
      clientId: (process.env.YOUTUBE_CLIENT_ID || "").trim(),
      clientSecret: (process.env.YOUTUBE_CLIENT_SECRET || "").trim(),
      redirectUri,
      requiredEnvVars: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
      setupGuideUrl: "https://console.cloud.google.com/apis/credentials",
    };
  }
  return {
    clientId: (process.env.TIKTOK_CLIENT_KEY || "").trim(),
    clientSecret: (process.env.TIKTOK_CLIENT_SECRET || "").trim(),
    redirectUri,
    requiredEnvVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    setupGuideUrl: "https://developers.tiktok.com/apps/",
  };
}

function isAllowedSocialUrl(rawUrl: string, platform: SocialPlatformId): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return null;
    }

    const allowedHosts: Record<SocialPlatformId, string[]> = {
      shorts: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
      tiktok: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "m.tiktok.com"],
    };

    if (!allowedHosts[platform].includes(host)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

app.get("/api/social/oauth/:platform/url", (req, res) => {
  const platform = String(req.params.platform || "");
  if (!isSocialPlatform(platform)) {
    return res.status(400).json({ error: "Unsupported social platform" });
  }

  const cfg = getSocialOAuthConfig(platform);
  if (!cfg.clientId || !cfg.clientSecret) {
    return res.json({
      configured: false,
      platform,
      redirectUri: cfg.redirectUri,
      requiredEnvVars: cfg.requiredEnvVars,
      setupGuideUrl: cfg.setupGuideUrl,
    });
  }

  const state = signOAuthState(platform);
  let url = "";

  if (platform === "shorts") {
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  } else {
    const params = new URLSearchParams({
      client_key: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: "code",
      scope: "user.info.basic,user.info.stats",
      state,
    });
    url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  return res.json({
    configured: true,
    platform,
    url,
    redirectUri: cfg.redirectUri,
  });
});

async function handleSocialOAuthCallback(req: express.Request, res: express.Response) {
  const platform = String(req.params.platform || "");
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const oauthError = typeof req.query.error === "string" ? req.query.error : "";

  const sendPopupResult = (payload: Record<string, unknown>, isError = false) => {
    const serialized = JSON.stringify(payload).replace(/</g, "\\u003c");
    return res.status(isError ? 400 : 200).send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Social Account Connection</title></head>
  <body style="font-family:system-ui,sans-serif;background:#09090b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;">
    <div style="max-width:400px;text-align:center;">
      <p style="font-size:14px;">${isError ? "Could not connect social account. You may close this window." : "Account connected! Returning to ClipForge..."}</p>
    </div>
    <script>
      if (window.opener) {
        window.opener.postMessage(${serialized}, "*");
        window.close();
      } else {
        window.location.href = "/";
      }
    </script>
  </body>
</html>`);
  };

  if (!isSocialPlatform(platform)) {
    return sendPopupResult({ type: "SOCIAL_OAUTH_ERROR", error: "Unsupported platform" }, true);
  }
  if (oauthError) {
    return sendPopupResult({ type: "SOCIAL_OAUTH_ERROR", platform, error: oauthError }, true);
  }
  if (!code || !state || !verifyOAuthState(state, platform)) {
    return sendPopupResult(
      { type: "SOCIAL_OAUTH_ERROR", platform, error: "Invalid or expired OAuth state" },
      true
    );
  }

  const cfg = getSocialOAuthConfig(platform);
  if (!cfg.clientId || !cfg.clientSecret) {
    return sendPopupResult(
      { type: "SOCIAL_OAUTH_ERROR", platform, error: "OAuth credentials not configured" },
      true
    );
  }

  try {
    let profile: {
      handle: string;
      displayName: string;
      profileUrl: string;
      avatarUrl: string;
      followersCount: number;
      postsCount: number;
    } = {
      handle: "@creator",
      displayName: "Connected Creator",
      profileUrl: "",
      avatarUrl: "",
      followersCount: 0,
      postsCount: 0,
    };

    if (platform === "shorts") {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenJson: any = await tokenRes.json();
      if (!tokenRes.ok || !tokenJson.access_token) {
        throw new Error(tokenJson.error_description || "YouTube OAuth token exchange failed");
      }

      const chRes = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
        { headers: { Authorization: `Bearer ${tokenJson.access_token}` } }
      );
      const chJson: any = await chRes.json();
      const channel = chJson?.items?.[0];
      if (!channel) {
        throw new Error("No YouTube channel found on this Google account");
      }
      const customHandle = channel.snippet?.customUrl || `@${channel.snippet?.title || "youtube"}`;
      profile = {
        handle: customHandle.startsWith("@") ? customHandle : `@${customHandle}`,
        displayName: channel.snippet?.title || customHandle,
        profileUrl: `https://www.youtube.com/channel/${channel.id}`,
        avatarUrl: channel.snippet?.thumbnails?.default?.url || "",
        followersCount: Number(channel.statistics?.subscriberCount) || 0,
        postsCount: Number(channel.statistics?.videoCount) || 0,
      };
    } else {
      const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: cfg.clientId,
          client_secret: cfg.clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: cfg.redirectUri,
        }),
      });
      const tokenJson: any = await tokenRes.json();
      const accessToken = tokenJson?.access_token || tokenJson?.data?.access_token;
      if (!tokenRes.ok || !accessToken) {
        throw new Error(tokenJson?.error_description || "TikTok OAuth token exchange failed");
      }

      const userRes = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username,follower_count,video_count",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const userJson: any = await userRes.json();
      const u = userJson?.data?.user || {};
      const uname = u.username || u.display_name || "tiktok_creator";
      profile = {
        handle: uname.startsWith("@") ? uname : `@${uname}`,
        displayName: u.display_name || uname,
        profileUrl: u.username ? `https://www.tiktok.com/@${u.username}` : "https://www.tiktok.com/",
        avatarUrl: u.avatar_url || "",
        followersCount: Number(u.follower_count) || 0,
        postsCount: Number(u.video_count) || 0,
      };
    }

    const nowIso = new Date().toISOString();
    const existingAccounts = readSessionAccountsFromReq(req);
    const normalizedHandle = profile.handle.trim().toLowerCase();
    const existingMatch = existingAccounts.find(
      (a) => a.platform === platform && a.handle.trim().toLowerCase() === normalizedHandle
    );
    const accountId =
      existingMatch?.id || `oauth_${platform}_${crypto.randomBytes(6).toString("hex")}`;

    const upsertedAccount: SessionSocialAccountRecord = {
      id: accountId,
      userId: "oauth_session",
      platform,
      handle: profile.handle,
      displayName: profile.displayName,
      profileUrl: profile.profileUrl,
      avatarUrl: profile.avatarUrl,
      connectionType: "oauth",
      storageSource: "oauth_session",
      isDefault: true,
      followersCount: Number(profile.followersCount) || 0,
      postsCount: Number(profile.postsCount) || 0,
      notes: "Signed in via social OAuth",
      lastSyncedAt: nowIso,
      createdAt: existingMatch?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const updatedSessionAccounts: SessionSocialAccountRecord[] = [
      upsertedAccount,
      ...existingAccounts
        .filter((a) => a.id !== accountId)
        .map((a) =>
          a.platform === platform ? { ...a, isDefault: false, updatedAt: nowIso } : a
        ),
    ];

    writeSessionAccountsCookie(res, updatedSessionAccounts);

    return sendPopupResult({
      type: "SOCIAL_OAUTH_SUCCESS",
      platform,
      profile,
      account: upsertedAccount,
    });
  } catch (err: any) {
    console.error("Social OAuth callback error:", err);
    return sendPopupResult(
      {
        type: "SOCIAL_OAUTH_ERROR",
        platform,
        error: err?.message || "Failed to finish OAuth connection",
      },
      true
    );
  }
}

app.get(
  ["/api/social/oauth/:platform/callback", "/api/social/oauth/:platform/callback/"],
  handleSocialOAuthCallback
);

app.get("/api/social/session-accounts", (req, res) => {
  const accounts = readSessionAccountsFromReq(req);
  return res.json({ accounts });
});

app.post("/api/social/session-accounts/:id/default", (req, res) => {
  if (!isSameOriginMutationAllowed(req)) {
    return res.status(403).json({ error: "Forbidden CSRF check" });
  }
  const targetId = String(req.params.id || "").trim();
  const current = readSessionAccountsFromReq(req);
  const target = current.find((a) => a.id === targetId);
  if (!target) {
    return res.status(404).json({ error: "Session account not found" });
  }
  const nowIso = new Date().toISOString();
  const updated = current.map((a) =>
    a.platform === target.platform
      ? { ...a, isDefault: a.id === targetId, updatedAt: nowIso }
      : a
  );
  writeSessionAccountsCookie(res, updated);
  return res.json({ accounts: updated });
});

app.delete("/api/social/session-accounts/:id", (req, res) => {
  if (!isSameOriginMutationAllowed(req)) {
    return res.status(403).json({ error: "Forbidden CSRF check" });
  }
  const targetId = String(req.params.id || "").trim();
  const current = readSessionAccountsFromReq(req);
  const removed = current.find((a) => a.id === targetId);
  if (!removed) {
    return res.json({ accounts: current });
  }
  let updated = current.filter((a) => a.id !== targetId);
  if (removed.isDefault) {
    let promoted = false;
    updated = updated.map((a) => {
      if (!promoted && a.platform === removed.platform) {
        promoted = true;
        return { ...a, isDefault: true };
      }
      return a;
    });
  }
  writeSessionAccountsCookie(res, updated);
  return res.json({ accounts: updated });
});

app.patch("/api/social/session-accounts/:id", (req, res) => {
  if (!isSameOriginMutationAllowed(req)) {
    return res.status(403).json({ error: "Forbidden CSRF check" });
  }
  const targetId = String(req.params.id || "").trim();
  const current = readSessionAccountsFromReq(req);
  const idx = current.findIndex((a) => a.id === targetId);
  if (idx === -1) {
    return res.status(404).json({ error: "Session account not found" });
  }
  const existing = current[idx];
  const body = req.body || {};
  const nowIso = new Date().toISOString();
  const nextRecord: SessionSocialAccountRecord = {
    ...existing,
    displayName:
      typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim().slice(0, 120)
        : existing.displayName,
    avatarUrl:
      typeof body.avatarUrl === "string" ? body.avatarUrl.trim().slice(0, 500) : existing.avatarUrl,
    followersCount:
      typeof body.followersCount === "number"
        ? Math.max(0, Math.round(body.followersCount))
        : existing.followersCount,
    postsCount:
      typeof body.postsCount === "number"
        ? Math.max(0, Math.round(body.postsCount))
        : existing.postsCount,
    notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 300) : existing.notes,
    lastSyncedAt:
      typeof body.lastSyncedAt === "string" ? body.lastSyncedAt.slice(0, 64) : nowIso,
    updatedAt: nowIso,
  };
  const updated = current.map((a, i) => (i === idx ? nextRecord : a));
  writeSessionAccountsCookie(res, updated);
  return res.json({ accounts: updated });
});

app.post("/api/social/lookup-channel", async (req, res) => {
  try {
    const platform = String(req.body?.platform || "");
    const rawInput = String(req.body?.handleOrUrl || "").trim().slice(0, 240);

    if (!isSocialPlatform(platform)) {
      return res.status(400).json({ error: "Invalid social platform" });
    }
    if (!rawInput) {
      return res.status(400).json({ error: "Please enter a @handle or profile URL" });
    }

    const extractHandleFromInput = (input: string, p: SocialPlatformId): string => {
      if (/^https?:\/\//i.test(input)) {
        const parsed = isAllowedSocialUrl(input, p);
        if (!parsed) {
          throw new Error(`URL must be a valid ${p} domain link.`);
        }
        const segments = parsed.pathname.split("/").filter(Boolean);
        const rawSeg = segments[0] || "creator";
        return rawSeg.startsWith("@") ? rawSeg : `@${rawSeg.replace(/^@/, "")}`;
      }
      const clean = input.replace(/^@+/, "").replace(/[^a-zA-Z0-9._-]/g, "");
      if (!clean) {
        throw new Error("Handle contains no valid characters.");
      }
      return `@${clean}`;
    };

    const normalizedHandle = extractHandleFromInput(rawInput, platform);
    const bareHandle = normalizedHandle.replace(/^@/, "");

    const defaultProfileUrl =
      platform === "shorts"
        ? `https://www.youtube.com/@${bareHandle}`
        : `https://www.tiktok.com/@${bareHandle}`;

    const profileUrl = /^https?:\/\//i.test(rawInput)
      ? isAllowedSocialUrl(rawInput, platform)?.toString() || defaultProfileUrl
      : defaultProfileUrl;

    if (platform === "shorts") {
      try {
        const ytdlp = ensureYtdlpReady();
        const { stdout } = await execFileAsync(
          ytdlp,
          [
            "--dump-single-json",
            "--no-warnings",
            "--playlist-items",
            "0",
            profileUrl,
          ],
          { timeout: 15000, maxBuffer: 4 * 1024 * 1024 }
        );
        const info = JSON.parse(stdout || "{}");
        const bestAvatar =
          Array.isArray(info.thumbnails) && info.thumbnails.length > 0
            ? info.thumbnails[info.thumbnails.length - 1]?.url || ""
            : "";
        return res.json({
          success: true,
          verifiedFromSource: true,
          profile: {
            handle: info.uploader_id
              ? info.uploader_id.startsWith("@")
                ? info.uploader_id
                : `@${info.uploader_id}`
              : normalizedHandle,
            displayName: info.channel || info.uploader || info.title || bareHandle,
            profileUrl: info.channel_url || info.webpage_url || profileUrl,
            avatarUrl: typeof bestAvatar === "string" ? bestAvatar : "",
            followersCount: Number(info.channel_follower_count) || 0,
            postsCount: Number(info.playlist_count) || 0,
          },
        });
      } catch {
        // Fallback cleanly to normalized handle metadata when YouTube blocks cloud channel dump
      }
    }

    return res.json({
      success: true,
      verifiedFromSource: false,
      profile: {
        handle: normalizedHandle,
        displayName: bareHandle,
        profileUrl,
        avatarUrl: "",
        followersCount: 0,
        postsCount: 0,
      },
    });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "Invalid account input" });
  }
});

app.post("/api/social/lookup-post", async (req, res) => {
  try {
    const platform = String(req.body?.platform || "");
    const rawUrl = String(req.body?.postUrl || "").trim().slice(0, 500);
    if (!isSocialPlatform(platform)) {
      return res.status(400).json({ error: "Invalid platform" });
    }
    const parsedUrl = isAllowedSocialUrl(rawUrl, platform);
    if (!parsedUrl) {
      return res.status(400).json({ error: "Please enter a valid YouTube or TikTok URL." });
    }

    const ytdlp = ensureYtdlpReady();
    const { stdout } = await execFileAsync(
      ytdlp,
      ["--dump-single-json", "--skip-download", "--no-warnings", parsedUrl.toString()],
      { timeout: 15000, maxBuffer: 4 * 1024 * 1024 }
    );
    const info = JSON.parse(stdout || "{}");
    return res.json({
      success: true,
      metrics: {
        title: typeof info.title === "string" ? info.title : "",
        views: Math.max(0, Math.round(Number(info.view_count) || 0)),
        likes: Math.max(0, Math.round(Number(info.like_count) || 0)),
        comments: Math.max(0, Math.round(Number(info.comment_count) || 0)),
        shares: Math.max(0, Math.round(Number(info.repost_count) || 0)),
      },
    });
  } catch (err: any) {
    return res.status(422).json({
      error:
        "Could not auto-fetch live post counts from that URL (platform may require OAuth or manual entry).",
    });
  }
});

// Ensure unmatched /api/* routes ALWAYS return JSON (never fall through to Vite/SPA HTML)
app.use("/api", (req, res) => {
  return res.status(404).json({
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    code: "API_NOT_FOUND",
  });
});

// Express JSON error middleware (handles multer, express.json, or unhandled route errors)
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (res.headersSent) return next(err);
    const isLimitErr = err?.code === "LIMIT_FILE_SIZE" || err?.type === "entity.too.large";
    const status = isLimitErr
      ? 413
      : Number(err?.status || err?.statusCode) || 500;
    const message = isLimitErr
      ? "Uploaded video or payload exceeds the server limit."
      : err?.message || "Internal server error";
    if (req.originalUrl.startsWith("/api")) {
      return res.status(status).json({
        error: message,
        code: err?.code || "SERVER_ERROR",
      });
    }
    return res.status(status).send(message);
  }
);

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ClipForge server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
