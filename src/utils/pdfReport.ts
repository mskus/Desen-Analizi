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
  // PAGE 1 (and Page 2 if simulation strip is extra tall):
  // Metadata Band (İğne Dizilimi + Özet + Rack Tablosu) + High-Res Simulation
  // =========================================================================
  const page1 = createPdfPageCanvas();
  pageCanvases.push(page1.canvas);
  drawPageHeader(
    page1.ctx,
    pattern,
    needleCols,
    rows.length,
    `MAY: ${mayDisplay}  |  MAKS TEL: ${maxTelCount.toLocaleString('tr-TR')}`
  );

  const metaY = HEADER_Y + HEADER_H + 14;
  const metaGapX = 16;
  const leftMetaW = Math.floor(AVAIL_W * 0.54);
  const rightMetaW = AVAIL_W - leftMetaW - metaGapX;

  const leftLineH = 26;
  const leftThreadingH = activeGbList.length * leftLineH;
  const statCardH = 56;
  const leftMetaContentH = 42 + leftThreadingH + 8 + statCardH + 14;

  const rackTitleH = 30;
  const rackHeaderH = 28;
  const rackRowH = 25;
  const visibleRackCount = Math.max(1, rawRackRows.length);

  let rackNoteLines: string[] = [];
  if (rackNote !== '') {
    page1.ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
    rackNoteLines = wrapCanvasText(page1.ctx, rackNote, rightMetaW - 40);
  }
  const rackNoteBoxH = rackNoteLines.length > 0 ? 28 + rackNoteLines.length * 16 + 8 : 0;
  const rightMetaContentH =
    rackTitleH +
    rackHeaderH +
    visibleRackCount * rackRowH +
    (rackNoteBoxH > 0 ? rackNoteBoxH + 10 : 0) +
    14;

  const metaBandH = Math.max(leftMetaContentH, rightMetaContentH);

  // Left Metadata Card: İğne Dizilimi + 3 Özet Kartı
  const ctx1 = page1.ctx;
  ctx1.fillStyle = '#0B0F17';
  ctx1.fillRect(PAD_X, metaY, leftMetaW, metaBandH);
  ctx1.strokeStyle = '#1E293B';
  ctx1.lineWidth = 1.2;
  ctx1.strokeRect(PAD_X, metaY, leftMetaW, metaBandH);

  ctx1.fillStyle = '#38BDF8';
  ctx1.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx1.textAlign = 'left';
  ctx1.fillText('İĞNE DİZİLİMİ VE DESEN ÖZETİ', PAD_X + 14, metaY + 22);

  let leftY = metaY + 46;
  activeGbList.forEach((gbId) => {
    const gb = gbMap[gbId];
    if (!gb) return;

    ctx1.fillStyle = gb.color;
    ctx1.fillRect(PAD_X + 14, leftY - 12, 13, 13);
    ctx1.strokeStyle = '#FFFFFF';
    ctx1.lineWidth = 1;
    ctx1.strokeRect(PAD_X + 14, leftY - 12, 13, 13);

    const filledCnt = Array.from({ length: needleCols }, (_, i) =>
      gb.threadingArray && typeof gb.threadingArray[i] === 'boolean'
        ? gb.threadingArray[i]
        : i % 2 === 0
    ).filter(Boolean).length;
    const emptyCnt = needleCols - filledCnt;

    const calc = guideBarCalculations[gbId];
    const yarnText = calc ? `  |  ${calc.requiredYarnCount} Tel (${calc.repeatCount} Tekrar)` : '';

    ctx1.fillStyle = '#F1F5F9';
    ctx1.font = 'bold 13.5px "JetBrains Mono", monospace';
    ctx1.textAlign = 'left';
    ctx1.fillText(
      `${gbId}: ${filledCnt} Dolu / ${emptyCnt} Boş (Top. ${needleCols}İ)${yarnText}`,
      PAD_X + 35,
      leftY
    );

    leftY += leftLineH;
  });

  // 3 Summary Cards
  const statY = metaY + metaBandH - statCardH - 12;
  const statGap = 10;
  const statBoxW = Math.floor((leftMetaW - 28 - statGap * 2) / 3);
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
    const sx = PAD_X + 14 + idx * (statBoxW + statGap);
    ctx1.fillStyle = '#111827';
    ctx1.fillRect(sx, statY, statBoxW, statCardH);
    ctx1.strokeStyle = sb.borderColor;
    ctx1.lineWidth = 1.2;
    ctx1.strokeRect(sx, statY, statBoxW, statCardH);

    ctx1.fillStyle = '#94A3B8';
    ctx1.font = 'bold 10.5px "Plus Jakarta Sans", sans-serif';
    ctx1.textAlign = 'left';
    ctx1.fillText(sb.label, sx + 10, statY + 19);

    ctx1.fillStyle = sb.valueColor;
    ctx1.font = 'bold 14.5px "JetBrains Mono", monospace';
    ctx1.fillText(sb.value, sx + 10, statY + 43);
  });

  // Right Metadata Card: RACK TANSİYON TABLOSU
  const rackX = PAD_X + leftMetaW + metaGapX;
  ctx1.fillStyle = '#0B0F17';
  ctx1.fillRect(rackX, metaY, rightMetaW, metaBandH);
  ctx1.strokeStyle = '#1E293B';
  ctx1.lineWidth = 1.2;
  ctx1.strokeRect(rackX, metaY, rightMetaW, metaBandH);

  ctx1.fillStyle = '#34D399';
  ctx1.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx1.textAlign = 'left';
  ctx1.fillText('RACK TANSİYON TABLOSU', rackX + 14, metaY + 22);

  ctx1.fillStyle = tableExtras.isRackManualOverride ? '#FCD34D' : '#6EE7B7';
  ctx1.font = 'bold 11.5px "Plus Jakarta Sans", sans-serif';
  ctx1.textAlign = 'right';
  ctx1.fillText(
    tableExtras.isRackManualOverride ? 'Elle Düzenlendi' : 'Otomatik (Atlama)',
    rackX + rightMetaW - 14,
    metaY + 22
  );

  const rackInnerX = rackX + 12;
  const rackInnerW = rightMetaW - 24;
  const rackTableY = metaY + rackTitleH;
  const sayiColW = 54;
  const kursColW = 94;
  const rackGbColW = (rackInnerW - sayiColW - kursColW) / activeGbList.length;
  const rackTotalH = rackHeaderH + visibleRackCount * rackRowH;

  ctx1.fillStyle = '#080C14';
  ctx1.fillRect(rackInnerX, rackTableY, rackInnerW, rackTotalH);
  ctx1.strokeStyle = '#334155';
  ctx1.lineWidth = 1;
  ctx1.strokeRect(rackInnerX, rackTableY, rackInnerW, rackTotalH);

  ctx1.fillStyle = '#111827';
  ctx1.fillRect(rackInnerX, rackTableY, rackInnerW, rackHeaderH);
  ctx1.strokeStyle = '#334155';
  ctx1.beginPath();
  ctx1.moveTo(rackInnerX, rackTableY + rackHeaderH);
  ctx1.lineTo(rackInnerX + rackInnerW, rackTableY + rackHeaderH);
  ctx1.stroke();

  ctx1.fillStyle = '#E2E8F0';
  ctx1.font = 'bold 12.5px "JetBrains Mono", monospace';
  ctx1.textAlign = 'center';
  ctx1.fillText('Sayı', rackInnerX + sayiColW / 2, rackTableY + 19);

  ctx1.fillStyle = '#38BDF8';
  ctx1.fillText('Kurs no', rackInnerX + sayiColW + kursColW / 2, rackTableY + 19);

  ctx1.strokeStyle = '#1E293B';
  ctx1.beginPath();
  ctx1.moveTo(rackInnerX + sayiColW, rackTableY);
  ctx1.lineTo(rackInnerX + sayiColW, rackTableY + rackTotalH);
  ctx1.moveTo(rackInnerX + sayiColW + kursColW, rackTableY);
  ctx1.lineTo(rackInnerX + sayiColW + kursColW, rackTableY + rackTotalH);
  ctx1.stroke();

  activeGbList.forEach((gbId, gbIdx) => {
    const cx = rackInnerX + sayiColW + kursColW + gbIdx * rackGbColW;
    const gbColor = gbMap[gbId]?.color || '#34D399';
    ctx1.fillStyle = gbColor;
    ctx1.font = 'bold 13px "JetBrains Mono", monospace';
    ctx1.textAlign = 'center';
    ctx1.fillText(gbId, cx + rackGbColW / 2, rackTableY + 19);

    ctx1.fillStyle = gbColor;
    ctx1.fillRect(cx + 1, rackTableY + rackHeaderH - 2.5, rackGbColW - 2, 2.5);

    if (gbIdx > 0) {
      ctx1.strokeStyle = '#1E293B';
      ctx1.beginPath();
      ctx1.moveTo(cx, rackTableY);
      ctx1.lineTo(cx, rackTableY + rackTotalH);
      ctx1.stroke();
    }
  });

  (rawRackRows.length > 0
    ? rawRackRows
    : [{ id: 'empty', courseCount: '-', values: {} as Record<GuideBarId, string> }]
  ).forEach((rRow, rIdx) => {
    const ry = rackTableY + rackHeaderH + rIdx * rackRowH;
    const isEven = rIdx % 2 === 1;
    ctx1.fillStyle = isEven ? '#111827' : '#0B0F17';
    ctx1.fillRect(rackInnerX + 1, ry, rackInnerW - 2, rackRowH);

    ctx1.fillStyle = '#38BDF8';
    ctx1.font = 'bold 13px "JetBrains Mono", monospace';
    ctx1.textAlign = 'center';
    ctx1.fillText(String(rIdx), rackInnerX + sayiColW / 2, ry + 17);

    ctx1.fillStyle = '#FFFFFF';
    ctx1.font = 'bold 13px "JetBrains Mono", monospace';
    ctx1.fillText(
      rRow.courseCount.trim() !== '' ? rRow.courseCount.trim() : '-',
      rackInnerX + sayiColW + kursColW / 2,
      ry + 17
    );

    activeGbList.forEach((gbId, gbIdx) => {
      const cx = rackInnerX + sayiColW + kursColW + gbIdx * rackGbColW;
      const val = (rRow.values[gbId] ?? '').trim();
      const numVal = parseFloat(val);
      const isSkipTension = !isNaN(numVal) && numVal > 0 && numVal <= 5000;

      if (isSkipTension) {
        ctx1.fillStyle = 'rgba(217, 119, 6, 0.28)';
        ctx1.fillRect(cx + 1, ry, rackGbColW - 2, rackRowH);
        ctx1.fillStyle = '#FCD34D';
      } else {
        ctx1.fillStyle = val !== '' ? '#34D399' : '#64748B';
      }
      ctx1.font = 'bold 13px "JetBrains Mono", monospace';
      ctx1.fillText(val !== '' ? val : '-', cx + rackGbColW / 2, ry + 17);
    });

    ctx1.strokeStyle = '#1E293B';
    ctx1.lineWidth = 0.8;
    ctx1.beginPath();
    ctx1.moveTo(rackInnerX, ry + rackRowH);
    ctx1.lineTo(rackInnerX + rackInnerW, ry + rackRowH);
    ctx1.stroke();
  });

  if (rackNoteLines.length > 0) {
    const noteY = rackTableY + rackTotalH + 8;
    ctx1.fillStyle = '#0F172A';
    ctx1.fillRect(rackInnerX, noteY, rackInnerW, rackNoteBoxH);
    ctx1.strokeStyle = '#B45309';
    ctx1.lineWidth = 1;
    ctx1.strokeRect(rackInnerX, noteY, rackInnerW, rackNoteBoxH);

    ctx1.fillStyle = '#FBBF24';
    ctx1.font = 'bold 11.5px "Plus Jakarta Sans", sans-serif';
    ctx1.textAlign = 'left';
    ctx1.fillText('NOT:', rackInnerX + 10, noteY + 18);

    ctx1.fillStyle = '#F1F5F9';
    ctx1.font = '600 12px "Plus Jakarta Sans", sans-serif';
    rackNoteLines.forEach((line, lIdx) => {
      ctx1.fillText(line, rackInnerX + 10, noteY + 35 + lIdx * 16);
    });
  }

  // Simulation / Technical Diagram Visual Area on Page 1 (Always Single Page, Max Aspect-Preserving Scale + Tmktekstil.com Side Watermark)
  const crop = getTrimmedSourceBounds(sourceCanvas);

  const simSectionTitleY = metaY + metaBandH + 22;
  const simFrameTopY = simSectionTitleY + 12;
  const availPage1SimH = PAGE_H - FOOTER_H - 18 - simFrameTopY;

  ctx1.fillStyle = '#38BDF8';
  ctx1.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx1.textAlign = 'left';
  ctx1.fillText(
    `${reportKindLabel} GÖRÜNÜMÜ  (${needleCols} İğne  •  ${rows.length} Kurs)`,
    PAD_X,
    simSectionTitleY
  );

  // Outer Showcase Box spanning full Page 1 width & remaining height
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
  // SUBSEQUENT PAGES: DEDICATED SPACIOUS 4-STEP MACHINE PATTERN TABLE
  // Automatically paginates across as many A4 pages as needed for crisp reading!
  // =========================================================================
  const totalSteps = expandedRows.length;
  if (totalSteps > 0) {
    const tableTitleY = HEADER_Y + HEADER_H + 32;
    const tableTopY = tableTitleY + 14;
    const tableMaxH = PAGE_H - FOOTER_H - 18 - tableTopY;

    const tableHeaderH = 36;
    const stepRowH = 24; // Large, ultra-legible 24px step row (96px per course!)
    const stepsPerCol = Math.max(1, Math.floor((tableMaxH - tableHeaderH) / stepRowH));

    // Choose spacious column count based on active guide bars so numbers & ATLA badges never squeeze
    const courseColW = 54;
    const minBarColW = 82;
    const minBlockW = courseColW + activeGbList.length * minBarColW;
    const blockGapX = 14;
    const maxColsByWidth = Math.max(
      1,
      Math.floor((AVAIL_W + blockGapX) / (minBlockW + blockGapX))
    );
    const maxPreferredCols =
      activeGbList.length <= 2 ? 3 : activeGbList.length <= 4 ? 2 : 2;
    const colsPerFullPage = Math.min(maxPreferredCols, maxColsByWidth);

    const stepsPerPage = stepsPerCol * colsPerFullPage;
    const totalTablePages = Math.max(1, Math.ceil(totalSteps / stepsPerPage));

    for (let tPageIdx = 0; tPageIdx < totalTablePages; tPageIdx++) {
      const pageStartStep = tPageIdx * stepsPerPage;
      const pageEndStep = Math.min(totalSteps, pageStartStep + stepsPerPage);
      const pageStepCount = pageEndStep - pageStartStep;

      const firstCourseOnPage = expandedRows[pageStartStep]?.courseIndex ?? 1;
      const lastCourseOnPage = expandedRows[pageEndStep - 1]?.courseIndex ?? rows.length;

      const tPage = createPdfPageCanvas();
      pageCanvases.push(tPage.canvas);
      const tCtx = tPage.ctx;

      drawPageHeader(
        tCtx,
        pattern,
        needleCols,
        rows.length,
        totalTablePages > 1
          ? `DESEN TABLOSU (${tPageIdx + 1}/${totalTablePages})`
          : '4 ADIMLI DESEN TABLOSU'
      );

      // Section Title + Legend
      tCtx.fillStyle = '#38BDF8';
      tCtx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
      tCtx.textAlign = 'left';
      tCtx.fillText(
        `4 ADIMLI MAKİNE DESEN TABLOSU  (Kurs ${firstCourseOnPage} – ${lastCourseOnPage}  /  Toplam ${totalSteps} Adım)`,
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
          const isInserted = Boolean(item.isInserted);
          const isCourseStart = item.stepInCourse === 1 && !isInserted;
          const isCourseEnd = item.stepInCourse === 4 && !isInserted;
          const isEvenStep = isInserted ? false : item.stepInCourse % 2 === 0;

          tCtx.fillStyle = isInserted ? '#1E1B4B' : isEvenStep ? '#111827' : '#0B0F17';
          tCtx.fillRect(bx + 1, ry, blockWidth - 2, stepRowH);

          tCtx.textAlign = 'center';
          if (isInserted) {
            tCtx.fillStyle = '#A5B4FC';
            tCtx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
            tCtx.fillText(item.customLabel || '+Ek', bx + courseColW / 2, ry + 17.5);
          } else if (isCourseStart) {
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

              if ((isCourseStart || isInserted) && barColW >= 72) {
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
              tCtx.fillStyle = isInserted
                ? '#E0E7FF'
                : isCourseStart
                ? gbMap[gbId]?.color || '#F8FAFC'
                : '#E2E8F0';
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
