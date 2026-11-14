import { GuideBarConfig, GuideBarId, PatternData, PatternRow, RackTensionRow } from '../types';
import { GuideBarCalculationResult } from './fabricCalculator';
import {
  ALL_GB_IDS,
  buildFinalFourStepRows,
  computePatternDifficulty,
  loadPatternTableExtras,
  loadSavedTableSettings,
  wrapCanvasText,
} from './patternTableCalc';

export interface PdfReportParams {
  sourceCanvas: HTMLCanvasElement;
  fileName: string;
  reportKindLabel: string; // e.g. 'KUMAŞ SİMÜLASYONU' | 'TEKNİK ŞEMA'
  pattern: PatternData;
  rows: PatternRow[];
  guideBarsState: Record<GuideBarId, GuideBarConfig>;
  activeBars: GuideBarId[];
  needleCols: number;
  guideBarCalculations: Partial<Record<GuideBarId, GuideBarCalculationResult>>;
}

/**
 * Scan sourceCanvas pixels to crop unused empty borders around the drawn pattern
 */
export function getTrimmedSourceBounds(
  canvas: HTMLCanvasElement
): { sx: number; sy: number; sw: number; sh: number } {
  const w = canvas.width;
  const h = canvas.height;
  const fallback = { sx: 0, sy: 0, sw: w, sh: h };
  if (w <= 0 || h <= 0) return fallback;

  const srcCtx = canvas.getContext('2d');
  if (!srcCtx) return fallback;

  try {
    const data = srcCtx.getImageData(0, 0, w, h).data;
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];
    const bgA = data[3];

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    const stride = 2;
    for (let y = 0; y < h; y += stride) {
      const rowOffset = y * w * 4;
      for (let x = 0; x < w; x += stride) {
        const i = rowOffset + x * 4;
        if (
          Math.abs(data[i] - bgR) > 12 ||
          Math.abs(data[i + 1] - bgG) > 12 ||
          Math.abs(data[i + 2] - bgB) > 12 ||
          Math.abs(data[i + 3] - bgA) > 12
        ) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX <= minX || maxY <= minY) return fallback;

    const margin = 10;
    const sx = Math.max(0, minX - margin);
    const sy = Math.max(0, minY - margin);
    const ex = Math.min(w, maxX + margin + stride);
    const ey = Math.min(h, maxY + margin + stride);
    return {
      sx,
      sy,
      sw: Math.max(1, ex - sx),
      sh: Math.max(1, ey - sy),
    };
  } catch {
    return fallback;
  }
}

const PAGE_W = 1240;
const PAGE_H = 1754; // A4 Portrait ratio (210 x 297)
const PDF_DPR = 1.85; // ~275 DPI A4 print clarity
const PAD_X = 32;
const AVAIL_W = PAGE_W - PAD_X * 2;
const HEADER_Y = 20;
const HEADER_H = 44;
const FOOTER_H = 40;

function createPdfPageCanvas(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_W * PDF_DPR);
  canvas.height = Math.round(PAGE_H * PDF_DPR);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable');
  }
  ctx.scale(PDF_DPR, PDF_DPR);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = '#060A12';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  return { canvas, ctx };
}

function drawPageHeader(
  ctx: CanvasRenderingContext2D,
  pattern: PatternData,
  needleCols: number,
  rowsLength: number,
  rightBadgeText: string
): void {
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(PAD_X, HEADER_Y, AVAIL_W, HEADER_H);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(PAD_X, HEADER_Y, AVAIL_W, HEADER_H);

  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `TMK TEKSTİL  |  ${pattern.title.toUpperCase()}  |  ${pattern.machine.gauge}  |  ${needleCols} İĞNE  |  ${rowsLength} KURS`,
    PAD_X + 14,
    HEADER_Y + 28
  );

  ctx.fillStyle = '#22D3EE';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(rightBadgeText, PAGE_W - PAD_X - 14, HEADER_Y + 27);
}

function drawPageFooter(
  ctx: CanvasRenderingContext2D,
  pageNum: number,
  totalPages: number,
  dateStr: string
): void {
  const lineY = PAGE_H - FOOTER_H;
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_X, lineY);
  ctx.lineTo(PAGE_W - PAD_X, lineY);
  ctx.stroke();

  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `TMK TEKSTİL  •  Yüksek Çözünürlüklü Desen & Üretim Raporu`,
    PAD_X,
    PAGE_H - 15
  );

  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 12.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(
    `Sayfa ${pageNum} / ${totalPages}   |   ${dateStr}   |   tmktekstil.com`,
    PAGE_W - PAD_X,
    PAGE_H - 15
  );
}

/**
 * Build a multi-page A4 high-resolution PDF Blob from simulation/diagram + metadata + rack + 4-step table.
 */
