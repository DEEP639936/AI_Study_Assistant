const state = {
  uploadedFiles: {},
  activeDoc: '',
  numQuestions: 5,
  isLoading: false,
};

const $ = (id) => document.getElementById(id);
const refs = {
  chatMessages: $('chatMessages'), chatInput: $('chatInput'), sendBtn: $('sendBtn'),
  fileInput: $('fileInput'), dropZone: $('dropZone'), browseBtn: $('browseBtn'),
  uploadProgress: $('uploadProgress'), progressFill: $('progressFill'), progressLabel: $('progressLabel'),
  fileList: $('fileList'), fileCount: $('fileCount'), activeDoc: $('activeDoc'),
  statusPill: $('statusPill'), statusText: $('statusText'), summarizeBtn: $('summarizeBtn'),
  summaryOutput: $('summaryOutput'), quizBtn: $('quizBtn'), quizOutput: $('quizOutput'),
  numDisplay: $('numDisplay'), numMinus: $('numMinus'), numPlus: $('numPlus'),
  themeToggle: $('themeToggle'), themeIcon: $('themeIcon'), toastContainer: $('toastContainer'),
  fabMobile: $('fabMobile'), sidebar: $('sidebar'), sidebarOverlay: $('sidebarOverlay'),
  clearChatBtn: $('clearChatBtn'), refreshDocsBtn: $('refreshDocsBtn'),
  keyPointsBtn: $('keyPointsBtn'), keyPointsOutput: $('keyPointsOutput'),
  flashcardsBtn: $('flashcardsBtn'), flashcardsOutput: $('flashcardsOutput'),
};

function setStatus(type, text) {
  refs.statusPill.className = `status-pill ${type || ''}`;
  refs.statusText.textContent = text;
}

