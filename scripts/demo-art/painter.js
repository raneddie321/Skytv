/* eslint-disable */
/**
 * Procedural artwork painter for the OFFLINE DEMO CATALOG.
 * Runs inside Chromium (canvas 2D). Produces cinematic-looking scenes without any third-party imagery.
 * window.paintArt(canvas, spec, variant) where
 *   spec    = { scene, palette: [skyTop, horizon, accent], figure?, creatures?, seed }
 *   variant = { kind: 'backdrop'|'poster'|'still'|'programme'|'avatar', index }
 */
(function () {
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function mix(h1, h2, t) {
    const a = hexToRgb(h1), b = hexToRgb(h2);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function shade(hex, t) {
    return t < 0 ? mix(hex, '#000000', -t) : mix(hex, '#ffffff', t);
  }

  // ------------------------------------------------------------------ primitives
  function skyGradient(ctx, W, H, top, horizon, horizonY) {
    const g = ctx.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, top);
    g.addColorStop(1, horizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function glow(ctx, x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(0.35, rgba(color, alpha * 0.45));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function clouds(ctx, W, H, rand, color, alpha, yMin, yMax, count) {
    for (let i = 0; i < count; i++) {
      const cx = rand() * W * 1.2 - W * 0.1;
      const cy = yMin + rand() * (yMax - yMin);
      const w = W * (0.15 + rand() * 0.35);
      const h = w * (0.08 + rand() * 0.1);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, h / w);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
      g.addColorStop(0, rgba(color, alpha));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, w, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function ridge(ctx, W, H, rand, baseY, amp, rough, color, opts = {}) {
    // midpoint displacement ridge line
    const n = 257;
    const pts = new Array(n).fill(0);
    pts[0] = rand() * amp;
    pts[n - 1] = rand() * amp;
    let step = n - 1, scale = amp;
    while (step > 1) {
      const half = step >> 1;
      for (let i = half; i < n; i += step) {
        pts[i] = (pts[i - half] + pts[i + half]) / 2 + (rand() - 0.5) * scale;
      }
      scale *= rough;
      step = half;
    }
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < n; i++) ctx.lineTo((i / (n - 1)) * W, baseY - pts[i]);
    ctx.lineTo(W, H);
    ctx.closePath();
    if (opts.gradientTo) {
      const g = ctx.createLinearGradient(0, baseY - amp, 0, H);
      g.addColorStop(0, color);
      g.addColorStop(1, opts.gradientTo);
      ctx.fillStyle = g;
    } else ctx.fillStyle = color;
    ctx.fill();
    if (opts.snow) {
      ctx.save();
      ctx.clip();
      const g2 = ctx.createLinearGradient(0, baseY - amp, 0, baseY - amp * 0.25);
      g2.addColorStop(0, rgba(opts.snow, 0.85));
      g2.addColorStop(1, rgba(opts.snow, 0));
      ctx.fillStyle = g2;
      ctx.fillRect(0, baseY - amp * 1.2, W, amp);
      ctx.restore();
    }
    return pts;
  }

  function haze(ctx, W, y, h, color, alpha) {
    const g = ctx.createLinearGradient(0, y - h, 0, y + h);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.5, rgba(color, alpha));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - h, W, h * 2);
  }

  function stars(ctx, W, H, rand, count, maxY, color = '#ffffff') {
    for (let i = 0; i < count; i++) {
      const x = rand() * W, y = rand() * maxY;
      const r = rand() < 0.97 ? rand() * 1.2 + 0.3 : rand() * 2 + 1.2;
      ctx.fillStyle = rgba(color, 0.3 + rand() * 0.7);
      ctx.beginPath();
      ctx.arc(x, y, r * (W / 1920), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function skyline(ctx, W, rand, baseY, minH, maxH, color, opts = {}) {
    let x = -20;
    const unit = W / 1920;
    while (x < W + 20) {
      const w = (30 + rand() * 90) * unit * (opts.widthScale || 1);
      let h = minH + Math.pow(rand(), 1.6) * (maxH - minH);
      if (opts.towerAt && Math.abs(x - opts.towerAt) < W * 0.08) h *= 1.6;
      ctx.fillStyle = color;
      ctx.fillRect(x, baseY - h, w + 1, h + 400);
      if (rand() < 0.25) {
        // antenna / spire
        ctx.fillRect(x + w / 2 - 1.5 * unit, baseY - h - 40 * unit * rand(), 3 * unit, 40 * unit);
      }
      if (rand() < 0.2) {
        ctx.beginPath();
        ctx.moveTo(x, baseY - h);
        ctx.lineTo(x + w / 2, baseY - h - w * 0.5);
        ctx.lineTo(x + w, baseY - h);
        ctx.fill();
      }
      if (opts.windows) {
        const cols = Math.max(1, Math.floor(w / (9 * unit)));
        const rows = Math.floor(h / (12 * unit));
        for (let r = 1; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (rand() < opts.windows.density) {
              ctx.fillStyle = rgba(opts.windows.color, 0.35 + rand() * 0.6);
              ctx.fillRect(x + 3 * unit + c * 9 * unit, baseY - h + r * 12 * unit, 4 * unit, 5 * unit);
            }
          }
        }
      }
      x += w + rand() * 6 * unit;
    }
  }

  function grain(ctx, W, H, rand, amount) {
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rand() - 0.5) * amount;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }

  function vignette(ctx, W, H, strength) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ------------------------------------------------------------------ figures
  function personPath(ctx, x, baseY, h, rand, opts = {}) {
    // Head-and-shoulders portrait silhouette (x = centre, baseY = bottom edge, h = height)
    const s = h / 100;
    const t = (opts.turn || 0) * s;
    ctx.beginPath();
    // skull + hair
    ctx.moveTo(x - 7.4 * s + t, baseY - 84 * s);
    ctx.bezierCurveTo(x - 8.2 * s + t, baseY - 95 * s, x - 3 * s + t, baseY - 99.5 * s, x + 1 * s + t, baseY - 99.5 * s);
    ctx.bezierCurveTo(x + 6.5 * s + t, baseY - 99.5 * s, x + 9 * s + t, baseY - 94 * s, x + 8.4 * s + t, baseY - 86 * s);
    // ear + jaw
    ctx.bezierCurveTo(x + 9.6 * s + t, baseY - 85 * s, x + 9.4 * s + t, baseY - 81.5 * s, x + 8 * s + t, baseY - 81 * s);
    ctx.bezierCurveTo(x + 7.4 * s + t, baseY - 77 * s, x + 4.5 * s + t, baseY - 74.5 * s, x + 1.5 * s + t, baseY - 74 * s);
    // neck
    ctx.lineTo(x + 5 * s, baseY - 71 * s);
    // shoulders + coat
    ctx.bezierCurveTo(x + 12 * s, baseY - 68.5 * s, x + 22 * s, baseY - 67 * s, x + 25 * s, baseY - 60 * s);
    ctx.bezierCurveTo(x + 28 * s, baseY - 50 * s, x + 29 * s, baseY - 22 * s, x + 30 * s, baseY);
    ctx.lineTo(x - 30 * s, baseY);
    ctx.bezierCurveTo(x - 29 * s, baseY - 22 * s, x - 28 * s, baseY - 50 * s, x - 25 * s, baseY - 60 * s);
    ctx.bezierCurveTo(x - 22 * s, baseY - 67 * s, x - 12 * s, baseY - 68.5 * s, x - 5 * s, baseY - 71 * s);
    ctx.lineTo(x - 4.5 * s + t, baseY - 75 * s);
    ctx.bezierCurveTo(x - 7 * s + t, baseY - 77 * s, x - 8 * s + t, baseY - 80 * s, x - 7.4 * s + t, baseY - 84 * s);
    ctx.closePath();
  }

  /** Fills a figure path with a dark body, soft key-light shading and a crisp rim light on the lit side. */
  function shadeFigure(ctx, drawPath, bounds, dark, rim, side, W) {
    const u = W / 1920;
    ctx.save();
    drawPath();
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.clip();
    const lx = bounds.x + side * bounds.w * 0.7, ly = bounds.y + bounds.h * 0.15;
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, bounds.h * 0.75);
    g.addColorStop(0, rgba(rim, 0.38));
    g.addColorStop(0.5, rgba(rim, 0.08));
    g.addColorStop(1, rgba(rim, 0));
    ctx.fillStyle = g;
    ctx.fillRect(bounds.x - bounds.w, bounds.y - bounds.h, bounds.w * 3, bounds.h * 3);
    // rim: fill lit colour, then cover with the same shape shifted away from the light
    ctx.fillStyle = rgba(rim, 0.85);
    ctx.fillRect(bounds.x - bounds.w, bounds.y - bounds.h, bounds.w * 3, bounds.h * 3);
    ctx.translate(-side * 4 * u, 3 * u);
    drawPath();
    const g2 = ctx.createRadialGradient(lx, ly, 0, lx, ly, bounds.h * 0.8);
    g2.addColorStop(0, mix(dark, rim, 0.28));
    g2.addColorStop(0.45, mix(dark, rim, 0.06));
    g2.addColorStop(1, dark);
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.restore();
  }

  function standingPerson(ctx, x, baseY, h) {
    const s = h / 100;
    ctx.beginPath();
    ctx.arc(x, baseY - 92 * s, 6 * s, 0, Math.PI * 2);
    ctx.moveTo(x - 9 * s, baseY - 82 * s);
    ctx.lineTo(x + 9 * s, baseY - 82 * s);
    ctx.lineTo(x + 11 * s, baseY - 45 * s);
    ctx.lineTo(x + 7 * s, baseY - 45 * s);
    ctx.lineTo(x + 6 * s, baseY);
    ctx.lineTo(x + 1 * s, baseY);
    ctx.lineTo(x, baseY - 40 * s);
    ctx.lineTo(x - 1 * s, baseY);
    ctx.lineTo(x - 6 * s, baseY);
    ctx.lineTo(x - 7 * s, baseY - 45 * s);
    ctx.lineTo(x - 11 * s, baseY - 45 * s);
    ctx.closePath();
    ctx.fill();
  }

  function rider(ctx, x, baseY, h) {
    const s = h / 100;
    ctx.beginPath();
    // horse body
    ctx.ellipse(x, baseY - 42 * s, 26 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    // neck/head
    ctx.moveTo(x + 18 * s, baseY - 48 * s);
    ctx.lineTo(x + 34 * s, baseY - 70 * s);
    ctx.lineTo(x + 42 * s, baseY - 64 * s);
    ctx.lineTo(x + 28 * s, baseY - 38 * s);
    ctx.fill();
    // legs
    [-20, -12, 14, 21].forEach((dx, i) => ctx.fillRect(x + dx * s, baseY - 36 * s, 3.5 * s, 36 * s - (i % 2) * 2 * s));
    // tail
    ctx.beginPath();
    ctx.moveTo(x - 25 * s, baseY - 46 * s);
    ctx.quadraticCurveTo(x - 38 * s, baseY - 36 * s, x - 33 * s, baseY - 18 * s);
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.stroke();
    // rider
    ctx.beginPath();
    ctx.arc(x - 2 * s, baseY - 82 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - 2 * s, baseY - 87 * s, 10 * s, 2 * s, 0, 0, Math.PI * 2); // hat brim
    ctx.fill();
    ctx.fillRect(x - 7 * s, baseY - 77 * s, 11 * s, 26 * s);
  }

  function drawFigure(ctx, W, H, rand, spec, variant, horizonY) {
    const kind = spec.figure || 'none';
    if (kind === 'none') return;
    const dark = shade(spec.palette[0], -0.75);
    const rim = spec.palette[2];
    const portrait = variant.kind === 'poster';
    const shift = variant.kind === 'still' ? (variant.index % 2 ? -0.18 : 0.08) : 0;
    if (kind === 'lone' || kind === 'pair') {
      const people = kind === 'pair' ? 2 : 1;
      const side = (spec.lightSide || 1);
      for (let p = people - 1; p >= 0; p--) {
        const h = H * (portrait ? 0.62 : 0.88) * (p ? 0.93 : 1);
        const cx = W * ((portrait ? 0.5 : 0.66) + shift + (people === 2 ? (p ? 0.1 : -0.04) : 0));
        const bounds = { x: cx - h * 0.3, y: H - h, w: h * 0.6, h };
        ctx.save();
        ctx.shadowColor = rgba(rim, 0.35);
        ctx.shadowBlur = 40 * (W / 1920);
        shadeFigure(ctx, () => personPath(ctx, cx, H + 2, h, rand, { turn: p ? -1.5 : 1.2 }), bounds, dark, rim, side, W);
        ctx.restore();
      }
    } else if (kind === 'group') {
      const n = 3 + Math.floor(rand() * 3);
      ctx.fillStyle = shade(spec.palette[0], -0.7);
      const base = horizonY + H * 0.12;
      for (let i = 0; i < n; i++) {
        const cx = W * ((portrait ? 0.3 : 0.55) + shift + i * (portrait ? 0.1 : 0.06) + rand() * 0.02);
        standingPerson(ctx, cx, base + rand() * H * 0.02, H * (0.2 + rand() * 0.05));
      }
    } else if (kind === 'rider') {
      ctx.fillStyle = shade(spec.palette[0], -0.7);
      rider(ctx, W * (portrait ? 0.5 : 0.68 + shift), horizonY + H * 0.08, H * 0.24);
    } else if (kind === 'climber') {
      ctx.fillStyle = shade(spec.palette[0], -0.6);
      standingPerson(ctx, W * (portrait ? 0.52 : 0.7 + shift), horizonY - H * 0.04, H * 0.1);
    }
  }

  // ------------------------------------------------------------------ scenes
  const scenes = {};

  scenes['city-dusk'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const horizonY = H * 0.68;
    skyGradient(ctx, W, H, top, hor, horizonY);
    const sunX = W * (0.62 + rand() * 0.25), sunY = horizonY - H * 0.08;
    glow(ctx, sunX, sunY, W * 0.5, acc, 0.85);
    glow(ctx, sunX, sunY, W * 0.06, '#ffffff', 0.9);
    clouds(ctx, W, H, rand, shade(top, -0.2), 0.75, H * 0.05, H * 0.35, 14);
    clouds(ctx, W, H, rand, acc, 0.25, H * 0.25, H * 0.5, 10);
    skyline(ctx, W, rand, horizonY, H * 0.12, H * 0.38, mix(hor, top, 0.55), { towerAt: W * 0.75 });
    haze(ctx, W, horizonY - H * 0.04, H * 0.08, acc, 0.25);
    skyline(ctx, W, rand, horizonY + H * 0.02, H * 0.05, H * 0.25, shade(top, -0.5), {
      windows: { color: acc, density: 0.18 },
      widthScale: 1.3,
    });
    // river
    const g = ctx.createLinearGradient(0, horizonY, 0, H);
    g.addColorStop(0, shade(top, -0.45));
    g.addColorStop(1, shade(top, -0.85));
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY + H * 0.02, W, H);
    for (let i = 0; i < 160; i++) {
      const y = horizonY + H * 0.03 + Math.pow(rand(), 1.5) * H * 0.3;
      const x = sunX + (rand() - 0.5) * W * 0.35 * (1 + (y - horizonY) / H);
      ctx.fillStyle = rgba(acc, 0.15 + rand() * 0.4);
      ctx.fillRect(x, y, (10 + rand() * 60) * (W / 1920), 1.5 * (W / 1920));
    }
    // bridge
    ctx.strokeStyle = shade(top, -0.6);
    ctx.lineWidth = 4 * (W / 1920);
    ctx.fillStyle = shade(top, -0.65);
    const by = horizonY + H * 0.06;
    ctx.fillRect(W * 0.7, by, W * 0.35, H * 0.012);
    for (let i = 0; i < 9; i++) {
      const x = W * 0.7 + i * W * 0.04;
      ctx.fillRect(x, by, W * 0.004, H * 0.06);
    }
    ctx.beginPath();
    ctx.moveTo(W * 0.7, by);
    ctx.quadraticCurveTo(W * 0.86, by - H * 0.12, W * 1.02, by);
    ctx.stroke();
    drawFigure(ctx, W, H, rand, spec, variant, horizonY);
    return horizonY;
  };

  scenes['city-night'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const horizonY = H * 0.72;
    skyGradient(ctx, W, H, top, hor, horizonY);
    glow(ctx, W * 0.7, horizonY, W * 0.7, acc, 0.35);
    stars(ctx, W, H, rand, 120, H * 0.4);
    skyline(ctx, W, rand, horizonY, H * 0.15, H * 0.5, mix(top, hor, 0.6), { windows: { color: acc, density: 0.1 } });
    haze(ctx, W, horizonY - H * 0.1, H * 0.1, acc, 0.18);
    skyline(ctx, W, rand, horizonY + H * 0.05, H * 0.1, H * 0.4, shade(top, -0.3), {
      windows: { color: '#ffe7b0', density: 0.22 },
      widthScale: 1.4,
    });
    // wet street
    const g = ctx.createLinearGradient(0, horizonY + H * 0.05, 0, H);
    g.addColorStop(0, shade(top, -0.2));
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY + H * 0.05, W, H);
    for (let i = 0; i < 90; i++) {
      const x = rand() * W, y = horizonY + H * 0.06 + rand() * H * 0.25;
      ctx.fillStyle = rgba(rand() < 0.5 ? acc : '#ffe7b0', 0.1 + rand() * 0.3);
      ctx.fillRect(x, y, 2 * (W / 1920), (20 + rand() * 80) * (W / 1920));
    }
    // rain
    ctx.strokeStyle = 'rgba(200,220,255,0.12)';
    ctx.lineWidth = 1.2 * (W / 1920);
    for (let i = 0; i < 500; i++) {
      const x = rand() * W, y = rand() * H, l = (20 + rand() * 30) * (W / 1920);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - l * 0.25, y + l);
      ctx.stroke();
    }
    drawFigure(ctx, W, H, rand, spec, variant, horizonY);
    return horizonY;
  };

  scenes['coast'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const horizonY = H * 0.6;
    skyGradient(ctx, W, H, top, hor, horizonY);
    const sx = W * (0.3 + rand() * 0.2);
    glow(ctx, sx, horizonY - H * 0.06, W * 0.45, acc, 0.7);
    clouds(ctx, W, H, rand, shade(top, 0.15), 0.5, H * 0.08, H * 0.45, 16);
    // sea
    const g = ctx.createLinearGradient(0, horizonY, 0, H);
    g.addColorStop(0, mix(hor, top, 0.4));
    g.addColorStop(1, shade(top, -0.6));
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY, W, H);
    for (let i = 0; i < 260; i++) {
      const y = horizonY + Math.pow(rand(), 1.3) * (H - horizonY);
      const near = (y - horizonY) / (H - horizonY);
      const x = rand() * W;
      ctx.fillStyle = rgba(rand() < 0.5 ? acc : '#ffffff', 0.08 + rand() * 0.2);
      ctx.fillRect(x, y, (20 + near * 140) * (W / 1920) * rand(), (1 + near * 2) * (W / 1920));
    }
    // cliff
    ctx.fillStyle = shade(top, -0.55);
    ctx.beginPath();
    ctx.moveTo(W * 0.62, H);
    ctx.lineTo(W * 0.66, horizonY - H * 0.06);
    ctx.lineTo(W * 0.74, horizonY - H * 0.14);
    ctx.lineTo(W * 0.86, horizonY - H * 0.16);
    ctx.lineTo(W * 1.0, horizonY - H * 0.2);
    ctx.lineTo(W, H);
    ctx.fill();
    // lighthouse
    const lx = W * 0.8, ly = horizonY - H * 0.155;
    ctx.fillStyle = shade(top, -0.4);
    ctx.beginPath();
    ctx.moveTo(lx - W * 0.012, ly);
    ctx.lineTo(lx - W * 0.007, ly - H * 0.2);
    ctx.lineTo(lx + W * 0.007, ly - H * 0.2);
    ctx.lineTo(lx + W * 0.012, ly);
    ctx.fill();
    ctx.fillRect(lx - W * 0.01, ly - H * 0.23, W * 0.02, H * 0.03);
    glow(ctx, lx, ly - H * 0.215, W * 0.08, '#fff6d8', 0.9);
    ctx.fillStyle = 'rgba(255,246,216,0.08)';
    ctx.beginPath();
    ctx.moveTo(lx, ly - H * 0.215);
    ctx.lineTo(W * 0.2, ly - H * 0.4);
    ctx.lineTo(W * 0.2, ly - H * 0.1);
    ctx.fill();
    drawFigure(ctx, W, H, rand, spec, variant, horizonY);
    return horizonY;
  };

  scenes['storm-sea'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const horizonY = H * 0.55;
    skyGradient(ctx, W, H, top, hor, horizonY);
    glow(ctx, W * 0.72, H * 0.3, W * 0.35, acc, 0.35);
    for (let l = 0; l < 3; l++) clouds(ctx, W, H, rand, shade(top, -0.3 + l * 0.1), 0.6, H * 0.0, H * 0.5, 18);
    // lightning
    if (rand() < 0.8) {
      ctx.strokeStyle = rgba('#e8f4ff', 0.85);
      ctx.lineWidth = 2.5 * (W / 1920);
      let x = W * (0.6 + rand() * 0.25), y = H * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (y < horizonY) {
        x += (rand() - 0.5) * W * 0.04;
        y += H * (0.03 + rand() * 0.05);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      glow(ctx, x, H * 0.3, W * 0.25, '#cfe6ff', 0.25);
    }
    // waves
    for (let layer = 0; layer < 7; layer++) {
      const y0 = horizonY + (layer / 7) * (H - horizonY);
      const amp = H * (0.008 + layer * 0.012);
      ctx.fillStyle = mix(shade(hor, -0.2), shade(top, -0.7), layer / 7);
      ctx.beginPath();
      ctx.moveTo(0, H);
      const ph = rand() * 10;
      for (let x = 0; x <= W; x += W / 120) {
        ctx.lineTo(x, y0 - Math.abs(Math.sin(x / (W * 0.04 * (1 + layer * 0.3)) + ph)) * amp);
      }
      ctx.lineTo(W, H);
      ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.06 + layer * 0.015);
      ctx.lineWidth = 1.5 * (W / 1920);
      ctx.stroke();
    }
    drawFigure(ctx, W, H, rand, spec, variant, horizonY);
    return horizonY;
  };

  scenes['forest'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const horizonY = H * 0.75;
    skyGradient(ctx, W, H, top, hor, H);
    glow(ctx, W * 0.65, H * 0.15, W * 0.6, acc, 0.45);
    // light shafts
    for (let i = 0; i < 7; i++) {
      const x = W * (0.45 + rand() * 0.45);
      ctx.save();
      ctx.translate(x, -H * 0.1);
      ctx.rotate(0.35);
      const g = ctx.createLinearGradient(0, 0, 0, H * 1.3);
      g.addColorStop(0, rgba(acc, 0.22));
      g.addColorStop(1, rgba(acc, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W * (0.01 + rand() * 0.03), H * 1.3);
      ctx.restore();
    }
    for (let layer = 0; layer < 5; layer++) {
      const depth = layer / 4;
      const color = mix(mix(hor, acc, 0.15), shade(top, -0.75), depth);
      const count = 14 + layer * 4;
      for (let i = 0; i < count; i++) {
        const x = rand() * W * 1.1 - W * 0.05;
        const h = H * (0.35 + depth * 0.55) * (0.7 + rand() * 0.5);
        const base = horizonY + depth * H * 0.25;
        const w = h * 0.28;
        ctx.fillStyle = color;
        ctx.fillRect(x - w * 0.03, base - h * 0.2, w * 0.06, h * 0.4);
        for (let t = 0; t < 6; t++) {
          const ty = base - h * (0.15 + t * 0.15);
          const tw = w * (1 - t * 0.15);
          ctx.beginPath();
          ctx.moveTo(x - tw / 2, ty);
          ctx.lineTo(x, ty - h * 0.25);
          ctx.lineTo(x + tw / 2, ty);
          ctx.fill();
        }
      }
      haze(ctx, W, horizonY + depth * H * 0.2, H * 0.14, mix(hor, acc, 0.45), 0.45 - depth * 0.06);
    }
    ctx.fillStyle = shade(top, -0.85);
    ctx.fillRect(0, H * 0.96, W, H);
    drawFigure(ctx, W, H, rand, spec, variant, horizonY);
    return horizonY;
  };

  scenes['mountains'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const horizonY = H * 0.62;
    skyGradient(ctx, W, H, top, hor, horizonY);
    const sx = W * (0.55 + rand() * 0.3);
    glow(ctx, sx, horizonY - H * 0.18, W * 0.45, acc, 0.65);
    clouds(ctx, W, H, rand, acc, 0.22, H * 0.1, H * 0.4, 12);
    const layers = 5;
    for (let i = 0; i < layers; i++) {
      const d = i / (layers - 1);
      const color = mix(mix(hor, top, 0.35), shade(top, -0.7), d);
      ridge(ctx, W, H, rand, horizonY + d * H * 0.3, H * (0.32 - d * 0.18), 0.55, color, {
        snow: i < 2 ? '#ffffff' : null,
        gradientTo: shade(color, -0.3),
      });
      haze(ctx, W, horizonY + d * H * 0.3, H * 0.05, mix(hor, acc, 0.4), 0.3);
    }
    drawFigure(ctx, W, H, rand, spec, variant, horizonY);
    return horizonY;
  };

  scenes['space'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      glow(ctx, W * (0.3 + rand() * 0.7), H * rand(), W * (0.15 + rand() * 0.3), i % 2 ? hor : acc, 0.18);
    }
    ctx.globalCompositeOperation = 'source-over';
    stars(ctx, W, H, rand, 900, H);
    // planet
    const px = W * (0.72 + rand() * 0.1), py = H * (0.95 + rand() * 0.2), pr = W * 0.42;
    const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.5, pr * 0.1, px, py, pr);
    pg.addColorStop(0, mix(hor, acc, 0.4));
    pg.addColorStop(0.6, shade(hor, -0.5));
    pg.addColorStop(1, shade(top, -0.2));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(acc, 0.7);
    ctx.lineWidth = 6 * (W / 1920);
    ctx.shadowColor = acc;
    ctx.shadowBlur = 40 * (W / 1920);
    ctx.beginPath();
    ctx.arc(px, py, pr, Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // moon
    const mx = W * (0.45 + rand() * 0.2), my = H * (0.2 + rand() * 0.2), mr = W * 0.035;
    const mg = ctx.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, 0, mx, my, mr);
    mg.addColorStop(0, '#f2f2f2');
    mg.addColorStop(1, shade(hor, -0.4));
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    // station / ship
    if (spec.figure !== 'none' || variant.index % 2) {
      const sx = W * (0.62 + (variant.index % 3) * 0.05), sy = H * 0.42;
      const u = W / 1920;
      ctx.fillStyle = '#0b0d14';
      ctx.fillRect(sx - 120 * u, sy - 6 * u, 240 * u, 12 * u);
      ctx.fillRect(sx - 30 * u, sy - 26 * u, 60 * u, 52 * u);
      ctx.fillRect(sx - 160 * u, sy - 30 * u, 40 * u, 60 * u);
      ctx.fillRect(sx + 120 * u, sy - 30 * u, 40 * u, 60 * u);
      glow(ctx, sx + 30 * u, sy, 40 * u, acc, 0.9);
    }
    return H * 0.7;
  };

  scenes['desert'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const horizonY = H * 0.62;
    skyGradient(ctx, W, H, top, hor, horizonY);
    const sx = W * (0.6 + rand() * 0.2), sy = horizonY - H * 0.04;
    glow(ctx, sx, sy, W * 0.55, acc, 0.75);
    ctx.fillStyle = rgba('#fff4dc', 0.95);
    ctx.beginPath();
    ctx.arc(sx, sy, W * 0.06, Math.PI, 0);
    ctx.fill();
    clouds(ctx, W, H, rand, acc, 0.2, H * 0.15, H * 0.45, 8);
    for (let i = 0; i < 5; i++) {
      const d = i / 4;
      const base = horizonY + d * H * 0.35;
      const lit = mix(mix(hor, acc, 0.3), shade(top, -0.4), d);
      const dark = shade(lit, -0.45);
      ctx.beginPath();
      ctx.moveTo(0, H);
      const ph = rand() * 10, f = 2 + rand() * 2;
      const pts = [];
      for (let x = 0; x <= W; x += W / 100) {
        const y = base - Math.sin((x / W) * Math.PI * f + ph) * H * (0.04 + d * 0.03) - H * 0.02;
        pts.push([x, y]);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, dark);
      g.addColorStop(Math.min(0.95, sx / W), lit);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.fill();
    }
    drawFigure(ctx, W, H, rand, spec, variant, horizonY);
    return horizonY;
  };

  scenes['arctic'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const horizonY = H * 0.6;
    skyGradient(ctx, W, H, top, hor, horizonY);
    // aurora
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      const y0 = H * (0.15 + b * 0.08);
      for (let x = 0; x <= W; x += W / 60) {
        const y = y0 + Math.sin(x / (W * 0.12) + b + rand() * 0.2) * H * 0.05;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(acc, 0.12);
      ctx.lineWidth = H * 0.08;
      ctx.shadowColor = acc;
      ctx.shadowBlur = 60 * (W / 1920);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    stars(ctx, W, H, rand, 250, horizonY * 0.9);
    // ice field
    const g = ctx.createLinearGradient(0, horizonY, 0, H);
    g.addColorStop(0, mix(hor, '#ffffff', 0.2));
    g.addColorStop(1, shade(top, -0.2));
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY, W, H);
    for (let i = 0; i < 60; i++) {
      const x = rand() * W, y = horizonY + Math.pow(rand(), 1.4) * (H - horizonY);
      const s = (20 + rand() * 120) * (0.4 + (y - horizonY) / (H - horizonY));
      ctx.fillStyle = rgba(rand() < 0.5 ? '#ffffff' : shade(hor, -0.3), 0.15 + rand() * 0.25);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s, y + s * 0.08);
      ctx.lineTo(x + s * 0.7, y + s * 0.2);
      ctx.lineTo(x - s * 0.2, y + s * 0.12);
      ctx.fill();
    }
    ridge(ctx, W, H, rand, horizonY + 2, H * 0.06, 0.5, mix(hor, '#ffffff', 0.35));
    // ship
    if (spec.figure === 'group' || variant.index % 2 === 0) {
      const sx = W * 0.68, sy = horizonY + H * 0.05, u = W / 1920;
      ctx.fillStyle = shade(top, -0.5);
      ctx.beginPath();
      ctx.moveTo(sx - 220 * u, sy - 30 * u);
      ctx.lineTo(sx + 240 * u, sy - 30 * u);
      ctx.lineTo(sx + 200 * u, sy + 10 * u);
      ctx.lineTo(sx - 190 * u, sy + 10 * u);
      ctx.fill();
      [-120, 0, 120].forEach((dx, i) => {
        ctx.fillRect(sx + dx * u, sy - (260 - i * 30) * u, 6 * u, (230 - i * 30) * u);
        for (let y = 0; y < 3; y++) ctx.fillRect(sx + (dx - 50 + y * 8) * u, sy - (230 - i * 30 - y * 60) * u, (106 - y * 16) * u, 4 * u);
      });
      ctx.strokeStyle = shade(top, -0.5);
      ctx.lineWidth = 1.5 * u;
      ctx.beginPath();
      ctx.moveTo(sx - 220 * u, sy - 30 * u);
      ctx.lineTo(sx - 120 * u, sy - 260 * u);
      ctx.lineTo(sx, sy - 230 * u);
      ctx.lineTo(sx + 120 * u, sy - 200 * u);
      ctx.lineTo(sx + 240 * u, sy - 30 * u);
      ctx.stroke();
    }
    return horizonY;
  };

  scenes['stadium'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const horizonY = H * 0.5;
    skyGradient(ctx, W, H, top, hor, horizonY);
    // stands
    const standTop = H * 0.32;
    ctx.fillStyle = shade(top, -0.4);
    ctx.beginPath();
    ctx.moveTo(0, standTop + H * 0.1);
    ctx.quadraticCurveTo(W / 2, standTop - H * 0.05, W, standTop + H * 0.1);
    ctx.lineTo(W, H * 0.62);
    ctx.lineTo(0, H * 0.62);
    ctx.fill();
    // crowd bokeh
    for (let i = 0; i < 2600; i++) {
      const x = rand() * W, y = standTop + H * 0.05 + rand() * H * 0.25;
      const hue = rand();
      ctx.fillStyle = hue < 0.33 ? rgba('#ffffff', 0.25 * rand()) : hue < 0.66 ? rgba(hor, 0.5 * rand()) : rgba(acc, 0.3 * rand());
      ctx.fillRect(x, y, 2.5 * (W / 1920), 2.5 * (W / 1920));
    }
    // floodlights
    [0.12, 0.88, 0.38, 0.62].forEach((fx, i) => {
      const x = W * fx, y = H * (i < 2 ? 0.08 : 0.16);
      ctx.fillStyle = shade(top, -0.5);
      ctx.fillRect(x - 2, y, 4, standTop - y + H * 0.05);
      ctx.fillStyle = '#fffbe8';
      ctx.fillRect(x - W * 0.025, y - H * 0.015, W * 0.05, H * 0.03);
      glow(ctx, x, y, W * 0.22, acc, 0.6);
      glow(ctx, x, y, W * 0.05, '#ffffff', 0.9);
    });
    // pitch
    const pt = H * 0.6;
    const g = ctx.createLinearGradient(0, pt, 0, H);
    g.addColorStop(0, '#1d6a35');
    g.addColorStop(1, '#0c2d17');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(W * 0.1, pt);
    ctx.lineTo(W * 0.9, pt);
    ctx.lineTo(W * 1.4, H);
    ctx.lineTo(-W * 0.4, H);
    ctx.fill();
    for (let s = 0; s < 8; s++) {
      if (s % 2) continue;
      const y1 = pt + Math.pow(s / 8, 1.6) * (H - pt), y2 = pt + Math.pow((s + 1) / 8, 1.6) * (H - pt);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, y1, W, y2 - y1);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3 * (W / 1920);
    ctx.beginPath();
    ctx.moveTo(W * 0.12, pt + H * 0.01);
    ctx.lineTo(W * 0.88, pt + H * 0.01);
    ctx.moveTo(W / 2, pt + H * 0.01);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(W / 2, pt + H * 0.2, W * 0.12, H * 0.07, 0, 0, Math.PI * 2);
    ctx.stroke();
    haze(ctx, W, pt, H * 0.08, acc, 0.15);
    if (spec.figure === 'lone') {
      ctx.fillStyle = shade(top, -0.8);
      standingPerson(ctx, W * 0.66, H * 0.97, H * 0.55);
    } else drawFigure(ctx, W, H, rand, spec, variant, pt + H * 0.15);
    return pt;
  };

  scenes['bokeh'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, top);
    g.addColorStop(1, hor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) {
      const x = W * (0.25 + rand() * 0.8), y = rand() * H, r = W * (0.01 + Math.pow(rand(), 2) * 0.07);
      const c = rand() < 0.6 ? acc : rand() < 0.5 ? '#ffffff' : hor;
      const bg = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
      bg.addColorStop(0, rgba(c, 0.18 + rand() * 0.15));
      bg.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    glow(ctx, W * 0.75, H * 0.45, W * 0.4, acc, 0.25);
    drawFigure(ctx, W, H, rand, spec, variant, H * 0.7);
    return H * 0.7;
  };

  scenes['village'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const horizonY = H * 0.58;
    skyGradient(ctx, W, H, top, hor, horizonY);
    glow(ctx, W * 0.7, horizonY - H * 0.05, W * 0.5, acc, 0.7);
    clouds(ctx, W, H, rand, '#ffffff', 0.25, H * 0.05, H * 0.35, 12);
    const hillColors = [mix(hor, '#4c6b4a', 0.55), mix(hor, '#36513a', 0.7), '#253a2a', '#1a2a1f'];
    hillColors.forEach((c, i) => {
      const base = horizonY + i * H * 0.08;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, H);
      const ph = rand() * 6;
      for (let x = 0; x <= W; x += W / 80) ctx.lineTo(x, base - Math.sin(x / (W * 0.18) + ph) * H * 0.04);
      ctx.lineTo(W, H);
      ctx.fill();
      if (i === 1) {
        // houses
        for (let h = 0; h < 14; h++) {
          const x = W * (0.45 + rand() * 0.5), y = base + H * 0.01;
          const hw = W * (0.02 + rand() * 0.02), hh = hw * 0.7;
          ctx.fillStyle = shade(c, -0.45);
          ctx.fillRect(x, y - hh, hw, hh + H * 0.02);
          ctx.beginPath();
          ctx.moveTo(x - hw * 0.1, y - hh);
          ctx.lineTo(x + hw / 2, y - hh - hw * 0.45);
          ctx.lineTo(x + hw * 1.1, y - hh);
          ctx.fill();
          if (rand() < 0.7) {
            ctx.fillStyle = rgba('#ffd98a', 0.85);
            ctx.fillRect(x + hw * 0.3, y - hh * 0.6, hw * 0.18, hw * 0.18);
          }
        }
        // spire
        const sx = W * 0.62, sy = base - H * 0.02;
        ctx.fillStyle = shade(c, -0.5);
        ctx.fillRect(sx, sy - H * 0.12, W * 0.018, H * 0.14);
        ctx.beginPath();
        ctx.moveTo(sx - W * 0.002, sy - H * 0.12);
        ctx.lineTo(sx + W * 0.009, sy - H * 0.22);
        ctx.lineTo(sx + W * 0.02, sy - H * 0.12);
        ctx.fill();
      }
    });
    drawFigure(ctx, W, H, rand, spec, variant, horizonY);
    return horizonY;
  };

  scenes['savanna'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const horizonY = H * 0.7;
    skyGradient(ctx, W, H, top, hor, horizonY);
    const sx = W * (0.62 + rand() * 0.15), sy = horizonY - H * 0.16;
    glow(ctx, sx, sy, W * 0.55, acc, 0.75);
    ctx.fillStyle = rgba('#fff1cf', 0.95);
    ctx.beginPath();
    ctx.arc(sx, sy, W * 0.075, 0, Math.PI * 2);
    ctx.fill();
    clouds(ctx, W, H, rand, shade(top, -0.2), 0.45, H * 0.1, H * 0.5, 10);
    ctx.fillStyle = shade(top, -0.6);
    ctx.fillRect(0, horizonY, W, H);
    ridge(ctx, W, H, rand, horizonY + 4, H * 0.03, 0.5, shade(top, -0.55));
    const tree = (x, y, s) => {
      ctx.fillStyle = shade(top, -0.8);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.03, y);
      ctx.lineTo(x - s * 0.01, y - s * 0.55);
      ctx.lineTo(x - s * 0.25, y - s * 0.75);
      ctx.lineTo(x + s * 0.0, y - s * 0.62);
      ctx.lineTo(x + s * 0.22, y - s * 0.8);
      ctx.lineTo(x + s * 0.03, y - s * 0.55);
      ctx.lineTo(x + s * 0.03, y);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.82, s * 0.45, s * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    tree(W * 0.78, horizonY + H * 0.02, H * 0.42);
    tree(W * 0.32, horizonY + H * 0.005, H * 0.18);
    // giraffes / animals
    const giraffe = (x, y, s) => {
      ctx.fillStyle = shade(top, -0.8);
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.55, s * 0.18, s * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.12, y - s * 0.6);
      ctx.lineTo(x + s * 0.3, y - s * 1.05);
      ctx.lineTo(x + s * 0.36, y - s * 1.02);
      ctx.lineTo(x + s * 0.2, y - s * 0.5);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + s * 0.37, y - s * 1.05, s * 0.06, s * 0.03, 0.3, 0, Math.PI * 2);
      ctx.fill();
      [-0.12, -0.06, 0.08, 0.14].forEach((dx) => ctx.fillRect(x + dx * s, y - s * 0.5, s * 0.025, s * 0.5));
    };
    giraffe(W * 0.55, horizonY + H * 0.01, H * 0.2);
    giraffe(W * 0.6, horizonY + H * 0.005, H * 0.15);
    // grass
    ctx.strokeStyle = shade(top, -0.85);
    ctx.lineWidth = 2 * (W / 1920);
    for (let i = 0; i < 700; i++) {
      const x = rand() * W, y = H - rand() * H * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + (rand() - 0.5) * 20, y - 20);
      ctx.stroke();
    }
    return horizonY;
  };

  scenes['highway'] = function (ctx, W, H, rand, spec, variant) {
    const [top, hor, acc] = spec.palette;
    const horizonY = H * 0.5;
    skyGradient(ctx, W, H, top, hor, horizonY);
    glow(ctx, W * 0.55, horizonY, W * 0.5, acc, 0.35);
    stars(ctx, W, H, rand, 150, H * 0.35);
    ridge(ctx, W, H, rand, horizonY, H * 0.08, 0.55, shade(top, -0.3));
    skyline(ctx, W * 0.5, rand, horizonY + 2, H * 0.02, H * 0.08, shade(top, -0.4), { windows: { color: acc, density: 0.2 }, widthScale: 0.5 });
    ctx.fillStyle = shade(top, -0.75);
    ctx.fillRect(0, horizonY, W, H);
    const vx = W * 0.55, vy = horizonY;
    ctx.fillStyle = shade(top, -0.55);
    ctx.beginPath();
    ctx.moveTo(vx - W * 0.01, vy);
    ctx.lineTo(vx + W * 0.01, vy);
    ctx.lineTo(W * 1.1, H);
    ctx.lineTo(-W * 0.1, H);
    ctx.fill();
    // light trails
    ctx.globalCompositeOperation = 'lighter';
    const trail = (color, offset) => {
      for (let k = 0; k < 4; k++) {
        ctx.strokeStyle = rgba(color, 0.5 - k * 0.1);
        ctx.lineWidth = (4 + k * 10) * (W / 1920);
        ctx.beginPath();
        ctx.moveTo(vx + offset * W * 0.004, vy + 2);
        ctx.quadraticCurveTo(vx + offset * W * 0.1, vy + H * 0.25, vx + offset * W * 0.45, H);
        ctx.stroke();
      }
    };
    trail('#ff3b30', 0.5);
    trail('#ff6a3d', 0.8);
    trail('#fff3d6', -0.5);
    trail('#fff3d6', -0.9);
    trail(acc, 0.2);
    ctx.globalCompositeOperation = 'source-over';
    drawFigure(ctx, W, H, rand, spec, variant, horizonY);
    return horizonY;
  };

  scenes['studio'] = function (ctx, W, H, rand, spec) {
    const [top, hor, acc] = spec.palette;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, top);
    g.addColorStop(1, hor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // globe wireframe
    const cx = W * 0.68, cy = H * 0.45, r = H * 0.38;
    glow(ctx, cx, cy, r * 1.6, acc, 0.35);
    ctx.strokeStyle = rgba(acc, 0.55);
    ctx.lineWidth = 2 * (W / 1920);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 1; i < 7; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * Math.cos((i / 7) * Math.PI / 2 * 2 - Math.PI / 2 + 0.0001), r, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      const yy = cy - r + (i / 7) * 2 * r;
      const rr = Math.sqrt(Math.max(0, r * r - (yy - cy) * (yy - cy)));
      ctx.moveTo(cx - rr, yy);
      ctx.lineTo(cx + rr, yy);
      ctx.stroke();
    }
    // light bars
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = rgba(i % 3 ? acc : '#ffffff', 0.08 + rand() * 0.12);
      ctx.fillRect(0, H * (0.75 + i * 0.02), W * (0.3 + rand() * 0.7), H * 0.004);
    }
    // desk
    ctx.fillStyle = shade(top, -0.5);
    ctx.beginPath();
    ctx.moveTo(W * 0.15, H * 0.8);
    ctx.quadraticCurveTo(W * 0.5, H * 0.7, W * 0.85, H * 0.8);
    ctx.lineTo(W * 0.9, H);
    ctx.lineTo(W * 0.1, H);
    ctx.fill();
    ctx.strokeStyle = rgba(acc, 0.8);
    ctx.lineWidth = 4 * (W / 1920);
    ctx.beginPath();
    ctx.moveTo(W * 0.15, H * 0.8);
    ctx.quadraticCurveTo(W * 0.5, H * 0.7, W * 0.85, H * 0.8);
    ctx.stroke();
    return H * 0.8;
  };

  scenes['concert'] = function (ctx, W, H, rand, spec) {
    const [top, hor, acc] = spec.palette;
    skyGradient(ctx, W, H, top, hor, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) {
      const x = W * (0.1 + i * 0.09);
      const c = i % 2 ? acc : hor;
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate((rand() - 0.5) * 0.7);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(c, 0.45));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.lineTo(W * 0.08, H);
      ctx.lineTo(-W * 0.08, H);
      ctx.fill();
      ctx.restore();
      glow(ctx, x, 0, W * 0.04, '#ffffff', 0.8);
    }
    ctx.globalCompositeOperation = 'source-over';
    haze(ctx, W, H * 0.6, H * 0.2, acc, 0.15);
    // crowd
    ctx.fillStyle = '#05030a';
    for (let i = 0; i < 70; i++) {
      const x = rand() * W, y = H * (0.82 + rand() * 0.1), s = H * (0.12 + rand() * 0.08);
      ctx.beginPath();
      ctx.arc(x, y, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - s * 0.35, y + s * 0.15, s * 0.7, H);
      if (rand() < 0.3) {
        ctx.save();
        ctx.translate(x + s * 0.25, y);
        ctx.rotate(-0.3);
        ctx.fillRect(0, -s * 0.7, s * 0.08, s * 0.7);
        ctx.restore();
      }
    }
    drawFigure(ctx, W, H, rand, { ...spec, figure: spec.figure === 'pair' ? 'none' : spec.figure }, { kind: 'x', index: 0 }, H * 0.8);
    return H * 0.8;
  };

  // ------------------------------------------------------------------ kids scenes
  function creature(ctx, x, y, r, color, rand, opts = {}) {
    const u = r / 100;
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.95, r * 0.8, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // ears / antennae
    ctx.fillStyle = shade(color, -0.1);
    if (opts.ears !== false) {
      ctx.beginPath();
      ctx.ellipse(x - r * 0.55, y - r * 0.85, r * 0.18, r * 0.32, -0.4, 0, Math.PI * 2);
      ctx.ellipse(x + r * 0.55, y - r * 0.85, r * 0.18, r * 0.32, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // body
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r * 1.1);
    g.addColorStop(0, shade(color, 0.35));
    g.addColorStop(0.7, color);
    g.addColorStop(1, shade(color, -0.2));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    // belly
    ctx.fillStyle = rgba('#ffffff', 0.35);
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.35, r * 0.5, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    const look = (rand() - 0.5) * 8 * u;
    [-1, 1].forEach((side) => {
      const ex = x + side * r * 0.32, ey = y - r * 0.22;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, r * 0.24, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d2240';
      ctx.beginPath();
      ctx.arc(ex + look, ey + 4 * u, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + look - r * 0.05, ey - r * 0.03, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
    });
    // cheeks
    ctx.fillStyle = 'rgba(255,120,150,0.45)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.6, y + r * 0.08, r * 0.12, r * 0.08, 0, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.6, y + r * 0.08, r * 0.12, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    // smile
    ctx.strokeStyle = '#1d2240';
    ctx.lineWidth = r * 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.05, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // feet
    ctx.fillStyle = shade(color, -0.15);
    ctx.beginPath();
    ctx.ellipse(x - r * 0.4, y + r * 0.9, r * 0.22, r * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.4, y + r * 0.9, r * 0.22, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function puffyCloud(ctx, x, y, s, alpha) {
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
    ctx.arc(x + s * 0.45, y - s * 0.2, s * 0.6, 0, Math.PI * 2);
    ctx.arc(x + s * 0.95, y, s * 0.45, 0, Math.PI * 2);
    ctx.rect(x, y - s * 0.1, s * 0.95, s * 0.55);
    ctx.fill();
  }

  function kidsCreatures(ctx, W, H, rand, spec, variant, groundY) {
    const colors = spec.creatures || ['#ff8fb1'];
    const portrait = variant.kind === 'poster';
    const n = colors.length;
    const baseX = portrait ? 0.5 : 0.62 + (variant.kind === 'still' ? (variant.index % 3) * 0.06 - 0.06 : 0);
    colors.forEach((c, i) => {
      const r = H * (portrait ? 0.16 : 0.2) * (i === 0 ? 1 : 0.78);
      const x = W * (baseX + (i - (n - 1) / 2) * (portrait ? 0.32 : 0.17));
      creature(ctx, x, groundY - r * 0.9, r, c, rand, { ears: i % 2 === 0 });
    });
  }

  scenes['kids-meadow'] = function (ctx, W, H, rand, spec, variant) {
    const [sky, light, acc] = spec.palette;
    skyGradient(ctx, W, H, sky, light, H * 0.8);
    glow(ctx, W * 0.85, H * 0.15, W * 0.25, '#fff7c2', 0.9);
    ctx.fillStyle = '#ffe680';
    ctx.beginPath();
    ctx.arc(W * 0.85, H * 0.15, H * 0.08, 0, Math.PI * 2);
    ctx.fill();
    // rainbow
    const rb = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'];
    rb.forEach((c, i) => {
      ctx.strokeStyle = rgba(c, 0.55);
      ctx.lineWidth = H * 0.025;
      ctx.beginPath();
      ctx.arc(W * 0.3, H * 0.85, H * (0.6 - i * 0.025), Math.PI, 0);
      ctx.stroke();
    });
    for (let i = 0; i < 5; i++) puffyCloud(ctx, rand() * W, H * (0.08 + rand() * 0.25), W * (0.06 + rand() * 0.05), 0.9);
    const hills = ['#a8e6a1', '#7fd37a', '#5fc366'];
    hills.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, H);
      const base = H * (0.66 + i * 0.09), ph = rand() * 6;
      for (let x = 0; x <= W; x += W / 60) ctx.lineTo(x, base - Math.sin(x / (W * 0.15) + ph) * H * 0.04);
      ctx.lineTo(W, H);
      ctx.fill();
    });
    for (let i = 0; i < 80; i++) {
      const x = rand() * W, y = H * (0.8 + rand() * 0.18);
      ctx.fillStyle = ['#ffffff', '#ffd43b', '#ff8fab', acc][i % 4];
      ctx.beginPath();
      ctx.arc(x, y, H * 0.007, 0, Math.PI * 2);
      ctx.fill();
    }
    kidsCreatures(ctx, W, H, rand, spec, variant, H * 0.93);
    return H * 0.8;
  };

  scenes['kids-space'] = function (ctx, W, H, rand, spec, variant) {
    const [sky, light, acc] = spec.palette;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky);
    g.addColorStop(1, light);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    stars(ctx, W, H, rand, 260, H, '#fff7d6');
    // planets
    const planet = (x, y, r, c, ring) => {
      const pg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      pg.addColorStop(0, shade(c, 0.4));
      pg.addColorStop(1, shade(c, -0.15));
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (ring) {
        ctx.strokeStyle = rgba('#ffffff', 0.7);
        ctx.lineWidth = r * 0.12;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.6, r * 0.35, -0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
    planet(W * 0.15, H * 0.25, H * 0.12, acc, true);
    planet(W * 0.9, H * 0.2, H * 0.07, '#ff8fb1', false);
    planet(W * 0.4, H * 0.12, H * 0.04, '#7ee0ff', false);
    // moon ground
    ctx.fillStyle = '#d9d2ff';
    ctx.beginPath();
    ctx.ellipse(W * 0.6, H * 1.25, W * 0.7, H * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = 'rgba(120,100,200,0.25)';
      ctx.beginPath();
      ctx.ellipse(W * (0.2 + rand() * 0.8), H * (0.88 + rand() * 0.1), W * 0.03, H * 0.012, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // rocket
    const rx = W * 0.32, ry = H * 0.55, rs = H * 0.18;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(0.5);
    glow(ctx, 0, rs * 0.9, rs * 0.6, '#ffb347', 0.8);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, rs * 0.22, rs * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(-rs * 0.2, -rs * 0.35);
    ctx.quadraticCurveTo(0, -rs * 0.9, rs * 0.2, -rs * 0.35);
    ctx.fill();
    ctx.fillRect(-rs * 0.35, rs * 0.25, rs * 0.15, rs * 0.3);
    ctx.fillRect(rs * 0.2, rs * 0.25, rs * 0.15, rs * 0.3);
    ctx.fillStyle = '#6fd6ff';
    ctx.beginPath();
    ctx.arc(0, -rs * 0.05, rs * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    kidsCreatures(ctx, W, H, rand, spec, variant, H * 0.92);
    return H * 0.85;
  };

  scenes['kids-ocean'] = function (ctx, W, H, rand, spec, variant) {
    const [sky, light, acc] = spec.palette;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, light);
    g.addColorStop(1, sky);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.translate(W * (0.1 + i * 0.12), 0);
      ctx.rotate(0.2);
      const lg = ctx.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, 'rgba(255,255,255,0.35)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, W * 0.04, H);
      ctx.restore();
    }
    // bubbles
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H * 0.8, H * (0.005 + rand() * 0.02), 0, Math.PI * 2);
      ctx.stroke();
    }
    // sand
    ctx.fillStyle = '#ffe3a3';
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += W / 40) ctx.lineTo(x, H * 0.86 - Math.sin(x / (W * 0.2)) * H * 0.03);
    ctx.lineTo(W, H);
    ctx.fill();
    // seaweed + coral
    for (let i = 0; i < 14; i++) {
      const x = rand() * W, h = H * (0.15 + rand() * 0.25);
      ctx.strokeStyle = i % 3 ? '#2fbf71' : acc;
      ctx.lineWidth = H * 0.018;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, H * 0.9);
      ctx.bezierCurveTo(x - 30, H * 0.9 - h * 0.3, x + 30, H * 0.9 - h * 0.6, x, H * 0.9 - h);
      ctx.stroke();
    }
    kidsCreatures(ctx, W, H, rand, spec, variant, H * 0.9);
    return H * 0.85;
  };

  scenes['kids-town'] = function (ctx, W, H, rand, spec, variant) {
    const [sky, light, acc] = spec.palette;
    skyGradient(ctx, W, H, sky, light, H * 0.75);
    for (let i = 0; i < 5; i++) puffyCloud(ctx, rand() * W, H * (0.08 + rand() * 0.2), W * (0.05 + rand() * 0.05), 0.95);
    const houseColors = ['#ff8fab', '#ffd43b', '#74c0fc', '#b197fc', '#8ce99a', '#ffa94d'];
    let x = -W * 0.02;
    while (x < W) {
      const w = W * (0.07 + rand() * 0.05), h = H * (0.18 + rand() * 0.22);
      const c = houseColors[Math.floor(rand() * houseColors.length)];
      ctx.fillStyle = c;
      ctx.fillRect(x, H * 0.78 - h, w, h);
      ctx.fillStyle = shade(c, -0.25);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.08, H * 0.78 - h);
      ctx.quadraticCurveTo(x + w / 2, H * 0.78 - h - w * 0.7, x + w * 1.08, H * 0.78 - h);
      ctx.fill();
      ctx.fillStyle = '#fff9db';
      for (let r = 0; r < Math.floor(h / (H * 0.08)); r++) {
        ctx.fillRect(x + w * 0.2, H * 0.78 - h + H * 0.03 + r * H * 0.08, w * 0.22, H * 0.04);
        ctx.fillRect(x + w * 0.58, H * 0.78 - h + H * 0.03 + r * H * 0.08, w * 0.22, H * 0.04);
      }
      x += w + W * 0.01;
    }
    ctx.fillStyle = '#7bd389';
    ctx.fillRect(0, H * 0.78, W, H);
    ctx.fillStyle = '#ffe8a3';
    ctx.beginPath();
    ctx.moveTo(W * 0.4, H * 0.78);
    ctx.lineTo(W * 0.6, H * 0.78);
    ctx.lineTo(W * 0.85, H);
    ctx.lineTo(W * 0.15, H);
    ctx.fill();
    kidsCreatures(ctx, W, H, rand, spec, variant, H * 0.95);
    return H * 0.78;
  };

  // ------------------------------------------------------------------ avatars
  function paintAvatar(ctx, W, H, spec, rand) {
    const [c1, c2, c3] = spec.palette;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    glow(ctx, W * 0.75, H * 0.2, W * 0.7, c3, 0.55);
    if (spec.creatures) {
      creature(ctx, W / 2, H * 0.58, W * 0.3, spec.creatures[0], rand);
      return;
    }
    // stylised portrait
    ctx.save();
    ctx.shadowColor = rgba(c3, 0.6);
    ctx.shadowBlur = W * 0.05;
    personPath(ctx, W / 2, H * 1.05, H * 0.95, rand, {});
    const pg = ctx.createLinearGradient(0, H * 0.2, W, H);
    pg.addColorStop(0, shade(c1, -0.55));
    pg.addColorStop(1, shade(c2, -0.7));
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.restore();
    // hair accent
    ctx.fillStyle = rgba(c3, 0.22);
    ctx.beginPath();
    ctx.ellipse(W / 2 + W * 0.01, H * 1.05 - H * 0.95 * 0.86 - H * 0.03, H * 0.95 * 0.075, H * 0.95 * 0.06, 0, Math.PI, 0);
    ctx.fill();
  }

  window.paintArt = function (canvas, spec, variant) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const rand = mulberry32(spec.seed + (variant.index || 0) * 7919);
    ctx.save();
    if (variant.kind === 'avatar') {
      paintAvatar(ctx, W, H, spec, rand);
      grain(ctx, W, H, rand, 6);
      ctx.restore();
      return;
    }
    const scene = scenes[spec.scene] || scenes['city-dusk'];
    // stills: re-frame the scene by zooming into a region
    if (variant.kind === 'still' && variant.index > 0) {
      const z = 1 + (variant.index % 3) * 0.18;
      ctx.translate(-W * (z - 1) * ((variant.index * 37) % 100) / 100, -H * (z - 1) * 0.6);
      ctx.scale(z, z);
    }
    scene(ctx, W, H, rand, spec, variant);
    ctx.restore();
    if (!spec.scene.startsWith('kids')) {
      vignette(ctx, W, H, 0.42);
      grain(ctx, W, H, rand, 7);
    } else {
      grain(ctx, W, H, rand, 3);
    }
  };
})();
