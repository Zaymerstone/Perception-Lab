/**
 * Experiment Engine — ported from freepar.js (2014)
 * SFM (Structure from Motion) visual perception experiment
 */

export const DEG = Math.PI / 180.0;

export const CONFIG = {
  size: 500,
  stimRadius: 200,
  dotRadius: 0.02,
  stimDur: 0.5,
  nPracticeTrials: 16,
  blockSize: 16,
  fpDur: 0.750,
  fpLen: 0.15,
  fpWid: 0.02,
  fpCol: "#fff",
  frameRate: 60,
  buttonDim: 216,
  buttonHSep: 200,
  buttonVSep: 50,
  buttonAlpha: 0.25,
  bgGray: 0.5,
  frameCol: "#bbb",
};

// ==================== Seeded PRNG (Mulberry32) ====================

const EXPERIMENT_SEED = 42; // Fixed seed — same stimuli for all participants

let _rngState = EXPERIMENT_SEED;

function mulberry32(): number {
  _rngState |= 0;
  _rngState = (_rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Reset RNG to initial state — call once before generating the experiment plan */
export function resetRNG(): void {
  _rngState = EXPERIMENT_SEED;
}

/** Seeded random number generator used throughout the experiment */
export function seededRandom(): number {
  return mulberry32();
}

// ==================== Math Utilities ====================

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function randint(a: number, b: number): number {
  return a + Math.floor((b - a) * seededRandom());
}

export function mod(x: number, den: number): number {
  if (x < 0) x += (Math.floor(-x / den) + 1) * den;
  return x - Math.floor(x / den) * den;
}

export function roundTo(x: number, places: number): number {
  const fact = Math.pow(10, places);
  return Math.round(x * fact) / fact;
}

export function vecLength(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

export function normalize(v: number[]): number[] {
  const l = vecLength(v);
  return v.map((x) => x / l);
}

export function rotation(axis: number[], ang: number): number[][] {
  const ax = normalize(axis);
  const c = Math.cos(ang),
    s = Math.sin(ang);
  return [
    [
      c - (c - 1) * ax[0] * ax[0],
      -(c - 1) * ax[0] * ax[1] - s * ax[2],
      s * ax[1] - (c - 1) * ax[0] * ax[2],
    ],
    [
      -(c - 1) * ax[0] * ax[1] + s * ax[2],
      c - (c - 1) * ax[1] * ax[1],
      -s * ax[0] - (c - 1) * ax[1] * ax[2],
    ],
    [
      -s * ax[1] - (c - 1) * ax[0] * ax[2],
      s * ax[0] - (c - 1) * ax[1] * ax[2],
      c - (c - 1) * ax[2] * ax[2],
    ],
  ];
}

export function grayToRgb(g: number): string {
  let gray = Math.round(256 * g);
  if (gray < 0) gray = 0;
  if (gray > 255) gray = 255;
  return `rgb(${gray},${gray},${gray})`;
}

// ==================== Types ====================

export interface SFMTrial {
  rep: number;
  tilt: number;
  shear: number;
}

export type Trial = SFMTrial;

export interface ExperimentPlan {
  practiceTrials: Trial[];
  trials: Trial[];
  experimentName: "sfm";
  showFrame: boolean;
}

export interface TrialResult {
  response: number;
  responseButton: number;
  rt: number;
  trialData: number[];
}

// ==================== SFM ====================

export function planSFM(): ExperimentPlan {
  const nTilts = 16;
  const shearValues = [+0.5];
  //const nRep = 109;
  const nRep = 4;    // MW

  const practiceTrials: SFMTrial[] = [];
  for (let k = 0; k < CONFIG.nPracticeTrials; k++) {
    const mytilt =
      (2 * Math.PI * (randint(0, nTilts) + 0.5)) / nTilts;
    practiceTrials.push({ rep: 0, tilt: mytilt, shear: shearValues[randint(0, shearValues.length)] });
  }

  let oneRep: SFMTrial[] = [];
  for (let i = 0; i < nTilts; i++) {
    for (let j = 0; j < shearValues.length; j++) {
      const mytilt = (Math.PI * (i + 0.5)) / nTilts;
      oneRep.push({ rep: 0, tilt: mytilt, shear: shearValues[j] });
    }
  }
  oneRep = shuffle(oneRep);

  let trials: SFMTrial[] = [];
  for (let k = 0; k < nRep; k++) {
    const newRep = oneRep.map((t) => ({ ...t, rep: k }));
    trials = trials.concat(newRep);
  }

  return {
    practiceTrials,
    trials,
    experimentName: "sfm",
    showFrame: false,
  };
}

export function createSFMDots(trial: SFMTrial): number[][] {
  const nDots = 200;
  const slant = 45 * DEG;
  const axisAngle = trial.tilt + 90 * DEG;
  const axis = [Math.cos(axisAngle), Math.sin(axisAngle), 0];
  const rot = rotation(axis, slant);
  const dots: number[][] = [];
  for (let i = 0; i < nDots; i++) {
    const r = Math.sqrt(seededRandom());
    const th = seededRandom() * 360 * DEG;
    const p0 = [r * Math.cos(th), r * Math.sin(th), 0];
    const p = [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        p[j] += rot[j][k] * p0[k];
      }
    }
    dots.push(p);
  }
  return dots;
}

function drawSFMDotsToContext(
  dots: number[][],
  axis: number[],
  ang: number,
  context: CanvasRenderingContext2D
) {
  const rot = rotation(axis, ang);
  const rmax2 = Math.pow(1 + CONFIG.dotRadius, 2);
  for (let i = 0; i < dots.length; i++) {
    const p = [0, 0];
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 3; k++) {
        p[j] += rot[j][k] * dots[i][k];
      }
    }
    if (p[0] * p[0] + p[1] * p[1] < rmax2) {
      context.fillRect(
        p[0] - CONFIG.dotRadius / 2,
        p[1] - CONFIG.dotRadius / 2,
        CONFIG.dotRadius,
        CONFIG.dotRadius
      );
    }
  }
}

