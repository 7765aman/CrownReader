/**
 * CrownReader - Digital Crown Book Reader
 * Browser-based single-page application
 * Vanilla JavaScript (ES6+), PDF.js, JSZip
 */

// Configure PDF.js worker
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/* ==========================================================================
   DEFAULT STATE & CONSTANTS
   ========================================================================== */

const STORAGE_KEYS = {
  BOOKS: 'crownreader_books_v1',
  SETTINGS: 'crownreader_settings_v1',
  LAST_READ: 'crownreader_last_read_v1'
};

const DEFAULT_SETTINGS = {
  theme: 'dark',
  font: 'serif',
  fontSize: 18,
  lineHeight: 1.8,
  dropCap: true,
  hapticSound: true
};

const FONT_MAP = {
  serif: "'Merriweather', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace"
};

// Global App State
const state = {
  books: [],
  currentBook: null,
  currentIndex: 0,
  settings: { ...DEFAULT_SETTINGS },
  isAnimating: false,
  crownRotation: 0,
  audioCtx: null
};

/* ==========================================================================
   DOM ELEMENT REFERENCES
   ========================================================================== */

const DOM = {
  // Nav
  navbar: document.getElementById('navbar'),
  navBrandBtn: document.getElementById('navBrandBtn'),
  readerNavMeta: document.getElementById('readerNavMeta'),
  navBookTitle: document.getElementById('navBookTitle'),
  navProgressBadge: document.getElementById('navProgressBadge'),
  libraryBackBtn: document.getElementById('libraryBackBtn'),
  shortcutsBtn: document.getElementById('shortcutsBtn'),
  settingsBtn: document.getElementById('settingsBtn'),

  // Views
  libraryView: document.getElementById('libraryView'),
  readerView: document.getElementById('readerView'),

  // Library
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  dropzoneLoading: document.getElementById('dropzoneLoading'),
  parsingStatusText: document.getElementById('parsingStatusText'),
  booksGrid: document.getElementById('booksGrid'),
  booksCountBadge: document.getElementById('booksCountBadge'),
  libraryEmpty: document.getElementById('libraryEmpty'),
  addSampleBooksBtn: document.getElementById('addSampleBooksBtn'),

  // Reader Progress
  readingProgressBar: document.getElementById('readingProgressBar'),
  paragraphCounter: document.getElementById('paragraphCounter'),
  currentParaNum: document.getElementById('currentParaNum'),
  totalParaNum: document.getElementById('totalParaNum'),

  // Carousel
  carouselSection: document.getElementById('carouselSection'),
  carouselStage: document.getElementById('carouselStage'),
  slotOffTop: document.getElementById('slotOffTop'),
  slotTop: document.getElementById('slotTop'),
  slotMiddle: document.getElementById('slotMiddle'),
  slotBottom: document.getElementById('slotBottom'),
  slotOffBottom: document.getElementById('slotOffBottom'),
  prevPreviewText: document.getElementById('prevPreviewText'),
  currPreviewText: document.getElementById('currPreviewText'),
  nextPreviewText: document.getElementById('nextPreviewText'),

  // Navigation Buttons
  crownArrowUp: document.getElementById('crownArrowUp'),
  crownArrowDown: document.getElementById('crownArrowDown'),

  // Full Paragraph
  fullParagraphSection: document.getElementById('fullParagraphSection'),
  fullParagraphCard: document.getElementById('fullParagraphCard'),
  fullParagraphText: document.getElementById('fullParagraphText'),

  // Modals
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  saveCloseSettingsBtn: document.getElementById('saveCloseSettingsBtn'),
  shortcutsModal: document.getElementById('shortcutsModal'),
  closeShortcutsBtn: document.getElementById('closeShortcutsBtn'),
  closeShortcutsBtn2: document.getElementById('closeShortcutsBtn2'),

  // Settings Controls
  themeBtns: document.querySelectorAll('.theme-btn'),
  fontBtns: document.querySelectorAll('.font-btn'),
  fontSizeSlider: document.getElementById('fontSizeSlider'),
  fontSizeDisplay: document.getElementById('fontSizeDisplay'),
  lineHeightSlider: document.getElementById('lineHeightSlider'),
  lineHeightDisplay: document.getElementById('lineHeightDisplay'),
  dropCapToggle: document.getElementById('dropCapToggle'),
  hapticSoundToggle: document.getElementById('hapticSoundToggle'),

  // Toast
  toastContainer: document.getElementById('toastContainer')
};

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

function init() {
  loadSettings();
  loadBooks();
  setupEventListeners();
  applySettings();

  // If no books exist, show empty state or auto-offer samples
  if (state.books.length === 0) {
    loadDefaultSamples(false); // loads sample books silently into library
  } else {
    renderBooksGrid();
  }
}

