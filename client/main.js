// ── Theme ──
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('theme', next);
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
}

const reviseBtn = document.getElementById('revise-btn');
const copyBtn = document.getElementById('copy-btn');
const inputText = document.getElementById('input-text');
const outputText = document.getElementById('output-text');
const status = document.getElementById('status');

// ── Pill selection ──
const pillGroups = {};
document.querySelectorAll('.preset-pills').forEach((group) => {
  const name = group.dataset.group;
  pillGroups[name] = '';
  group.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      group.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      pillGroups[name] = pill.dataset.value;

      // Clear the custom input for this group when a preset is chosen
      const custom = document.getElementById(`${name}-custom`);
      if (custom) custom.value = '';
    });
  });
});

// Clear pill selection when user types a custom value
document.querySelectorAll('.custom-input').forEach((input) => {
  input.addEventListener('input', () => {
    const groupName = input.id.replace('-custom', '');
    const group = document.querySelector(`.preset-pills[data-group="${groupName}"]`);
    if (!group) return;
    group.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
    pillGroups[groupName] = '';
  });
});

function getControlValue(groupName) {
  const custom = document.getElementById(`${groupName}-custom`);
  return custom?.value.trim() || pillGroups[groupName] || '';
}

function buildPrompt(text) {
  const tone = getControlValue('tone');
  const audience = getControlValue('audience');
  const length = pillGroups['length'];
  const readingLevel = pillGroups['reading-level'];
  const style = getControlValue('style');
  const comments = document.getElementById('comments').value.trim();

  const stylePrefs = [
    style && style,
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

reviseBtn.addEventListener('click', async () => {
  const text = inputText.value.trim();
  if (!text) {
    setStatus('Please enter some text to revise.', true);
    return;
  }

  reviseBtn.disabled = true;
  copyBtn.disabled = true;
  outputText.value = '';
  setStatus('Revising...');

  try {
    const res = await fetch('/api/revise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: buildPrompt(text) }),
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || 'Something went wrong.', true);
      return;
    }

    outputText.value = data.revised;
    copyBtn.disabled = false;
    setStatus('Done.');
  } catch {
    setStatus('Network error. Is the server running?', true);
  } finally {
    reviseBtn.disabled = false;
  }
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(outputText.value).then(() => {
    setStatus('Copied to clipboard.');
  });
});

function setStatus(msg, isError = false) {
  status.textContent = msg;
  status.className = 'status' + (isError ? ' error' : '');
}