export function prerenderSFM(
  trial: SFMTrial,
  dots: number[][]
): HTMLCanvasElement[] {
  const angularSpeed = 30 * DEG;
  const axisAngle = trial.tilt + 90 * DEG * (1 - trial.shear);
  const axis = [Math.cos(axisAngle), Math.sin(axisAngle), 0];
  const nFrames = 1 + Math.floor(CONFIG.stimDur * CONFIG.frameRate);
  const frames: HTMLCanvasElement[] = [];

  for (let frame = 0; frame < nFrames; frame++) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2 * CONFIG.stimRadius;
    const ctxt = canvas.getContext("2d")!;
    ctxt.translate(CONFIG.stimRadius, CONFIG.stimRadius);
    ctxt.scale(CONFIG.stimRadius, -CONFIG.stimRadius);
    ctxt.clearRect(-1, -1, 2, 2);
    const t = frame / CONFIG.frameRate;
    const ang = angularSpeed * (t - 0.5 * CONFIG.stimDur);
    drawSFMDotsToContext(dots, axis, ang, ctxt);
    frames.push(canvas);
  }
  return frames;
}

export function sfmDataRecord(trial: SFMTrial, resp: number): number[] {
  return [trial.rep, roundTo(trial.tilt / DEG, 6), trial.shear, roundTo(resp / DEG, 6)];
}

// ==================== Drawing Utilities ====================

export function drawFixationPoint(
  context: CanvasRenderingContext2D,
  col: string
) {
  context.save();
  context.strokeStyle = col;
  context.lineWidth = CONFIG.fpWid;
  context.beginPath();
  context.moveTo(-CONFIG.fpLen / 2, 0);
  context.lineTo(+CONFIG.fpLen / 2, 0);
  context.stroke();
  context.beginPath();
  context.moveTo(0, -CONFIG.fpLen / 2);
  context.lineTo(0, +CONFIG.fpLen / 2);
  context.stroke();
  context.restore();
}

export function drawArrow(
  context: CanvasRenderingContext2D,
  ang: number,
  len: number,
  thick: number,
  style: string,
  outlinethick = 0,
  outlinestyle = "",
  headLengthRatio = 0.2,
  thickRatio = 1.75
) {
  context.save();
  context.rotate(ang);

  const x1 = (1.0 - headLengthRatio) * len;
  const y1 = thick * thickRatio;
  context.beginPath();
  context.moveTo(0, -thick / 2);
  context.lineTo(x1, -thick / 2);
  context.lineTo(x1, -y1 / 2);
  context.lineTo(len, 0);
  context.lineTo(x1, +y1 / 2);
  context.lineTo(x1, +thick / 2);
  context.lineTo(0, +thick / 2);
  context.closePath();
  context.fillStyle = style;
  context.fill();
  if (outlinethick > 0) {
    context.lineWidth = outlinethick;
    context.strokeStyle = outlinestyle;
    context.stroke();
  }

  context.restore();
}

// ==================== Probe Drawing ====================

