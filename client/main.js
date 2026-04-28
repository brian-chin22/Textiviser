// ── Theme ──
const themeToggle = document.getElementById('theme-toggle');
applyTheme(localStorage.getItem('theme') || 'light');

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('theme', next);
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
}

// ── Router ──
const pages = {
  '':              document.getElementById('page-home'),
  '#':             document.getElementById('page-home'),
  '#cover-letter': document.getElementById('page-cover-letter'),
};

function navigate() {
  const hash = window.location.hash || '#';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const page = pages[hash] || pages['#'];
  if (page) page.classList.add('active');

  const link = document.querySelector(`.nav-link[href="${hash === '#' ? '#' : hash}"]`);
  if (link) link.classList.add('active');
}

window.addEventListener('hashchange', navigate);
navigate();

// ── Pill groups (shared across all pages) ──
const pillGroups = {};

document.querySelectorAll('.preset-pills').forEach((group) => {
  const name = group.dataset.group;
  const active = group.querySelector('.pill.active');
  pillGroups[name] = active ? active.dataset.value : '';

  group.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      group.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      pillGroups[name] = pill.dataset.value;

      const custom = document.getElementById(`${name}-custom`);
      if (custom) custom.value = '';
    });
  });
});

document.querySelectorAll('.custom-input').forEach((input) => {
  input.addEventListener('input', () => {
    const groupName = input.id.replace('-custom', '');
    const group = document.querySelector(`.preset-pills[data-group="${groupName}"]`);
    if (!group) return;
    group.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pillGroups[groupName] = '';
  });
});

function getControlValue(groupName) {
  const custom = document.getElementById(`${groupName}-custom`);
  return custom?.value.trim() || pillGroups[groupName] || '';
}

// ── Streaming render queue ──
const CHARS_PER_FRAME = 8;
let renderQueue = '';
let renderTarget = null;
let rafId = null;

function enqueue(text, target) {
  renderQueue += text;
  renderTarget = target;
  if (!rafId) scheduleTick();
}

function scheduleTick() {
  rafId = requestAnimationFrame(tick);
}

function tick() {
  if (!renderQueue || !renderTarget) {
    rafId = null;
    renderTarget = null;
    return;
  }
  renderTarget.value += renderQueue.slice(0, CHARS_PER_FRAME);
  renderQueue = renderQueue.slice(CHARS_PER_FRAME);
  renderTarget.scrollTop = renderTarget.scrollHeight;
  scheduleTick();
}

