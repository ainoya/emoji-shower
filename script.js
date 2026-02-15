const canvas = document.getElementById("playground");
const clearMobileButton = document.getElementById("clear-mobile");
const ctx = canvas.getContext("2d");

const GRAVITY = 0.22;
const AIR_DRAG = 0.996;
const BOUNCE = 0.02;
const COLLISION_DAMPING = 0.92;
const SLEEP_SPEED_SQ = 0.045;
const SLEEP_FRAMES = 6;

const emojiByLetter = {
  a: ["🍎", "🐜", "🛩️", "🥑", "🅰️"],
  b: ["🍌", "🐻", "⚽", "🚌", "🫧"],
  c: ["🐱", "🚗", "🥕", "☁️", "🍪"],
  d: ["🐶", "🐬", "🍩", "🦆", "🧃"],
  e: ["🥚", "🦅", "🐘", "🌎", "🚨"],
  f: ["🐟", "🦊", "🌸", "🔥", "🍟"],
  g: ["🍇", "🦒", "🎁", "👻", "🌍"],
  h: ["🏠", "❤️", "🎩", "🐹", "🍯"],
  i: ["🍦", "🧊", "🪲", "📷", "🆔"],
  j: ["🧃", "🤹", "🕹️", "🇯🇵", "🍇"],
  k: ["🔑", "🪁", "🐨", "🥝", "🏰"],
  l: ["🦁", "🍋", "💡", "🦙", "🌿"],
  m: ["🌙", "🍈", "🧲", "🍄", "📯"],
  n: ["📰", "👃", "🪺", "🌃", "🔢"],
  o: ["🐙", "🦉", "🧅", "⭕", "🛢️"],
  p: ["🐼", "🍍", "🍕", "🐧", "🎈"],
  q: ["👑", "❓", "🇶🇦", "🧑‍🚀", "⚛️"],
  r: ["🤖", "🌈", "🚀", "🌹", "🦏"],
  s: ["⭐", "🐍", "☀️", "🧦", "🍓"],
  t: ["🐯", "🌮", "🚂", "🌳", "🎯"],
  u: ["☂️", "🦄", "🛸", "⬆️", "🦔"],
  v: ["🎻", "🌋", "🎮", "🏐", "✅"],
  w: ["🍉", "🐋", "🪟", "⌚", "🌊"],
  x: ["❌", "📦", "🩻", "🧬", "⚔️"],
  y: ["🪀", "🛳️", "💴", "🟡", "🧘"],
  z: ["🦓", "⚡", "🤐", "💤", "🛣️"],
};

const fallbackEmojis = [
  "😀",
  "😎",
  "🎉",
  "🌈",
  "🍭",
  "🧸",
  "🎵",
  "✨",
  "🫧",
  "🍀",
];
const tapEmojis = [...new Set([...Object.values(emojiByLetter).flat(), ...fallbackEmojis])];

let particles = [];
let width = 0;
let height = 0;
let hasInteracted = false;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  width = Math.max(320, Math.floor(rect.width));
  height = Math.max(320, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function randomFrom(list) {
  return list[(Math.random() * list.length) | 0];
}

function emojiForKey(key) {
  if (key === "__tap__") {
    return randomFrom(tapEmojis);
  }
  const lower = key.toLowerCase();
  if (/^[a-z]$/.test(lower)) {
    return randomFrom(emojiByLetter[lower]);
  }
  if (key === " ") {
    return "☁️";
  }
  return randomFrom(fallbackEmojis);
}

function spawnEmoji(key, options = {}) {
  const emoji = emojiForKey(key);
  const size = 44 + Math.random() * 64;
  const radius = size * 0.43;
  const x =
    typeof options.x === "number"
      ? Math.min(width - radius, Math.max(radius, options.x))
      : radius + Math.random() * Math.max(1, width - radius * 2);
  const y =
    typeof options.y === "number"
      ? Math.min(height - radius, Math.max(radius, options.y))
      : -radius - Math.random() * 60;

  particles.push({
    emoji,
    x,
    y,
    vx: (Math.random() - 0.5) * 1.8,
    vy: Math.random() * 0.3,
    radius,
    size,
    asleep: false,
    sleepFrames: 0,
  });
}

function solveCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minDist = a.radius + b.radius;
  const distSq = dx * dx + dy * dy;

  if (distSq <= 0.0001 || distSq >= minDist * minDist) {
    return;
  }

  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;
  const correction = overlap * 0.75;

  if (a.asleep && b.asleep) {
    return;
  }
  if (a.asleep) {
    b.x += nx * correction;
    b.y += ny * correction;
  } else if (b.asleep) {
    a.x -= nx * correction;
    a.y -= ny * correction;
  } else {
    a.x -= nx * correction * 0.5;
    a.y -= ny * correction * 0.5;
    b.x += nx * correction * 0.5;
    b.y += ny * correction * 0.5;
  }

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const sepSpeed = rvx * nx + rvy * ny;

  if (a.asleep) {
    const speed = b.vx * nx + b.vy * ny;
    if (speed >= 0) {
      return;
    }
    b.vx -= speed * nx;
    b.vy -= speed * ny;
    b.vx *= COLLISION_DAMPING;
    b.vy *= COLLISION_DAMPING;
    return;
  }

  if (b.asleep) {
    const speed = a.vx * nx + a.vy * ny;
    if (speed <= 0) {
      return;
    }
    a.vx -= speed * nx;
    a.vy -= speed * ny;
    a.vx *= COLLISION_DAMPING;
    a.vy *= COLLISION_DAMPING;
    return;
  }

  if (sepSpeed > 0) {
    return;
  }

  const impulse = -(1 + BOUNCE) * sepSpeed * 0.5;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;

  a.vx *= COLLISION_DAMPING;
  a.vy *= COLLISION_DAMPING;
  b.vx *= COLLISION_DAMPING;
  b.vy *= COLLISION_DAMPING;
}