function showToast(message, type = 'info') {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type]} toast-icon"></i><span class="toast-msg">${message}</span>`;
  refs.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function markdownToHtml(text) {
  return marked.parse(text || '', { breaks: true, gfm: true });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function initTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  applyTheme(theme);
  refs.themeToggle.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  refs.themeIcon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
  localStorage.setItem('theme', theme);
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

function renderFiles() {
  const files = Object.values(state.uploadedFiles);
  refs.fileCount.textContent = String(files.length);
  if (!files.length) {
    refs.fileList.innerHTML = `<div class="empty-state-small"><i class="fas fa-file-lines"></i><p>No files uploaded yet</p></div>`;
    refs.activeDoc.innerHTML = '<option value="">All uploaded notes</option>';
    return;
  }
  refs.fileList.innerHTML = files.map(file => `
    <div class="file-item ${state.activeDoc === file.filename ? 'active' : ''}">
      <div class="file-item-main">
        <i class="fas ${file.filename.endsWith('.pdf') ? 'fa-file-pdf' : 'fa-file-lines'} file-item-icon"></i>
        <div class="file-item-info">
          <div class="file-item-name">${escapeHtml(file.filename)}</div>
          <div class="file-item-size">${file.chunk_count || 0} chunks · ${file.pages || 0} pages</div>
        </div>
      </div>
      <button class="file-item-del" onclick="removeFile('${encodeURIComponent(file.filename)}')"><i class="fas fa-xmark"></i></button>
    </div>`).join('');
  refs.activeDoc.innerHTML = '<option value="">All uploaded notes</option>' + files.map(file => `<option value="${escapeHtml(file.filename)}">${escapeHtml(file.filename)}</option>`).join('');
  refs.activeDoc.value = state.activeDoc || '';
}

async function refreshDocuments() {
  const res = await fetch('/documents');
  const data = await res.json();
  if (data.success) {
    state.uploadedFiles = {};
    data.documents.forEach(doc => state.uploadedFiles[doc.filename] = doc);
    renderFiles();
  }
}

async function handleUpload(files) {
  const validFiles = [...files].filter(file => /\.(pdf|txt|md)$/i.test(file.name));
  if (!validFiles.length) return showToast('Upload PDF, TXT, or MD files only.', 'error');

  const formData = new FormData();
  validFiles.forEach(file => formData.append('file', file));
  refs.uploadProgress.style.display = 'block';
  refs.progressFill.style.width = '35%';
  refs.progressLabel.textContent = `Uploading ${validFiles.length} file(s)...`;
  setStatus('loading', 'Uploading');

  try {
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    refs.progressFill.style.width = '100%';
    if (!data.success) throw new Error(data.error || 'Upload failed');
    data.files.forEach(file => state.uploadedFiles[file.filename] = file);
    renderFiles();
    showToast(data.message, 'success');
    setStatus('', 'Ready');
  } catch (error) {
    showToast(error.message, 'error');
    setStatus('error', 'Error');
  } finally {
    setTimeout(() => { refs.uploadProgress.style.display = 'none'; refs.fileInput.value = ''; }, 1200);
  }
}

window.removeFile = async (encodedName) => {
  const filename = decodeURIComponent(encodedName);
  await fetch(`/documents/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  delete state.uploadedFiles[filename];
  if (state.activeDoc === filename) state.activeDoc = '';
  renderFiles();
  showToast(`${filename} removed.`, 'info');
};

function addMessage(role, text, citations = []) {
  document.querySelector('.welcome-card')?.remove();
  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  const citationHtml = citations?.length ? `<div class="message-citations">${citations.map(c => `<span class="citation-chip">${escapeHtml(c)}</span>`).join('')}</div>` : '';
  row.innerHTML = `
    <div class="message-avatar"><i class="fas ${role === 'user' ? 'fa-user' : 'fa-robot'}"></i></div>
    <div class="message-bubble-wrap">
      <div class="message-bubble">${role === 'user' ? escapeHtml(text).replace(/\n/g,'<br>') : markdownToHtml(text)}</div>
      ${citationHtml}
    </div>`;
  refs.chatMessages.appendChild(row);
  refs.chatMessages.scrollTop = refs.chatMessages.scrollHeight;
}

function addTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'message-row ai';
  el.id = `typing-${Date.now()}`;
  el.innerHTML = `<div class="message-avatar"><i class="fas fa-robot"></i></div><div class="message-bubble typing"><span></span><span></span><span></span></div>`;
  refs.chatMessages.appendChild(el);
  refs.chatMessages.scrollTop = refs.chatMessages.scrollHeight;
  return el.id;
}

function removeTypingIndicator(id) {
  $(id)?.remove();
}

async function sendMessage() {
  const question = refs.chatInput.value.trim();
  if (!question || state.isLoading) return;
  if (!Object.keys(state.uploadedFiles).length) return showToast('Upload notes first.', 'warning');

  addMessage('user', question);
  refs.chatInput.value = '';
  refs.chatInput.style.height = 'auto';
  state.isLoading = true;
  refs.sendBtn.disabled = true;
  setStatus('loading', 'Thinking');
  const typingId = addTypingIndicator();

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, filename: state.activeDoc }),
    });
    const data = await res.json();
    removeTypingIndicator(typingId);
    if (!data.success) throw new Error(data.error || 'Chat failed');
    addMessage('ai', data.answer, data.citations || []);
    setStatus('', 'Ready');
  } catch (error) {
    removeTypingIndicator(typingId);
    addMessage('ai', `### Error\n${error.message}`);
    setStatus('error', 'Error');
  } finally {
    state.isLoading = false;
    refs.sendBtn.disabled = false;
  }
}

async function callTool(endpoint, targetEl, buttonEl, payload = {}, successMessage = 'Done') {
  if (!Object.keys(state.uploadedFiles).length) return showToast('Upload notes first.', 'warning');
  targetEl.innerHTML = `<div class="output-loading"><div class="spinner"></div><p>Working...</p></div>`;
  buttonEl.disabled = true;
  setStatus('loading', 'Generating');
  try {
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, filename: state.activeDoc }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Request failed');
    const content = data.summary || data.quiz || data.key_points || data.flashcards;
    targetEl.innerHTML = `<div class="output-content">${markdownToHtml(content)}</div>`;
    setStatus('', 'Ready');
    showToast(successMessage, 'success');
  } catch (error) {
    targetEl.innerHTML = `<div class="error-box"><i class="fas fa-circle-exclamation"></i><span>${escapeHtml(error.message)}</span></div>`;
    setStatus('error', 'Error');
  } finally {
    buttonEl.disabled = false;
  }
}

