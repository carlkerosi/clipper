import { CaptionChunk, CaptionPreset, FramingMode } from '../types';

export interface RenderFrameOptions {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  videoElement: HTMLVideoElement | null;
  currentTimeInClip: number; // in seconds, relative to clip start
  clipDuration: number;
  captions: CaptionChunk[];
  captionPreset: CaptionPreset;
  captionPosition: 'top' | 'middle' | 'lower_third' | 'bottom';
  captionFontSize: number;
  captionColor: string;
  framingMode: FramingMode;
  panX: number; // -100 to 100
  showHookBanner: boolean;
  hookBannerText?: string;
  showProgressBar: boolean;
  progressBarColor?: string;
  showSafeZones?: boolean;
  overlayOnly?: boolean;
}

export function drawVerticalFrame(options: RenderFrameOptions) {
  const {
    ctx,
    canvasWidth,
    canvasHeight,
    videoElement,
    currentTimeInClip,
    clipDuration,
    captions,
    captionPreset,
    captionPosition,
    captionFontSize,
    captionColor,
    framingMode,
    panX,
    showHookBanner,
    hookBannerText,
    showProgressBar,
    progressBarColor = '#EF4444',
    showSafeZones = false,
    overlayOnly = false,
  } = options;

  if (overlayOnly) {
    // Transparent overlay for native video preview
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  } else {
    // Clear canvas with dark background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (videoElement && videoElement.readyState >= 2) {
      const vWidth = videoElement.videoWidth || 1920;
      const vHeight = videoElement.videoHeight || 1080;

      if (framingMode === 'smart_crop') {
        // 9:16 target crop from source
        const targetAspect = canvasWidth / canvasHeight;
        let cropWidth = vHeight * targetAspect;
        let cropHeight = vHeight;

        if (cropWidth > vWidth) {
          cropWidth = vWidth;
          cropHeight = vWidth / targetAspect;
        }

        const maxOffsetX = (vWidth - cropWidth) / 2;
        const offsetX = maxOffsetX + (panX / 100) * maxOffsetX;
        const cropX = Math.max(0, Math.min(vWidth - cropWidth, offsetX));
        const cropY = (vHeight - cropHeight) / 2;

        ctx.drawImage(
          videoElement,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          canvasWidth,
          canvasHeight
        );
      } else if (framingMode === 'blur_fit') {
        ctx.save();
        ctx.filter = 'blur(28px) brightness(0.4)';
        ctx.drawImage(videoElement, -canvasWidth * 0.2, -canvasHeight * 0.1, canvasWidth * 1.4, canvasHeight * 1.2);
        ctx.restore();

        const targetW = canvasWidth;
        const targetH = (canvasWidth / vWidth) * vHeight;
        const targetY = (canvasHeight - targetH) / 2;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 30;
        ctx.drawImage(videoElement, 0, targetY, targetW, targetH);
        ctx.restore();
      } else if (framingMode === 'split_screen') {
        const topHeight = canvasHeight * 0.52;
        const topAspect = canvasWidth / topHeight;
        const cropW = Math.min(vWidth, vHeight * topAspect);
        const cropH = cropW / topAspect;
        const maxOffX = (vWidth - cropW) / 2;
        const cropX = Math.max(0, Math.min(vWidth - cropW, maxOffX + (panX / 100) * maxOffX));
        const cropY = (vHeight - cropH) / 2;

        ctx.drawImage(videoElement, cropX, cropY, cropW, cropH, 0, 0, canvasWidth, topHeight);

        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(0, topHeight - 3, canvasWidth, 6);

        const bottomHeight = canvasHeight - topHeight;
        drawSatisfyingBottomCanvas(ctx, 0, topHeight, canvasWidth, bottomHeight, currentTimeInClip);
      } else {
        const targetW = canvasWidth;
        const targetH = (canvasWidth / vWidth) * vHeight;
        const targetY = (canvasHeight - targetH) / 2;
        ctx.drawImage(videoElement, 0, targetY, targetW, targetH);
      }
    } else {
      drawFallbackStudioBackground(ctx, canvasWidth, canvasHeight, currentTimeInClip);
    }
  }

  // Draw Top Hook Banner if enabled
  if (showHookBanner && hookBannerText) {
    drawHookBanner(ctx, canvasWidth, canvasHeight, hookBannerText);
  }

  // Draw Animated Captions
  drawCaptions(
    ctx,
    canvasWidth,
    canvasHeight,
    currentTimeInClip,
    captions,
    captionPreset,
    captionPosition,
    captionFontSize,
    captionColor
  );

  // Draw Progress Bar at bottom
  if (showProgressBar && clipDuration > 0) {
    const progress = Math.max(0, Math.min(1, currentTimeInClip / clipDuration));
    const barHeight = 8;
    const barY = canvasHeight - barHeight;

    // Background track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(0, barY, canvasWidth, barHeight);

    // Progress
    ctx.fillStyle = progressBarColor;
    ctx.fillRect(0, barY, canvasWidth * progress, barHeight);
  }

  // Draw TikTok Safe Zones if requested
  if (showSafeZones) {
    drawTikTokSafeZones(ctx, canvasWidth, canvasHeight);
  }
}

