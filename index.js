#!/usr/bin/env node
/**
 * dashboard-builder
 * Describe a terminal dashboard in plain English. Get it running instantly.
 * Zero external dependencies — pure Node.js ES modules.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { request } from 'https';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── ANSI HELPERS ────────────────────────────────────────────────────────────

const ESC      = '\x1b';
const RESET    = `${ESC}[0m`;
const BOLD     = `${ESC}[1m`;
const DIM      = `${ESC}[2m`;
const GREEN    = `${ESC}[32m`;
const YELLOW   = `${ESC}[33m`;
const CYAN     = `${ESC}[36m`;
const WHITE    = `${ESC}[37m`;
const RED      = `${ESC}[31m`;
const MAGENTA  = `${ESC}[35m`;

const cursor = {
  home:  () => process.stdout.write(`${ESC}[H`),
  clear: () => process.stdout.write(`${ESC}[2J`),
  hide:  () => process.stdout.write(`${ESC}[?25l`),
  show:  () => process.stdout.write(`${ESC}[?25h`),
};

function colorize(text, color) { return `${color}${text}${RESET}`; }

// ─── BOX DRAWING ─────────────────────────────────────────────────────────────

const BOX = {
  tl: '┌', tr: '┐', bl: '└', br: '┘',
  h: '─', v: '│',
  ml: '├', mr: '┤', mt: '┬', mb: '┴', cross: '┼',
};

function stripAnsi(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, '');
}

function padRight(str, width) {
  const visible = stripAnsi(str);
  const pad = width - visible.length;
  return str + (pad > 0 ? ' '.repeat(pad) : '');
}

function truncate(str, maxLen) {
  const clean = stripAnsi(str);
  if (clean.length <= maxLen) return str;
  // Truncate the raw string — approximate, good enough for CLI
  return str.slice(0, maxLen - 1) + '\u2026';
}

// ─── ASCII BAR ────────────────────────────────────────────────────────────────

function asciiBar(value, max, width = 20, filled = '\u2588', empty = '\u2591') {
  const pct         = Math.min(1, Math.max(0, value / max));
  const filledCount = Math.round(pct * width);
  const emptyCount  = width - filledCount;
  const color       = pct > 0.8 ? RED : pct > 0.5 ? YELLOW : GREEN;
  return colorize(filled.repeat(filledCount), color)
    + colorize(empty.repeat(emptyCount), DIM)
    + ` ${Math.round(pct * 100)}%`;
}

// ─── DATA SOURCES ─────────────────────────────────────────────────────────────

function safeExec(cmd, fallback = '') {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000,
    }).trim();
  } catch {
    return fallback;
  }
}

function isGitRepo() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'pipe', timeout: 2000 });
    return true;
  } catch { return false; }
}

const sources = {
  'os.loadavg': () => {
    const [m1, m5, m15] = os.loadavg();
    const cpus = os.cpus().length;
    return { m1: m1.toFixed(2), m5: m5.toFixed(2), m15: m15.toFixed(2), cpus, pct: Math.round((m1 / cpus) * 100) };
  },

  'os.memory': () => {
    const total = os.totalmem();
    const free  = os.freemem();
    const used  = total - free;
    const gb    = n => (n / 1024 ** 3).toFixed(1);
    return { totalGB: gb(total), usedGB: gb(used), freeGB: gb(free), pct: Math.round((used / total) * 100) };
  },

  'os.uptime': () => {
    const secs = os.uptime();
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return { days: d, hours: h, mins: m, formatted: `${d}d ${h}h ${m}m` };
  },

  'os.platform': () => ({
    platform: os.platform(),
    arch:     os.arch(),
    hostname: os.hostname(),
    user:     os.userInfo().username,
  }),

  'git.log': () => {
    if (!isGitRepo()) return { commits: ['(not a git repo)'] };
    const log     = safeExec('git log --oneline -8 --format="%h %s (%ar)"', '');
    const commits = log ? log.split('\n').map(l => l.trim()).filter(Boolean) : ['No commits yet'];
    return { commits };
  },

  'git.status': () => {
    if (!isGitRepo()) return { branch: 'N/A', changed: 0, staged: 0, untracked: 0, stash: 0 };
    const branch  = safeExec('git rev-parse --abbrev-ref HEAD', 'unknown');
    const status  = safeExec('git status --porcelain', '');
    const lines   = status ? status.split('\n').filter(Boolean) : [];
    const staged  = lines.filter(l => !'? '.includes(l[0]) && l[0] !== ' ').length;
    const changed = lines.filter(l => l[1] === 'M' || l[0] === 'M').length;
    const untracked = lines.filter(l => l.startsWith('??')).length;
    const stash   = parseInt(safeExec('git stash list', '').split('\n').filter(Boolean).length, 10);
    return { branch, changed, staged, untracked, stash };
  },

  'git.diff.stat': () => {
    if (!isGitRepo()) return { files: ['(not a git repo)'] };
    const stat  = safeExec('git status --short', '');
    const files = stat ? stat.split('\n').slice(0, 6).filter(Boolean) : ['No changes'];
    return { files };
  },

  'npm.scripts': () => {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (!existsSync(pkgPath)) return { scripts: ['(no package.json)'] };
    try {
      const pkg     = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const scripts = Object.keys(pkg.scripts || {})
        .map(k => `${k}: ${pkg.scripts[k]}`).slice(0, 6);
      return { scripts: scripts.length ? scripts : ['No scripts defined'] };
    } catch {
      return { scripts: ['(parse error)'] };
    }
  },

  'todos.count': () => {
    const dirs = ['src', 'lib', '.'].filter(d => existsSync(path.join(process.cwd(), d)));
    const dir  = dirs[0];
    try {
      const countRaw = safeExec(
        `grep -r "TODO\\|FIXME\\|HACK\\|XXX" "${path.join(process.cwd(), dir)}" --include="*.js" --include="*.ts" --include="*.py" --include="*.php" 2>/dev/null | wc -l`,
        '0'
      );
      const filesRaw = safeExec(
        `grep -r "TODO\\|FIXME\\|HACK\\|XXX" "${path.join(process.cwd(), dir)}" --include="*.js" --include="*.ts" --include="*.py" --include="*.php" -l 2>/dev/null | wc -l`,
        '0'
      );
      return { count: parseInt(countRaw.trim(), 10), files: parseInt(filesRaw.trim(), 10) };
    } catch {
      return { count: 0, files: 0 };
    }
  },

  'disk.usage': () => {
    try {
      const raw   = safeExec('df -h . | tail -1', '');
      if (!raw) return { used: 'N/A', total: 'N/A', pct: 0, pctStr: '0%', avail: 'N/A' };
      const parts = raw.trim().split(/\s+/);
      const pctStr = parts[4] || '0%';
      return {
        filesystem: parts[0] || '',
        total:  parts[1] || 'N/A',
        used:   parts[2] || 'N/A',
        avail:  parts[3] || 'N/A',
        pct:    parseInt(pctStr, 10) || 0,
        pctStr,
      };
    } catch {
      return { used: 'N/A', total: 'N/A', pct: 0, pctStr: '0%', avail: 'N/A' };
    }
  },

  'project.info': () => {
    const cwd = process.cwd();
    let type = 'unknown';
    if (existsSync(path.join(cwd, 'package.json')))   type = 'Node.js';
    else if (existsSync(path.join(cwd, 'composer.json'))) type = 'PHP';
    else if (existsSync(path.join(cwd, 'requirements.txt'))
          || existsSync(path.join(cwd, 'pyproject.toml'))) type = 'Python';
    else if (existsSync(path.join(cwd, 'go.mod')))    type = 'Go';
    else if (existsSync(path.join(cwd, 'Cargo.toml'))) type = 'Rust';
    return { name: path.basename(cwd), type, cwd };
  },

  'countdown.friday': () => {
    const now      = new Date();
    const day      = now.getDay();
    const daysUntil = day === 5 ? 0 : (5 - day + 7) % 7;
    const target   = new Date(now);
    target.setDate(now.getDate() + daysUntil);
    target.setHours(17, 0, 0, 0);
    const diff = Math.max(0, target - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { days: daysUntil, hours: h, mins: m, secs: s, formatted: `${daysUntil}d ${h}h ${m}m ${s}s` };
  },

  'pomodoro': () => {
    const statePath = path.join(os.tmpdir(), '.dashboard-builder-pomo.json');
    let state;
    if (existsSync(statePath)) {
      try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch { state = null; }
    }
    if (!state) {
      state = { start: Date.now(), duration: 25 * 60 * 1000, phase: 'work' };
      writeFileSync(statePath, JSON.stringify(state));
    }
    const elapsed   = Date.now() - state.start;
    const remaining = Math.max(0, state.duration - elapsed);
    const m   = Math.floor(remaining / 60000);
    const s   = Math.floor((remaining % 60000) / 1000);
    const pct = Math.round(((state.duration - remaining) / state.duration) * 100);
    return {
      phase: state.phase,
      mins: m, secs: s,
      formatted: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      pct,
    };
  },
};

function fetchData(sourceKey) {
  if (sourceKey && sourceKey.startsWith('shell:')) {
    const cmd    = sourceKey.slice(6);
    const result = safeExec(cmd, '(no output)');
    return { lines: result.split('\n').filter(Boolean).slice(0, 8), raw: result };
  }
  if (sourceKey && sourceKey.startsWith('grep:')) {
    const pattern = sourceKey.slice(5);
    const count   = safeExec(
      `grep -r "${pattern}" . --include="*.js" --include="*.ts" --include="*.py" 2>/dev/null | wc -l`,
      '0'
    );
    return { count: parseInt(count.trim(), 10) };
  }
  if (sources[sourceKey]) return sources[sourceKey]();
  return {};
}

// ─── PANEL RENDERERS ─────────────────────────────────────────────────────────

function renderPanel(panel, innerWidth, innerHeight) {
  const lines = [];
  const data  = fetchData(panel.source || panel.type);

  switch (panel.type) {
    case 'metric': {
      const val = data.pct ?? data.m1 ?? 0;
      const max = panel.max ?? 100;
      lines.push('');
      lines.push(`  ${asciiBar(parseFloat(val), max, Math.min(18, innerWidth - 8))}`);
      if (panel.source === 'os.loadavg') {
        lines.push(`  ${colorize('1m:', DIM)}  ${colorize(data.m1, CYAN)}`);
        lines.push(`  ${colorize('5m:', DIM)}  ${colorize(data.m5, CYAN)}`);
        lines.push(`  ${colorize('15m:', DIM)} ${colorize(data.m15, CYAN)}`);
        lines.push(`  ${colorize(`${data.cpus} CPUs`, DIM)}`);
      } else {
        lines.push(`  ${colorize(String(val), BOLD + CYAN)}`);
      }
      break;
    }

    case 'list': {
      const items = data.commits || data.scripts || data.files || data.lines || [];
      for (const item of items.slice(0, innerHeight - 2)) {
        const bullet = colorize('\u2022', CYAN);
        lines.push(`  ${bullet} ${truncate(String(item), innerWidth - 5)}`);
      }
      break;
    }

    case 'count': {
      const n = data.count ?? 0;
      lines.push('');
      lines.push(`  ${colorize(String(n), BOLD + YELLOW)}${colorize(` ${panel.unit || 'items'}`, DIM)}`);
      if (data.files !== undefined) {
        lines.push(`  ${colorize(`across ${data.files} file${data.files !== 1 ? 's' : ''}`, DIM)}`);
      }
      break;
    }

    case 'timer': {
      lines.push('');
      lines.push(`  ${colorize(data.formatted || '00:00', BOLD + MAGENTA)}`);
      if (data.phase) {
        lines.push(`  ${colorize(data.phase.toUpperCase(), data.phase === 'work' ? GREEN : YELLOW)}`);
      }
      if (data.pct !== undefined) {
        lines.push(`  ${asciiBar(data.pct, 100, Math.min(16, innerWidth - 6))}`);
      }
      break;
    }

    case 'bar': {
      const val = data.pct ?? 0;
      const max = panel.max ?? 100;
      lines.push('');
      lines.push(`  ${asciiBar(parseFloat(val), max, Math.min(18, innerWidth - 8))}`);
      if (panel.source === 'os.memory') {
        lines.push(`  ${colorize('Used:', DIM)}  ${colorize(data.usedGB + 'GB', CYAN)}`);
        lines.push(`  ${colorize('Free:', DIM)}  ${colorize(data.freeGB + 'GB', GREEN)}`);
        lines.push(`  ${colorize('Total:', DIM)} ${colorize(data.totalGB + 'GB', WHITE)}`);
      } else if (panel.source === 'disk.usage') {
        lines.push(`  ${colorize('Used:', DIM)}  ${colorize(data.used, CYAN)}`);
        lines.push(`  ${colorize('Free:', DIM)}  ${colorize(data.avail, GREEN)}`);
        lines.push(`  ${colorize('Total:', DIM)} ${colorize(data.total, WHITE)}`);
      }
      break;
    }

    case 'git.status': {
      const s     = data;
      const dot   = s.branch !== 'N/A' ? colorize('\u25cf', GREEN) : colorize('\u25cf', RED);
      lines.push(`  ${dot} ${colorize(s.branch || 'N/A', BOLD + CYAN)}`);
      lines.push(`  ${colorize('Changed:', DIM)}   ${colorize(String(s.changed),   s.changed > 0   ? YELLOW : GREEN)}`);
      lines.push(`  ${colorize('Staged:', DIM)}    ${colorize(String(s.staged),    s.staged > 0    ? GREEN  : DIM)}`);
      lines.push(`  ${colorize('Untracked:', DIM)} ${colorize(String(s.untracked), s.untracked > 0 ? RED    : DIM)}`);
      lines.push(`  ${colorize('Stashes:', DIM)}   ${colorize(String(s.stash),     s.stash > 0     ? YELLOW : DIM)}`);
      break;
    }

    case 'status': {
      if (panel.source === 'os.platform') {
        const p = data;
        lines.push(`  ${colorize('\u25cf', GREEN)} ${colorize(p.hostname, WHITE)}`);
        lines.push(`  ${colorize('OS:', DIM)}   ${p.platform}/${p.arch}`);
        lines.push(`  ${colorize('User:', DIM)} ${colorize(p.user, CYAN)}`);
      } else {
        for (const [k, v] of Object.entries(data).slice(0, innerHeight - 2)) {
          if (typeof v !== 'object') {
            lines.push(`  ${colorize('\u25cf', GREEN)} ${colorize(k, DIM)}: ${String(v)}`);
          }
        }
      }
      break;
    }

    case 'countdown': {
      const d = data;
      lines.push('');
      lines.push(`  ${colorize(d.formatted || '0d 0h 0m 0s', BOLD + YELLOW)}`);
      if (d.days === 0) lines.push(`  ${colorize("It's Friday!", BOLD + GREEN)}`);
      else lines.push(`  ${colorize('until Friday 5pm', DIM)}`);
      break;
    }

    case 'uptime': {
      lines.push('');
      lines.push(`  ${colorize(data.formatted || '0d 0h 0m', BOLD + GREEN)}`);
      lines.push(`  ${colorize('system uptime', DIM)}`);
      break;
    }

    case 'project.info': {
      const p = data;
      lines.push(`  ${colorize('Name:', DIM)}    ${colorize(p.name || '?', BOLD + CYAN)}`);
      lines.push(`  ${colorize('Type:', DIM)}    ${colorize(p.type || 'unknown', YELLOW)}`);
      lines.push(`  ${colorize('Dir:', DIM)}     ${truncate(p.cwd || '', innerWidth - 12)}`);
      break;
    }

    default: {
      for (const [k, v] of Object.entries(data).slice(0, innerHeight - 2)) {
        if (typeof v !== 'object') {
          lines.push(`  ${colorize(k + ':', DIM)} ${colorize(String(v), CYAN)}`);
        }
      }
    }
  }

  while (lines.length < innerHeight - 1) lines.push('');
  return lines;
}

// ─── LAYOUT ENGINE ────────────────────────────────────────────────────────────

function computeLayout(panels, termW, termH) {
  const count  = panels.length;
  const cols   = count <= 1 ? 1 : count <= 2 ? 2 : count <= 4 ? 2 : 3;
  const rows   = Math.ceil(count / cols);
  const headerH = 3;
  const totalPanelH = termH - headerH - 1;
  const panelH = Math.max(6, Math.floor(totalPanelH / rows));
  const panelW = Math.floor(termW / cols);

  return panels.map((p, i) => ({
    ...p,
    col: i % cols,
    row: Math.floor(i / cols),
    cols, rows,
    width: panelW,
    height: panelH,
  }));
}

// ─── FULL SCREEN RENDERER ─────────────────────────────────────────────────────

function draw(config, countdown) {
  const termW  = process.stdout.columns || 100;
  const termH  = process.stdout.rows    || 30;
  const layout = computeLayout(config.panels, termW, termH);
  const cols   = layout[0]?.cols   || 1;
  const rows   = layout[0]?.rows   || 1;
  const panelW = layout[0]?.width  || termW;
  const panelH = layout[0]?.height || Math.max(6, Math.floor((termH - 4) / rows));

  const output = [];

  // Title bar
  const refreshLabel = colorize(`Refreshing in ${countdown}s  `, DIM);
  const title        = colorize(`  ${config.title || 'Dashboard'}  `, BOLD + CYAN);
  const innerWidth   = termW - 2;
  const titleLen     = stripAnsi(title).length;
  const refreshLen   = stripAnsi(refreshLabel).length;
  const midPad       = Math.max(0, innerWidth - titleLen - refreshLen);

  output.push(colorize(BOX.tl + BOX.h.repeat(termW - 2) + BOX.tr, CYAN));
  output.push(
    colorize(BOX.v, CYAN) + title + ' '.repeat(midPad) + refreshLabel + colorize(BOX.v, CYAN)
  );

  // Sep row with column dividers
  let sepLine = colorize(BOX.ml, CYAN);
  for (let c = 0; c < cols; c++) {
    const w = (c === cols - 1) ? (termW - 2 - c * panelW) : panelW;
    sepLine += colorize(BOX.h.repeat(w), CYAN);
    if (c < cols - 1) sepLine += colorize(BOX.mt, CYAN);
  }
  sepLine += colorize(BOX.mr, CYAN);
  output.push(sepLine);

  // Panel rows
  for (let r = 0; r < rows; r++) {
    const panelsInRow = layout.filter(p => p.row === r);
    const innerH      = panelH - 2;

    // Panel title row
    let titleRow = colorize(BOX.v, CYAN);
    for (let c = 0; c < cols; c++) {
      const panel = panelsInRow.find(p => p.col === c);
      const w     = (c === cols - 1) ? (termW - 2 - c * panelW) : panelW;
      if (panel) {
        titleRow += padRight(colorize(`  ${panel.title || panel.id}`, BOLD + WHITE), w);
      } else {
        titleRow += ' '.repeat(w);
      }
      if (c < cols - 1) titleRow += colorize(BOX.v, CYAN);
    }
    titleRow += colorize(BOX.v, CYAN);
    output.push(titleRow);

    // Panel content
    const panelContent = panelsInRow.map(p => renderPanel(p, panelW, panelH));

    for (let line = 0; line < innerH; line++) {
      let contentRow = colorize(BOX.v, CYAN);
      for (let c = 0; c < cols; c++) {
        const idx = panelsInRow.findIndex(p => p.col === c);
        const w   = (c === cols - 1) ? (termW - 2 - c * panelW) : panelW;
        if (idx !== -1 && panelContent[idx]?.[line] !== undefined) {
          contentRow += padRight(panelContent[idx][line], w);
        } else {
          contentRow += ' '.repeat(w);
        }
        if (c < cols - 1) contentRow += colorize(BOX.v, CYAN);
      }
      contentRow += colorize(BOX.v, CYAN);
      output.push(contentRow);
    }

    // Row separator or bottom border
    if (r < rows - 1) {
      let rowSep = colorize(BOX.ml, CYAN);
      for (let c = 0; c < cols; c++) {
        const w = (c === cols - 1) ? (termW - 2 - c * panelW) : panelW;
        rowSep += colorize(BOX.h.repeat(w), CYAN);
        if (c < cols - 1) rowSep += colorize(BOX.cross, CYAN);
      }
      rowSep += colorize(BOX.mr, CYAN);
      output.push(rowSep);
    }
  }

  output.push(colorize(BOX.bl + BOX.h.repeat(termW - 2) + BOX.br, CYAN));

  cursor.home();
  process.stdout.write(output.join('\n'));
}

// ─── PRESET TEMPLATES ─────────────────────────────────────────────────────────

const PRESETS = {
  git: {
    title: 'Git Dashboard',
    refresh: 3,
    panels: [
      { id: 'status',  title: 'Git Status',    type: 'git.status', source: 'git.status'     },
      { id: 'log',     title: 'Recent Commits', type: 'list',       source: 'git.log'        },
      { id: 'changes', title: 'Changed Files',  type: 'list',       source: 'git.diff.stat'  },
    ],
  },

  system: {
    title: 'System Monitor',
    refresh: 2,
    panels: [
      { id: 'cpu',    title: 'CPU Load',   type: 'metric', source: 'os.loadavg', max: os.cpus().length },
      { id: 'mem',    title: 'Memory',     type: 'bar',    source: 'os.memory'   },
      { id: 'disk',   title: 'Disk Usage', type: 'bar',    source: 'disk.usage'  },
      { id: 'uptime', title: 'Uptime',     type: 'uptime', source: 'os.uptime'   },
    ],
  },

  dev: {
    title: 'Dev Dashboard',
    refresh: 3,
    panels: [
      { id: 'cpu',     title: 'CPU Load',       type: 'metric',     source: 'os.loadavg', max: os.cpus().length },
      { id: 'git',     title: 'Recent Commits',  type: 'list',       source: 'git.log'     },
      { id: 'status',  title: 'Git Status',      type: 'git.status', source: 'git.status'  },
      { id: 'scripts', title: 'npm Scripts',     type: 'list',       source: 'npm.scripts' },
    ],
  },

  focus: {
    title: 'Focus Mode',
    refresh: 1,
    panels: [
      { id: 'pomo',    title: 'Pomodoro Timer',  type: 'timer', source: 'pomodoro'    },
      { id: 'commits', title: "Today's Commits", type: 'list',  source: 'git.log'     },
      { id: 'todos',   title: 'TODO Count',      type: 'count', source: 'todos.count', unit: 'TODOs' },
    ],
  },

  project: {
    title: 'Project Overview',
    refresh: 5,
    panels: [
      { id: 'info',  title: 'Project Info',   type: 'project.info', source: 'project.info' },
      { id: 'git',   title: 'Recent Commits', type: 'list',         source: 'git.log'      },
      { id: 'mem',   title: 'Memory',         type: 'bar',          source: 'os.memory'    },
      { id: 'todos', title: 'TODO Count',     type: 'count',        source: 'todos.count', unit: 'items' },
    ],
  },
};

// ─── AI CONFIG GENERATION ─────────────────────────────────────────────────────

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return reject(new Error('No API key'));

    const systemPrompt = `You are a terminal dashboard configuration generator. Given a description, return ONLY valid JSON (no markdown, no explanation) matching this schema:
{
  "title": "string",
  "refresh": number (1-10 seconds),
  "panels": [
    {
      "id": "unique_snake_case_id",
      "title": "Panel Title",
      "type": "metric|list|count|timer|bar|status|git.status|countdown|uptime|project.info",
      "source": "os.loadavg|os.memory|os.uptime|os.platform|git.log|git.status|git.diff.stat|npm.scripts|todos.count|disk.usage|project.info|countdown.friday|pomodoro",
      "max": number (optional, for metric/bar),
      "unit": "string (optional, for count)"
    }
  ]
}

Source → type pairings:
- os.loadavg → metric (CPU load, set max to 4 or 8)
- os.memory → bar (RAM usage)
- os.uptime → uptime
- os.platform → status
- git.log → list (recent commits)
- git.status → git.status
- git.diff.stat → list (changed files)
- npm.scripts → list
- todos.count → count (unit: "TODOs")
- disk.usage → bar
- project.info → project.info
- countdown.friday → countdown
- pomodoro → timer

Use 2-4 panels. Return ONLY the JSON object, no markdown code blocks.`;

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'x-api-key':          apiKey,
        'anthropic-version':  '2023-06-01',
        'content-type':       'application/json',
        'content-length':     Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          const text  = json.content?.[0]?.text || '';
          const match = text.match(/\{[\s\S]*\}/);
          if (!match) return reject(new Error('No JSON in Claude response'));
          resolve(JSON.parse(match[0]));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── DASHBOARD RUNNER ─────────────────────────────────────────────────────────

function runDashboard(config) {
  const refreshSecs = config.refresh || 2;
  let countdown     = refreshSecs;

  cursor.clear();
  cursor.hide();

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      // q = 113, Ctrl-C = 3
      if (key[0] === 113 || key[0] === 3) shutdown();
    });
  }

  function shutdown() {
    clearInterval(ticker);
    cursor.show();
    cursor.clear();
    cursor.home();
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(false); } catch {}
    }
    process.stdout.write(colorize('\nDashboard stopped.\n', GREEN));
    process.exit(0);
  }

  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);

  process.stdout.on('resize', () => {
    cursor.clear();
    draw(config, countdown);
  });

  draw(config, countdown);

  const ticker = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      countdown = refreshSecs;
    }
    draw(config, countdown);
  }, 1000);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`
${colorize('dashboard-builder', BOLD + CYAN)} \u2014 Describe a terminal dashboard. Get it running instantly.

${colorize('USAGE', BOLD)}
  npx dashboard-builder "description"     AI-generated dashboard (needs ANTHROPIC_API_KEY)
  npx dashboard-builder --git             Git activity dashboard
  npx dashboard-builder --system          System CPU/memory/disk
  npx dashboard-builder --dev             Dev dashboard (git + npm + CPU)
  npx dashboard-builder --focus           Pomodoro timer + commits + TODOs
  npx dashboard-builder --project         Auto-detect project type and show stats
  npx dashboard-builder --list            List all presets
  npx dashboard-builder --save <f.json>   Save generated config to file
  npx dashboard-builder --load <f.json>   Load and run saved config
  npx dashboard-builder --preview <name>  Print preset config as JSON

${colorize('EXAMPLES', BOLD)}
  npx dashboard-builder "show CPU, memory, and recent git commits"
  npx dashboard-builder "pomodoro timer with todo count and git status"
  npx dashboard-builder --git
  npx dashboard-builder --save myboard.json "CPU and memory"
  npx dashboard-builder --load myboard.json

${colorize('CONTROLS', BOLD)}
  q / Ctrl-C   Stop dashboard

${colorize('ENV', BOLD)}
  ANTHROPIC_API_KEY   Enables AI mode (optional \u2014 presets work without it)

`);
    process.exit(0);
  }

  if (args.includes('--list')) {
    process.stdout.write(`\n${colorize('Available preset templates:', BOLD + CYAN)}\n\n`);
    for (const [key, cfg] of Object.entries(PRESETS)) {
      const panels = cfg.panels.map(p => p.title).join(', ');
      process.stdout.write(`  ${colorize('--' + key, BOLD + GREEN).padEnd(20)}  ${colorize(cfg.title, WHITE)} \u2014 ${panels}\n`);
    }
    process.stdout.write('\n');
    process.exit(0);
  }

  // Preset flags
  for (const preset of Object.keys(PRESETS)) {
    if (args.includes(`--${preset}`)) {
      runDashboard(PRESETS[preset]);
      return;
    }
  }

  // --preview
  if (args.includes('--preview')) {
    const idx    = args.indexOf('--preview') + 1;
    const name   = args[idx];
    const preset = PRESETS[name];
    if (!preset) {
      process.stderr.write(colorize(`Unknown preset: ${name}. Run --list to see options.\n`, RED));
      process.exit(1);
    }
    process.stdout.write(JSON.stringify(preset, null, 2) + '\n');
    process.exit(0);
  }

  // --load
  if (args.includes('--load')) {
    const idx  = args.indexOf('--load') + 1;
    const file = args[idx];
    if (!file || !existsSync(file)) {
      process.stderr.write(colorize(`File not found: ${file || '(none specified)'}\n`, RED));
      process.exit(1);
    }
    const config = JSON.parse(readFileSync(file, 'utf8'));
    process.stdout.write(colorize(`Loaded: ${file}\n`, GREEN));
    await new Promise(r => setTimeout(r, 400));
    runDashboard(config);
    return;
  }

  // --save flag (grab file path but continue to generate)
  let saveFile = null;
  if (args.includes('--save')) {
    const idx = args.indexOf('--save') + 1;
    saveFile  = args[idx];
  }

  // Description = remaining non-flag args (excluding save filename)
  const flagArgs = new Set(['--save', saveFile].filter(Boolean));
  const descArgs = args.filter(a => !a.startsWith('--') && !flagArgs.has(a));
  const description = descArgs.join(' ').trim();

  if (!description) {
    process.stderr.write(colorize('No description provided. Use --help for usage.\n', YELLOW));
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    process.stdout.write(colorize(`\nNo ANTHROPIC_API_KEY \u2014 matching preset for: "${description}"\n`, YELLOW));
    const desc    = description.toLowerCase();
    let matched   = 'dev';
    if ((desc.includes('git') || desc.includes('commit')) && !desc.includes('system')) matched = 'git';
    else if (desc.includes('system') || (desc.includes('cpu') && desc.includes('memory'))) matched = 'system';
    else if (desc.includes('focus') || desc.includes('pomodoro')) matched = 'focus';
    else if (desc.includes('project')) matched = 'project';
    process.stdout.write(colorize(`\u2192 Running preset: --${matched}\n\n`, CYAN));
    await new Promise(r => setTimeout(r, 800));
    runDashboard(PRESETS[matched]);
    return;
  }

  process.stdout.write(colorize('\nGenerating dashboard config with Claude Haiku\u2026\n', CYAN));

  let config;
  try {
    config = await callClaude(description);
    process.stdout.write(colorize('Config generated. Starting dashboard\u2026\n', GREEN));
  } catch (err) {
    process.stderr.write(colorize(`\nAI generation failed: ${err.message}\n`, RED));
    process.stdout.write(colorize('Falling back to dev preset\u2026\n', YELLOW));
    config = PRESETS.dev;
  }

  if (saveFile) {
    writeFileSync(saveFile, JSON.stringify(config, null, 2));
    process.stdout.write(colorize(`Config saved to: ${saveFile}\n`, GREEN));
  }

  await new Promise(r => setTimeout(r, 500));
  runDashboard(config);
}

main().catch(err => {
  cursor.show();
  process.stderr.write(colorize(`\nFatal error: ${err.message}\n`, RED));
  process.exit(1);
});