function initEvents() {
  refs.browseBtn.addEventListener('click', () => refs.fileInput.click());
  refs.dropZone.addEventListener('click', () => refs.fileInput.click());
  refs.fileInput.addEventListener('change', () => handleUpload(refs.fileInput.files));
  refs.dropZone.addEventListener('dragover', e => { e.preventDefault(); refs.dropZone.classList.add('dragover'); });
  refs.dropZone.addEventListener('dragleave', () => refs.dropZone.classList.remove('dragover'));
  refs.dropZone.addEventListener('drop', e => { e.preventDefault(); refs.dropZone.classList.remove('dragover'); handleUpload(e.dataTransfer.files); });
  refs.activeDoc.addEventListener('change', () => { state.activeDoc = refs.activeDoc.value; renderFiles(); });
  refs.chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  refs.chatInput.addEventListener('input', () => { refs.chatInput.style.height = 'auto'; refs.chatInput.style.height = Math.min(refs.chatInput.scrollHeight, 160) + 'px'; });
  refs.sendBtn.addEventListener('click', sendMessage);
  refs.summarizeBtn.addEventListener('click', () => callTool('/summarize', refs.summaryOutput, refs.summarizeBtn, {}, 'Summary generated'));
  refs.quizBtn.addEventListener('click', () => callTool('/quiz', refs.quizOutput, refs.quizBtn, { num_questions: state.numQuestions }, 'Quiz generated'));
  refs.keyPointsBtn.addEventListener('click', () => callTool('/key-points', refs.keyPointsOutput, refs.keyPointsBtn, {}, 'Key points generated'));
  refs.flashcardsBtn.addEventListener('click', () => callTool('/flashcards', refs.flashcardsOutput, refs.flashcardsBtn, { num_cards: 8 }, 'Flashcards generated'));
  refs.numMinus.addEventListener('click', () => { state.numQuestions = Math.max(1, state.numQuestions - 1); refs.numDisplay.textContent = state.numQuestions; });
  refs.numPlus.addEventListener('click', () => { state.numQuestions = Math.min(10, state.numQuestions + 1); refs.numDisplay.textContent = state.numQuestions; });
  refs.clearChatBtn.addEventListener('click', async () => { await fetch('/chat/clear', { method: 'POST' }); refs.chatMessages.innerHTML = `<div class="welcome-card glass"><div class="welcome-icon"><i class="fas fa-robot"></i></div><h1>Conversation cleared.</h1><p>Upload notes or ask a fresh question to continue.</p></div>`; showToast('Conversation cleared.', 'success'); });
  refs.refreshDocsBtn.addEventListener('click', refreshDocuments);
  document.querySelectorAll('.tip-chip').forEach(chip => chip.addEventListener('click', () => { refs.chatInput.value = chip.textContent.trim(); refs.chatInput.focus(); }));
  refs.fabMobile.addEventListener('click', () => { refs.sidebar.classList.toggle('open'); refs.sidebarOverlay.classList.toggle('open'); });
  refs.sidebarOverlay.addEventListener('click', () => { refs.sidebar.classList.remove('open'); refs.sidebarOverlay.classList.remove('open'); });
}

initTheme();
initTabs();
initEvents();
refreshDocuments();
setStatus('', 'Ready');

// FIX: Add response modes and override send behavior without changing existing app.js code above
state.responseMode = 'detailed';

function getModeInstruction(mode) {
  if (mode === 'simple') {
    return `Answer in very simple and beginner-friendly language.
Use short paragraphs.
Explain difficult words in an easy way.
Give 3 to 5 key points at the end.`;
  }

  if (mode === 'exam') {
    return `Answer in exam-oriented format.
Start with a direct definition or core answer.
Then give important points in bullets.
Highlight important terms, short notes, and revision points.
Keep it easy to remember for exams.`;
  }

  return `Answer in detailed and well-structured format.
Use these sections:
1. Overview
2. Detailed Explanation
3. Key Points
4. Example (if relevant)
5. Final Summary

Make the explanation easy to understand and student-friendly.`;
}

