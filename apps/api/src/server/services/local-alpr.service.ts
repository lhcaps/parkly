import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { buildPlateCanonical } from '@parkly/gate-core';

import { config } from '../config';
import { ApiError } from '../http';
import { rankAlprCandidates, type AlprObservation } from './alpr-candidate-ranker';
import { runAlprProviderOrchestration, type AlprProviderTrace } from './alpr-provider-orchestrator';

const execFile = promisify(execFileCallback);

export type LocalAlprCandidate = {
  plate: string;
  score: number;
  votes: number;
  cropVariants: string[];
  psmModes: number[];
  suspiciousFlags: string[];
};

export type LocalAlprWinner = {
  cropVariant: string;
  psm: number;
  rawText: string;
  score: number;
  provider: string;
};

export type LocalAlprRecognition = {
  recognizedPlate: string;
  confidence: number;
  source: 'PLATE_HINT' | 'LOCAL_OCR' | 'HTTP_PROVIDER';
  previewStatus: 'STRICT_VALID' | 'REVIEW' | 'INVALID';
  needsConfirm: boolean;
  candidates: LocalAlprCandidate[];
  winner: LocalAlprWinner | null;
  attempts: number;
  failureReason: string | null;
  rawText: string | null;
  imagePath: string | null;
  originalFilename: string | null;
  latencyMs: number;
  cacheHit: boolean | null;
  providerTrace: AlprProviderTrace[];
};

export type StoredUploadDescriptor = {
  storageKind: 'UPLOAD' | 'URL';
  mediaUrl: string;
  filePath: string | null;
  mimeType: string | null;
  metadataJson: Record<string, unknown>;
};

type ImageMeta = {
  width: number;
  height: number;
};

type CropPlan = {
  name: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  likelyTwoLine: boolean;
  scoreBias: number;
};

type RecognizeImageSource = {
  absolutePath: string;
  filename: string;
  cleanup: () => Promise<void>;
  reportImagePath: string | null;
};

function normalizeImageUrl(imageUrl?: string | null) {
  const value = String(imageUrl ?? '').trim();
  return value || null;
}

function parseImagePathname(imageUrl: string) {
  try {
    return decodeURIComponent(new URL(imageUrl, 'http://local').pathname);
  } catch {
    return null;
  }
}

export function resolveLocalUploadFromUrl(
  imageUrl?: string | null,
): { absolutePath: string; relativePath: string; filename: string } | null {
  const url = normalizeImageUrl(imageUrl);
  if (!url) return null;

  const pathname = parseImagePathname(url);
  if (!pathname) return null;

  const publicPrefix = config.upload.publicPath.replace(/\/+$/, '');
  const expectedPrefix = `${publicPrefix}/`;
  if (!pathname.startsWith(expectedPrefix)) return null;

  const relativePath = pathname.slice(expectedPrefix.length);
  if (!relativePath) return null;

  const uploadRoot = path.resolve(process.cwd(), config.upload.dir);
  const absolutePath = path.resolve(uploadRoot, relativePath);
  if (absolutePath !== uploadRoot && !absolutePath.startsWith(`${uploadRoot}${path.sep}`)) return null;

  return {
    absolutePath,
    relativePath,
    filename: path.basename(absolutePath),
  };
}

async function downloadRemoteImageToTemp(
  imageUrl: string,
): Promise<{ absolutePath: string; filename: string; cleanup: () => Promise<void> }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Không tải được ảnh từ imageUrl để OCR local',
      details: {
        reason: 'ALPR_IMAGE_FETCH_FAILED',
        imageUrl,
        status: response.status,
      },
    });
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > config.upload.maxBytes) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Ảnh vượt quá giới hạn upload',
      details: {
        reason: 'ALPR_IMAGE_TOO_LARGE',
        bytes: bytes.length,
        maxBytes: config.upload.maxBytes,
      },
    });
  }

  const contentType = String(response.headers.get('content-type') ?? '').trim().toLowerCase();
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const tempDir = await mkdtemp(path.join(tmpdir(), 'parkly-alpr-http-'));
  const absolutePath = path.join(tempDir, `source.${ext}`);
  await writeFile(absolutePath, bytes);

  return {
    absolutePath,
    filename: `remote.${ext}`,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}