/* ==========================================================================
   SETTINGS & PERSISTENCE
   ========================================================================== */

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.warn('Failed to load settings from localStorage:', err);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
  } catch (err) {
    console.warn('Failed to save settings:', err);
  }
}

function applySettings() {
  const { theme, font, fontSize, lineHeight, dropCap, hapticSound } = state.settings;

  // Theme
  document.body.setAttribute('data-theme', theme);
  DOM.themeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeVal === theme);
  });

  // Font family
  const chosenFont = FONT_MAP[font] || FONT_MAP.serif;
  document.documentElement.style.setProperty('--reader-font', chosenFont);
  DOM.fontBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.fontVal === font);
  });

  // Font size & line height
  document.documentElement.style.setProperty('--reader-font-size', `${fontSize}px`);
  document.documentElement.style.setProperty('--reader-line-height', lineHeight);

  DOM.fontSizeSlider.value = fontSize;
  DOM.fontSizeDisplay.textContent = `${fontSize}px`;
  DOM.lineHeightSlider.value = lineHeight;
  DOM.lineHeightDisplay.textContent = Number(lineHeight).toFixed(1);

  // Drop cap & sound
  DOM.dropCapToggle.checked = Boolean(dropCap);
  DOM.hapticSoundToggle.checked = Boolean(hapticSound);

  if (DOM.fullParagraphText) {
    DOM.fullParagraphText.classList.toggle('with-drop-cap', Boolean(dropCap));
  }
}

function playHapticTick() {
  if (!state.settings.hapticSound) return;
  try {
    if (!state.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        state.audioCtx = new AudioContextClass();
      }
    }
    if (!state.audioCtx) return;

    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }

    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, state.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, state.audioCtx.currentTime + 0.035);

    gain.gain.setValueAtTime(0.08, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + 0.035);

    osc.connect(gain);
    gain.connect(state.audioCtx.destination);

    osc.start();
    osc.stop(state.audioCtx.currentTime + 0.04);
  } catch (e) {
    // Ignore audio context errors
  }
}

/* ==========================================================================
   BOOKS PERSISTENCE & MANAGEMENT
   ========================================================================== */

function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKS);
    if (raw) {
      state.books = JSON.parse(raw);

      // Auto-upgrade sample books to rich full paragraphs if old short version was cached
      const timeMachine = state.books.find(b => b.id === 'sample_time_machine');
      if (timeMachine && timeMachine.paragraphs.length > 10) {
        // Old sample was split into 16 tiny 1-line sentences; upgrade to full paragraphs
        timeMachine.paragraphs = getFullTimeMachineParagraphs();
        saveBooks();
      }
      const artOfWar = state.books.find(b => b.id === 'sample_art_of_war');
      if (artOfWar && artOfWar.paragraphs.length > 8) {
        artOfWar.paragraphs = getFullArtOfWarParagraphs();
        saveBooks();
      }
    }
  } catch (err) {
    console.warn('Failed to load books from localStorage:', err);
    state.books = [];
  }
}

function saveBooks() {
  try {
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(state.books));
  } catch (err) {
    showToast('⚠️ Storage limit reached. Some books may not persist.', 4000);
  }
}

function addBook(book) {
  state.books.unshift(book);
  saveBooks();
  renderBooksGrid();
  showToast(`📖 "${book.title}" added to library (${book.paragraphs.length} paragraphs)`);
}

function deleteBook(bookId, event) {
  if (event) event.stopPropagation();
  const book = state.books.find(b => b.id === bookId);
  if (!book) return;

  state.books = state.books.filter(b => b.id !== bookId);
  saveBooks();
  renderBooksGrid();
  showToast(`🗑️ "${book.title}" removed from library`);

  if (state.currentBook && state.currentBook.id === bookId) {
    showLibraryView();
  }
}