function injectModeButtons() {
  if (document.getElementById('responseModeBar')) return;
  if (!refs.chatMessages || !refs.chatMessages.parentNode) return;

  const bar = document.createElement('div');
  bar.id = 'responseModeBar';
  bar.style.display = 'flex';
  bar.style.gap = '10px';
  bar.style.flexWrap = 'wrap';
  bar.style.margin = '0 0 12px 0';

  bar.innerHTML = `
    <button type="button" class="response-mode-btn active" data-mode="detailed">Detailed mode</button>
    <button type="button" class="response-mode-btn" data-mode="simple">Simple mode</button>
    <button type="button" class="response-mode-btn" data-mode="exam">Exam mode</button>
  `;

  refs.chatMessages.parentNode.insertBefore(bar, refs.chatMessages);

  if (!document.getElementById('responseModeStyle')) {
    const style = document.createElement('style');
    style.id = 'responseModeStyle';
    style.innerHTML = `
      .response-mode-btn {
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(255,255,255,.05);
        color: var(--text);
        cursor: pointer;
        transition: .2s ease;
      }
      .response-mode-btn:hover {
        transform: translateY(-1px);
        background: rgba(124,58,237,.12);
      }
      .response-mode-btn.active {
        background: linear-gradient(135deg, var(--primary), #4f46e5);
        color: #fff;
        border-color: transparent;
      }
    `;
    document.head.appendChild(style);
  }

  bar.querySelectorAll('.response-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.response-mode-btn').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      state.responseMode = btn.dataset.mode;
      showToast(`Switched to ${btn.textContent}.`, 'info');
      refs.chatInput.focus();
    });
  });
}

async function sendMessageWithMode() {
  const question = refs.chatInput.value.trim();
  if (!question || state.isLoading) return;
  if (!Object.keys(state.uploadedFiles).length) return showToast('Upload notes first.', 'warning');

  const modeInstruction = getModeInstruction(state.responseMode || 'detailed');
  const enhancedQuestion = `${modeInstruction}

User question:
${question}`;

  addMessage('user', question);
  refs.chatInput.value = '';
  refs.chatInput.style.height = 'auto';
  state.isLoading = true;
  refs.sendBtn.disabled = true;
  setStatus('loading', 'Thinking');
  const typingId = addTypingIndicator();

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: enhancedQuestion,
        filename: state.activeDoc,
      }),
    });

    const data = await res.json();
    removeTypingIndicator(typingId);

    if (!data.success) throw new Error(data.error || 'Chat failed');

    addMessage('ai', data.answer, data.citations || []);
    setStatus('', 'Ready');
  } catch (error) {
    removeTypingIndicator(typingId);
    addMessage('ai', `### Error\n${error.message}`);
    setStatus('error', 'Error');
  } finally {
    state.isLoading = false;
    refs.sendBtn.disabled = false;
  }
}

function rebindChatEventsForModes() {
  if (!refs.sendBtn || !refs.chatInput) return;

  const newSendBtn = refs.sendBtn.cloneNode(true);
  refs.sendBtn.parentNode.replaceChild(newSendBtn, refs.sendBtn);
  refs.sendBtn = newSendBtn;

  const newChatInput = refs.chatInput.cloneNode(true);
  newChatInput.value = refs.chatInput.value;
  newChatInput.style.height = refs.chatInput.style.height;
  refs.chatInput.parentNode.replaceChild(newChatInput, refs.chatInput);
  refs.chatInput = newChatInput;

  refs.sendBtn.addEventListener('click', sendMessageWithMode);

  refs.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageWithMode();
    }
  });

  refs.chatInput.addEventListener('input', () => {
    refs.chatInput.style.height = 'auto';
    refs.chatInput.style.height = Math.min(refs.chatInput.scrollHeight, 160) + 'px';
  });

  document.querySelectorAll('.tip-chip').forEach(chip => {
    const newChip = chip.cloneNode(true);
    chip.parentNode.replaceChild(newChip, chip);

    newChip.addEventListener('click', () => {
      refs.chatInput.value = newChip.textContent.trim();
      refs.chatInput.focus();
      sendMessageWithMode();
    });
  });
}

injectModeButtons();
rebindChatEventsForModes();