/** Draw SFM probe: a tilted disc (ellipse with gradient) */
export function drawSFMProbe(
  ctx: CanvasRenderingContext2D,
  size: number
) {
  const cx = size / 2;
  const cy = size / 2;
  const rx = size * 0.38;
  const ry = size * 0.18;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fill();

  const grad = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
  grad.addColorStop(0, "#ddd");
  grad.addColorStop(0.5, "#999");
  grad.addColorStop(1, "#555");
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - ry * 1.8);
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy - ry * 1.8, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#333";
  ctx.fill();

  ctx.restore();
}

/** Draw SFM probe mask (hover highlight) */
export function drawSFMProbeMask(
  ctx: CanvasRenderingContext2D,
  size: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fill();
  ctx.restore();
}

// ==================== Bias Visualization ====================

export function showBias(
  data: number[],
  canvas: HTMLCanvasElement
): { biasDir: number; biasStr: number } {
  const lengthScale = 0.6;
  const widthIndiv = 0.04;
  const widthMean = 0.1;
  const widthMeanBorder = widthMean / 10;
  const colIndivYes = "rgba(0, 0, 0, 0.5)";
  const colIndivNo = "rgba(164, 164, 164, 0.5)";
  const colMean = "rgba(255, 0, 0, 1)";
  const colMeanBorder = "rgba(255, 255, 255, 1)";
  const offset = Math.PI;

  if (data.length === 0) return { biasDir: 0, biasStr: 0 };

  const context = canvas.getContext("2d")!;
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.restore();

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.translate(canvas.width / 2, canvas.height / 2);
  const scale = Math.min(canvas.width, canvas.height) / 2;
  
  context.beginPath();
  context.arc(0, 0, scale * 0.95, 0, Math.PI * 2);
  context.strokeStyle = "rgba(255,255,255,0.3)";
  context.lineWidth = 1;
  context.stroke();

  let x = 0,
    y = 0;
  for (let i = 0; i < data.length; i++) {
    const resp = data[i];
    drawArrow(context, offset + resp, lengthScale * scale, widthIndiv * scale, colIndivYes);
    drawArrow(context, offset + resp + Math.PI, lengthScale * scale, widthIndiv * scale, colIndivNo);
    x += Math.cos(resp);
    y += Math.sin(resp);
  }
  x /= data.length;
  y /= data.length;

  let biasDir = Math.atan2(y, x);
  while (biasDir < 0) biasDir += 2 * Math.PI;
  biasDir = biasDir % (2 * Math.PI);
  let biasStr = Math.sqrt(x * x + y * y);
  const maxBiasStr =
    1.0 / (data.length * Math.sin(Math.PI / (2 * data.length)));
  biasStr /= maxBiasStr;

  drawArrow(
    context,
    biasDir + offset,
    biasStr * lengthScale * scale,
    widthMean * scale,
    colMean,
    widthMeanBorder * scale,
    colMeanBorder,
    0.3
  );

  context.restore();

  return {
    biasDir: mod(biasDir + offset, 2 * Math.PI),
    biasStr,
  };
}

// ==================== Response Probe Rendering ====================

/** Cache the loaded probe image */
let probeImageCache: HTMLImageElement | null = null;
let probeImageLoaded = false;

export function loadProbeImage(): Promise<HTMLImageElement> {
  if (probeImageLoaded && probeImageCache) return Promise.resolve(probeImageCache);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      probeImageCache = img;
      probeImageLoaded = true;
      resolve(img);
    };
    img.onerror = reject;
    img.src = "/images/probeSFM_500.png";
  });
}

export function renderProbeButton(
  angle: number,
  isHovered: boolean,
  probeImg?: HTMLImageElement
): HTMLCanvasElement {
  const size = CONFIG.buttonDim;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  if (probeImg) {
    // Professor's pattern: translate to center, rotate, translate back
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-angle);
    ctx.translate(-size / 2, -size / 2);
    ctx.drawImage(probeImg, 0, 0, size, size);
    ctx.restore();
  } else {
    // Fallback to programmatic drawing
    const disp = size / 2;
    ctx.save();
    ctx.translate(disp, disp);
    ctx.rotate(-angle);
    ctx.translate(-disp, -disp);
    drawSFMProbe(ctx, size);
    ctx.restore();
  }

  if (isHovered) {
    drawSFMProbeMask(ctx, size);
  }

  return canvas;
}

// ==================== Timer ====================

export class Timer {
  private t0: number;
  constructor() {
    this.t0 = performance.now() / 1000;
  }
  read(): number {
    return performance.now() / 1000 - this.t0;
  }
  reset() {
    this.t0 = performance.now() / 1000;
  }
}
