import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, ArrowLeft, ArrowRight, Clock, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CONFIG,
  DEG,
  Timer,
  planSFM,
  createSFMDots,
  prerenderSFM,
  drawFixationPoint,
  sfmDataRecord,
  showBias,
  mod,
  roundTo,
  renderProbeButton,
  loadProbeImage,
  seededRandom,
  resetRNG,
  type ExperimentPlan,
  type SFMTrial,
} from "@/lib/experiment-engine";

/**
 * Block timing array (in minutes).
 * 0 = start immediately after previous block ends.
 * N = start N minutes after the START of the previous block.
 * First entry is always 0 (first block starts immediately).
 */
const BLOCK_TIMING = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
];

type Phase =
  | "general_instructions"
  | "general_instructions_2"
  | "experiment_instructions"
  | "running"
  | "begin_real"
  | "block_countdown"
  | "results"
  | "done";

/** Play a short alarm beep using Web Audio API */
function playAlarm() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Three ascending beeps
    const now = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(800, now + 0.15);
    osc.frequency.setValueAtTime(1000, now + 0.3);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.setValueAtTime(0.3, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (e) {
    console.warn("Could not play alarm:", e);
  }
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const Experiment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const participantData = useRef(location.state as {
    age?: string;
    gender?: string;
    vision?: string;
    subjectCode?: string;
  } | null);
  const [phase, setPhase] = useState<Phase>("general_instructions");
  const [isPractice, setIsPractice] = useState(true);
  const [displayTrialIndex, setDisplayTrialIndex] = useState(0);
  const [biasResult, setBiasResult] = useState<{ dir: number; str: number } | null>(null);

  // Block tracking
  const [currentBlock, setCurrentBlock] = useState(0);
  const totalBlocks = BLOCK_TIMING.length;
  const blockStartTimeRef = useRef<number>(0); // timestamp (ms) when current block started
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarm60PlayedRef = useRef(false);
  const alarm30PlayedRef = useRef(false);
  const alarm10PlayedRef = useRef(false);
  const alarm0PlayedRef = useRef(false);

  // Canvas and animation refs
  const probeImgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const biasCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const planRef = useRef<ExperimentPlan | null>(null);
  const responseDataRef = useRef<number[]>([]);
  const blockTrialDataRef = useRef<Array<{
    subject_code: string;
    block_number: number;
    trial_number: number;
    timestamp: string;
    tilt_degrees: number;
    user_selection: "left" | "right";
    response_tilt_degrees: number;
  }>>([]);
  const bigDataRef = useRef<number[][]>([]);

  // Trial state refs
  const trialIndexRef = useRef(0);
  const stateRef = useRef(0);
  const timerRef = useRef(new Timer());
  const startStateTRef = useRef(0);
  const framesRef = useRef<HTMLCanvasElement[]>([]);
  const dotsRef = useRef<number[][] | null>(null);
  const stimFramesCountRef = useRef(0);

  // Response refs
  const responseRef = useRef<{ responded: boolean; resp: number; respButton: number }>({
    responded: false,
    resp: 0,
    respButton: 0,
  });
  const responseContainerRef = useRef<HTMLDivElement>(null);
  const responseAngsRef = useRef<number[]>([0, Math.PI]);

  const getCurrentTrial = useCallback((): SFMTrial => {
    const plan = planRef.current!;
    if (isPractice) {
      return plan.practiceTrials[trialIndexRef.current];
    }

    const blockTrialOffset = currentBlock * CONFIG.blockSize;
    return plan.trials[blockTrialOffset + trialIndexRef.current];
  }, [isPractice, currentBlock]);

  const destroyResponseButtons = useCallback(() => {
    if (responseContainerRef.current) {
      responseContainerRef.current.innerHTML = "";
    }
  }, []);

  const createResponseButtons = useCallback(
    (trial: SFMTrial) => {
      const ang = trial.tilt;
      const angs = [mod(ang, 360 * DEG), mod(ang + 180 * DEG, 360 * DEG)];
      if (seededRandom() < 0.5) angs.reverse();
      responseAngsRef.current = angs;

      responseRef.current = { responded: false, resp: 0, respButton: 0 };

      const container = responseContainerRef.current;
      if (!container) return;
      container.innerHTML = "";

      const probeImg = probeImgRef.current;

      // Add arrow key labels
      for (let i = 0; i < 2; i++) {
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.alignItems = "center";
        wrapper.style.margin = "0 140px";

        const btnCanvas = renderProbeButton(angs[i], false, probeImg ?? undefined);
        btnCanvas.style.borderRadius = "8px";

        wrapper.appendChild(btnCanvas);
        container.appendChild(wrapper);
      }
    },
    []
  );

  // Keyboard listener for arrow key responses during trials
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current !== 100) return; // Only respond during response phase
      if (responseRef.current.responded) return;

      const angs = responseAngsRef.current;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        responseRef.current = { responded: true, resp: angs[0], respButton: 0 };
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        responseRef.current = { responded: true, resp: angs[1], respButton: 1 };
      }
    };

    if (phase === "running") {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase]);

  const expStartTimeRef = useRef<number>(Date.now());

  /** Submit one block's data to Supabase */
  const submitBlockResults = useCallback(async (blockIdx: number, blockTrials: typeof blockTrialDataRef.current, blockRawData: number[][]) => {
    const p = participantData.current;
    const rawLines = blockRawData.map((row) => row.join("\t")).join("\n");

    const metadata = {
      window_size: `${window.innerWidth}x${window.innerHeight}`,
      screen_size: `${screen.width}x${screen.height}`,
      useragent: navigator.userAgent,
      platform: navigator.platform,
      timestamp: new Date().toISOString(),
      frameRate: CONFIG.frameRate,
      stimDur: CONFIG.stimDur,
      fpDur: CONFIG.fpDur,
      blockSize: CONFIG.blockSize,
      stimRadius: CONFIG.stimRadius,
      total_blocks: totalBlocks,
      block_timing: BLOCK_TIMING,
      trials: blockTrials,
    };

    const { error } = await supabase.from("experiment_results").insert({
      participant_age: p?.age ?? null,
      participant_gender: p?.gender ?? null,
      participant_vision: p?.vision ?? null,
      subject_code: p?.subjectCode ?? null,
      block_number: blockIdx + 1,
      experiment_type: "sfm",
      raw_data_string: rawLines,
      metadata,
    });

    if (error) {
      console.error("Failed to save block results:", error);
      toast({ title: "Warning", description: "Could not save block data. Please contact the researcher.", variant: "destructive" });
    } else {
      console.log(`Block ${blockIdx + 1} results saved successfully`);
    }
  }, [totalBlocks]);

  /** Start a real experiment block and reset block-local state */
  const startBlock = useCallback((blockIdx: number) => {
    requestFullscreen();

    if (!planRef.current) {
      resetRNG();
      planRef.current = planSFM();
    }

    trialIndexRef.current = 0;
    setDisplayTrialIndex(0);
    blockTrialDataRef.current = [];
    bigDataRef.current = [];
    setCurrentBlock(blockIdx);
    setIsPractice(false);
    blockStartTimeRef.current = Date.now();

    stateRef.current = 0;
    timerRef.current = new Timer();
    stimFramesCountRef.current = 0;
    setPhase("running");
  }, []);

  /** Handle end of a block: submit data, then decide immediate next or countdown */
  const handleBlockEnd = useCallback(() => {
    // Submit this block's data
    const blockTrials = [...blockTrialDataRef.current];
    const blockRawData = [...bigDataRef.current];
    submitBlockResults(currentBlock, blockTrials, blockRawData);
    
    // Reset for next block
    blockTrialDataRef.current = [];
    bigDataRef.current = [];

    const nextBlockIdx = currentBlock + 1;

    if (nextBlockIdx >= totalBlocks) {
      exitFullscreen();
      setPhase("results");
      return;
    }

    const delayMinutes = BLOCK_TIMING[nextBlockIdx];

    if (delayMinutes === 0) {
      startBlock(nextBlockIdx);
    } else {
      const elapsedMs = Date.now() - blockStartTimeRef.current;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const totalRestSeconds = delayMinutes * 60;
      const remainingRest = Math.max(0, totalRestSeconds - elapsedSeconds);

      if (remainingRest <= 0) {
        startBlock(nextBlockIdx);
      } else {
        setCountdownRemaining(remainingRest);
        alarm60PlayedRef.current = remainingRest <= 60;
        alarm30PlayedRef.current = remainingRest <= 30;
        alarm10PlayedRef.current = remainingRest <= 10;
        alarm0PlayedRef.current = false;
        setPhase("block_countdown");
      }
    }
  }, [currentBlock, totalBlocks, startBlock, submitBlockResults]);

  // Countdown timer effect
  useEffect(() => {
    if (phase !== "block_countdown") {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdownRemaining((prev) => {
        const next = prev - 1;
        // Play alarm at 60 seconds remaining
        if (next === 60 && !alarm60PlayedRef.current) {
          alarm60PlayedRef.current = true;
          playAlarm();
        }
        // Play alarm at 30 seconds remaining
        if (next === 30 && !alarm30PlayedRef.current) {
          alarm30PlayedRef.current = true;
          playAlarm();
        }
        // Play alarm at 10 seconds remaining
        if (next === 10 && !alarm10PlayedRef.current) {
          alarm10PlayedRef.current = true;
          playAlarm();
        }
        // Play alarm at 0
        if (next <= 0) {
          if (!alarm0PlayedRef.current) {
            alarm0PlayedRef.current = true;
            playAlarm();
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [phase]);

  const runTrialLoop = useCallback(() => {
    const plan = planRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const timer = timerRef.current;
    const t = timer.read();
    let drawFp = false;
    let drawStim = false;

    const state = stateRef.current;

    if (state === 0) {
      const trial = getCurrentTrial();
      const dots = createSFMDots(trial);
      dotsRef.current = dots;
      framesRef.current = prerenderSFM(trial, dots);
      stateRef.current = 1;
      startStateTRef.current = timer.read();
    }

    if (stateRef.current === 1) {
      if (t < startStateTRef.current + CONFIG.fpDur) {
        drawFp = true;
        drawStim = false;
      } else {
        stateRef.current = 2;
        startStateTRef.current = t;
      }
    }

    if (stateRef.current === 2) {
      if (t < startStateTRef.current + CONFIG.stimDur) {
        drawFp = false;
        drawStim = true;
      } else {
        stateRef.current = 100;
        startStateTRef.current = t;
        const trial = getCurrentTrial();
        createResponseButtons(trial);
      }
    }

    if (stateRef.current === 100) {
      if (responseRef.current.responded) {
        destroyResponseButtons();
        stateRef.current = 999;
        startStateTRef.current = t;
      }
    }

    if (stateRef.current === 999) {
      const trial = getCurrentTrial();
      const resp = responseRef.current.resp;
      const respButton = responseRef.current.respButton;
      const rt = t - startStateTRef.current;

      stateRef.current = 0;

      if (isPractice) {
        // Record practice trial data just like real trials
        const trialData = sfmDataRecord(trial, resp);
        trialData.push(roundTo(rt, 3));
        trialData.push(respButton);
        trialData.push(0); // block 0 for practice
        bigDataRef.current.push(trialData);

        const p = participantData.current;
        blockTrialDataRef.current.push({
          subject_code: p?.subjectCode ?? "",
          block_number: 0,
          trial_number: trialIndexRef.current + 1,
          timestamp: new Date().toISOString(),
          tilt_degrees: roundTo(trial.tilt / DEG, 6),
          user_selection: respButton === 0 ? "left" : "right",
          response_tilt_degrees: roundTo(resp / DEG, 6),
        });

        if (trialIndexRef.current < plan.practiceTrials.length - 1) {
          trialIndexRef.current++;
          setDisplayTrialIndex(trialIndexRef.current);
        } else {
          // Submit practice block data as block 0
          const practiceTrials = [...blockTrialDataRef.current];
          const practiceRawData = [...bigDataRef.current];
          submitBlockResults(-1, practiceTrials, practiceRawData);

          // Reset for real trials
          blockTrialDataRef.current = [];
          bigDataRef.current = [];
          setIsPractice(false);
          trialIndexRef.current = 0;
          setDisplayTrialIndex(0);
          setPhase("begin_real");
          return;
        }
      } else {
        const trialData = sfmDataRecord(trial, resp);
        trialData.push(roundTo(rt, 3));
        trialData.push(respButton);
        trialData.push(currentBlock);
        bigDataRef.current.push(trialData);
        responseDataRef.current.push(resp);

        // Record per-trial metadata for this block
        const p = participantData.current;
        blockTrialDataRef.current.push({
          subject_code: p?.subjectCode ?? "",
          block_number: currentBlock + 1,
          trial_number: trialIndexRef.current + 1,
          timestamp: new Date().toISOString(),
          tilt_degrees: roundTo(trial.tilt / DEG, 6),
          user_selection: respButton === 0 ? "left" : "right",
          response_tilt_degrees: roundTo(resp / DEG, 6),
        });

        const blockTrialOffset = currentBlock * CONFIG.blockSize;
        const realTrialsThisBlock = Math.min(
          CONFIG.blockSize,
          plan.trials.length - blockTrialOffset
        );

        if (trialIndexRef.current < realTrialsThisBlock - 1) {
          trialIndexRef.current++;
          setDisplayTrialIndex(trialIndexRef.current);
        } else {
          // Block finished — handle transition to next block
          handleBlockEnd();
          return;
        }
      }
    }

    // Draw
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgb(128,128,128)`;
    ctx.fillRect(0, 0, CONFIG.size, CONFIG.size);

    if (plan.showFrame) {
      ctx.fillStyle = CONFIG.frameCol;
      ctx.beginPath();
      ctx.arc(CONFIG.size / 2, CONFIG.size / 2, CONFIG.size / 2, 0, Math.PI * 2, true);
      ctx.fill();
    }

    ctx.restore();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(CONFIG.size / 2, CONFIG.size / 2);

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.stimRadius, 0, Math.PI * 2, true);
    ctx.clip();

    ctx.fillStyle = `rgb(128,128,128)`;
    ctx.fillRect(-CONFIG.stimRadius, -CONFIG.stimRadius, CONFIG.stimRadius * 2, CONFIG.stimRadius * 2);

    if (plan.showFrame) {
      ctx.fillStyle = CONFIG.frameCol;
      ctx.fillRect(-CONFIG.stimRadius, -CONFIG.stimRadius, CONFIG.stimRadius * 2, CONFIG.stimRadius * 2);
    }

    ctx.restore();

    if (drawFp) {
      ctx.save();
      ctx.scale(CONFIG.stimRadius, -CONFIG.stimRadius);
      drawFixationPoint(ctx, CONFIG.fpCol);
      ctx.restore();
    }

    if (drawStim) {
      const frameIdx = Math.round(
        (t - startStateTRef.current) * CONFIG.frameRate
      );
      const clampedFrame = Math.max(
        0,
        Math.min(frameIdx, framesRef.current.length - 1)
      );
      ctx.drawImage(
        framesRef.current[clampedFrame],
        -CONFIG.stimRadius,
        -CONFIG.stimRadius
      );
      stimFramesCountRef.current++;
    }

    ctx.restore();

    animFrameRef.current = requestAnimationFrame(runTrialLoop);
  }, [
    isPractice,
    currentBlock,
    getCurrentTrial,
    createResponseButtons,
    destroyResponseButtons,
    handleBlockEnd,
  ]);

  const requestFullscreen = useCallback(() => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      }
    } catch (e) {
      console.warn("Fullscreen not supported:", e);
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      console.warn("Could not exit fullscreen:", e);
    }
  }, []);

  const startTrials = useCallback(() => {
    requestFullscreen();
    stateRef.current = 0;
    timerRef.current = new Timer();
    stimFramesCountRef.current = 0;
    if (currentBlock === 0) {
      expStartTimeRef.current = Date.now();
      blockStartTimeRef.current = Date.now();
    }
    setPhase("running");
  }, [currentBlock]);

  const initExperiment = useCallback(() => {
    resetRNG();
    const plan = planSFM();
    planRef.current = plan;
    trialIndexRef.current = 0;
    setDisplayTrialIndex(0);
    bigDataRef.current = [];
    responseDataRef.current = [];
    setCurrentBlock(0);
    setIsPractice(plan.practiceTrials.length > 0);
    // Preload probe image
    loadProbeImage().then((img) => {
      probeImgRef.current = img;
    }).catch((e) => console.warn("Could not load probe image:", e));
    setPhase("experiment_instructions");
  }, []);

  // Start animation loop when in "running" phase
  useEffect(() => {
    if (phase === "running") {
      animFrameRef.current = requestAnimationFrame(runTrialLoop);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [phase, runTrialLoop]);

  // Show bias when reaching results
  useEffect(() => {
    if (phase === "results" && biasCanvasRef.current) {
      const plan = planRef.current;
      if (plan && responseDataRef.current.length > 0) {
        const result = showBias(
          responseDataRef.current,
          biasCanvasRef.current
        );
        setBiasResult({ dir: result.biasDir, str: result.biasStr });
      }
    }
  }, [phase]);

  // ==================== Render ====================

  const renderHeader = () => (
    <header className="border-b border-border/50">
      <div className="container max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
        <Eye className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        <span className="text-base font-medium tracking-tight text-foreground">
          Perception Lab
        </span>
      </div>
    </header>
  );

  const renderInstructionShell = (children: React.ReactNode, hideBack = false) => (
    <div className="min-h-screen bg-background">
      {renderHeader()}
      <main className="container max-w-2xl mx-auto px-6 py-12 md:py-20">
        {!hideBack && (
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10 group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to overview
          </button>
        )}
        {children}
      </main>
    </div>
  );

  // General instructions
  if (phase === "general_instructions") {
    return renderInstructionShell(
      <Card className="border-border/60 shadow-none">
        <CardContent className="p-8 space-y-6">
          <h1
            className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Experiment Instructions
          </h1>
          <div className="space-y-4 text-foreground/80 leading-relaxed">
            <p>
              You will participate in an experiment consisting of{" "}
              <strong>{totalBlocks} blocks</strong> of trials. Each trial shows a brief animated
              display. Following the display, you will answer a question about what you saw by
              clicking one of two icons. Specific instructions will be given before the experiment
              begins.
            </p>
            <p>
              The goal is to study how people differ in their perception of
              simple visual scenes. We prefer not to give more information before
              you complete the experiment, to avoid influencing your responses.
            </p>
          </div>
          <div className="pt-4">
            <Button
              size="lg"
              className="h-12 px-8 rounded-xl gap-3 group"
              onClick={() => setPhase("general_instructions_2")}
            >
              Continue
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "general_instructions_2") {
    return renderInstructionShell(
      <Card className="border-border/60 shadow-none">
        <CardContent className="p-8 space-y-6">
          <h2
            className="text-xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Before You Begin
          </h2>
          <div className="space-y-4 text-foreground/80 leading-relaxed">
            <p>
              For the experiment to work well, please close other windows and
              applications, as well as any other browser tabs.
            </p>
            <p>
              It's best to do the experiment in a calm environment where you
              won't be disturbed. Please sit upright without leaning your head to
              either side (this is important), at a comfortable distance from
              your screen.
            </p>
            <p className="font-medium text-foreground">
              For the best experience, please make your browser window as large
              as possible, or use full-screen mode (F11 on most systems).
            </p>
          </div>
          <div className="pt-4">
            <Button
              size="lg"
              className="h-12 px-8 rounded-xl gap-3 group"
              onClick={() => initExperiment()}
            >
              I'm Ready
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "experiment_instructions") {
    return renderInstructionShell(
      <Card className="border-border/60 shadow-none">
        <CardContent className="p-8 space-y-6">
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
            Structure from Motion
          </p>
          <h2
            className="text-xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Surface Orientation Task
          </h2>
          <div className="space-y-4 text-foreground/80 leading-relaxed">
            <p>
              After a briefly presented cross — which you should look at —
              you will see a cloud of moving black dots. It should give you
              the impression of a round surface like a plate,{" "}
              <strong>but that is slanted</strong>.
            </p>
            <p>
              Your task is to{" "}
              <strong>
                report which way this surface is slanted or inclined
              </strong>
              , by choosing from two icons that will appear below the
              display using the <strong>left</strong> and <strong>right arrow keys</strong> on your keyboard.
            </p>
            <p>
              Please press the arrow key corresponding to the icon closest to the way the surface is
              slanted, disregarding its motion. Sometimes the choice won't be
              obvious — choose the one that intuitively seems best.
            </p>
            <p className="text-sm text-muted-foreground italic">
              You will now do {CONFIG.nPracticeTrials} practice trials before the
              real experiment begins.
            </p>
          </div>
          <div className="pt-4">
            <Button
              size="lg"
              className="h-12 px-8 rounded-xl gap-3 group"
              onClick={startTrials}
            >
              Start Practice
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "begin_real") {
    const plan = planRef.current!;
    return renderInstructionShell(
      <Card className="border-border/60 shadow-none">
        <CardContent className="p-8 space-y-6">
          <h2
            className="text-xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Practice Complete
          </h2>
          <div className="space-y-4 text-foreground/80 leading-relaxed">
            <p>
              Good job! You've completed the practice trials. The real experiment
              will now begin.
            </p>
            <p>
              There will be <strong>{totalBlocks} blocks</strong> of{" "}
              <strong>{Math.min(CONFIG.blockSize, plan.trials.length)} trials</strong> each. Your data will
              be stored anonymously. By proceeding, you agree to let us analyze
              this anonymous data.
            </p>
            <p className="text-sm text-muted-foreground">
              Please make sure your window is as large as possible so you can see
              the response icons below the stimulus.
            </p>
          </div>
          <div className="pt-4">
            <Button
              size="lg"
              className="h-12 px-8 rounded-xl gap-3 group"
              onClick={() => {
                blockStartTimeRef.current = Date.now();
                startTrials();
              }}
            >
              Begin Experiment
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Block countdown phase — waiting for timed start
  if (phase === "block_countdown") {
    const isReady = countdownRemaining <= 0;
    const nextBlockIdx = currentBlock + 1;
    const progress = BLOCK_TIMING[nextBlockIdx]
      ? Math.max(0, 100 - (countdownRemaining / (BLOCK_TIMING[nextBlockIdx] * 60)) * 100)
      : 100;

    return renderInstructionShell(
      <Card className="border-border/60 shadow-none">
        <CardContent className="p-8 space-y-6 text-center">
          <h2
            className="text-xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {isReady ? "Ready to Continue!" : "Break Between Blocks"}
          </h2>

          <p className="text-foreground/80">
            Block {currentBlock + 1} of {totalBlocks} complete.
          </p>

          {!isReady ? (
            <>
              <div className="flex flex-col items-center gap-4 py-6">
                <Clock className="h-10 w-10 text-muted-foreground animate-pulse" />
                <div
                  className="text-5xl font-mono font-bold tracking-widest text-foreground tabular-nums"
                >
                  {formatCountdown(countdownRemaining)}
                </div>
                <p className="text-sm text-muted-foreground">
                  until block {nextBlockIdx + 1} begins
                </p>
              </div>

              <div className="w-full bg-secondary rounded-full h-2 max-w-sm mx-auto">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="text-xs text-muted-foreground italic">
                Please stay nearby. An alarm will sound when it's time to continue.
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-4 py-6">
                <Volume2 className="h-10 w-10 text-primary animate-bounce" />
                <p className="text-lg font-medium text-foreground">
                  The next block is ready to start!
                </p>
              </div>

              <div className="pt-2">
                <Button
                  size="lg"
                  className="h-12 px-8 rounded-xl gap-3 group"
                  onClick={() => startBlock(nextBlockIdx)}
                >
                  Start Block {nextBlockIdx + 1}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>,
      true
    );
  }

  if (phase === "results") {
    return renderInstructionShell(
      <div className="space-y-8">
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-8 space-y-6 text-center">
            <h2
              className="text-2xl font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Experiment Complete
            </h2>
            <p className="text-foreground/80">
              Thank you very much for participating! You completed all{" "}
              {totalBlocks} blocks. We appreciate the time you've spent helping
              us with our research.
            </p>


            <div className="pt-4">
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 rounded-xl gap-3 group"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Running phase — canvas display
  if (phase === "running") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ backgroundColor: `rgb(128,128,128)`, cursor: "none" }}
      >
        <div className="relative flex items-center justify-center" style={{ marginTop: "-20px", width: CONFIG.size, height: CONFIG.size }}>
          <canvas
            ref={canvasRef}
            width={CONFIG.size}
            height={CONFIG.size}
            style={{
              display: "block",
              borderRadius: "4px",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          />
          <div
            ref={responseContainerRef}
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 10 }}
          />
        </div>
      </div>
    );
  }

  // Fallback
  return null;
};

export default Experiment;
