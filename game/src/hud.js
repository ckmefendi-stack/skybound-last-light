// The 2D canvas HUD drawn over the 3D view: airspeed and altitude tapes, heading compass,
// pitch ladder with bank, throttle and fuel, ring progress and next-ring guidance, and the
// warnings. It reads the same telemetry object as the cockpit gauges, so the two can never
// disagree in a screenshot.
const GREEN = '#7dff5e';
const AMBER = '#ffcf4d';
const RED = '#ff5555';
const WHITE = '#eef4f8';
const PANEL = 'rgba(8, 12, 18, 0.45)';

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function tape(x, y, w, h, value, step, range, unit, format) {
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(238,244,248,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    const cy = y + h / 2;
    const pxPerUnit = h / (range * 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = WHITE;
    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    const first = Math.ceil((value - range) / step) * step;
    for (let v = first; v <= value + range; v += step) {
      const py = cy - (v - value) * pxPerUnit;
      ctx.strokeStyle = 'rgba(238,244,248,0.5)';
      ctx.beginPath();
      ctx.moveTo(x + w - 14, py);
      ctx.lineTo(x + w, py);
      ctx.stroke();
      ctx.fillText(format(v), x + 6, py + 5);
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(8,12,18,0.75)';
    ctx.fillRect(x - 4, cy - 16, w + 8, 32);
    ctx.fillStyle = GREEN;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(format(value), x + w / 2, cy + 7);
    ctx.fillStyle = WHITE;
    ctx.font = '13px monospace';
    ctx.fillText(unit, x + w / 2, y + h + 18);
  }

  function compass(t) {
    const w = 460;
    const h = 44;
    const x = (width - w) / 2;
    const y = 14;
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, y, w, h);
    const cx = x + w / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = WHITE;
    ctx.font = '15px monospace';
    ctx.textAlign = 'center';
    const pxPerDeg = w / 120;
    const first = Math.floor((t.headingDeg - 60) / 10) * 10;
    for (let d = first; d <= t.headingDeg + 60; d += 10) {
      const norm = ((d % 360) + 360) % 360;
      const px = cx + (d - t.headingDeg) * pxPerDeg;
      ctx.strokeStyle = 'rgba(238,244,248,0.5)';
      ctx.beginPath();
      ctx.moveTo(px, y + h - 12);
      ctx.lineTo(px, y + h - 4);
      ctx.stroke();
      const label = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : norm % 30 === 0 ? String(norm / 10) : '';
      if (label) ctx.fillText(label, px, y + 20);
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(8,12,18,0.8)';
    ctx.fillRect(cx - 34, y + h - 2, 68, 26);
    ctx.fillStyle = GREEN;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(String(t.headingDeg).padStart(3, '0') + '°', cx, y + h + 17);
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(cx - 7, y + h);
    ctx.lineTo(cx + 7, y + h);
    ctx.lineTo(cx, y + h + 8);
    ctx.closePath();
    ctx.fill();
  }

  function pitchLadder(t) {
    const cx = width / 2;
    const cy = height / 2;
    const r = 120;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate((-t.bankDeg * Math.PI) / 180);
    const pitchPx = t.pitchDeg * 3;
    ctx.strokeStyle = 'rgba(238,244,248,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, pitchPx);
    ctx.lineTo(r, pitchPx);
    ctx.stroke();
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    for (const d of [-20, -10, 10, 20]) {
      const y = pitchPx + d * 3;
      if (Math.abs(y) > r - 8) continue;
      ctx.beginPath();
      ctx.moveTo(-34, y);
      ctx.lineTo(34, y);
      ctx.stroke();
      ctx.fillStyle = WHITE;
      ctx.fillText(String(Math.abs(d)), -46, y + 5);
      ctx.fillText(String(Math.abs(d)), 46, y + 5);
    }
    ctx.restore();
    // Fixed aircraft symbol.
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 46, cy);
    ctx.lineTo(cx - 14, cy);
    ctx.moveTo(cx + 14, cy);
    ctx.lineTo(cx + 46, cy);
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.stroke();
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function bars(t) {
    const x = 24;
    const y = height - 108;
    ctx.fillStyle = PANEL;
    ctx.fillRect(x - 8, y - 8, 250, 100);
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = WHITE;
    ctx.fillText('THR ' + t.throttlePct + '%', x, y + 14);
    ctx.fillStyle = '#2a323d';
    ctx.fillRect(x + 90, y + 2, 140, 12);
    ctx.fillStyle = GREEN;
    ctx.fillRect(x + 90, y + 2, 140 * (t.throttlePct / 100), 12);
    ctx.fillStyle = WHITE;
    ctx.fillText('FUEL ' + t.fuelPct + '%', x, y + 40);
    ctx.fillStyle = '#2a323d';
    ctx.fillRect(x + 90, y + 28, 140, 12);
    ctx.fillStyle = t.fuelPct < 25 ? AMBER : '#7dc8ff';
    ctx.fillRect(x + 90, y + 28, 140 * (t.fuelPct / 100), 12);
    ctx.fillStyle = WHITE;
    ctx.fillText('GEAR ' + (t.gear ? 'DOWN' : 'UP') + '   FLAPS ' + (t.flaps ? 'ON' : 'OFF'), x, y + 66);
  }

  function scoreBlock(t) {
    const x = width - 24;
    const y = height - 108;
    ctx.fillStyle = PANEL;
    ctx.fillRect(x - 230, y - 8, 238, 100);
    ctx.textAlign = 'right';
    ctx.fillStyle = WHITE;
    ctx.font = 'bold 15px monospace';
    ctx.fillText('SCORE ' + t.score.toLocaleString('en-US'), x, y + 14);
    ctx.fillText('TIME ' + fmtTime(t.timeSec), x, y + 40);
    if (t.mode === 'mission') {
      ctx.fillStyle = GREEN;
      ctx.fillText('RINGS ' + t.ring + '/' + t.ringsTotal + '   STREAK x' + (1 + 0.05 * t.streak).toFixed(2), x, y + 66);
    } else {
      ctx.fillStyle = GREEN;
      ctx.fillText('FREE FLIGHT', x, y + 66);
    }
  }

  function nextRing(t) {
    if (t.mode !== 'mission' || t.ring >= t.ringsTotal) return;
    const cx = width / 2;
    const y = 96;
    const dist = t.nextDistM >= 1000 ? (t.nextDistM / 1000).toFixed(1) + ' KM' : t.nextDistM + ' M';
    ctx.fillStyle = PANEL;
    ctx.fillRect(cx - 170, y - 6, 340, 30);
    ctx.fillStyle = '#22e6ff';
    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RING ' + (t.ring + 1) + '/' + t.ringsTotal + '  ·  ' + dist, cx, y + 15);
    // Bearing chevron: points toward the next ring relative to the nose.
    const b = Math.max(-60, Math.min(60, t.nextBearingDeg));
    const bx = cx + b * 2.4;
    ctx.fillStyle = '#22e6ff';
    ctx.beginPath();
    ctx.moveTo(bx, y + 34);
    ctx.lineTo(bx - 9, y + 48);
    ctx.lineTo(bx + 9, y + 48);
    ctx.closePath();
    ctx.fill();
  }

  function warnings(t) {
    const cx = width / 2;
    let y = 150;
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px monospace';
    if (t.stalled) {
      const flash = Math.sin(t.timeSec * 10) > 0;
      if (flash) {
        ctx.fillStyle = RED;
        ctx.fillText('STALL — NOSE DOWN, ADD POWER', cx, y);
        y += 34;
      }
    }
    if (t.fuelEmpty) {
      ctx.fillStyle = RED;
      ctx.fillText('FUEL EMPTY — GLIDE TO THE RUNWAY', cx, y);
      y += 34;
    } else if (t.lowFuel) {
      ctx.fillStyle = AMBER;
      ctx.fillText('LOW FUEL', cx, y);
      y += 34;
    }
    if (t.phase === 'air' && !t.gear && t.altAglFt < 600) {
      ctx.fillStyle = AMBER;
      ctx.fillText('GEAR UP — PRESS G TO LOWER', cx, y);
    }
  }

  function ringFlash(t) {
    if (t.timeSec - t.lastRingAt > 2.5 || t.lastRingGain <= 0) return;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7dff5e';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('RING ' + t.ring + '/' + t.ringsTotal + '  +' + t.lastRingGain, width / 2, height / 2 - 160);
  }

  function draw(t) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = WHITE;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SKYBOUND — LAST LIGHT', 24, 30);
    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(238,244,248,0.75)';
    ctx.fillText('ALT ' + t.altFt + ' FT   SPD ' + t.speedKt + ' KT   HDG ' + String(t.headingDeg).padStart(3, '0') + '°   VS ' + (t.vsFpm >= 0 ? '+' : '') + t.vsFpm + ' FPM', 24, 52);
    tape(24, height / 2 - 150, 92, 300, t.speedKt, 10, 50, 'KT', (v) => String(Math.round(v)));
    tape(width - 116, height / 2 - 150, 92, 300, t.altFt, 100, 500, 'FT', (v) => String(Math.round(v)));
    compass(t);
    pitchLadder(t);
    nextRing(t);
    bars(t);
    scoreBlock(t);
    warnings(t);
    ringFlash(t);
    if (t.phase === 'ground' && t.speedKt < 5 && t.timeSec < 20) {
      ctx.textAlign = 'center';
      ctx.fillStyle = WHITE;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('HOLD SHIFT TO THROTTLE UP — PULL UP (S) AT 70 KT', width / 2, height - 140);
    }
  }

  return { draw, resize };
}