// FIX: Rebind upload controls at the end so picker opens only once and drag-drop works properly
(function fixUploadControls() {
  if (!refs.dropZone || !refs.fileInput || !refs.browseBtn) return;

  // Replace old elements with clean clones to remove previous upload listeners
  const newDropZone = refs.dropZone.cloneNode(true);
  const newFileInput = refs.fileInput.cloneNode(true);
  const newBrowseBtn = newDropZone.querySelector('#browseBtn') || refs.browseBtn.cloneNode(true);

  // Put cloned file input back into the cloned drop zone if needed
  const oldInputInClone = newDropZone.querySelector('#fileInput');
  if (oldInputInClone) {
    oldInputInClone.replaceWith(newFileInput);
  } else {
    newDropZone.prepend(newFileInput);
  }

  const oldBrowseInClone = newDropZone.querySelector('#browseBtn');
  if (oldBrowseInClone && oldBrowseInClone !== newBrowseBtn) {
    oldBrowseInClone.replaceWith(newBrowseBtn);
  }

  refs.dropZone.parentNode.replaceChild(newDropZone, refs.dropZone);

  // Update refs to point to the new clean elements
  refs.dropZone = newDropZone;
  refs.fileInput = newFileInput;
  refs.browseBtn = newBrowseBtn;

  let isPickingFile = false;

  function openFilePicker() {
    if (isPickingFile) return;
    isPickingFile = true;
    refs.fileInput.click();
  }

  // Browse text/button click: open picker once only
  refs.browseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openFilePicker();
  });

  // Drop zone click: open picker once, but ignore browse button clicks
  refs.dropZone.addEventListener('click', (e) => {
    if (e.target.closest('#browseBtn')) return;
    e.preventDefault();
    openFilePicker();
  });

  // Prevent bubbling from input itself
  refs.fileInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // File selected from picker
  refs.fileInput.addEventListener('change', () => {
    isPickingFile = false;
    if (refs.fileInput.files && refs.fileInput.files.length) {
      handleUpload(refs.fileInput.files);
    }
  });

  // Drag over
  refs.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    refs.dropZone.classList.add('dragover');
  });

  // Drag leave
  refs.dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    refs.dropZone.classList.remove('dragover');
  });

  // Drop files
  refs.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    refs.dropZone.classList.remove('dragover');

    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length) {
      isPickingFile = false;
      handleUpload(droppedFiles);
    }
  });
})();

// FIX: Enhance AI answer formatting and transform quiz output into cleaner cards
(function enhanceUiFormatting() {
  function escapeUnsafe(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatAiAnswerBubbles() {
    document.querySelectorAll('.message-row.ai .message-bubble').forEach((bubble) => {
      if (bubble.dataset.enhanced === 'true') return;

      let html = bubble.innerHTML;

      html = html.replace(/(?:^|>)(Key Points:)(?:<|$)/gi, '><strong>$1</strong><');
      html = html.replace(/(?:^|>)(Final Summary:)(?:<|$)/gi, '><strong>$1</strong><');
      html = html.replace(/(?:^|>)(Overview:)(?:<|$)/gi, '><strong>$1</strong><');
      html = html.replace(/(?:^|>)(Detailed Explanation:)(?:<|$)/gi, '><strong>$1</strong><');
      html = html.replace(/(?:^|>)(Example:)(?:<|$)/gi, '><strong>$1</strong><');

      bubble.innerHTML = html;
      bubble.dataset.enhanced = 'true';
    });
  }

  function parseQuizTextToCards(rawText) {
    if (!rawText) return '';

    const lines = rawText
      .replace(/\r/g, '')
      .split('\n')
      .map(line => line.trim());

    const blocks = [];
    let current = [];

    for (const line of lines) {
      if (/^Q\d+[\.\):\-]/i.test(line) && current.length) {
        blocks.push(current);
        current = [line];
      } else {
        current.push(line);
      }
    }
    if (current.length) blocks.push(current);

    const cards = [];

    blocks.forEach((block) => {
      const clean = block.filter(Boolean);
      const titleLine = clean.find(line => /^Q\d+[\.\):\-]/i.test(line));
      if (!titleLine) return;

      const options = clean.filter(line => /^[A-D][\)\.\-]/i.test(line));
      const answerLine = clean.find(line => /^Correct Answer\s*:/i.test(line));
      const explanationLineIndex = clean.findIndex(line => /^Explanation\s*:/i.test(line));

      let questionText = titleLine.replace(/^Q\d+[\.\):\-]\s*/i, '').trim();

      if (!questionText) {
        const explicitQuestion = clean.find(line => /^[-•]?\s*Question\s*:/i.test(line));
        if (explicitQuestion) {
          questionText = explicitQuestion.replace(/^[-•]?\s*Question\s*:/i, '').trim();
        }
      }

      let explanation = '';
      if (explanationLineIndex !== -1) {
        explanation = clean
          .slice(explanationLineIndex)
          .join(' ')
          .replace(/^Explanation\s*:/i, '')
          .trim();
      }

      const titleMatch = titleLine.match(/^Q\d+/i);
      const title = titleMatch ? titleMatch[0].toUpperCase() : 'QUESTION';

      cards.push(`
        <div class="quiz-card">
          <div class="quiz-card-title">${escapeUnsafe(title)}</div>
          <div class="quiz-question-text">${escapeUnsafe(questionText || titleLine)}</div>
          <div class="quiz-options">
            ${options.map(opt => `<div class="quiz-option">${escapeUnsafe(opt)}</div>`).join('')}
          </div>
          ${answerLine ? `<div class="quiz-answer"><strong>${escapeUnsafe(answerLine)}</strong></div>` : ''}
          ${explanation ? `<div class="quiz-explanation">${escapeUnsafe(explanation)}</div>` : ''}
        </div>
      `);
    });

    return cards.join('');
  }

  function enhanceQuizOutput() {
    const quizOutput = document.getElementById('quizOutput');
    if (!quizOutput) return;

    const content = quizOutput.querySelector('.output-content');
    if (!content || content.dataset.quizEnhanced === 'true') return;

    const rawText = content.innerText || '';
    if (!/Q1/i.test(rawText) || !/Correct Answer/i.test(rawText)) return;

    const cardsHtml = parseQuizTextToCards(rawText);
    if (!cardsHtml) return;

    content.innerHTML = cardsHtml;
    content.dataset.quizEnhanced = 'true';
  }

  const observer = new MutationObserver(() => {
    formatAiAnswerBubbles();
    enhanceQuizOutput();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  formatAiAnswerBubbles();
  enhanceQuizOutput();
})();

