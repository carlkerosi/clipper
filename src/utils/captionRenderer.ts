import {
  CaptionChunk,
  CaptionPreset,
  CaptionHighlightStyle,
  CaptionFontFamily,
  CaptionTextCase,
  FramingMode,
  CaptionEntranceAnimation,
  CaptionExitAnimation,
} from '../types';

export interface RenderFrameOptions {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  videoElement: HTMLVideoElement | null;
  currentTimeInClip: number; // in seconds, relative to clip start
  clipDuration: number;
  captions: CaptionChunk[];
  captionPreset: CaptionPreset;
  captionHighlightStyle?: CaptionHighlightStyle;
  captionPosition: 'top' | 'middle' | 'lower_third' | 'bottom';
  captionFontSize: number;
  captionColor: string;
  captionBaseColor?: string;
  captionFontFamily?: CaptionFontFamily;
  captionTextCase?: CaptionTextCase;
  captionOutlineWidth?: number;
  captionWordsPerLine?: 'single_line' | 'multi_line';
  captionDropShadow?: boolean;
  captionEntranceAnim?: CaptionEntranceAnimation;
  captionExitAnim?: CaptionExitAnimation;
  framingMode: FramingMode;
  panX: number; // -100 to 100
  showHookBanner: boolean;
  hookBannerText?: string;
  showProgressBar: boolean;
  progressBarColor?: string;
  showSafeZones?: boolean;
  overlayOnly?: boolean;
  videoFilterCss?: string;
}