// Draw dynamic satisfying bottom half for split-screen format
function drawSatisfyingBottomCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Dark animated gradient background
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1e1b4b');
  grad.addColorStop(1, '#090d16');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Animated particle / geometric satisfying kinetic waves
  const waveCount = 5;
  for (let i = 0; i < waveCount; i++) {
    ctx.beginPath();
    const speed = (i + 1) * 0.8;
    const waveY = y + h * 0.5 + Math.sin(time * speed + i) * (h * 0.25);
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 4 + i * 2;
    ctx.moveTo(x, waveY);

    for (let px = 0; px <= w; px += 20) {
      const cy = waveY + Math.sin((px * 0.015) + (time * 2) + i) * 35;
      ctx.lineTo(x + px, cy);
    }
    ctx.stroke();
  }

  // Satisfying bouncing 3D sphere
  const sphereX = x + w * 0.5 + Math.sin(time * 2.2) * (w * 0.3);
  const sphereY = y + h * 0.5 + Math.cos(time * 1.8) * (h * 0.25);
  const radius = 32 + Math.sin(time * 4) * 6;

  const sphereGrad = ctx.createRadialGradient(
    sphereX - 10,
    sphereY - 10,
    4,
    sphereX,
    sphereY,
    radius
  );
  sphereGrad.addColorStop(0, '#FDE047');
  sphereGrad.addColorStop(0.7, '#EAB308');
  sphereGrad.addColorStop(1, '#CA8A04');

  ctx.fillStyle = sphereGrad;
  ctx.shadowColor = '#FDE047';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(sphereX, sphereY, radius, 0, Math.PI * 2);
  ctx.fill();

  // Floating gameplay label
  ctx.shadowBlur = 0;
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'center';
  ctx.fillText('SATISFYING RETENTION LOOP', x + w / 2, y + h - 20);

  ctx.restore();
}

function drawFallbackStudioBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number
) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1e1b4b');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Audio waveform pulse simulation
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const centerY = h / 2;
  for (let x = 0; x < w; x += 15) {
    const barHeight = Math.sin((x * 0.05) + (time * 4)) * 40 * Math.sin(time * 2);
    ctx.moveTo(x, centerY - barHeight);
    ctx.lineTo(x, centerY + barHeight);
  }
  ctx.stroke();
}

// Draw Top Hook Banner sticker (like viral TikTok/Reels questions)
function drawHookBanner(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string
) {
  ctx.save();
  const bannerY = h * 0.12;
  const paddingX = 24;
  const paddingY = 14;

  ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textMetrics = ctx.measureText(text);
  const boxWidth = Math.min(w * 0.9, textMetrics.width + paddingX * 2);
  const boxHeight = 56;
  const boxX = (w - boxWidth) / 2;
  const boxY = bannerY - boxHeight / 2;

  // Background rounded box
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 16;

  roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 14);
  ctx.fill();
  ctx.stroke();

  // Text
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, w / 2, bannerY);

  ctx.restore();
}