// FIX: Create sidebar toggle + top mode buttons from scratch
(function initUiAddons() {
  function run() {
    const sidebar = document.querySelector('.sidebar');
    const tabNav = document.querySelector('.tab-nav');
    if (!tabNav) return;

    // ---------- Sidebar toggle button ----------
    if (sidebar && !document.getElementById('sidebarToggleBtnInline')) {
      const uploadTitle = Array.from(sidebar.querySelectorAll('.section-title')).find(
        (el) => el.textContent.trim().includes('Upload Study Material')
      );

      if (uploadTitle) {
        const row = document.createElement('div');
        row.className = 'upload-toggle-row';
        uploadTitle.parentNode.insertBefore(row, uploadTitle);
        row.appendChild(uploadTitle);

        const inlineBtn = document.createElement('button');
        inlineBtn.id = 'sidebarToggleBtnInline';
        inlineBtn.type = 'button';
        inlineBtn.title = 'Hide sidebar';
        inlineBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        row.appendChild(inlineBtn);

        let reopenBtn = document.getElementById('sidebarReopenBtn');
        if (!reopenBtn) {
          reopenBtn = document.createElement('button');
          reopenBtn.id = 'sidebarReopenBtn';
          reopenBtn.type = 'button';
          reopenBtn.title = 'Show sidebar';
          reopenBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
          document.body.appendChild(reopenBtn);
        }

        function setCollapsed(collapsed) {
          document.body.classList.toggle('sidebar-collapsed', collapsed);
          localStorage.setItem('sidebarCollapsed', collapsed ? 'true' : 'false');
        }

        inlineBtn.addEventListener('click', () => setCollapsed(true));
        reopenBtn.addEventListener('click', () => setCollapsed(false));

        const saved = localStorage.getItem('sidebarCollapsed');
        if (saved === 'true') setCollapsed(true);
      }
    }

    // ---------- Top mode buttons ----------
    if (!document.getElementById('topModeGroup')) {
      const wrapper = document.createElement('div');
      wrapper.id = 'topModeGroup';
      wrapper.className = 'top-mode-group';

      const modes = [
        { key: 'detailed', label: 'Detailed mode' },
        { key: 'simple', label: 'Simple mode' },
        { key: 'exam', label: 'Exam mode' }
      ];

      const currentMode =
        (window.state && (window.state.responseMode || window.state.mode)) || 'detailed';

      modes.forEach(({ key, label }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'response-mode-btn';
        btn.dataset.mode = key;
        btn.textContent = label;
        if (key === currentMode) btn.classList.add('active');

        btn.addEventListener('click', () => {
          wrapper.querySelectorAll('.response-mode-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');

          if (window.state) {
            if ('responseMode' in window.state) {
              window.state.responseMode = key;
            } else if ('mode' in window.state) {
              window.state.mode = key;
            } else {
              window.state.responseMode = key;
            }
          }
        });

        wrapper.appendChild(btn);
      });

      tabNav.appendChild(wrapper);
    }

    // Hide old separate mode bar if it exists
    const oldModeBar = document.getElementById('responseModeBar');
    if (oldModeBar) {
      oldModeBar.style.display = 'none';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();