async function resolveRecognitionImageSource(
  imageUrl?: string | null,
): Promise<RecognizeImageSource | null> {
  const normalizedUrl = normalizeImageUrl(imageUrl);
  if (!normalizedUrl) return null;

  const local = resolveLocalUploadFromUrl(normalizedUrl);
  if (local) {
    return {
      absolutePath: local.absolutePath,
      filename: local.filename,
      cleanup: async () => undefined,
      reportImagePath: local.absolutePath,
    };
  }

  const remote = await downloadRemoteImageToTemp(normalizedUrl);
  return {
    absolutePath: remote.absolutePath,
    filename: remote.filename,
    cleanup: remote.cleanup,
    reportImagePath: null,
  };
}

function mimeFromExt(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return null;
}

export function describeStoredUpload(imageUrl?: string | null): StoredUploadDescriptor | null {
  const normalizedUrl = normalizeImageUrl(imageUrl);
  if (!normalizedUrl) return null;

  const local = resolveLocalUploadFromUrl(normalizedUrl);
  if (!local) {
    return {
      storageKind: 'URL',
      mediaUrl: normalizedUrl,
      filePath: null,
      mimeType: null,
      metadataJson: {
        source: 'EXTERNAL_URL',
      },
    };
  }

  return {
    storageKind: 'UPLOAD',
    mediaUrl: normalizedUrl,
    filePath: local.relativePath,
    mimeType: mimeFromExt(local.filename),
    metadataJson: {
      source: 'LOCAL_UPLOAD',
      relativePath: local.relativePath,
      filename: local.filename,
    },
  };
}

function parsePngSize(buffer: Buffer): ImageMeta | null {
  if (buffer.length < 24) return null;
  if (buffer[0] !== 0x89 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpegSize(buffer: Buffer): ImageMeta | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const size = buffer.readUInt16BE(offset + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof && offset + 9 < buffer.length) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += 2 + size;
  }
  return null;
}

async function readImageMeta(imagePath: string): Promise<ImageMeta | null> {
  try {
    const buffer = await readFile(imagePath);
    return parsePngSize(buffer) ?? parseJpegSize(buffer);
  } catch {
    return null;
  }
}

function buildCropPlans(meta: ImageMeta | null): CropPlan[] {
  const portraitLike = meta ? meta.height >= meta.width : false;
  return [
    { name: 'full_frame', leftPct: 0, topPct: 0, widthPct: 1, heightPct: 1, likelyTwoLine: false, scoreBias: 6 },
    { name: 'center_wide', leftPct: 0.08, topPct: 0.38, widthPct: 0.84, heightPct: 0.26, likelyTwoLine: false, scoreBias: 18 },
    { name: 'lower_band', leftPct: 0.12, topPct: 0.48, widthPct: 0.76, heightPct: 0.22, likelyTwoLine: false, scoreBias: 22 },
    { name: 'detector_box', leftPct: 0.16, topPct: portraitLike ? 0.32 : 0.36, widthPct: 0.68, heightPct: portraitLike ? 0.34 : 0.28, likelyTwoLine: true, scoreBias: 28 },
  ];
}

async function cropWithImageMagick(inputPath: string, outputPath: string, plan: CropPlan, meta: ImageMeta | null) {
  if (!meta) return false;

  const width = Math.max(32, Math.floor(meta.width * plan.widthPct));
  const height = Math.max(24, Math.floor(meta.height * plan.heightPct));
  const left = Math.max(0, Math.floor(meta.width * plan.leftPct));
  const top = Math.max(0, Math.floor(meta.height * plan.topPct));
  const binaries = ['magick', 'convert'];

  for (const bin of binaries) {
    try {
      const args = bin === 'magick'
        ? ['convert', inputPath, '-crop', `${width}x${height}+${left}+${top}`, '+repage', outputPath]
        : [inputPath, '-crop', `${width}x${height}+${left}+${top}`, '+repage', outputPath];
      await execFile(bin, args, { timeout: 3_000, maxBuffer: 512 * 1024 });
      return true;
    } catch {
      // try next binary
    }
  }

  return false;
}