export function formatCaptionCase(text: string, textCase: CaptionTextCase = 'uppercase'): string {
  if (textCase === 'uppercase') return text.toUpperCase();
  if (textCase === 'titlecase') {
    return text.replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return text;
}

function getBoxTextContrastColor(bgHex: string): string {
  const clean = bgHex.replace('#', '');
  if (clean.length !== 6) return '#09090B';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#09090B' : '#FFFFFF';
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
    captionHighlightStyle,
    captionPosition,
    captionFontSize,
    captionColor,
    captionBaseColor = '#FFFFFF',
    captionFontFamily = 'Montserrat',
    captionTextCase = 'uppercase',
    captionOutlineWidth = 6,
    captionWordsPerLine = 'multi_line',
    captionDropShadow = true,
    captionEntranceAnim = 'pop',
    captionExitAnim = 'fade',
    framingMode,
    panX,
    showHookBanner,
    hookBannerText,
    showProgressBar,
    progressBarColor = '#EF4444',
    showSafeZones = false,
    overlayOnly = false,
    videoFilterCss = 'none',
  } = options;

  if (overlayOnly) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  } else {
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (videoElement && videoElement.readyState >= 2) {
      const vWidth = videoElement.videoWidth || 1920;
      const vHeight = videoElement.videoHeight || 1080;
      const activeFilter = videoFilterCss && videoFilterCss !== 'none' ? videoFilterCss : 'none';

      if (framingMode === 'smart_crop') {
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

        ctx.save();
        ctx.filter = activeFilter;
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
        ctx.restore();
      } else if (framingMode === 'blur_fit') {
        ctx.save();
        ctx.filter = activeFilter === 'none'
          ? 'blur(28px) brightness(0.4)'
          : `blur(28px) brightness(0.4) ${activeFilter}`;
        ctx.drawImage(videoElement, -canvasWidth * 0.2, -canvasHeight * 0.1, canvasWidth * 1.4, canvasHeight * 1.2);
        ctx.restore();

        const targetW = canvasWidth;
        const targetH = (canvasWidth / vWidth) * vHeight;
        const targetY = (canvasHeight - targetH) / 2;

        ctx.save();
        ctx.filter = activeFilter;
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

        ctx.save();
        ctx.filter = activeFilter;
        ctx.drawImage(videoElement, cropX, cropY, cropW, cropH, 0, 0, canvasWidth, topHeight);
        ctx.restore();

        ctx.fillStyle = '#22C55E';
        ctx.fillRect(0, topHeight - 3, canvasWidth, 6);

        const bottomHeight = canvasHeight - topHeight;
        drawSatisfyingBottomCanvas(ctx, 0, topHeight, canvasWidth, bottomHeight, currentTimeInClip);
      } else {
        const targetW = canvasWidth;
        const targetH = (canvasWidth / vWidth) * vHeight;
        const targetY = (canvasHeight - targetH) / 2;
        ctx.save();
        ctx.filter = activeFilter;
        ctx.drawImage(videoElement, 0, targetY, targetW, targetH);
        ctx.restore();
      }
    } else {
      drawFallbackStudioBackground(ctx, canvasWidth, canvasHeight, currentTimeInClip);
    }
  }

  if (showHookBanner && hookBannerText) {
    drawHookBanner(ctx, canvasWidth, canvasHeight, hookBannerText);
  }

  drawCaptions({
    ctx,
    w: canvasWidth,
    h: canvasHeight,
    currentTime: currentTimeInClip,
    captions,
    preset: captionPreset,
    highlightStyle: captionHighlightStyle,
    position: captionPosition,
    fontSize: captionFontSize,
    primaryColor: captionColor,
    baseColor: captionBaseColor,
    fontFamily: captionFontFamily,
    textCase: captionTextCase,
    outlineWidth: captionOutlineWidth,
    wordsPerLine: captionWordsPerLine,
    dropShadow: captionDropShadow,
    entranceAnimation: captionEntranceAnim,
    exitAnimation: captionExitAnim,
  });

  if (showProgressBar && clipDuration > 0) {
    const progress = Math.max(0, Math.min(1, currentTimeInClip / clipDuration));
    const barHeight = 8;
    const barY = canvasHeight - barHeight;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(0, barY, canvasWidth, barHeight);

    ctx.fillStyle = progressBarColor;
    ctx.fillRect(0, barY, canvasWidth * progress, barHeight);
  }

  if (showSafeZones) {
    drawTikTokSafeZones(ctx, canvasWidth, canvasHeight);
  }
}

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

  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1e1b4b');
  grad.addColorStop(1, '#090d16');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  const waveCount = 5;
  for (let i = 0; i < waveCount; i++) {
    ctx.beginPath();
    const speed = (i + 1) * 0.8;
    const waveY = y + h * 0.5 + Math.sin(time * speed + i) * (h * 0.25);
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(34, 197, 94, 0.35)' : 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 4 + i * 2;
    ctx.moveTo(x, waveY);

    for (let px = 0; px <= w; px += 20) {
      const cy = waveY + Math.sin(px * 0.015 + time * 2 + i) * 35;
      ctx.lineTo(x + px, cy);
    }
    ctx.stroke();
  }

  const sphereX = x + w * 0.5 + Math.sin(time * 2.2) * (w * 0.3);
  const sphereY = y + h * 0.5 + Math.cos(time * 1.8) * (h * 0.25);
  const radius = 32 + Math.sin(time * 4) * 6;

  const sphereGrad = ctx.createRadialGradient(sphereX - 10, sphereY - 10, 4, sphereX, sphereY, radius);
  sphereGrad.addColorStop(0, '#4ADE80');
  sphereGrad.addColorStop(0.7, '#22C55E');
  sphereGrad.addColorStop(1, '#15803D');

  ctx.fillStyle = sphereGrad;
  ctx.shadowColor = '#22C55E';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(sphereX, sphereY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'center';
  ctx.fillText('SATISFYING RETENTION LOOP', x + w / 2, y + h - 20);

  ctx.restore();
}

function drawFallbackStudioBackground(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#09090b');
  grad.addColorStop(0.5, '#18181b');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const centerY = h / 2;
  for (let x = 0; x < w; x += 15) {
    const barHeight = Math.sin(x * 0.05 + time * 4) * 40 * Math.sin(time * 2);
    ctx.moveTo(x, centerY - barHeight);
    ctx.lineTo(x, centerY + barHeight);
  }
  ctx.stroke();
}

function drawHookBanner(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  ctx.save();
  const bannerY = h * 0.12;
  const paddingX = 24;

  ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textMetrics = ctx.measureText(text);
  const boxWidth = Math.min(w * 0.88, textMetrics.width + paddingX * 2);
  const boxHeight = 52;
  const boxX = (w - boxWidth) / 2;
  const boxY = bannerY - boxHeight / 2;

  ctx.fillStyle = 'rgba(9, 9, 11, 0.92)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 16;

  roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 12);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, w / 2, bannerY, boxWidth - 20);

  ctx.restore();
}