function resetQueue() {
  renderQueue = '';
  renderTarget = null;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function waitForDrain() {
  return new Promise(resolve => {
    if (!renderQueue && !rafId) { resolve(); return; }
    const id = setInterval(() => {
      if (!renderQueue && !rafId) { clearInterval(id); resolve(); }
    }, 16);
  });
}

// ── Shared revision runner ──
async function runRevision({ prompt, outputEl, reviseBtnEl, copyBtnEl, statusEl }) {
  reviseBtnEl.disabled = true;
  copyBtnEl.disabled = true;
  outputEl.value = '';
  resetQueue();
  statusEl.textContent = 'Revising...';
  statusEl.className = 'status';

  try {
    const res = await fetch('/api/revise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const data = await res.json();
      statusEl.textContent = data.error || 'Something went wrong.';
      statusEl.className = 'status error';
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      enqueue(decoder.decode(value, { stream: true }), outputEl);
    }

    await waitForDrain();

    copyBtnEl.disabled = false;
    statusEl.textContent = 'Done.';
    statusEl.className = 'status';
  } catch {
    statusEl.textContent = 'Network error. Is the server running?';
    statusEl.className = 'status error';
  } finally {
    reviseBtnEl.disabled = false;
  }
}

// ── Page: Text Reviser ──
function buildPrompt(text) {
  const tone = getControlValue('tone');
  const audience = getControlValue('audience');
  const length = pillGroups['length'];
  const readingLevel = pillGroups['reading-level'];
  const style = getControlValue('style');
  const comments = document.getElementById('comments').value.trim();

  const stylePrefs = [
    style,
    readingLevel && `${readingLevel} reading level`,
  ].filter(Boolean).join(', ');

  const lengthConstraint = length ? `Make it ${length.toLowerCase()}` : '';
  const req = (label, value) => value ? `* ${label}: ${value}` : `* ${label}: Not specified`;

  return `You are an expert editor and writer. Revise the following text according to the user's specifications.

Original Text:
${text}

Revision Requirements:

${req('Tone', tone)}
${req('Audience', audience)}
* Purpose/Goal: Not specified
* Context/Setting: Not specified
${req('Length Constraint', lengthConstraint)}
${req('Style Preferences', stylePrefs)}
* Key Points to Emphasize: Not specified
${req('Things to Avoid', comments)}

Instructions:

* Preserve the original meaning unless explicitly told to modify it.
* Improve clarity, coherence, and readability.
* Ensure the revised text aligns strictly with the tone, audience, and purpose.
* If necessary, restructure sentences or paragraphs for better flow.
* Do not include explanations—output only the revised text.

Revised Text:`;
}

const reviseBtn   = document.getElementById('revise-btn');
const copyBtn     = document.getElementById('copy-btn');
const inputText   = document.getElementById('input-text');
const outputText  = document.getElementById('output-text');
const statusEl    = document.getElementById('status');

reviseBtn.addEventListener('click', () => {
  const text = inputText.value.trim();
  if (!text) {
    statusEl.textContent = 'Please enter some text to revise.';
    statusEl.className = 'status error';
    return;
  }
  runRevision({ prompt: buildPrompt(text), outputEl: outputText, reviseBtnEl: reviseBtn, copyBtnEl: copyBtn, statusEl });
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(outputText.value).then(() => {
    statusEl.textContent = 'Copied to clipboard.';
    statusEl.className = 'status';
  });
});

// ── Page: Cover Letter ──
function buildCoverLetterPrompt(text) {
  const position = document.getElementById('cl-position').value.trim();
  const company  = document.getElementById('cl-company').value.trim();
  const tone     = pillGroups['cl-tone'] || 'Professional';
  const emphasis = pillGroups['cl-emphasis'];
  const length   = pillGroups['cl-length'] || 'standard (~350 words)';
  const skills   = document.getElementById('cl-skills').value.trim();
  const comments = document.getElementById('cl-comments').value.trim();

  const req = (label, value) => value ? `- ${label}: ${value}` : `- ${label}: Not specified`;

  return `You are an expert career coach and professional writer specializing in cover letters.

Job Details:
${req('Position', position)}
${req('Company', company)}

Original Cover Letter / Draft:
${text}

Revision Requirements:
- Tone: ${tone}
${emphasis ? `- Emphasize: ${emphasis}` : ''}
- Length: ${length}
${req('Key Skills to Highlight', skills)}
${comments ? `- Additional Notes: ${comments}` : ''}

Instructions:
- Do not open with 'I am writing to apply'.
- Open with a compelling hook that immediately grabs the hiring manager's attention.
- Clearly connect the applicant's background to the specific role and company.
- Highlight concrete achievements with quantifiable results where possible.
- Keep it under 250 words.
- The tone should be confident and human, not formal and stiff.
- Show genuine enthusiasm for the company and position.
- Close with a confident, action-oriented call to action.
- Preserve any specific facts, dates, names, or numbers from the original.
- Do not include explanations or meta-commentary—output only the revised cover letter.

Revised Cover Letter:`;
}

const clReviseBtn  = document.getElementById('cl-revise-btn');
const clCopyBtn    = document.getElementById('cl-copy-btn');
const clInputText  = document.getElementById('cl-input-text');
const clOutputText = document.getElementById('cl-output-text');
const clStatusEl   = document.getElementById('cl-status');

clReviseBtn.addEventListener('click', () => {
  const text = clInputText.value.trim();
  if (!text) {
    clStatusEl.textContent = 'Please enter your cover letter draft.';
    clStatusEl.className = 'status error';
    return;
  }
  runRevision({ prompt: buildCoverLetterPrompt(text), outputEl: clOutputText, reviseBtnEl: clReviseBtn, copyBtnEl: clCopyBtn, statusEl: clStatusEl });
});

clCopyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(clOutputText.value).then(() => {
    clStatusEl.textContent = 'Copied to clipboard.';
    clStatusEl.className = 'status';
  });
});