async function materializeCrop(imagePath: string, tempDir: string, plan: CropPlan, meta: ImageMeta | null) {
  if (plan.name === 'full_frame') return imagePath;

  const outputPath = path.join(tempDir, `${plan.name}.png`);
  const cropped = await cropWithImageMagick(imagePath, outputPath, plan, meta);
  return cropped ? outputPath : imagePath;
}

async function materializeSplitCrop(imagePath: string, tempDir: string, part: 'upper' | 'lower') {
  const outputPath = path.join(tempDir, `${path.basename(imagePath, path.extname(imagePath))}_${part}.png`);
  const binaries = ['magick', 'convert'];

  for (const bin of binaries) {
    try {
      const gravity = part === 'upper' ? 'North' : 'South';
      const args = bin === 'magick'
        ? ['convert', imagePath, '-gravity', gravity, '-crop', '100%x50%+0+0', '+repage', outputPath]
        : [imagePath, '-gravity', gravity, '-crop', '100%x50%+0+0', '+repage', outputPath];
      await execFile(bin, args, { timeout: 3_000, maxBuffer: 512 * 1024 });
      return outputPath;
    } catch {
      // try next binary
    }
  }

  return null;
}

async function runTesseract(imagePath: string, psm: number, timeoutMs: number): Promise<string | null> {
  const bin = String(process.env.ALPR_TESSERACT_BIN ?? 'tesseract').trim() || 'tesseract';
  const lang = String(process.env.ALPR_TESSERACT_LANG ?? 'eng').trim() || 'eng';

  try {
    const result = await execFile(bin, [imagePath, 'stdout', '--psm', String(psm), '-l', lang], {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });
    const stdout = String(result.stdout ?? '').trim();
    return stdout || null;
  } catch (error: any) {
    if (String(error?.code ?? '') === 'ENOENT') {
      throw new ApiError({
        code: 'INTERNAL_ERROR',
        statusCode: 503,
        message: 'Không tìm thấy Tesseract local. Hãy cấu hình ALPR_TESSERACT_BIN hoặc provider ngoài.',
        details: {
          reason: 'TESSERACT_NOT_FOUND',
          bin,
        },
      });
    }
    if (error?.name === 'AbortError' || /timed? out/i.test(String(error?.message ?? ''))) return null;
    return null;
  }
}