interface DrawCaptionsArgs {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  currentTime: number;
  captions: CaptionChunk[];
  preset: CaptionPreset;
  highlightStyle?: CaptionHighlightStyle;
  position: 'top' | 'middle' | 'lower_third' | 'bottom';
  fontSize: number;
  primaryColor: string;
  baseColor: string;
  fontFamily: CaptionFontFamily;
  textCase: CaptionTextCase;
  outlineWidth: number;
  wordsPerLine: 'single_line' | 'multi_line';
  dropShadow: boolean;
  entranceAnimation: CaptionEntranceAnimation;
  exitAnimation: CaptionExitAnimation;
}

function resolveDefaultHighlightStyle(preset: CaptionPreset, explicit?: CaptionHighlightStyle): CaptionHighlightStyle {
  if (explicit) return explicit;
  if (preset === 'opus_box') return 'active_box';
  if (preset === 'karaoke_fill') return 'dual_tone';
  if (preset === 'minimal_cinema') return 'none';
  return 'text_color';
}

function drawCaptions(args: DrawCaptionsArgs) {
  const {
    ctx,
    w,
    h,
    currentTime,
    captions,
    preset,
    highlightStyle: explicitHighlight,
    position,
    fontSize,
    primaryColor,
    baseColor,
    fontFamily,
    textCase,
    outlineWidth,
    wordsPerLine,
    dropShadow,
    entranceAnimation,
    exitAnimation,
  } = args;

  const activeChunk = captions.find((c) => currentTime >= c.start && currentTime <= c.end);
  if (!activeChunk) return;

  ctx.save();

  let posY = h * 0.72;
  if (position === 'top') posY = h * 0.24;
  if (position === 'middle') posY = h * 0.50;
  if (position === 'bottom') posY = h * 0.84;

  // Kinetic Entrance & Exit Calculations
  const entranceDuration = 0.24;
  const exitDuration = 0.18;
  const timeSinceStart = currentTime - activeChunk.start;
  const timeUntilEnd = activeChunk.end - currentTime;

  let animScale = 1;
  let animOffsetY = 0;
  let animAlpha = 1;
  let animGlowBlur = 0;

  if (timeSinceStart < entranceDuration) {
    const p = Math.max(0, Math.min(1, timeSinceStart / entranceDuration));
    if (entranceAnimation === 'pop') {
      animScale = p < 0.65 ? 0.4 + (p / 0.65) * 0.75 : 1.15 - ((p - 0.65) / 0.35) * 0.15;
      animOffsetY = (1 - p) * 12;
      animAlpha = Math.min(1, p * 1.8);
    } else if (entranceAnimation === 'slide_up') {
      const ease = 1 - Math.pow(1 - p, 3);
      animOffsetY = (1 - ease) * 32;
      animAlpha = ease;
    } else if (entranceAnimation === 'slide_down') {
      const ease = 1 - Math.pow(1 - p, 3);
      animOffsetY = -(1 - ease) * 32;
      animAlpha = ease;
    } else if (entranceAnimation === 'fade') {
      animAlpha = p;
    } else if (entranceAnimation === 'bounce') {
      const bounceOffset = Math.sin(p * Math.PI * 2.2) * (1 - p) * 22;
      animOffsetY = -bounceOffset;
      animScale = 0.85 + p * 0.15;
      animAlpha = Math.min(1, p * 2);
    } else if (entranceAnimation === 'zoom_in') {
      const ease = 1 - Math.pow(1 - p, 3);
      animScale = 0.25 + ease * 0.75;
      animAlpha = ease;
    } else if (entranceAnimation === 'glow_burst') {
      const ease = 1 - Math.pow(1 - p, 3);
      animScale = 0.85 + ease * 0.15;
      animGlowBlur = (1 - p) * 24;
      animAlpha = Math.min(1, p * 2);
    }
  }

  if (timeUntilEnd < exitDuration && exitAnimation !== 'none') {
    const p = Math.max(0, Math.min(1, (exitDuration - timeUntilEnd) / exitDuration));
    if (exitAnimation === 'fade') {
      animAlpha *= 1 - p;
    } else if (exitAnimation === 'slide_down') {
      animOffsetY += p * 30;
      animAlpha *= 1 - p;
    } else if (exitAnimation === 'slide_up') {
      animOffsetY -= p * 30;
      animAlpha *= 1 - p;
    } else if (exitAnimation === 'shrink') {
      animScale *= Math.max(0.05, 1 - p * 0.9);
      animAlpha *= 1 - p;
    } else if (exitAnimation === 'pop_out') {
      animScale *= 1 + p * 0.22;
      animAlpha *= 1 - p;
    }
  }

  ctx.globalAlpha = Math.max(0, Math.min(1, animAlpha));
  if (animGlowBlur > 0) {
    ctx.shadowColor = primaryColor || '#22C55E';
    ctx.shadowBlur = animGlowBlur;
  }

  if (animScale !== 1 || animOffsetY !== 0) {
    ctx.translate(w / 2, posY + animOffsetY);
    ctx.scale(animScale, animScale);
    ctx.translate(-w / 2, -(posY + animOffsetY));
  }

  const rawWords =
    activeChunk.words && activeChunk.words.length > 0
      ? activeChunk.words
      : activeChunk.text
          .split(/\s+/)
          .filter(Boolean)
          .map((word, idx, arr) => {
            const segDuration = (activeChunk.end - activeChunk.start) / Math.max(1, arr.length);
            return {
              w: word,
              start: activeChunk.start + idx * segDuration,
              end: activeChunk.start + (idx + 1) * segDuration,
            };
          });

  const highlightStyle = resolveDefaultHighlightStyle(preset, explicitHighlight);
  const weight = preset === 'minimal_cinema' ? 700 : 900;
  const effectiveFontSize = preset === 'hormozi' ? fontSize * 1.1 : fontSize;
  const fontStack = `"${fontFamily}", "Montserrat", "Plus Jakarta Sans", sans-serif`;
  ctx.font = `${weight} ${effectiveFontSize}px ${fontStack}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Measure and wrap tokens into lines cleanly so nothing overflows canvas edges
  const maxLineWidth = w * 0.86;
  const wordGap = Math.max(10, Math.round(effectiveFontSize * 0.34));
  const lines: Array<{ tokens: Array<{ token: typeof rawWords[number]; label: string; width: number }>; lineWidth: number }> = [];

  let currentTokens: Array<{ token: typeof rawWords[number]; label: string; width: number }> = [];
  let currentWidth = 0;

  rawWords.forEach((token) => {
    const label = formatCaptionCase(token.w, textCase);
    const width = ctx.measureText(label).width;
    const nextWidth = currentTokens.length === 0 ? width : currentWidth + wordGap + width;

    if (
      wordsPerLine === 'multi_line' &&
      currentTokens.length > 0 &&
      (nextWidth > maxLineWidth || currentTokens.length >= 4)
    ) {
      lines.push({ tokens: currentTokens, lineWidth: currentWidth });
      currentTokens = [{ token, label, width }];
      currentWidth = width;
    } else {
      currentTokens.push({ token, label, width });
      currentWidth = nextWidth;
    }
  });
  if (currentTokens.length > 0) {
    lines.push({ tokens: currentTokens, lineWidth: currentWidth });
  }

  const lineHeight = effectiveFontSize * 1.32;
  const totalBlockHeight = lines.length * lineHeight;
  const startY = posY - totalBlockHeight / 2 + lineHeight / 2;

  // Optional outer backdrop for minimal_cinema or tiktok_neon
  if (preset === 'minimal_cinema' || preset === 'tiktok_neon') {
    const maxW = Math.max(...lines.map((l) => l.lineWidth), 80);
    const padX = 24;
    const padY = 14;
    const boxW = Math.min(w * 0.92, maxW + padX * 2);
    const boxH = totalBlockHeight + padY * 2;
    const boxX = (w - boxW) / 2;
    const boxY = posY - boxH / 2;

    ctx.save();
    if (preset === 'tiktok_neon') {
      ctx.fillStyle = 'rgba(9, 9, 11, 0.82)';
      ctx.strokeStyle = primaryColor || '#06B6D4';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = primaryColor || '#06B6D4';
      ctx.shadowBlur = 18;
      roundRect(ctx, boxX, boxY, boxW, boxH, 14);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
      roundRect(ctx, boxX, boxY, boxW, boxH, 10);
      ctx.fill();
    }
    ctx.restore();
  }

  lines.forEach((line, lineIdx) => {
    const lineY = startY + lineIdx * lineHeight;
    let cursorX = (w - line.lineWidth) / 2;

    line.tokens.forEach(({ token, label, width }) => {
      const wordCenterX = cursorX + width / 2;
      const isWordActive = currentTime >= token.start && currentTime <= token.end;
      const isWordSpoken = currentTime >= token.start;
      const isEmphasis =
        Boolean(activeChunk.emphasisWord) &&
        token.w.toUpperCase().includes(activeChunk.emphasisWord!.toUpperCase());

      ctx.save();

      if (dropShadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;
      }

      if (isWordActive && highlightStyle !== 'none') {
        if (highlightStyle === 'active_box') {
          const padX = Math.max(10, effectiveFontSize * 0.24);
          const padY = Math.max(6, effectiveFontSize * 0.16);
          ctx.save();
          ctx.fillStyle = primaryColor || '#22C55E';
          ctx.shadowColor = primaryColor || '#22C55E';
          ctx.shadowBlur = 14;
          ctx.shadowOffsetY = 0;
          roundRect(
            ctx,
            wordCenterX - width / 2 - padX,
            lineY - effectiveFontSize / 2 - padY,
            width + padX * 2,
            effectiveFontSize + padY * 2,
            10
          );
          ctx.fill();
          ctx.restore();

          const contrastFill = getBoxTextContrastColor(primaryColor || '#22C55E');
          if (outlineWidth > 0 && contrastFill === '#FFFFFF') {
            ctx.lineWidth = Math.max(2, outlineWidth * 0.6);
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineJoin = 'round';
            ctx.strokeText(label, wordCenterX, lineY);
          }
          ctx.fillStyle = contrastFill;
          ctx.fillText(label, wordCenterX, lineY);
          ctx.restore();
          cursorX += width + wordGap;
          return;
        }

        if (highlightStyle === 'text_color' || highlightStyle === 'dual_tone') {
          const scale = highlightStyle === 'text_color' ? 1.1 : 1.04;
          ctx.translate(wordCenterX, lineY);
          ctx.scale(scale, scale);
          ctx.translate(-wordCenterX, -lineY);
        } else if (highlightStyle === 'underline_glow') {
          ctx.save();
          ctx.fillStyle = primaryColor || '#22C55E';
          ctx.shadowColor = primaryColor || '#22C55E';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 0;
          roundRect(
            ctx,
            wordCenterX - width / 2 - 4,
            lineY + effectiveFontSize * 0.56,
            width + 8,
            Math.max(4, effectiveFontSize * 0.14),
            3
          );
          ctx.fill();
          ctx.restore();
        }
      }

      if (outlineWidth > 0 && preset !== 'minimal_cinema') {
        ctx.lineWidth = Math.max(2, outlineWidth * 1.4);
        ctx.strokeStyle = '#000000';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(label, wordCenterX, lineY);
      }

      if (preset === 'beast_flame' && (isWordActive || isEmphasis)) {
        const grad = ctx.createLinearGradient(0, lineY - effectiveFontSize / 2, 0, lineY + effectiveFontSize / 2);
        grad.addColorStop(0, '#EF4444');
        grad.addColorStop(1, '#FACC15');
        ctx.fillStyle = grad;
      } else if (highlightStyle === 'dual_tone') {
        ctx.fillStyle = isWordSpoken ? primaryColor : baseColor;
      } else if (isWordActive && highlightStyle !== 'none') {
        ctx.fillStyle = primaryColor;
      } else if (isEmphasis && highlightStyle !== 'none') {
        ctx.fillStyle = primaryColor;
      } else {
        ctx.fillStyle = baseColor || '#FFFFFF';
      }

      ctx.fillText(label, wordCenterX, lineY);
      ctx.restore();

      cursorX += width + wordGap;
    });
  });

  ctx.restore();
}

function drawTikTokSafeZones(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;

  const rightMargin = w * 0.18;
  ctx.strokeRect(w - rightMargin, h * 0.2, rightMargin, h * 0.55);

  const bottomMargin = h * 0.22;
  ctx.strokeRect(0, h - bottomMargin, w, bottomMargin);

  const topMargin = h * 0.12;
  ctx.strokeRect(0, 0, w, topMargin);

  ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
  ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('TIKTOK SAFE ZONE (UI OVERLAY)', w - 16, topMargin - 8);

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
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