function renderBooksGrid() {
  DOM.booksGrid.innerHTML = '';
  DOM.booksCountBadge.textContent = `(${state.books.length})`;

  if (state.books.length === 0) {
    DOM.libraryEmpty.style.display = 'block';
    return;
  }

  DOM.libraryEmpty.style.display = 'none';

  state.books.forEach(book => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Open ${book.title}`);

    const progressPct = book.paragraphs.length > 0
      ? Math.round(((book.lastIndex || 0) / (book.paragraphs.length - 1)) * 100) || 0
      : 0;

    card.innerHTML = `
      <div class="book-card-header">
        <span class="book-icon-badge">📖</span>
        <button class="delete-book-btn" title="Delete book" aria-label="Delete ${escapeHtml(book.title)}">&times;</button>
      </div>
      <h3 class="book-card-title">${escapeHtml(book.title)}</h3>
      <div class="book-card-meta">
        <span class="book-para-badge">${book.paragraphs.length} paragraphs</span>
        <span class="book-progress-badge">${progressPct}% read</span>
      </div>
    `;

    card.addEventListener('click', () => openBook(book.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openBook(book.id);
      }
    });

    const delBtn = card.querySelector('.delete-book-btn');
    delBtn.addEventListener('click', (e) => deleteBook(book.id, e));

    DOM.booksGrid.appendChild(card);
  });
}

/* ==========================================================================
   FILE PARSING LOGIC (.txt, .epub, .pdf)
   ========================================================================== */

function handleFileSelection(file) {
  if (!file) return;

  const fileName = file.name;
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

  setDropzoneLoading(true, `Reading "${fileName}"...`);

  if (ext === '.txt') {
    parseTxtFile(file);
  } else if (ext === '.epub') {
    parseEpubFile(file);
  } else if (ext === '.pdf') {
    parsePdfFile(file);
  } else {
    setDropzoneLoading(false);
    showToast('❌ Unsupported format. Please drop a .txt, .epub, or .pdf file.');
  }
}

// 1. TXT PARSING
function parseTxtFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const text = e.target.result;
      const paragraphs = parseTextIntoParagraphs(text);
      if (paragraphs.length === 0) {
        throw new Error('No readable paragraphs found in text file.');
      }

      const book = {
        id: 'book_' + Date.now(),
        title: cleanFileName(file.name),
        paragraphs: paragraphs,
        addedAt: new Date().toISOString(),
        lastIndex: 0
      };

      addBook(book);
      setDropzoneLoading(false);
      openBook(book.id);
    } catch (err) {
      console.error(err);
      setDropzoneLoading(false);
      showToast('❌ Failed to parse .txt file: ' + err.message);
    }
  };
  reader.onerror = function() {
    setDropzoneLoading(false);
    showToast('❌ Failed to read text file.');
  };
  reader.readAsText(file);
}

function parseTextIntoParagraphs(rawText) {
  if (!rawText) return [];
  // Normalize line endings
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Try double newlines first (standard paragraph break in text)
  let blocks = normalized.split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (blocks.length >= 2) {
    // Merge internal wrapped lines with a space so each paragraph is a complete, full block of text
    return blocks.map(b => b.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim());
  }

  // If fewer than 2 double-newline paragraphs, group single lines into paragraphs
  const rawLines = normalized.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
  if (rawLines.length > 0) {
    const paras = [];
    let current = [];

    rawLines.forEach(line => {
      current.push(line);
      // Paragraph break heuristic: line ends with terminal punctuation and accumulated text is substantive
      if (line.match(/[.!?]["”']?$/) && current.join(' ').length > 140) {
        paras.push(current.join(' ').replace(/\s{2,}/g, ' ').trim());
        current = [];
      }
    });

    if (current.length > 0) {
      paras.push(current.join(' ').replace(/\s{2,}/g, ' ').trim());
    }

    if (paras.length >= 2) {
      return paras;
    }
  }

  // Fallback: split by sentence boundaries if it's one large continuous text block
  const sentences = normalized.match(/[^.!?]+[.!?]+(\s+|$)/g);
  if (sentences && sentences.length > 0) {
    const paras = [];
    let chunk = [];
    sentences.forEach(s => {
      chunk.push(s.trim());
      if (chunk.join(' ').length > 200) {
        paras.push(chunk.join(' ').trim());
        chunk = [];
      }
    });
    if (chunk.length > 0) paras.push(chunk.join(' ').trim());
    if (paras.length > 0) return paras;
  }

  return [normalized];
}

// 2. EPUB PARSING (via JSZip)
function parseEpubFile(file) {
  if (!window.JSZip) {
    setDropzoneLoading(false);
    showToast('❌ JSZip library not loaded. Cannot parse EPUB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      setDropzoneLoading(true, 'Extracting EPUB chapters...');
      const zip = await JSZip.loadAsync(e.target.result);

      // Find all xhtml/html documents in the archive
      const htmlFiles = [];
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && /\.(x?html|xml)$/i.test(relativePath)) {
          // Exclude manifest/toc files
          if (!relativePath.toLowerCase().includes('toc') && !relativePath.toLowerCase().includes('nav')) {
            htmlFiles.push(zipEntry);
          }
        }
      });

      // Sort files naturally by filename
      htmlFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      if (htmlFiles.length === 0) {
        throw new Error('No readable chapter files found inside EPUB.');
      }

      const paragraphs = [];
      const domParser = new DOMParser();

      for (let i = 0; i < htmlFiles.length; i++) {
        const content = await htmlFiles[i].async('text');
        const doc = domParser.parseFromString(content, 'text/html');

        // Extract paragraphs and headings
        const elements = doc.querySelectorAll('p, h1, h2, h3, h4, blockquote, div');
        let chapterHadContent = false;

        elements.forEach(el => {
          const text = el.textContent ? el.textContent.trim() : '';
          // Avoid empty lines or duplicate nested container text
          if (text.length > 15 && (!el.firstElementChild || el.tagName.toLowerCase() === 'p')) {
            paragraphs.push(text);
            chapterHadContent = true;
          }
        });

        // Fallback: if querySelectorAll didn't catch, use body text
        if (!chapterHadContent && doc.body) {
          const bodyText = doc.body.textContent || '';
          const bodyParas = parseTextIntoParagraphs(bodyText);
          paragraphs.push(...bodyParas);
        }
      }

      if (paragraphs.length === 0) {
        throw new Error('Unable to extract paragraphs from EPUB contents.');
      }

      const book = {
        id: 'book_' + Date.now(),
        title: cleanFileName(file.name),
        paragraphs: paragraphs,
        addedAt: new Date().toISOString(),
        lastIndex: 0
      };

      addBook(book);
      setDropzoneLoading(false);
      openBook(book.id);
    } catch (err) {
      console.error(err);
      setDropzoneLoading(false);
      showToast('❌ Failed to parse .epub file: ' + err.message);
    }
  };
  reader.onerror = function() {
    setDropzoneLoading(false);
    showToast('❌ Failed to read EPUB file.');
  };
  reader.readAsArrayBuffer(file);
}

// 3. PDF PARSING (via Mozilla PDF.js)
async function parsePdfFile(file) {
  if (!window.pdfjsLib) {
    setDropzoneLoading(false);
    showToast('❌ PDF.js library not loaded. Cannot parse PDF.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      setDropzoneLoading(true, 'Extracting text from PDF pages...');
      const typedArray = new Uint8Array(e.target.result);
      const loadingTask = pdfjsLib.getDocument({ data: typedArray });
      const pdf = await loadingTask.promise;

      let allTextLines = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        setDropzoneLoading(true, `Reading PDF page ${pageNum} of ${pdf.numPages}...`);
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Group text items by Y coordinate into visual lines
        const linesMap = new Map();
        textContent.items.forEach(item => {
          if (!item.str || item.str.trim() === '') return;
          // Approximate Y coordinate to group characters on same line
          const y = Math.round(item.transform[5] / 4) * 4;
          if (!linesMap.has(y)) {
            linesMap.set(y, []);
          }
          linesMap.get(y).push(item);
        });

        // Sort lines top to bottom (higher Y in PDF coordinates means higher on page)
        const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a);

        sortedYs.forEach(y => {
          const itemsOnLine = linesMap.get(y);
          // Sort items left to right
          itemsOnLine.sort((a, b) => a.transform[4] - b.transform[4]);
          const lineStr = itemsOnLine.map(it => it.str).join(' ').trim();
          if (lineStr.length > 0) {
            allTextLines.push(lineStr);
          }
        });
      }

      // Merge extracted PDF lines into complete, multi-line paragraphs
      const paragraphs = [];
      let currentParaLines = [];

      allTextLines.forEach(line => {
        currentParaLines.push(line);
        // Paragraph boundary: line ends with terminal punctuation (. ! ?) and accumulated length is substantial
        const accumulated = currentParaLines.join(' ');
        if (line.match(/[.!?]["”']?$/) && accumulated.length > 150) {
          paragraphs.push(accumulated.replace(/\s{2,}/g, ' ').trim());
          currentParaLines = [];
        }
      });

      if (currentParaLines.length > 0) {
        paragraphs.push(currentParaLines.join(' ').replace(/\s{2,}/g, ' ').trim());
      }

      if (paragraphs.length === 0) {
        throw new Error('No readable text found in PDF (file might be scanned images).');
      }

      const book = {
        id: 'book_' + Date.now(),
        title: cleanFileName(file.name),
        paragraphs: paragraphs,
        addedAt: new Date().toISOString(),
        lastIndex: 0
      };

      addBook(book);
      setDropzoneLoading(false);
      openBook(book.id);
    } catch (err) {
      console.error(err);
      setDropzoneLoading(false);
      showToast('❌ Failed to parse PDF: ' + err.message);
    }
  };
  reader.onerror = function() {
    setDropzoneLoading(false);
    showToast('❌ Failed to read PDF file.');
  };
  reader.readAsArrayBuffer(file);
}

function setDropzoneLoading(isLoading, text) {
  if (isLoading) {
    DOM.dropzoneLoading.style.display = 'flex';
    if (text) DOM.parsingStatusText.textContent = text;
  } else {
    DOM.dropzoneLoading.style.display = 'none';
  }
}

/* ==========================================================================
   SAMPLE BOOKS STARTER
   ========================================================================== */

function getFullTimeMachineParagraphs() {
  return [
    "The Time Traveller (for so it will be convenient to speak of him) was expounding a recondite matter to us. His grey eyes shone and twinkled, and his usually pale face was flushed and animated. The fire burnt brightly, and the soft radiance of the incandescent lights in the lilies of silver caught the bubbles that flashed and passed in our glasses. Our chairs, being his patents, embraced and caressed us rather than submitted to be sat upon, and there was that luxurious after-dinner atmosphere when thought roams gracefully free of the trammels of precision. And he put it to us in this way—marking the points with a lean forefinger—as we sat and lazily admired his earnestness over this new paradox and his fecundity.",

    "“You must follow me carefully. I shall have to controvert one or two ideas that are almost universally accepted. The geometry, for instance, they taught you at school is founded on a misconception. Is not that rather a large thing to expect us to begin upon? said Filby, an argumentative person with red hair. I do not mean to ask you to accept anything without reasonable ground for it. You will soon admit as much as I need from you. You know of course that a mathematical line, a line of thickness nil, has no real existence. They taught you that? Neither has a mathematical plane. These things are mere abstractions.”",

    "“That is all right,” said the Psychologist. “Nor, having only length, breadth, and thickness, can a cube have a real existence.” “There I object,” said Filby. “Of course a solid body may exist. All real things are solid.” “So most people think. But wait a moment. Can an instantaneous cube exist?” “Don’t follow you,” said Filby. “Can a cube that does not exist for any time at all, have any real existence?” Filby became pensive.",

    "“Clearly,” the Time Traveller proceeded, “any real body must have extension in four directions: it must have Length, Breadth, Thickness, and—Duration. But through a natural infirmity of the flesh, which I will explain to you in a moment, we incline to overlook this fact. There are really four dimensions, three which we call the three planes of Space, and a fourth, Time. There is, however, a tendency to draw an unreal distinction between the former three dimensions and the latter, because it happens that our consciousness moves intermittently in one direction along the latter from the beginning to the end of our lives.”",

    "“That,” said a very young man, making spasmodic efforts to relight his cigar over the lamp; “that... very clear indeed.” “Now, it is very remarkable that this is so extensively overlooked,” continued the Time Traveller, with a slight accession of cheerfulness. “Really this is what is meant by the Fourth Dimension, though some people who talk about the Fourth Dimension do not know they mean it. It is only another way of looking at Time. There is no difference between Time and any of the three dimensions of Space except that our consciousness moves along it.”",

    "“Some foolish people have got hold of the wrong side of that idea. You have all heard what they have to say about this Fourth Dimension?” “I have not,” said the Provincial Mayor. “It is simply this. That Space, as our mathematicians have it, is spoken of as having three dimensions, which one may call Length, Breadth, and Thickness, and is always definable by reference to three planes, each at right angles to the others. But some philosophical people have been asking why three dimensions particularly—why not another direction at right angles to the other three?—and have even tried to construct a Four-Dimensional geometry.”"
  ];
}

function getFullArtOfWarParagraphs() {
  return [
    "Sun Tzu said: The art of war is of vital importance to the State. It is a matter of life and death, a road either to safety or to ruin. Hence it is a subject of inquiry which can on no account be neglected. The art of war, then, is governed by five constant factors, to be taken into account in one's deliberations, when seeking to determine the conditions obtaining in the field. These are: The Moral Law; Heaven; Earth; The Commander; Method and discipline.",

    "The Moral Law causes the people to be in complete accord with their ruler, so that they will follow him regardless of their lives, undismayed by any danger. Heaven signifies night and day, cold and heat, times and seasons. Earth comprises distances, great and small; danger and security; open ground and narrow passes; the chances of life and death. The Commander stands for the virtues of wisdom, sincerely, benevolence, strictness and courage. By method and discipline are to be understood the marshaling of the army in its proper subdivisions, the graduations of rank among the officers, the maintenance of roads by which supplies may reach the army, and the control of military expenditure.",

    "All warfare is based on deception. Hence, when able to attack, we must seem unable; when using our forces, we must seem inactive; when we are near, we must make the enemy believe we are far away; when far away, we must make him believe we are near. Hold out baits to entice the enemy. Feign disorder, and crush him. If he is secure at all points, be prepared for him. If he is in superior strength, evade him.",

    "If your opponent is of choleric temper, seek to irritate him. Pretend to be weak, that he may grow arrogant. If he is taking his ease, give him no rest. If his forces are united, separate them. Attack him where he is unprepared, appear where you are not expected. These military devices, leading to victory, must not be divulged beforehand.",

    "Now the general who wins a battle makes many calculations in his temple ere the battle is fought. The general who loses a battle makes but few calculations beforehand. Thus do many calculations lead to victory, and few calculations to defeat: how much more no calculation at all! It is by attention to this point that I can foresee who is likely to win or lose."
  ];
}

function loadDefaultSamples(notify = true) {
  const sampleTimeMachine = {
    id: 'sample_time_machine',
    title: 'The Time Machine (H.G. Wells)',
    addedAt: new Date().toISOString(),
    lastIndex: 0,
    paragraphs: getFullTimeMachineParagraphs()
  };

  const sampleArtOfWar = {
    id: 'sample_art_of_war',
    title: 'The Art of War (Sun Tzu)',
    addedAt: new Date().toISOString(),
    lastIndex: 0,
    paragraphs: getFullArtOfWarParagraphs()
  };

  // Replace or add samples
  state.books = state.books.filter(b => b.id !== sampleTimeMachine.id && b.id !== sampleArtOfWar.id);
  state.books.push(sampleTimeMachine);
  state.books.push(sampleArtOfWar);

  saveBooks();
  renderBooksGrid();
  if (notify) {
    showToast('✨ Sample classic books added with complete paragraphs!');
  }
}

/* ==========================================================================
   READER VIEW CONTROLLER & CAROUSEL ENGINE
   ========================================================================== */

function openBook(bookId) {
  const book = state.books.find(b => b.id === bookId);
  if (!book || !book.paragraphs || book.paragraphs.length === 0) {
    showToast('❌ Unable to open book: No content found.');
    return;
  }

  state.currentBook = book;
  state.currentIndex = Math.min(Math.max(0, book.lastIndex || 0), book.paragraphs.length - 1);

  // Switch View
  DOM.libraryView.style.display = 'none';
  DOM.readerView.style.display = 'flex';
  DOM.readerNavMeta.style.display = 'flex';
  DOM.libraryBackBtn.style.display = 'flex';

  DOM.navBookTitle.textContent = book.title;
  DOM.totalParaNum.textContent = book.paragraphs.length;

  updateCarouselDisplay(false);
  updateFullParagraphDisplay();
  updateProgressUI();
}

function showLibraryView() {
  if (state.currentBook) {
    state.currentBook.lastIndex = state.currentIndex;
    saveBooks();
  }

  state.currentBook = null;
  DOM.readerView.style.display = 'none';
  DOM.readerNavMeta.style.display = 'none';
  DOM.libraryBackBtn.style.display = 'none';
  DOM.libraryView.style.display = 'flex';

  renderBooksGrid();
}

/**
 * Returns snippet preview (up to 100 characters)
 */
function getPreviewText(index) {
  if (!state.currentBook || !state.currentBook.paragraphs) return '';
  if (index < 0) return '— Beginning of Book —';
  if (index >= state.currentBook.paragraphs.length) return '— End of Book —';

  const full = state.currentBook.paragraphs[index].trim();
  if (full.length <= 100) return full;
  return full.slice(0, 100).trim() + '...';
}

/**
 * Updates the stationary text previews on the slots
 */
function updateCarouselDisplay(animate = false) {
  const total = state.currentBook ? state.currentBook.paragraphs.length : 0;
  const idx = state.currentIndex;

  DOM.currentParaNum.textContent = idx + 1;
  DOM.totalParaNum.textContent = total;

  DOM.prevPreviewText.textContent = getPreviewText(idx - 1);
  DOM.currPreviewText.textContent = getPreviewText(idx);
  DOM.nextPreviewText.textContent = getPreviewText(idx + 1);

  // Set accessibility/state attributes on panels
  DOM.slotTop.style.pointerEvents = (idx > 0) ? 'auto' : 'none';
  DOM.slotBottom.style.pointerEvents = (idx < total - 1) ? 'auto' : 'none';
}

/**
 * Updates full paragraph display in section 2
 */
function updateFullParagraphDisplay() {
  if (!state.currentBook) return;
  const fullText = state.currentBook.paragraphs[state.currentIndex] || '';

  DOM.fullParagraphText.textContent = fullText;
  DOM.fullParagraphCard.scrollTop = 0; // reset scroll for new paragraph
}

/**
 * Updates progress bar and percentages
 */
function updateProgressUI() {
  if (!state.currentBook || state.currentBook.paragraphs.length <= 1) {
    DOM.readingProgressBar.style.width = '100%';
    DOM.navProgressBadge.textContent = '100%';
    return;
  }

  const total = state.currentBook.paragraphs.length;
  const pct = Math.round((state.currentIndex / (total - 1)) * 100);
  DOM.readingProgressBar.style.width = `${pct}%`;
  DOM.navProgressBadge.textContent = `${pct}%`;

  // Persist current position
  state.currentBook.lastIndex = state.currentIndex;
  saveBooks();
}

/**
 * Rotates the physical Digital Crown dial knob
 */
function rotateCrownHardware(direction) {
  // Physical crown dial visual removed per UI requirements
}

/* ==========================================================================
   CAROUSEL NAVIGATION WITH 0.5s CSS TRANSITIONS & 500ms DEBOUNCE
   ========================================================================== */

function navigateNext() {
  if (state.isAnimating || !state.currentBook) return;
  if (state.currentIndex >= state.currentBook.paragraphs.length - 1) {
    // End reached feedback
    flashMiddleBoundary();
    return;
  }

  state.isAnimating = true;
  playHapticTick();
  rotateCrownHardware(1);

  // Prepare buffer slot off bottom with upcoming paragraph
  DOM.slotOffBottom.querySelector('.panel-preview-text').textContent = getPreviewText(state.currentIndex + 2);

  // Trigger CSS transition animation class
  DOM.carouselStage.classList.add('stage-animating-down');

  // Debounce lock: 500ms transition
  setTimeout(() => {
    // Temporarily disable transitions to reset DOM elements instantly
    DOM.slotOffTop.classList.add('no-transition');
    DOM.slotTop.classList.add('no-transition');
    DOM.slotMiddle.classList.add('no-transition');
    DOM.slotBottom.classList.add('no-transition');
    DOM.slotOffBottom.classList.add('no-transition');

    // Remove animating class
    DOM.carouselStage.classList.remove('stage-animating-down');

    // Advance index
    state.currentIndex++;

    // Update texts at resting slots
    updateCarouselDisplay(false);
    updateFullParagraphDisplay();
    updateProgressUI();

    // Force browser reflow
    void DOM.carouselStage.offsetHeight;

    // Restore transitions
    DOM.slotOffTop.classList.remove('no-transition');
    DOM.slotTop.classList.remove('no-transition');
    DOM.slotMiddle.classList.remove('no-transition');
    DOM.slotBottom.classList.remove('no-transition');
    DOM.slotOffBottom.classList.remove('no-transition');

    state.isAnimating = false;
  }, 500);
}

function navigatePrev() {
  if (state.isAnimating || !state.currentBook) return;
  if (state.currentIndex <= 0) {
    // Beginning reached feedback
    flashMiddleBoundary();
    return;
  }

  state.isAnimating = true;
  playHapticTick();
  rotateCrownHardware(-1);

  // Prepare buffer slot off top with upcoming previous paragraph
  DOM.slotOffTop.querySelector('.panel-preview-text').textContent = getPreviewText(state.currentIndex - 2);

  // Trigger CSS transition animation class
  DOM.carouselStage.classList.add('stage-animating-up');

  // Debounce lock: 500ms transition
  setTimeout(() => {
    // Temporarily disable transitions
    DOM.slotOffTop.classList.add('no-transition');
    DOM.slotTop.classList.add('no-transition');
    DOM.slotMiddle.classList.add('no-transition');
    DOM.slotBottom.classList.add('no-transition');
    DOM.slotOffBottom.classList.add('no-transition');

    // Remove animating class
    DOM.carouselStage.classList.remove('stage-animating-up');

    // Decrement index
    state.currentIndex--;

    // Update texts at resting slots
    updateCarouselDisplay(false);
    updateFullParagraphDisplay();
    updateProgressUI();

    // Force reflow
    void DOM.carouselStage.offsetHeight;

    // Restore transitions
    DOM.slotOffTop.classList.remove('no-transition');
    DOM.slotTop.classList.remove('no-transition');
    DOM.slotMiddle.classList.remove('no-transition');
    DOM.slotBottom.classList.remove('no-transition');
    DOM.slotOffBottom.classList.remove('no-transition');

    state.isAnimating = false;
  }, 500);
}

function flashMiddleBoundary() {
  DOM.slotMiddle.style.transform = 'translateY(105px) scale(0.96)';
  setTimeout(() => {
    DOM.slotMiddle.style.transform = '';
  }, 180);
}

/* ==========================================================================
   EVENT LISTENERS & INPUT HANDLERS
   ========================================================================== */

function setupEventListeners() {
  // Navigation Bar
  DOM.navBrandBtn.addEventListener('click', () => {
    if (state.currentBook) showLibraryView();
  });
  DOM.libraryBackBtn.addEventListener('click', showLibraryView);
  DOM.settingsBtn.addEventListener('click', toggleSettingsModal);
  DOM.shortcutsBtn.addEventListener('click', toggleShortcutsModal);

  // Modals
  DOM.closeSettingsBtn.addEventListener('click', toggleSettingsModal);
  DOM.saveCloseSettingsBtn.addEventListener('click', toggleSettingsModal);
  DOM.closeShortcutsBtn.addEventListener('click', toggleShortcutsModal);
  DOM.closeShortcutsBtn2.addEventListener('click', toggleShortcutsModal);

  // Close modals clicking on backdrop
  DOM.settingsModal.addEventListener('click', (e) => {
    if (e.target === DOM.settingsModal) toggleSettingsModal();
  });
  DOM.shortcutsModal.addEventListener('click', (e) => {
    if (e.target === DOM.shortcutsModal) toggleShortcutsModal();
  });

  // Settings: Themes
  DOM.themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.theme = btn.dataset.themeVal;
      applySettings();
      saveSettings();
    });
  });

  // Settings: Fonts
  DOM.fontBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.font = btn.dataset.fontVal;
      applySettings();
      saveSettings();
    });
  });

  // Settings: Sliders & Switches
  DOM.fontSizeSlider.addEventListener('input', (e) => {
    state.settings.fontSize = Number(e.target.value);
    applySettings();
    saveSettings();
  });

  DOM.lineHeightSlider.addEventListener('input', (e) => {
    state.settings.lineHeight = Number(e.target.value);
    applySettings();
    saveSettings();
  });

  DOM.dropCapToggle.addEventListener('change', (e) => {
    state.settings.dropCap = e.target.checked;
    applySettings();
    saveSettings();
  });

  DOM.hapticSoundToggle.addEventListener('change', (e) => {
    state.settings.hapticSound = e.target.checked;
    applySettings();
    saveSettings();
  });

  // Sample Books Button
  DOM.addSampleBooksBtn.addEventListener('click', () => loadDefaultSamples(true));

  // Dropzone drag & drop
  setupDropZoneEvents();

  // Carousel interactive clicks
  DOM.slotTop.addEventListener('click', navigatePrev);
  DOM.slotBottom.addEventListener('click', navigateNext);
  DOM.crownArrowUp.addEventListener('click', navigatePrev);
  DOM.crownArrowDown.addEventListener('click', navigateNext);

  // Mouse wheel over carousel section
  DOM.carouselSection.addEventListener('wheel', handleCarouselWheel, { passive: false });

  // Touch / Swipe gestures on carousel
  setupTouchEvents();

  // Keyboard navigation
  window.addEventListener('keydown', handleGlobalKeydown);
}

/* ==========================================================================
   WHEEL & TOUCH GESTURES
   ========================================================================== */

function handleCarouselWheel(e) {
  // If user is inside the reader view
  if (!state.currentBook) return;

  // Prevent default page scroll over carousel so wheel behaves as digital crown
  e.preventDefault();

  if (state.isAnimating) return;

  if (e.deltaY > 15) {
    navigateNext();
  } else if (e.deltaY < -15) {
    navigatePrev();
  }
}

let touchStartY = 0;
let touchStartX = 0;

function setupTouchEvents() {
  DOM.carouselSection.addEventListener('touchstart', (e) => {
    if (!state.currentBook || e.touches.length === 0) return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  DOM.carouselSection.addEventListener('touchend', (e) => {
    if (!state.currentBook || e.changedTouches.length === 0) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const deltaX = e.changedTouches[0].clientX - touchStartX;

    // Must be predominantly vertical swipe
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 35) {
      if (deltaY < 0) {
        // Swiped UP -> Next paragraph
        navigateNext();
      } else {
        // Swiped DOWN -> Previous paragraph
        navigatePrev();
      }
    }
  }, { passive: true });
}

/* ==========================================================================
   KEYBOARD NAVIGATION
   ========================================================================== */

function handleGlobalKeydown(e) {
  // If modals are open, allow Escape to close them
  if (DOM.settingsModal.style.display !== 'none') {
    if (e.key === 'Escape') toggleSettingsModal();
    return;
  }
  if (DOM.shortcutsModal.style.display !== 'none') {
    if (e.key === 'Escape') toggleShortcutsModal();
    return;
  }

  // Toggle settings with 's' or 'S'
  if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag !== 'input' && activeTag !== 'textarea') {
      e.preventDefault();
      toggleSettingsModal();
      return;
    }
  }

  // If in Reader View
  if (state.currentBook) {
    if (e.key === 'Escape') {
      e.preventDefault();
      showLibraryView();
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      navigateNext();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      navigatePrev();
    }
  }
}

/* ==========================================================================
   DROP ZONE FILE HANDLING
   ========================================================================== */

function setupDropZoneEvents() {
  const dropZone = DOM.dropZone;
  const fileInput = DOM.fileInput;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  });

  dropZone.addEventListener('click', (e) => {
    // Trigger hidden file input if clicked directly on dropzone
    if (e.target !== fileInput) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
      fileInput.value = ''; // reset so same file can be re-selected if deleted
    }
  });
}

/* ==========================================================================
   MODAL TOGGLERS & TOAST NOTIFICATIONS
   ========================================================================== */

function toggleSettingsModal() {
  const isHidden = DOM.settingsModal.style.display === 'none';
  DOM.settingsModal.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    applySettings(); // sync controls with current state
  }
}

function toggleShortcutsModal() {
  const isHidden = DOM.shortcutsModal.style.display === 'none';
  DOM.shortcutsModal.style.display = isHidden ? 'flex' : 'none';
}

function showToast(message, duration = 3500) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, duration);
}

/* ==========================================================================
   HELPERS & UTILITIES
   ========================================================================== */

function cleanFileName(filename) {
  return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', init);