async function collectOcrObservations(args: {
  imagePath: string;
  meta: ImageMeta | null;
  plans: CropPlan[];
  psmModes: number[];
  stage: 'FAST' | 'DEEP';
  timeoutMs: number;
}): Promise<{ observations: AlprObservation[]; attempts: number }> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'parkly-alpr-'));
  const observations: AlprObservation[] = [];
  let attempts = 0;

  try {
    for (const plan of args.plans) {
      const cropPath = await materializeCrop(args.imagePath, tempDir, plan, args.meta);

      for (const psm of args.psmModes) {
        attempts += 1;
        const fullText = await runTesseract(cropPath, psm, args.timeoutMs);
        if (fullText) {
          observations.push({
            provider: 'LOCAL',
            cropVariant: plan.name,
            psm,
            rawText: fullText,
            lineMode: 'FULL',
            stage: args.stage,
            evidenceWeight: plan.scoreBias,
          });
        }

        if (!plan.likelyTwoLine) continue;

        const upperPath = await materializeSplitCrop(cropPath, tempDir, 'upper');
        const lowerPath = await materializeSplitCrop(cropPath, tempDir, 'lower');
        if (!upperPath || !lowerPath) continue;

        attempts += 2;
        const upperText = await runTesseract(upperPath, psm, args.timeoutMs);
        const lowerText = await runTesseract(lowerPath, psm, args.timeoutMs);
        if (upperText && lowerText) {
          observations.push({
            provider: 'LOCAL',
            cropVariant: `${plan.name}_two_line`,
            psm,
            rawText: `${upperText}\n${lowerText}`,
            lineMode: 'TWO_LINE',
            stage: args.stage,
            evidenceWeight: plan.scoreBias + 6,
          });
        }
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return { observations, attempts };
}

function mapRankedCandidatesToPreview(candidates: ReturnType<typeof rankAlprCandidates>['candidates']): LocalAlprCandidate[] {
  return candidates.map((candidate) => ({
    plate: candidate.plate,
    score: candidate.score,
    votes: candidate.votes,
    cropVariants: candidate.cropVariants,
    psmModes: candidate.psmModes,
    suspiciousFlags: candidate.suspiciousFlags,
  }));
}

function mapWinner(winner: ReturnType<typeof rankAlprCandidates>['winner']): LocalAlprWinner | null {
  if (!winner) return null;
  return {
    cropVariant: winner.cropVariant,
    psm: winner.psm,
    rawText: winner.rawText,
    score: winner.score,
    provider: winner.provider,
  };
}

function previewStatusForCandidate(plate: string | null | undefined): 'STRICT_VALID' | 'REVIEW' | 'INVALID' {
  if (!plate) return 'INVALID';
  return buildPlateCanonical(plate).plateValidity;
}

function buildHintRecognition(plateHint: string): LocalAlprRecognition {
  const canonical = buildPlateCanonical(plateHint);
  const recognizedPlate = canonical.plateDisplay ?? canonical.plateRaw ?? plateHint;
  const previewStatus = canonical.plateValidity;
  return {
    recognizedPlate,
    confidence: previewStatus === 'STRICT_VALID' ? 0.99 : 0.85,
    source: 'PLATE_HINT',
    previewStatus,
    needsConfirm: previewStatus !== 'STRICT_VALID',
    candidates: [{
      plate: recognizedPlate,
      score: previewStatus === 'STRICT_VALID' ? 99 : 85,
      votes: 1,
      cropVariants: ['plate_hint'],
      psmModes: [],
      suspiciousFlags: canonical.suspiciousFlags,
    }],
    winner: {
      cropVariant: 'plate_hint',
      psm: 0,
      rawText: plateHint,
      score: previewStatus === 'STRICT_VALID' ? 99 : 85,
      provider: 'PLATE_HINT',
    },
    attempts: 0,
    failureReason: null,
    rawText: plateHint,
    imagePath: null,
    originalFilename: null,
    latencyMs: 0,
    cacheHit: null,
    providerTrace: [],
  };
}

export async function recognizeLocalPlate(args: { imageUrl?: string | null; plateHint?: string | null }): Promise<LocalAlprRecognition> {
  const startedAt = Date.now();
  const plateHint = String(args.plateHint ?? '').trim();
  if (plateHint) return buildHintRecognition(plateHint);

  const imageSource = await resolveRecognitionImageSource(args.imageUrl);
  if (!imageSource) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Cần imageUrl hợp lệ hoặc plateHint để OCR.',
      details: {
        reason: 'ALPR_IMAGE_URL_REQUIRED',
        imageUrl: normalizeImageUrl(args.imageUrl),
      },
    });
  }

  await access(imageSource.absolutePath);

  try {
    const meta = await readImageMeta(imageSource.absolutePath);
    const cropPlans = buildCropPlans(meta);
    const fastPlans = cropPlans.slice(0, 2);
    const deepPlans = cropPlans;
    const providerTrace: AlprProviderTrace[] = [];
    const allObservations: AlprObservation[] = [];
    let attempts = 0;
    let failureReason: string | null = null;

    if (config.alpr.mode === 'MOCK') {
      failureReason = 'ALPR_MOCK_MODE_REQUIRES_HINT_OR_EXTERNAL_PROVIDER';
    } else if (config.alpr.mode === 'DISABLED') {
      failureReason = 'ALPR_LOCAL_DISABLED';
    } else {
      const fastRun = await collectOcrObservations({
        imagePath: imageSource.absolutePath,
        meta,
        plans: fastPlans,
        psmModes: config.alpr.fastPsmModes,
        stage: 'FAST',
        timeoutMs: config.alpr.fastTimeoutMs,
      });
      attempts += fastRun.attempts;
      allObservations.push(...fastRun.observations);

      let ranked = rankAlprCandidates(allObservations, {
        maxCandidates: config.alpr.previewMaxCandidates,
        provinceAllowlist: config.alpr.provinceAllowlist,
      });

      const shouldRunDeep =
        !ranked.candidates[0] ||
        ranked.candidates[0].previewStatus !== 'STRICT_VALID' ||
        ranked.candidates[0].score < config.alpr.externalEscalationThreshold;

      if (shouldRunDeep) {
        const deepRun = await collectOcrObservations({
          imagePath: imageSource.absolutePath,
          meta,
          plans: deepPlans,
          psmModes: config.alpr.deepPsmModes,
          stage: 'DEEP',
          timeoutMs: config.alpr.deepTimeoutMs,
        });
        attempts += deepRun.attempts;
        allObservations.push(...deepRun.observations);
        ranked = rankAlprCandidates(allObservations, {
          maxCandidates: config.alpr.previewMaxCandidates,
          provinceAllowlist: config.alpr.provinceAllowlist,
        });
      }

      providerTrace.push({
        provider: 'LOCAL',
        called: true,
        status: allObservations.length > 0 ? 'SUCCESS' : 'ERROR',
        latencyMs: Date.now() - startedAt,
        reason: allObservations.length > 0 ? null : 'LOCAL_OCR_EMPTY',
      });
    }

    let ranked = rankAlprCandidates(allObservations, {
      maxCandidates: config.alpr.previewMaxCandidates,
      provinceAllowlist: config.alpr.provinceAllowlist,
    });

    const orchestration = await runAlprProviderOrchestration({
      imageUrl: args.imageUrl ?? null,
      imagePath: imageSource.absolutePath,
      plateHint: args.plateHint ?? null,
      localTopCandidate: ranked.candidates[0] ?? null,
    });

    providerTrace.push(...orchestration.traces);
    if (orchestration.observations.length > 0) {
      allObservations.push(...orchestration.observations);
      ranked = rankAlprCandidates(allObservations, {
        maxCandidates: config.alpr.previewMaxCandidates,
        provinceAllowlist: config.alpr.provinceAllowlist,
      });
    }

    const topCandidate = ranked.candidates[0] ?? null;
    if (!topCandidate) failureReason = failureReason ?? 'OCR_NO_VALID_CANDIDATE';
    else if (topCandidate.previewStatus === 'INVALID') failureReason = failureReason ?? 'OCR_INVALID_CANDIDATE';
    else failureReason = null;

    const recognizedPlate = topCandidate?.plate ?? '';
    const previewStatus = topCandidate?.previewStatus ?? previewStatusForCandidate(recognizedPlate);
    const winner = mapWinner(ranked.winner);
    const recognitionSource: LocalAlprRecognition['source'] =
      winner?.provider && winner.provider !== 'LOCAL' ? 'HTTP_PROVIDER' : 'LOCAL_OCR';

    return {
      recognizedPlate,
      confidence: topCandidate ? Number((topCandidate.score / 100).toFixed(2)) : 0,
      source: recognitionSource,
      previewStatus,
      needsConfirm: previewStatus !== 'STRICT_VALID',
      candidates: mapRankedCandidatesToPreview(ranked.candidates),
      winner,
      attempts,
      failureReason,
      rawText: winner?.rawText ?? null,
      imagePath: imageSource.reportImagePath,
      originalFilename: imageSource.filename,
      latencyMs: Date.now() - startedAt,
      cacheHit: null,
      providerTrace,
    };
  } finally {
    await imageSource.cleanup().catch(() => undefined);
  }
}