// Draw Animated TikTok/MrBeast captions
function drawCaptions(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  currentTime: number,
  captions: CaptionChunk[],
  preset: CaptionPreset,
  position: 'top' | 'middle' | 'lower_third' | 'bottom',
  fontSize: number,
  primaryColor: string
) {
  // Find caption chunk that is currently active
  const activeChunk = captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end
  );

  if (!activeChunk) return;

  ctx.save();

  // Determine Y position
  let posY = h * 0.72; // default lower third
  if (position === 'top') posY = h * 0.25;
  if (position === 'middle') posY = h * 0.50;
  if (position === 'bottom') posY = h * 0.84;

  const words = activeChunk.words && activeChunk.words.length > 0
    ? activeChunk.words
    : activeChunk.text.split(' ').map((word, idx, arr) => {
        const segDuration = (activeChunk.end - activeChunk.start) / Math.max(1, arr.length);
        return {
          w: word,
          start: activeChunk.start + idx * segDuration,
          end: activeChunk.start + (idx + 1) * segDuration,
        };
      });

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  if (preset === 'hormozi') {
    // Hormozi / MrBeast Style: Heavy uppercase bold, black stroke, bouncy highlighted current word
    const baseFontSize = fontSize * 1.15;
    ctx.font = `900 ${baseFontSize}px "Montserrat", "Plus Jakarta Sans", sans-serif`;

    // Measure total line width
    let totalWidth = 0;
    const wordWidths = words.map((token) => {
      const width = ctx.measureText(token.w.toUpperCase() + ' ').width;
      totalWidth += width;
      return width;
    });

    let currentX = (w - totalWidth) / 2;

    words.forEach((token, idx) => {
      const isWordActive = currentTime >= token.start && currentTime <= token.end;
      const isEmphasis =
        activeChunk.emphasisWord &&
        token.w.toUpperCase().includes(activeChunk.emphasisWord.toUpperCase());

      const wordStr = token.w.toUpperCase();
      const wordW = wordWidths[idx];
      const wordCenterX = currentX + wordW / 2;

      ctx.save();

      if (isWordActive) {
        // Bouncy scale for active word
        const scale = 1.12;
        ctx.translate(wordCenterX, posY);
        ctx.scale(scale, scale);
        ctx.translate(-wordCenterX, -posY);

        // Stroke
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#000000';
        ctx.lineJoin = 'miter';
        ctx.miterLimit = 2;
        ctx.strokeText(wordStr, wordCenterX, posY);

        // Active fill
        ctx.fillStyle = primaryColor || '#FACC15'; // Yellow
        ctx.fillText(wordStr, wordCenterX, posY);
      } else {
        // Normal word
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#000000';
        ctx.lineJoin = 'miter';
        ctx.miterLimit = 2;
        ctx.strokeText(wordStr, wordCenterX, posY);

        ctx.fillStyle = isEmphasis ? primaryColor : '#FFFFFF';
        ctx.fillText(wordStr, wordCenterX, posY);
      }

      ctx.restore();
      currentX += wordW;
    });
  } else if (preset === 'tiktok_neon') {
    // TikTok Neon Pill: Sleek translucent box with neon text
    ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    const fullText = activeChunk.text.toUpperCase();
    const textWidth = ctx.measureText(fullText).width;

    const padX = 20;
    const padY = 12;
    const boxW = textWidth + padX * 2;
    const boxH = fontSize + padY * 2;
    const boxX = (w - boxW) / 2;
    const boxY = posY - boxH / 2;

    // Glowing pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 18;
    roundRect(ctx, boxX, boxY, boxW, boxH, 12);
    ctx.fill();
    ctx.stroke();

    // Text with neon cyan fill
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(fullText, w / 2, posY);
  } else if (preset === 'beast_flame') {
    // Fiery beast style
    ctx.font = `900 ${fontSize * 1.1}px "Montserrat", sans-serif`;
    const fullText = `🔥 ${activeChunk.text.toUpperCase()} 🔥`;
    
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(fullText, w / 2, posY);

    // Red to amber gradient
    const grad = ctx.createLinearGradient(0, posY - fontSize, 0, posY + fontSize);
    grad.addColorStop(0, '#EF4444');
    grad.addColorStop(1, '#F59E0B');
    ctx.fillStyle = grad;
    ctx.fillText(fullText, w / 2, posY);
  } else if (preset === 'karaoke_fill') {
    // Karaoke gradient
    ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    const fullText = activeChunk.text;
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(fullText, w / 2, posY);

    ctx.fillStyle = '#F59E0B';
    ctx.fillText(fullText, w / 2, posY);
  } else {
    // minimal_cinema
    ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    const fullText = activeChunk.text;
    const textW = ctx.measureText(fullText).width;

    // Subtle dark backdrop
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, (w - textW) / 2 - 12, posY - fontSize / 2 - 6, textW + 24, fontSize + 12, 6);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(fullText, w / 2, posY);
  }

  ctx.restore();
}

// Safe zone guidelines for TikTok / Reels creators
function drawTikTokSafeZones(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;

  // Right side interaction buttons safe zone (profile, like, comment, bookmark, share)
  const rightMargin = w * 0.18;
  ctx.strokeRect(w - rightMargin, h * 0.2, rightMargin, h * 0.55);

  // Bottom account & caption safe zone
  const bottomMargin = h * 0.22;
  ctx.strokeRect(0, h - bottomMargin, w, bottomMargin);

  // Top header safe zone
  const topMargin = h * 0.12;
  ctx.strokeRect(0, 0, w, topMargin);

  // Label
  ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
  ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('TIKTOK SAFE ZONE (UI OVERLAY)', w - 16, topMargin - 8);

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
