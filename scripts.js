let currentNumber = 0;
let numbers = [];
let numbersPosibles = [];
let numbersTaken = [];
let inCourse = false;
let resultSort = false;
let timerId = 0;
let countdownIntervalId = 0;
let nextDrawAt = 0;
let nextDrawDelayMs = 0;
let remainingMs = 0;
let gameState = "idle";
let speechEnabled = true;

const COUNTDOWN_RADIUS = 42;
const COUNTDOWN_CIRCUMFERENCE = 2 * Math.PI * COUNTDOWN_RADIUS;

const $ = (selector) => document.querySelector(selector);

const setStatus = (text) => {
  const statusEl = $("#status");
  if (statusEl) statusEl.textContent = text;
};

const updateActionButtons = () => {
  const primaryAction = $("#primaryAction");
  const pauseAction = $("#pauseAction");
  const resumeAction = $("#resumeAction");
  if (!primaryAction || !pauseAction || !resumeAction) return;

  const isIdle = gameState === "idle";
  const isRunning = gameState === "running";
  const isPaused = gameState === "paused";
  const isFinished = gameState === "finished";

  primaryAction.textContent = isIdle || isFinished ? "Iniciar Juego" : "Reiniciar Juego";
  primaryAction.disabled = false;
  pauseAction.disabled = !isRunning;
  resumeAction.disabled = !isPaused;
};

const setGameState = (nextState) => {
  const previousState = gameState;
  gameState = nextState;
  inCourse = nextState === "running";

  if (nextState === "idle") setStatus("Sin Iniciar");
  if (nextState === "running") setStatus("En Curso");
  if (nextState === "paused") setStatus("En Pausa");
  if (nextState === "finished") setStatus("Juego Terminado");

  updateActionButtons();

  if (previousState !== nextState) {
    speak($("#status")?.textContent || "");
  }
};

const updateCurrent = () => {
  const currentEl = $("#currentNumber");
  if (currentEl) currentEl.textContent = currentNumber;
};

const speak = (text) => {
  if (!speechEnabled || !("speechSynthesis" in window)) return;

  const message = String(text || "").trim();
  if (!message) return;

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "es-ES";
  utterance.rate = 0.9;
  utterance.pitch = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

const updateTaken = () => {
  const values = resultSort ? [...numbersTaken].sort((a, b) => a - b) : numbersTaken;
  const takenEl = $("#numbersTaken");
  if (!takenEl) return;

  takenEl.innerHTML = values
    .map((value) => `<span class='text-center'> ${value} </span>`)
    .join("");
};

const updateCountdown = (remaining, total) => {
  const ringEl = $("#countdownRing");
  const secondsEl = $("#countdownSeconds");
  if (!ringEl || !secondsEl) return;

  const safeRemaining = Math.max(0, remaining);
  const safeTotal = Math.max(1, total);
  const progress = Math.min(1, safeRemaining / safeTotal);

  ringEl.style.strokeDasharray = `${COUNTDOWN_CIRCUMFERENCE} ${COUNTDOWN_CIRCUMFERENCE}`;
  ringEl.style.strokeDashoffset = String(COUNTDOWN_CIRCUMFERENCE * (1 - progress));
  secondsEl.textContent = String(Math.ceil(safeRemaining / 1000));
};

const clearCountdownInterval = () => {
  clearInterval(countdownIntervalId);
  countdownIntervalId = 0;
};

const stopTimer = () => {
  clearTimeout(timerId);
  timerId = 0;
};

const startCountdownTicker = (totalMs) => {
  clearCountdownInterval();

  const tick = () => {
    const remaining = Math.max(0, nextDrawAt - Date.now());
    remainingMs = remaining;
    updateCountdown(remaining, totalMs);

    if (remaining === 0) {
      clearCountdownInterval();
    }
  };

  tick();
  countdownIntervalId = setInterval(tick, 100);
};

const scheduleNext = (delayMs) => {
  if (!inCourse || numbersPosibles.length === 0) return;

  const configuredDelay = (Number($("#timer")?.value) || 0) * 1000;
  const nextDelay = Math.max(0, Math.round(delayMs ?? configuredDelay));

  stopTimer();
  clearCountdownInterval();

  nextDrawDelayMs = nextDelay;
  remainingMs = nextDelay;
  nextDrawAt = Date.now() + nextDelay;

  if (nextDelay === 0) {
    updateCountdown(0, 1);
    timerId = setTimeout(takeNumber, 0);
    return;
  }

  startCountdownTicker(nextDelay);
  timerId = setTimeout(() => {
    stopTimer();
    clearCountdownInterval();
    takeNumber();
  }, nextDelay);
};

const finishGame = () => {
  stopTimer();
  clearCountdownInterval();
  remainingMs = 0;
  updateCountdown(0, nextDrawDelayMs || 1);
  setGameState("finished");
};

const takeNumber = () => {
  const randomIndex = Math.floor(Math.random() * numbersPosibles.length);
  currentNumber = numbersPosibles.splice(randomIndex, 1)[0];
  numbersTaken.push(currentNumber);

  updateCurrent();
  speak(currentNumber);
  updateTaken();

  if (numbersPosibles.length === 0) {
    finishGame();
    return;
  }

  scheduleNext();
};

window.changeSort = () => {
  resultSort = !resultSort;
  updateTaken();
};

window.resetGame = () => {
  const max = Math.max(0, parseInt($("#options")?.value, 10) || 0);

  numbers = Array.from({ length: max }, (_, index) => index + 1);
  numbersPosibles = [...numbers];
  numbersTaken = [];
  currentNumber = 0;

  stopTimer();
  clearCountdownInterval();
  updateCurrent();
  updateTaken();

  if (numbersPosibles.length === 0) {
    remainingMs = 0;
    updateCountdown(0, 1);
    setGameState("finished");
    return;
  }

  setGameState("running");
  scheduleNext();
};

window.pauseGame = () => {
  if (!inCourse) return;

  remainingMs = Math.max(0, nextDrawAt - Date.now());
  stopTimer();
  clearCountdownInterval();
  updateCountdown(remainingMs, nextDrawDelayMs || Math.max(remainingMs, 1));
  setGameState("paused");
};

window.resumeGame = () => {
  if (inCourse || numbersPosibles.length === 0 || gameState !== "paused") return;

  setGameState("running");
  scheduleNext(remainingMs > 0 ? remainingMs : undefined);
};

const initializeCountdown = () => {
  const timerInput = $("#timer");
  const speechInput = $("#speechEnabled");
  const initialMs = Math.max(0, (Number(timerInput?.value) || 0) * 1000);

  updateCountdown(initialMs, Math.max(1, initialMs));
  speechEnabled = speechInput?.checked ?? true;

  timerInput?.addEventListener("input", () => {
    if (gameState !== "idle" && gameState !== "finished") return;

    const previewMs = Math.max(0, (Number(timerInput.value) || 0) * 1000);
    remainingMs = previewMs;
    updateCountdown(previewMs, Math.max(1, previewMs));
  });

  speechInput?.addEventListener("change", () => {
    speechEnabled = speechInput.checked;
    if (!speechEnabled && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  });

  setGameState("idle");
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeCountdown);
} else {
  initializeCountdown();
}