export async function buildHighResPatternPdf(params: PdfReportParams): Promise<Blob> {
  const {
    sourceCanvas,
    reportKindLabel,
    pattern,
    rows,
    guideBarsState,
    activeBars,
    needleCols,
    guideBarCalculations,
  } = params;

  const gbMap = guideBarsState || pattern.guideBars;
  const activeGbList: GuideBarId[] = activeBars.length > 0 ? activeBars : ALL_GB_IDS;

  const tableSettings = loadSavedTableSettings();
  const tableExtras = loadPatternTableExtras(pattern);
  const expandedRows = buildFinalFourStepRows(rows, tableSettings, tableExtras);
  const displayCourseCount = expandedRows.length > 0 ? Math.ceil(expandedRows.length / 4) : rows.length;
  const rackNote = (tableExtras.rackNote ?? pattern.rackNote ?? '').trim();
  const mayDensity = (pattern.mayDensity ?? tableExtras.mayDensity ?? '').trim();
  const mayDisplay = mayDensity !== '' ? `${mayDensity.replace('.', ',')} May` : 'Belirtilmedi';

  const rawRackRows: RackTensionRow[] =
    tableExtras.isRackManualOverride && tableExtras.rackTensionRows.length > 0
      ? tableExtras.rackTensionRows
      : pattern.isRackManualOverride && pattern.rackTensionRows && pattern.rackTensionRows.length > 0
      ? pattern.rackTensionRows
      : tableExtras.rackTensionRows;

  let maxTelCount = 0;
  activeGbList.forEach((gbId) => {
    const calc = guideBarCalculations[gbId];
    if (calc) maxTelCount += calc.requiredYarnCount;
  });
  const diffInfo = computePatternDifficulty(rows, activeGbList, pattern.machine?.rpm || 600);

  const pageCanvases: HTMLCanvasElement[] = [];

  // =========================================================================
  // MEASURE METADATA BAND (İĞNE DİZİLİMİ VE DESEN ÖZETİ + RACK TANSİYON TABLOSU)
  // =========================================================================
  const pageBodyTop = HEADER_Y + HEADER_H + 14;
  const pageBodyBottom = PAGE_H - FOOTER_H - 16;

  const leftMetaW = Math.floor(AVAIL_W * 0.52);
  const metaGapX = 14;
  const rightMetaW = AVAIL_W - leftMetaW - metaGapX;

  const leftHeaderH = 34;
  const leftLineH = 24;
  const leftStatCardH = 52;
  const leftMetaContentH =
    leftHeaderH + activeGbList.length * leftLineH + 8 + leftStatCardH + 12;

  const rackList: RackTensionRow[] =
    rawRackRows.length > 0
      ? rawRackRows
      : [{ id: 'empty', courseCount: '-', values: {} as Record<GuideBarId, string> }];

  const rackInnerW = rightMetaW - 24;
  let rackNoteLines: string[] = [];
  if (rackNote !== '') {
    const mCanvas = document.createElement('canvas');
    const mCtx = mCanvas.getContext('2d');
    if (mCtx) {
      mCtx.font = '600 11.5px "Plus Jakarta Sans", sans-serif';
      rackNoteLines = wrapCanvasText(mCtx, rackNote, rackInnerW - 20);
    } else {
      rackNoteLines = rackNote.split(/\r?\n/).filter(Boolean);
    }
  }
  const rackNoteBoxH = rackNoteLines.length > 0 ? 24 + rackNoteLines.length * 15 + 8 : 0;

  const rackTitleH = 30;
  const rackHeaderH = 26;
  const rackRowH = 22;
  const rightMetaContentH =
    rackTitleH +
    rackHeaderH +
    rackList.length * rackRowH +
    (rackNoteBoxH > 0 ? rackNoteBoxH + 8 : 0) +
    12;

  const metaBandH = Math.max(leftMetaContentH, rightMetaContentH);

  // Helper to draw side-by-side İĞNE DİZİLİMİ VE DESEN ÖZETİ (Left) + RACK TANSİYON TABLOSU (Right)
  const drawMetaAndRackBand = (
    targetCtx: CanvasRenderingContext2D,
    bandY: number,
    rackRowsSlice: RackTensionRow[],
    rackStartIndex: number,
    showNoteInBand: boolean,
    isContinuation = false
  ): number => {
    const sliceNoteH = showNoteInBand && rackNoteBoxH > 0 ? rackNoteBoxH + 8 : 0;
    const sliceRightH =
      rackTitleH + rackHeaderH + rackRowsSlice.length * rackRowH + sliceNoteH + 12;
    const bandH = isContinuation ? sliceRightH : Math.max(leftMetaContentH, sliceRightH);

    // LEFT BOX: İĞNE DİZİLİMİ VE DESEN ÖZETİ (on first band)
    if (!isContinuation) {
      targetCtx.fillStyle = '#0B0F17';
      targetCtx.fillRect(PAD_X, bandY, leftMetaW, bandH);
      targetCtx.strokeStyle = '#1E293B';
      targetCtx.lineWidth = 1.2;
      targetCtx.strokeRect(PAD_X, bandY, leftMetaW, bandH);

      targetCtx.fillStyle = '#38BDF8';
      targetCtx.font = 'bold 13.5px "Plus Jakarta Sans", sans-serif';
      targetCtx.textAlign = 'left';
      targetCtx.fillText('İĞNE DİZİLİMİ VE DESEN ÖZETİ', PAD_X + 12, bandY + 21);

      targetCtx.fillStyle = '#94A3B8';
      targetCtx.font = 'bold 10.5px "JetBrains Mono", monospace';
      targetCtx.textAlign = 'right';
      targetCtx.fillText(
        `${activeGbList.length} Tarak  |  ${needleCols} İğne`,
        PAD_X + leftMetaW - 12,
        bandY + 21
      );

      let rowY = bandY + 44;
      activeGbList.forEach((gbId) => {
        const gb = gbMap[gbId];
        if (!gb) return;

        targetCtx.fillStyle = gb.color;
        targetCtx.fillRect(PAD_X + 12, rowY - 11, 12, 12);
        targetCtx.strokeStyle = '#FFFFFF';
        targetCtx.lineWidth = 0.8;
        targetCtx.strokeRect(PAD_X + 12, rowY - 11, 12, 12);

        const filledCnt = Array.from({ length: needleCols }, (_, i) =>
          gb.threadingArray && typeof gb.threadingArray[i] === 'boolean'
            ? gb.threadingArray[i]
            : i % 2 === 0
        ).filter(Boolean).length;
        const emptyCnt = needleCols - filledCnt;

        const calc = guideBarCalculations[gbId];
        const yarnText = calc ? ` | ${calc.requiredYarnCount} Tel (${calc.repeatCount} Tekrar)` : '';

        targetCtx.fillStyle = '#F1F5F9';
        targetCtx.font = 'bold 11.5px "JetBrains Mono", monospace';
        targetCtx.textAlign = 'left';
        targetCtx.fillText(
          `${gbId}: ${filledCnt} Dolu / ${emptyCnt} Boş (Top. ${needleCols}İ)${yarnText}`,
          PAD_X + 30,
          rowY
        );

        rowY += leftLineH;
      });

      const statY = bandY + bandH - leftStatCardH - 10;
      const statGap = 10;
      const statBoxW = Math.floor((leftMetaW - 24 - statGap * 2) / 3);
      const statBoxes = [
        {
          label: 'KUMAŞ SIKLIĞI (MAY)',
          value: mayDisplay,
          borderColor: '#0891B2',
          valueColor: '#22D3EE',
        },
        {
          label: 'MAKSİMUM TEL',
          value: `${maxTelCount.toLocaleString('tr-TR')} Tel`,
          borderColor: '#059669',
          valueColor: '#34D399',
        },
        {
          label: 'DESEN ZORLUĞU',
          value: `${diffInfo.shortLabel} (${diffInfo.score}/100)`,
          borderColor: '#7C3AED',
          valueColor: '#C4B5FD',
        },
      ];

      statBoxes.forEach((sb, idx) => {
        const sx = PAD_X + 12 + idx * (statBoxW + statGap);
        targetCtx.fillStyle = '#111827';
        targetCtx.fillRect(sx, statY, statBoxW, leftStatCardH);
        targetCtx.strokeStyle = sb.borderColor;
        targetCtx.lineWidth = 1.1;
        targetCtx.strokeRect(sx, statY, statBoxW, leftStatCardH);

        targetCtx.fillStyle = '#94A3B8';
        targetCtx.font = 'bold 9.5px "Plus Jakarta Sans", sans-serif';
        targetCtx.textAlign = 'left';
        targetCtx.fillText(sb.label, sx + 9, statY + 17);

        targetCtx.fillStyle = sb.valueColor;
        targetCtx.font = 'bold 13px "JetBrains Mono", monospace';
        targetCtx.fillText(sb.value, sx + 9, statY + 39);
      });
    }

    // RIGHT BOX: RACK TANSİYON TABLOSU (+ Not)
    const rackBoxX = isContinuation ? PAD_X : PAD_X + leftMetaW + metaGapX;
    const rackBoxW = isContinuation ? AVAIL_W : rightMetaW;
    const rInnerX = rackBoxX + 12;
    const rInnerW = rackBoxW - 24;

    targetCtx.fillStyle = '#0B0F17';
    targetCtx.fillRect(rackBoxX, bandY, rackBoxW, bandH);
    targetCtx.strokeStyle = '#1E293B';
    targetCtx.lineWidth = 1.2;
    targetCtx.strokeRect(rackBoxX, bandY, rackBoxW, bandH);

    targetCtx.fillStyle = '#34D399';
    targetCtx.font = 'bold 13.5px "Plus Jakarta Sans", sans-serif';
    targetCtx.textAlign = 'left';
    targetCtx.fillText(
      isContinuation ? 'RACK TANSİYON TABLOSU (DEVAM)' : 'RACK TANSİYON TABLOSU',
      rackBoxX + 12,
      bandY + 21
    );

    targetCtx.fillStyle = tableExtras.isRackManualOverride ? '#FCD34D' : '#6EE7B7';
    targetCtx.font = 'bold 10.5px "Plus Jakarta Sans", sans-serif';
    targetCtx.textAlign = 'right';
    targetCtx.fillText(
      tableExtras.isRackManualOverride ? 'Elle Düzenlendi' : 'Otomatik (Atlama)',
      rackBoxX + rackBoxW - 12,
      bandY + 21
    );

    const rackTableY = bandY + rackTitleH;
    const sayiColW = isContinuation ? 70 : 46;
    const kursColW = isContinuation ? 130 : 94;
    const rackGbColW = (rInnerW - sayiColW - kursColW) / activeGbList.length;
    const rackTotalH = rackHeaderH + rackRowsSlice.length * rackRowH;

    targetCtx.fillStyle = '#080C14';
    targetCtx.fillRect(rInnerX, rackTableY, rInnerW, rackTotalH);
    targetCtx.strokeStyle = '#334155';
    targetCtx.lineWidth = 1;
    targetCtx.strokeRect(rInnerX, rackTableY, rInnerW, rackTotalH);

    targetCtx.fillStyle = '#111827';
    targetCtx.fillRect(rInnerX, rackTableY, rInnerW, rackHeaderH);
    targetCtx.strokeStyle = '#334155';
    targetCtx.beginPath();
    targetCtx.moveTo(rInnerX, rackTableY + rackHeaderH);
    targetCtx.lineTo(rInnerX + rInnerW, rackTableY + rackHeaderH);
    targetCtx.stroke();

    targetCtx.fillStyle = '#E2E8F0';
    targetCtx.font = 'bold 11px "JetBrains Mono", monospace';
    targetCtx.textAlign = 'center';
    targetCtx.fillText('Sayı', rInnerX + sayiColW / 2, rackTableY + 17);

    targetCtx.fillStyle = '#38BDF8';
    targetCtx.fillText('Kurs no', rInnerX + sayiColW + kursColW / 2, rackTableY + 17);

    targetCtx.strokeStyle = '#1E293B';
    targetCtx.beginPath();
    targetCtx.moveTo(rInnerX + sayiColW, rackTableY);
    targetCtx.lineTo(rInnerX + sayiColW, rackTableY + rackTotalH);
    targetCtx.moveTo(rInnerX + sayiColW + kursColW, rackTableY);
    targetCtx.lineTo(rInnerX + sayiColW + kursColW, rackTableY + rackTotalH);
    targetCtx.stroke();

    activeGbList.forEach((gbId, gbIdx) => {
      const cx = rInnerX + sayiColW + kursColW + gbIdx * rackGbColW;
      const gbColor = gbMap[gbId]?.color || '#34D399';
      targetCtx.fillStyle = gbColor;
      targetCtx.font = 'bold 11.5px "JetBrains Mono", monospace';
      targetCtx.textAlign = 'center';
      targetCtx.fillText(gbId, cx + rackGbColW / 2, rackTableY + 17);

      targetCtx.fillStyle = gbColor;
      targetCtx.fillRect(cx + 1, rackTableY + rackHeaderH - 2.5, rackGbColW - 2, 2.5);

      if (gbIdx > 0) {
        targetCtx.strokeStyle = '#1E293B';
        targetCtx.beginPath();
        targetCtx.moveTo(cx, rackTableY);
        targetCtx.lineTo(cx, rackTableY + rackTotalH);
        targetCtx.stroke();
      }
    });

    rackRowsSlice.forEach((rRow, localIdx) => {
      const globalIdx = rackStartIndex + localIdx;
      const ry = rackTableY + rackHeaderH + localIdx * rackRowH;
      const isEven = globalIdx % 2 === 1;
      targetCtx.fillStyle = isEven ? '#111827' : '#0B0F17';
      targetCtx.fillRect(rInnerX + 1, ry, rInnerW - 2, rackRowH);

      targetCtx.fillStyle = '#38BDF8';
      targetCtx.font = 'bold 11.5px "JetBrains Mono", monospace';
      targetCtx.textAlign = 'center';
      targetCtx.fillText(String(globalIdx), rInnerX + sayiColW / 2, ry + 15);

      targetCtx.fillStyle = '#FFFFFF';
      targetCtx.font = 'bold 11.5px "JetBrains Mono", monospace';
      targetCtx.fillText(
        rRow.courseCount.trim() !== '' ? rRow.courseCount.trim() : '-',
        rInnerX + sayiColW + kursColW / 2,
        ry + 15
      );

      activeGbList.forEach((gbId, gbIdx) => {
        const cx = rInnerX + sayiColW + kursColW + gbIdx * rackGbColW;
        const val = (rRow.values[gbId] ?? '').trim();
        const numVal = parseFloat(val);
        const isSkipTension = !isNaN(numVal) && numVal > 0 && numVal <= 5000;

        if (isSkipTension) {
          targetCtx.fillStyle = 'rgba(217, 119, 6, 0.28)';
          targetCtx.fillRect(cx + 1, ry, rackGbColW - 2, rackRowH);
          targetCtx.fillStyle = '#FCD34D';
        } else {
          targetCtx.fillStyle = val !== '' ? '#34D399' : '#64748B';
        }
        targetCtx.font = 'bold 11.5px "JetBrains Mono", monospace';
        targetCtx.fillText(val !== '' ? val : '-', cx + rackGbColW / 2, ry + 15);
      });

      targetCtx.strokeStyle = '#1E293B';
      targetCtx.lineWidth = 0.7;
      targetCtx.beginPath();
      targetCtx.moveTo(rInnerX, ry + rackRowH);
      targetCtx.lineTo(rInnerX + rInnerW, ry + rackRowH);
      targetCtx.stroke();
    });

    if (showNoteInBand && rackNoteLines.length > 0) {
      const noteY = rackTableY + rackTotalH + 8;
      targetCtx.fillStyle = '#0F172A';
      targetCtx.fillRect(rInnerX, noteY, rInnerW, rackNoteBoxH);
      targetCtx.strokeStyle = '#B45309';
      targetCtx.lineWidth = 1;
      targetCtx.strokeRect(rInnerX, noteY, rInnerW, rackNoteBoxH);

      targetCtx.fillStyle = '#FBBF24';
      targetCtx.font = 'bold 10.5px "Plus Jakarta Sans", sans-serif';
      targetCtx.textAlign = 'left';
      targetCtx.fillText('NOT:', rInnerX + 10, noteY + 15);

      targetCtx.fillStyle = '#F1F5F9';
      targetCtx.font = '600 11.5px "Plus Jakarta Sans", sans-serif';
      rackNoteLines.forEach((line, lIdx) => {
        targetCtx.fillText(line, rInnerX + 10, noteY + 31 + lIdx * 15);
      });
    }

    return bandH;
  };

  // =========================================================================
  // PAGE 1: SIMULATION / TECHNICAL DIAGRAM (+ TOP METADATA IF NO SHRINK)
  // =========================================================================
  const page1 = createPdfPageCanvas();
  pageCanvases.push(page1.canvas);
  drawPageHeader(
    page1.ctx,
    pattern,
    needleCols,
    displayCourseCount,
    `MAY: ${mayDisplay}  |  MAKS TEL: ${maxTelCount.toLocaleString('tr-TR')}`
  );

  const ctx1 = page1.ctx;
  const crop = getTrimmedSourceBounds(sourceCanvas);

  const simSectionTitleOffset = 22;
  const maxSimOnlyH = pageBodyBottom - (pageBodyTop + simSectionTitleOffset);
  const simOnlyScale = Math.min(
    AVAIL_W / Math.max(1, crop.sw),
    maxSimOnlyH / Math.max(1, crop.sh)
  );

  const metaSimGap = 14;
  const remainingSimH =
    pageBodyBottom - (pageBodyTop + metaBandH + metaSimGap + simSectionTitleOffset);
  const simWithMetaScale =
    remainingSimH > 120
      ? Math.min(AVAIL_W / Math.max(1, crop.sw), remainingSimH / Math.max(1, crop.sh))
      : 0;

  // Put İĞNE DİZİLİMİ + RACK TANSİYON on Page 1 top ONLY if it fits cleanly without shrinking the simulation
  const putMetaOnPage1 =
    remainingSimH >= 240 && metaBandH <= 680 && simWithMetaScale >= simOnlyScale * 0.995;

  let simSectionTitleY = pageBodyTop + 10;
  if (putMetaOnPage1) {
    const drawnMetaH = drawMetaAndRackBand(ctx1, pageBodyTop, rackList, 0, true, false);
    simSectionTitleY = pageBodyTop + drawnMetaH + metaSimGap + 12;
  }

  const simFrameTopY = simSectionTitleY + 12;
  const availPage1SimH = pageBodyBottom - simFrameTopY;

  ctx1.fillStyle = '#38BDF8';
  ctx1.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx1.textAlign = 'left';
  ctx1.fillText(
    `${reportKindLabel} GÖRÜNÜMÜ  (${needleCols} İğne  •  ${rows.length} Kurs)`,
    PAD_X,
    simSectionTitleY
  );

  // Outer Showcase Box spanning full Page 1 width & available height
  ctx1.fillStyle = '#070B14';
  ctx1.fillRect(PAD_X, simFrameTopY, AVAIL_W, availPage1SimH);
  ctx1.strokeStyle = '#1E293B';
  ctx1.lineWidth = 1.2;
  ctx1.strokeRect(PAD_X, simFrameTopY, AVAIL_W, availPage1SimH);

  // Maximize size inside Page 1 box while strictly preserving exact aspect ratio
  const fitScale = Math.min(AVAIL_W / Math.max(1, crop.sw), availPage1SimH / Math.max(1, crop.sh));
  const drawW = Math.max(1, Math.round(crop.sw * fitScale));
  const drawH = Math.max(1, Math.round(crop.sh * fitScale));

  const simX = PAD_X + Math.floor((AVAIL_W - drawW) / 2);
  const simY = simFrameTopY + Math.floor((availPage1SimH - drawH) / 2);

  // Draw subtle tiled "Tmktekstil.com" watermark across the surrounding empty spaces
  ctx1.save();
  ctx1.beginPath();
  ctx1.rect(PAD_X + 2, simFrameTopY + 2, AVAIL_W - 4, availPage1SimH - 4);
  ctx1.clip();

  ctx1.font = 'bold 21px "Plus Jakarta Sans", sans-serif';
  ctx1.fillStyle = 'rgba(148, 163, 184, 0.16)';
  ctx1.textAlign = 'center';
  ctx1.textBaseline = 'middle';

  const stepX = 240;
  const stepY = 120;
  const centerX = PAD_X + AVAIL_W / 2;
  const centerY = simFrameTopY + availPage1SimH / 2;

  ctx1.translate(centerX, centerY);
  ctx1.rotate((-28 * Math.PI) / 180);

  for (let wy = -availPage1SimH; wy <= availPage1SimH; wy += stepY) {
    const rowShift = Math.abs(Math.round(wy / stepY)) % 2 === 1 ? stepX / 2 : 0;
    for (let wx = -AVAIL_W; wx <= AVAIL_W; wx += stepX) {
      ctx1.fillText('Tmktekstil.com', wx + rowShift, wy);
    }
  }
  ctx1.restore();

  // Opaque backdrop under the simulation image so watermark stays strictly in the outer margins
  ctx1.fillStyle = '#070B14';
  ctx1.fillRect(simX, simY, drawW, drawH);

  // Draw aspect-preserved simulation at maximum Page 1 resolution
  ctx1.drawImage(
    sourceCanvas,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    simX,
    simY,
    drawW,
    drawH
  );
  ctx1.strokeStyle = '#334155';
  ctx1.lineWidth = 1.5;
  ctx1.strokeRect(simX, simY, drawW, drawH);

  // =========================================================================
  // SUBSEQUENT PAGES: (IF NOT ON PAGE 1) İĞNE DİZİLİMİ & RACK TANSİYON ABOVE
  // 4-STEP MACHINE PATTERN TABLE — NO DEDICATED EMPTY SUMMARY-ONLY PAGE!
  // =========================================================================
  const totalSteps = expandedRows.length;
  let metaDrawn = putMetaOnPage1;
  let rackCursor = 0;

  // Helper to ensure İĞNE DİZİLİMİ & RACK TANSİYON is rendered (handles extra-long Rack lists gracefully)
  const renderPendingMetaOntoCurrentPage = (
    targetCtx: CanvasRenderingContext2D,
    startY: number
  ): { nextY: number; finishedAllMeta: boolean } => {
    const availH = pageBodyBottom - startY;
    const isCont = rackCursor > 0;
    const reserveNoteH = rackNoteBoxH > 0 ? rackNoteBoxH + 8 : 0;
    const minNeededForHeader = isCont ? rackTitleH + rackHeaderH + 12 : Math.max(leftMetaContentH, rackTitleH + rackHeaderH + 12);

    const maxRowsWithNote = Math.max(
      1,
      Math.floor((availH - rackTitleH - rackHeaderH - reserveNoteH - 12) / rackRowH)
    );
    const maxRowsWithoutNote = Math.max(
      1,
      Math.floor((availH - rackTitleH - rackHeaderH - 12) / rackRowH)
    );

    const remainingRack = rackList.length - rackCursor;
    if (remainingRack <= maxRowsWithNote && (isCont || metaBandH <= availH)) {
      const slice = rackList.slice(rackCursor);
      const drawnH = drawMetaAndRackBand(targetCtx, startY, slice, rackCursor, true, isCont);
      rackCursor = rackList.length;
      metaDrawn = true;
      return { nextY: startY + drawnH + 18, finishedAllMeta: true };
    }

    const sliceCount = Math.min(remainingRack, maxRowsWithoutNote);
    const slice = rackList.slice(rackCursor, rackCursor + sliceCount);
    const drawnH = drawMetaAndRackBand(
      targetCtx,
      startY,
      slice,
      rackCursor,
      remainingRack <= sliceCount && availH >= minNeededForHeader + reserveNoteH,
      isCont
    );
    rackCursor += slice.length;
    if (rackCursor >= rackList.length) {
      metaDrawn = true;
    }
    return { nextY: startY + drawnH + 18, finishedAllMeta: metaDrawn };
  };

  if (totalSteps === 0 && !metaDrawn) {
    while (!metaDrawn) {
      const mPage = createPdfPageCanvas();
      pageCanvases.push(mPage.canvas);
      drawPageHeader(
        mPage.ctx,
        pattern,
        needleCols,
        displayCourseCount,
        'İĞNE DİZİLİMİ & RACK TANSİYON'
      );
      renderPendingMetaOntoCurrentPage(mPage.ctx, pageBodyTop);
    }
  }

  if (totalSteps > 0) {
    const tableHeaderH = 36;
    const stepRowH = 24;

    const courseColW = 54;
    const minBarColW = 82;
    const minBlockW = courseColW + activeGbList.length * minBarColW;
    const blockGapX = 14;
    const maxColsByWidth = Math.max(
      1,
      Math.floor((AVAIL_W + blockGapX) / (minBlockW + blockGapX))
    );
    const maxPreferredCols = activeGbList.length <= 2 ? 3 : 2;
    const colsPerFullPage = Math.min(maxPreferredCols, maxColsByWidth);

    let stepCursor = 0;
    let tPageIdx = 0;

    while (stepCursor < totalSteps) {
      const tPage = createPdfPageCanvas();
      pageCanvases.push(tPage.canvas);
      const tCtx = tPage.ctx;

      let contentTopY = pageBodyTop;
      const hadMetaPendingOnThisPage = !metaDrawn;

      if (!metaDrawn) {
        const res = renderPendingMetaOntoCurrentPage(tCtx, contentTopY);
        contentTopY = res.nextY;

        // If Rack overflowed onto another page and left too little height here for table rows, continue on next page
        if (!res.finishedAllMeta || pageBodyBottom - contentTopY < 32 + tableHeaderH + stepRowH * 4) {
          drawPageHeader(
            tCtx,
            pattern,
            needleCols,
            displayCourseCount,
            'İĞNE DİZİLİMİ & RACK TANSİYON'
          );
          tPageIdx++;
          continue;
        }
      }

      const tableTitleY = contentTopY + 14;
      const tableTopY = tableTitleY + 14;
      const tableMaxH = pageBodyBottom - tableTopY;
      const stepsPerCol = Math.max(1, Math.floor((tableMaxH - tableHeaderH) / stepRowH));
      const stepsPerThisPage = stepsPerCol * colsPerFullPage;

      const pageStartStep = stepCursor;
      const pageEndStep = Math.min(totalSteps, pageStartStep + stepsPerThisPage);
      const pageStepCount = pageEndStep - pageStartStep;

      const firstCourseOnPage = expandedRows[pageStartStep]?.courseIndex ?? 1;
      const lastCourseOnPage = expandedRows[pageEndStep - 1]?.courseIndex ?? displayCourseCount;

      drawPageHeader(
        tCtx,
        pattern,
        needleCols,
        displayCourseCount,
        hadMetaPendingOnThisPage
          ? 'ÖZET & 4 ADIMLI DESEN TABLOSU'
          : tPageIdx > 0
          ? '4 ADIMLI DESEN TABLOSU (Devam)'
          : '4 ADIMLI DESEN TABLOSU'
      );

      // Section Title + Legend
      tCtx.fillStyle = '#38BDF8';
      tCtx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
      tCtx.textAlign = 'left';
      tCtx.fillText(
        `4 ADIMLI MAKİNE DESEN TABLOSU  (Kurs ${firstCourseOnPage} – ${lastCourseOnPage}  /  Toplam ${displayCourseCount} Kurs · ${totalSteps} Adım)`,
        PAD_X,
        tableTitleY
      );

      tCtx.textAlign = 'right';
      tCtx.fillStyle = '#FCD34D';
      tCtx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      const legendLabel = 'ATLA (Atlama Yapılan Adımlar)';
      const legendLabelW = tCtx.measureText(legendLabel).width;
      tCtx.fillText(legendLabel, PAGE_W - PAD_X, tableTitleY);

      tCtx.fillStyle = 'rgba(217, 119, 6, 0.45)';
      tCtx.fillRect(PAGE_W - PAD_X - legendLabelW - 24, tableTitleY - 13, 16, 14);
      tCtx.strokeStyle = '#F59E0B';
      tCtx.lineWidth = 1.4;
      tCtx.strokeRect(PAGE_W - PAD_X - legendLabelW - 24, tableTitleY - 13, 16, 14);

      const numColsThisPage = Math.max(
        1,
        Math.min(colsPerFullPage, Math.ceil(pageStepCount / stepsPerCol))
      );
      const colStepsCount = Math.ceil(pageStepCount / numColsThisPage);
      const blockWidth = Math.floor(
        (AVAIL_W - blockGapX * (numColsThisPage - 1)) / numColsThisPage
      );
      const barColW = (blockWidth - courseColW) / activeGbList.length;

      for (let colIdx = 0; colIdx < numColsThisPage; colIdx++) {
        const startIdx = pageStartStep + colIdx * colStepsCount;
        const endIdx = Math.min(pageEndStep, startIdx + colStepsCount);
        if (startIdx >= pageEndStep) break;

        const bx = PAD_X + colIdx * (blockWidth + blockGapX);
        const by = tableTopY;
        const sliceSteps = expandedRows.slice(startIdx, endIdx);
        const colHeight = tableHeaderH + sliceSteps.length * stepRowH;

        tCtx.fillStyle = '#080C14';
        tCtx.fillRect(bx, by, blockWidth, colHeight);
        tCtx.strokeStyle = '#334155';
        tCtx.lineWidth = 1.2;
        tCtx.strokeRect(bx, by, blockWidth, colHeight);

        // Table Header
        tCtx.fillStyle = '#111827';
        tCtx.fillRect(bx, by, blockWidth, tableHeaderH);
        tCtx.strokeStyle = '#334155';
        tCtx.beginPath();
        tCtx.moveTo(bx, by + tableHeaderH);
        tCtx.lineTo(bx + blockWidth, by + tableHeaderH);
        tCtx.stroke();

        tCtx.fillStyle = '#E2E8F0';
        tCtx.font = 'bold 14px "JetBrains Mono", monospace';
        tCtx.textAlign = 'center';
        tCtx.fillText('Kurs', bx + courseColW / 2, by + 23);

        tCtx.strokeStyle = '#1E293B';
        tCtx.beginPath();
        tCtx.moveTo(bx + courseColW, by);
        tCtx.lineTo(bx + courseColW, by + colHeight);
        tCtx.stroke();

        activeGbList.forEach((gbId, gbIdx) => {
          const cx = bx + courseColW + gbIdx * barColW;
          const gbColor = gbMap[gbId]?.color || '#38BDF8';

          tCtx.fillStyle = gbColor;
          tCtx.font = 'bold 15px "JetBrains Mono", monospace';
          tCtx.textAlign = 'center';
          tCtx.fillText(gbId, cx + barColW / 2, by + 23);

          tCtx.fillStyle = gbColor;
          tCtx.fillRect(cx + 1, by + tableHeaderH - 3, barColW - 2, 3);

          if (gbIdx > 0) {
            tCtx.strokeStyle = '#1E293B';
            tCtx.beginPath();
            tCtx.moveTo(cx, by);
            tCtx.lineTo(cx, by + colHeight);
            tCtx.stroke();
          }
        });

        // Step Rows
        sliceSteps.forEach((item, rOffset) => {
          const ry = by + tableHeaderH + rOffset * stepRowH;
          const isCourseStart = item.stepInCourse === 1;
          const isCourseEnd = item.stepInCourse === 4;
          const isEvenStep = item.stepInCourse % 2 === 0;

          tCtx.fillStyle = isEvenStep ? '#111827' : '#0B0F17';
          tCtx.fillRect(bx + 1, ry, blockWidth - 2, stepRowH);

          tCtx.textAlign = 'center';
          if (isCourseStart) {
            tCtx.fillStyle = '#38BDF8';
            tCtx.font = 'bold 15px "JetBrains Mono", monospace';
            tCtx.fillText(String(item.courseIndex), bx + courseColW / 2, ry + 17.5);
          } else {
            tCtx.fillStyle = '#64748B';
            tCtx.font = 'bold 12px "JetBrains Mono", monospace';
            tCtx.fillText(`·${item.stepInCourse}`, bx + courseColW / 2, ry + 16.5);
          }

          activeGbList.forEach((gbId, gbIdx) => {
            const cx = bx + courseColW + gbIdx * barColW;
            const val = item.values[gbId];
            const isSkipped = Boolean(item.skippedBars[gbId]);

            if (isSkipped) {
              tCtx.fillStyle = 'rgba(217, 119, 6, 0.34)';
              tCtx.fillRect(cx + 1, ry, barColW - 1, stepRowH);
              tCtx.fillStyle = '#F59E0B';
              tCtx.fillRect(cx + 1, ry, 3.5, stepRowH);

              if (isCourseStart && barColW >= 72) {
                tCtx.fillStyle = '#FDE68A';
                tCtx.font = 'bold 15px "JetBrains Mono", monospace';
                tCtx.textAlign = 'center';
                tCtx.fillText(String(val), cx + barColW * 0.32, ry + 17.5);

                const badgeW = 38;
                const badgeH = 16;
                const badgeX = cx + barColW - badgeW - 6;
                const badgeY = ry + 4;
                tCtx.fillStyle = '#D97706';
                tCtx.fillRect(badgeX, badgeY, badgeW, badgeH);
                tCtx.fillStyle = '#FFFFFF';
                tCtx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
                tCtx.textAlign = 'center';
                tCtx.fillText('ATLA', badgeX + badgeW / 2, badgeY + 11.5);
              } else {
                tCtx.fillStyle = '#FDE68A';
                tCtx.font = 'bold 15px "JetBrains Mono", monospace';
                tCtx.textAlign = 'center';
                tCtx.fillText(String(val), cx + barColW / 2, ry + 17.5);
              }
            } else {
              tCtx.fillStyle = isCourseStart ? (gbMap[gbId]?.color || '#F8FAFC') : '#E2E8F0';
              tCtx.font = isCourseStart
                ? 'bold 15.5px "JetBrains Mono", monospace'
                : 'bold 14.5px "JetBrains Mono", monospace';
              tCtx.textAlign = 'center';
              tCtx.fillText(String(val), cx + barColW / 2, ry + 17.5);
            }
          });

          tCtx.strokeStyle = isCourseEnd ? '#475569' : '#1E293B';
          tCtx.lineWidth = isCourseEnd ? 1.5 : 0.7;
          tCtx.beginPath();
          tCtx.moveTo(bx, ry + stepRowH);
          tCtx.lineTo(bx + blockWidth, ry + stepRowH);
          tCtx.stroke();
        });
      }

      stepCursor = pageEndStep;
      tPageIdx++;
    }
  }

  // Stamp Footer with total page count & assemble multi-page A4 jsPDF
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1)
    .toString()
    .padStart(2, '0')}.${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const totalPages = pageCanvases.length;
  pageCanvases.forEach((canvas, idx) => {
    const pCtx = canvas.getContext('2d');
    if (pCtx) {
      drawPageFooter(pCtx, idx + 1, totalPages, dateStr);
    }

    if (idx > 0) {
      pdf.addPage('a4', 'portrait');
    }

    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  });

  return pdf.output('blob');
}
