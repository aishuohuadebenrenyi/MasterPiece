const { createCanvas, registerFont } = require('/tmp/share-covers/node_modules/canvas');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../frontend/assets/share');
const W = 500;
const H = 400;

// Try to register a Chinese-capable font on macOS
const fontPaths = [
  '/System/Library/Fonts/PingFang.ttc',
  '/System/Library/Fonts/STHeiti Light.ttc',
  '/System/Library/Fonts/Hiragino Sans GB.ttc',
  '/Library/Fonts/Arial Unicode.ttf',
];

let fontFamily = 'sans-serif';
for (const fp of fontPaths) {
  if (fs.existsSync(fp)) {
    try {
      registerFont(fp, { family: 'CustomFont' });
      fontFamily = 'CustomFont';
      console.log(`Registered font: ${fp}`);
      break;
    } catch (e) {
      console.log(`Failed to register ${fp}: ${e.message}`);
    }
  }
}

function drawDiagonalGradient(ctx, color1, color2) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, color1);
  grad.addColorStop(1, color2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawVerticalGradient(ctx, color1, color2) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, color1);
  grad.addColorStop(1, color2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawPillTag(ctx, text, y) {
  ctx.font = `bold 42px "${fontFamily}"`;
  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const pillW = textW + 60;
  const pillH = 64;
  const pillX = (W - pillW) / 2;
  const pillY = y - pillH / 2;
  const r = pillH / 2;

  // White pill with slight transparency
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.moveTo(pillX + r, pillY);
  ctx.lineTo(pillX + pillW - r, pillY);
  ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + r, r);
  ctx.lineTo(pillX + pillW, pillY + pillH - r);
  ctx.arcTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH, r);
  ctx.lineTo(pillX + r, pillY + pillH);
  ctx.arcTo(pillX, pillY + pillH, pillX, pillY + pillH - r, r);
  ctx.lineTo(pillX, pillY + r);
  ctx.arcTo(pillX, pillY, pillX + r, pillY, r);
  ctx.closePath();
  ctx.fill();

  // Text inside pill - use dark color for contrast
  ctx.fillStyle = '#24324a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, y);
}

function drawWatermark(ctx, text, size = 14) {
  ctx.font = `${size}px "${fontFamily}"`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, W - 20, H - 16);
}

function drawSubtleText(ctx, text, y) {
  ctx.font = `300 22px "${fontFamily}"`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, y);
}

function drawDecorativeCircles(ctx) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(W * 0.85, H * 0.15, 60, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W * 0.15, H * 0.85, 40, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W * 0.9, H * 0.75, 25, 0, Math.PI * 2);
  ctx.stroke();
}

// ===== 1. share-brand.png =====
function createBrandCover() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawDiagonalGradient(ctx, '#ff7a45', '#4f8cff');
  drawDecorativeCircles(ctx);

  ctx.font = `bold 56px "${fontFamily}"`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('即兴工具箱', W / 2, H / 2 - 20);

  ctx.font = `300 22px "${fontFamily}"`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText('找素材 · 快记录 · 可沉淀', W / 2, H / 2 + 35);

  drawWatermark(ctx, 'IMPROV');

  return canvas;
}

// ===== 2. share-material-orange.png =====
function createMaterialOrange() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawVerticalGradient(ctx, '#ff7a45', '#ff965e');
  drawDecorativeCircles(ctx);

  drawPillTag(ctx, '即兴素材', H / 2 - 10);
  drawSubtleText(ctx, '游戏 · 才艺', H / 2 + 50);
  drawWatermark(ctx, '即兴工具箱');

  return canvas;
}

// ===== 3. share-material-blue.png =====
function createMaterialBlue() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawVerticalGradient(ctx, '#4f8cff', '#7fb1ff');
  drawDecorativeCircles(ctx);

  drawPillTag(ctx, '即兴素材', H / 2 - 10);
  drawSubtleText(ctx, '角色 · 格式 · 技巧', H / 2 + 50);
  drawWatermark(ctx, '即兴工具箱');

  return canvas;
}

// ===== 4. share-material-mint.png =====
function createMaterialMint() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawVerticalGradient(ctx, '#35bfa6', '#7ce0cf');
  drawDecorativeCircles(ctx);

  drawPillTag(ctx, '即兴素材', H / 2 - 10);
  drawSubtleText(ctx, '复盘 · 路径', H / 2 + 50);
  drawWatermark(ctx, '即兴工具箱');

  return canvas;
}

// ===== 5. share-rehearsal.png =====
function createRehearsal() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawDiagonalGradient(ctx, '#35bfa6', '#4f8cff');
  drawDecorativeCircles(ctx);

  drawPillTag(ctx, '排练复盘', H / 2 - 10);
  drawSubtleText(ctx, 'Keep · Try · 下次提醒', H / 2 + 50);
  drawWatermark(ctx, '即兴工具箱');

  return canvas;
}

// Generate all covers
const covers = [
  { name: 'share-brand.png', fn: createBrandCover },
  { name: 'share-material-orange.png', fn: createMaterialOrange },
  { name: 'share-material-blue.png', fn: createMaterialBlue },
  { name: 'share-material-mint.png', fn: createMaterialMint },
  { name: 'share-rehearsal.png', fn: createRehearsal },
];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const { name, fn } of covers) {
  const canvas = fn();
  const outPath = path.join(OUTPUT_DIR, name);
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buf);
  console.log(`✅ ${name} (${buf.length} bytes) → ${outPath}`);
}

console.log('\nAll 5 share covers generated!');