function updateParticles() {
  for (const p of particles) {
    if (p.asleep) {
      continue;
    }
    p.vy += GRAVITY;
    p.vx *= AIR_DRAG;
    p.vy *= AIR_DRAG;
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < p.radius) {
      p.x = p.radius;
      p.vx *= -0.35;
    } else if (p.x > width - p.radius) {
      p.x = width - p.radius;
      p.vx *= -0.35;
    }

    if (p.y > height - p.radius) {
      p.y = height - p.radius;
      p.vy *= -0.08;
      p.vx *= 0.86;
    }
  }

  for (let i = 0; i < particles.length; i += 1) {
    for (let j = i + 1; j < particles.length; j += 1) {
      solveCollision(particles[i], particles[j]);
    }
  }

  for (const p of particles) {
    if (p.asleep) {
      continue;
    }
    const speedSq = p.vx * p.vx + p.vy * p.vy;
    if (speedSq < SLEEP_SPEED_SQ && p.y > height * 0.25) {
      p.sleepFrames += 1;
    } else {
      p.sleepFrames = 0;
    }
    if (p.sleepFrames >= SLEEP_FRAMES) {
      p.asleep = true;
      p.x = Math.round(p.x * 2) / 2;
      p.y = Math.round(p.y * 2) / 2;
      p.vx = 0;
      p.vy = 0;
    }
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let i = 0; i < 6; i += 1) {
    const size = 28 + i * 10;
    ctx.beginPath();
    ctx.arc((width / 6) * i + 30, 18 + (i % 2) * 12, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of particles) {
    ctx.font = `${p.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(p.emoji, p.x, p.y + 1);
  }
}

function drawHint() {
  if (hasInteracted) {
    return;
  }
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 32px "Verdana", sans-serif';
  ctx.fillText("press any key", width / 2, height / 2);
}

function tick() {
  drawBackground();
  updateParticles();
  drawParticles();
  drawHint();
  requestAnimationFrame(tick);
}

function clearAll() {
  particles = [];
  hasInteracted = false;
}

window.addEventListener("resize", resizeCanvas);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearAll();
    return;
  }

  hasInteracted = true;
  if (event.repeat) {
    for (let i = 0; i < 2; i += 1) {
      spawnEmoji(event.key);
    }
    return;
  }
  spawnEmoji(event.key);
});

function spawnAtPoint(x, y) {
  hasInteracted = true;
  spawnEmoji("__tap__", {
    x,
    y,
  });
}

if ("PointerEvent" in window) {
  window.addEventListener("pointerdown", (event) => {
    spawnAtPoint(event.clientX, event.clientY);
  });
} else {
  window.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }
      spawnAtPoint(touch.clientX, touch.clientY);
    },
    { passive: true },
  );
}

if (clearMobileButton) {
  clearMobileButton.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  clearMobileButton.addEventListener("touchstart", (event) => {
    event.stopPropagation();
  });
  clearMobileButton.addEventListener("click", (event) => {
    event.stopPropagation();
    clearAll();
  });
}

resizeCanvas();
tick();
