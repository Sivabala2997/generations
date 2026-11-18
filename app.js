/* =====================================================
   GENERATIONS - App Logic
   Features: browse/search/filter, story detail, favorites,
             add story, Story of the Day, text size controls,
             read aloud, photo upload, writing prompts, print
   ===================================================== */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     STORAGE HELPERS
  ───────────────────────────────────────────── */
  const LS_USER_STORIES = 'gen_user_stories';
  const LS_FAVORITES    = 'gen_favorites';
  const LS_REACTIONS    = 'gen_reactions';
  const LS_TEXT_SIZE    = 'gen_text_size';
  const LS_STORY_OVERRIDES = 'gen_story_overrides';
  const LS_DELETED_STORIES = 'gen_deleted_stories';

  function getCurrentFamilyId() {
    return sessionStorage.getItem('gen_family_id') || 'reed-family';
  }
  function familyStorageKey(key) { return `${key}_${getCurrentFamilyId()}`; }
  function getFamilyStorageValue(key) {
    const scopedValue = localStorage.getItem(familyStorageKey(key));
    if (scopedValue !== null) return scopedValue;
    return getCurrentFamilyId() === 'reed-family' ? localStorage.getItem(key) : null;
  }

  function getUserStories() {
    try {
      const saved = localStorage.getItem(familyStorageKey(LS_USER_STORIES));
      const legacy = saved === null && getCurrentFamilyId() === 'reed-family'
        ? localStorage.getItem(LS_USER_STORIES)
        : null;
      const stories = JSON.parse(saved || legacy || '[]') || [];
      return stories
        .map(story => story.familyId ? story : { ...story, familyId: 'reed-family', isPrivate: true })
        .filter(story => story.familyId === getCurrentFamilyId());
    } catch { return []; }
  }
  function saveUserStories(arr) {
    const familyId = getCurrentFamilyId();
    const stories = arr.map(story => ({ ...story, familyId, isPrivate: story.isPrivate !== false }));
    localStorage.setItem(familyStorageKey(LS_USER_STORIES), JSON.stringify(stories));
  }

  function getStoryOverrides() {
    try { return JSON.parse(localStorage.getItem(familyStorageKey(LS_STORY_OVERRIDES)) || '{}'); }
    catch { return {}; }
  }
  function saveStoryOverrides(overrides) {
    localStorage.setItem(familyStorageKey(LS_STORY_OVERRIDES), JSON.stringify(overrides));
  }
  function getDeletedStoryIds() {
    try { return JSON.parse(localStorage.getItem(familyStorageKey(LS_DELETED_STORIES)) || '[]'); }
    catch { return []; }
  }
  function saveDeletedStoryIds(ids) {
    localStorage.setItem(familyStorageKey(LS_DELETED_STORIES), JSON.stringify(ids));
  }

  function getPublicUserStories() {
    const prefix = LS_USER_STORIES;
    const keys = Object.keys(localStorage).filter(key => key === prefix || key.startsWith(`${prefix}_`));
    return keys.flatMap(key => {
      try {
        const familyId = key === prefix ? 'reed-family' : key.slice(prefix.length + 1);
        return (JSON.parse(localStorage.getItem(key)) || [])
          .map(story => story.familyId ? story : { ...story, familyId })
          .filter(story => story.isPrivate === false);
      } catch { return []; }
    });
  }

  function getFavorites() {
    try { return JSON.parse(getFamilyStorageValue(LS_FAVORITES)) || []; }
    catch { return []; }
  }
  function saveFavorites(arr) { localStorage.setItem(familyStorageKey(LS_FAVORITES), JSON.stringify(arr)); }
  function isFav(id) { return getFavorites().includes(id); }
  function toggleFav(id) {
    let favs = getFavorites();
    favs = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
    saveFavorites(favs);
  }

  function getReactions() {
    try { return JSON.parse(getFamilyStorageValue(LS_REACTIONS)) || {}; }
    catch { return {}; }
  }
  function saveReactions(obj) { localStorage.setItem(familyStorageKey(LS_REACTIONS), JSON.stringify(obj)); }
  function getMyReaction(storyId) { return getReactions()[storyId] || null; }
  function setReaction(storyId, emoji) {
    const r = getReactions();
    if (r[storyId] === emoji) delete r[storyId]; // toggle off
    else r[storyId] = emoji;
    saveReactions(r);
  }

  /* ─────────────────────────────────────────────
     ALL STORIES
  ───────────────────────────────────────────── */
  function getAllStories() {
    const familyId = getCurrentFamilyId();
    const privateSamples = (window.FAMILY_PRIVATE_STORIES || []).filter(story => story.familyId === familyId);
    const userStories = getUserStories();
    const publicStories = getPublicUserStories();
    const privateUserStories = userStories.filter(story => story.isPrivate !== false);
    const overrides = getStoryOverrides();
    const deletedIds = new Set(getDeletedStoryIds());
    return [...SAMPLE_STORIES, ...privateSamples, ...publicStories, ...privateUserStories]
      .map(story => overrides[story.id] ? { ...story, ...overrides[story.id] } : story)
      .filter(story => !deletedIds.has(story.id));
  }

  /* ─────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────── */
  let currentView    = 'browse';
  let activeCategory = 'all';
  let searchQuery    = '';
  let currentStoryId = null;
  let editingStoryId = null;
  let photoDataUrl   = null;   // base64 for the current add-form photo
  let speechUtterance = null;  // current TTS utterance
  let isSpeaking     = false;

  /* ─────────────────────────────────────────────
     DOM REFS
  ───────────────────────────────────────────── */
  const views = {
    browse:    document.getElementById('browseView'),
    story:     document.getElementById('storyView'),
    favorites: document.getElementById('favoritesView'),
    add:       document.getElementById('addView'),
  };
  const heroSection    = document.getElementById('heroSection');
  const navLinks       = document.querySelectorAll('.nav-link');
  const hamburger      = document.getElementById('hamburger');
  const mainNav        = document.getElementById('mainNav');
  const searchInput    = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearch');
  const filterChips    = document.getElementById('filterChips');
  const storyGrid      = document.getElementById('storyGrid');
  const favGrid        = document.getElementById('favGrid');
  const emptyState     = document.getElementById('emptyState');
  const favEmpty       = document.getElementById('favEmpty');
  const resultsInfo    = document.getElementById('resultsInfo');
  const backBtn        = document.getElementById('backBtn');
  const storyDetail    = document.getElementById('storyDetail');
  const storyForm      = document.getElementById('storyForm');
  const storyFormHeading = document.querySelector('#addView .view-header h2');
  const submitStoryBtn = storyForm.querySelector('button[type="submit"]');
  const successToast   = document.getElementById('successToast');
  const cancelAddBtn   = document.getElementById('cancelAdd');
  const storyBodyTA    = document.getElementById('storyBody');
  const charCount      = document.getElementById('charCount');
  const readAloudBtn   = document.getElementById('readAloudBtn');
  const readAloudLabel = document.getElementById('readAloudLabel');
  const printBtn       = document.getElementById('printBtn');
  const sotdBanner     = document.getElementById('sotdBanner');
  const promptBar      = document.getElementById('promptBar');
  const promptChips    = document.getElementById('promptChips');
  const photoInput     = document.getElementById('photoInput');
  const photoUploadArea = document.getElementById('photoUploadArea');
  const photoPlaceholder = document.getElementById('photoPlaceholder');
  const photoPreviewWrap = document.getElementById('photoPreviewWrap');
  const photoPreview   = document.getElementById('photoPreview');
  const photoRemoveBtn = document.getElementById('photoRemoveBtn');
  const tsIncrease     = document.getElementById('tsIncrease');
  const tsDecrease     = document.getElementById('tsDecrease');

  /* ─────────────────────────────────────────────
     FEATURE 1 - TEXT SIZE CONTROLS
  ───────────────────────────────────────────── */
  const TEXT_SIZES = ['ts-normal', 'ts-large', 'ts-xlarge'];
  const savedTextSize = parseInt(localStorage.getItem(LS_TEXT_SIZE) || '0', 10);
  let textSizeIdx = Number.isInteger(savedTextSize) && savedTextSize >= 0 && savedTextSize < TEXT_SIZES.length
    ? savedTextSize
    : 0;

  function applyTextSize() {
    document.documentElement.classList.remove(...TEXT_SIZES);
    document.documentElement.classList.add(TEXT_SIZES[textSizeIdx]);
    document.body.classList.remove(...TEXT_SIZES);
    document.body.classList.add(TEXT_SIZES[textSizeIdx]);
    tsDecrease.disabled = textSizeIdx === 0;
    tsIncrease.disabled = textSizeIdx === TEXT_SIZES.length - 1;
    localStorage.setItem(LS_TEXT_SIZE, textSizeIdx);
  }

  tsIncrease.addEventListener('click', () => {
    if (textSizeIdx < TEXT_SIZES.length - 1) { textSizeIdx++; applyTextSize(); }
  });
  tsDecrease.addEventListener('click', () => {
    if (textSizeIdx > 0) { textSizeIdx--; applyTextSize(); }
  });

  applyTextSize(); // apply on load

  /* ─────────────────────────────────────────────
     FEATURE 2 - STORY OF THE DAY
  ───────────────────────────────────────────── */
  function initStoryOfTheDay() {
    const stories = getAllStories();
    if (!stories.length) return;
    // Pick a story based on today's date so it stays consistent all day
    const today = new Date();
    const dayIndex = (today.getFullYear() * 1000 + today.getMonth() * 31 + today.getDate()) % stories.length;
    const sotd = stories[dayIndex];

    document.getElementById('sotdCat').textContent     = categoryLabel(sotd.category);
    document.getElementById('sotdCat').className       = `sotd-category sotd-cat--${sotd.category}`;
    document.getElementById('sotdPrivacy').hidden       = !sotd.isPrivate;
    document.getElementById('sotdTitle').textContent   = sotd.title;
    document.getElementById('sotdExcerpt').textContent = sotd.excerpt;
    document.getElementById('sotdReadBtn').addEventListener('click', () => openStory(sotd.id));
    sotdBanner.style.display = '';
  }

  /* ─────────────────────────────────────────────
     FEATURE 3 - WRITING PROMPTS
  ───────────────────────────────────────────── */
  const PROMPTS = {
    memory: [
      "What did it smell like?",
      "Who else was there?",
      "What would you want them to know?",
      "What year did this happen?",
      "How did it make you feel?",
    ],
    recipe: [
      "Who taught you this recipe?",
      "What occasion is it for?",
      "What's the secret ingredient?",
      "What does it taste like?",
      "Any tips for getting it right?",
    ],
    tradition: [
      "How did this tradition start?",
      "Who participates?",
      "What does it mean to your family?",
      "Has it changed over the years?",
      "What would be lost without it?",
    ],
    lesson: [
      "What happened that taught you this?",
      "How old were you?",
      "Who taught you this lesson?",
      "How has it shaped your life?",
      "What do you wish you'd known sooner?",
    ],
    default: [
      "Start with a specific moment.",
      "What's one detail you'll never forget?",
      "Who should read this?",
      "What would surprise people about this?",
      "What do you want to be remembered?",
    ],
  };

  function updatePrompts(category) {
    const pool = PROMPTS[category] || PROMPTS.default;
    // Show 3 random prompts
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 3);
    promptChips.innerHTML = '';
    shuffled.forEach(prompt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prompt-chip';
      btn.textContent = prompt;
      btn.addEventListener('click', () => {
        const cur = storyBodyTA.value;
        const prefix = cur.length > 0 && !cur.endsWith('\n') ? '\n\n' : '';
        storyBodyTA.value = cur + prefix + prompt + ' ';
        storyBodyTA.focus();
        charCount.textContent = storyBodyTA.value.length.toLocaleString();
      });
      promptChips.appendChild(btn);
    });
  }

  document.getElementById('storyCategory').addEventListener('change', (e) => {
    updatePrompts(e.target.value);
  });

  updatePrompts('default');

  /* ─────────────────────────────────────────────
     FEATURE 4 - PHOTO UPLOAD
  ───────────────────────────────────────────── */
  function showPhotoPreview(dataUrl) {
    photoDataUrl = dataUrl;
    photoPreview.src = dataUrl;
    photoPlaceholder.style.display = 'none';
    photoPreviewWrap.style.display = '';
    photoUploadArea.classList.add('has-photo');
  }

  function clearPhoto() {
    photoDataUrl = null;
    photoPreview.src = '';
    photoInput.value = '';
    photoPlaceholder.style.display = '';
    photoPreviewWrap.style.display = 'none';
    photoUploadArea.classList.remove('has-photo');
  }

  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be under 5 MB.');
      clearPhoto();
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => showPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  });

  photoRemoveBtn.addEventListener('click', clearPhoto);

  // Drag and drop
  photoUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); photoUploadArea.classList.add('drag-over'); });
  photoUploadArea.addEventListener('dragleave', () => photoUploadArea.classList.remove('drag-over'));
  photoUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    photoUploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('Photo must be under 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => showPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  });

  // Click anywhere on the area (not the remove btn) to trigger file picker
  photoUploadArea.addEventListener('click', (e) => {
    if (e.target === photoRemoveBtn || photoRemoveBtn.contains(e.target)) return;
    if (!photoDataUrl) photoInput.click();
  });

  /* ─────────────────────────────────────────────
     VIEW SWITCHING
  ───────────────────────────────────────────── */
  function showView(name) {
    currentView = name;
    // Stop any speech when navigating away
    if (name !== 'story') stopSpeech();

    Object.entries(views).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });
    heroSection.style.display = (name === 'browse' || name === 'story') ? '' : 'none';
    navLinks.forEach(l => l.classList.toggle('active', l.dataset.view === name));
    mainNav.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ─────────────────────────────────────────────
     RENDER HELPERS
  ───────────────────────────────────────────── */
  function categoryLabel(cat) {
    return { memory: 'Memory', recipe: 'Recipe', tradition: 'Tradition', lesson: 'Life Lesson' }[cat] || cat;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const REACTION_EMOJIS = ['🥹', '🍃', '🙏', '❤️', '😄'];
  function privateBadge() { return '<span class="privacy-badge"><span aria-hidden="true">🔒</span> Family only</span>'; }

  function buildCard(story) {
    const fav = isFav(story.id);
    const myReaction = getMyReaction(story.id);
    const card = document.createElement('div');
    card.className = 'story-card';
    card.dataset.id = story.id;

    const photoHtml = story.photo
      ? `<div class="card-photo"><img src="${story.photo}" alt="Story photo" loading="lazy" /></div>`
      : '';

    card.innerHTML = `
      <div class="card-banner ${story.category}"></div>
      ${photoHtml}
      <div class="card-body">
        <div class="card-labels">
          <span class="card-category ${story.category}">${categoryLabel(story.category)}</span>
          ${story.isPrivate ? privateBadge() : ''}
        </div>
        <h3 class="card-title">${escHtml(story.title)}</h3>
        <p class="card-excerpt">${escHtml(story.excerpt)}</p>
      </div>
      <div class="card-footer">
        <div class="card-reactions">
          ${REACTION_EMOJIS.map(e => `<button class="reaction-btn ${myReaction === e ? 'active' : ''}" data-emoji="${e}" data-id="${story.id}" title="React with ${e}">${e}</button>`).join('')}
        </div>
        <button class="fav-btn ${fav ? 'active' : ''}" data-id="${story.id}" aria-label="${fav ? 'Remove from favorites' : 'Save to favorites'}">
          ${fav ? '❤️' : '🤍'}
        </button>
      </div>
    `;

    card.querySelector('.card-body').addEventListener('click', () => openStory(story.id));
    card.querySelector('.card-title').addEventListener('click', (e) => { e.stopPropagation(); openStory(story.id); });

    card.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setReaction(story.id, btn.dataset.emoji);
        renderCurrentView();
      });
    });

    card.querySelector('.fav-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFav(story.id);
      renderCurrentView();
    });

    return card;
  }

  /* ─────────────────────────────────────────────
     BROWSE / FILTER / SEARCH
  ───────────────────────────────────────────── */
  function getFilteredStories() {
    let stories = getAllStories();
    if (activeCategory !== 'all') stories = stories.filter(s => s.category === activeCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      stories = stories.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.author.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q) ||
        s.excerpt.toLowerCase().includes(q) ||
        categoryLabel(s.category).toLowerCase().includes(q)
      );
    }
    return stories;
  }

  function renderBrowse() {
    const stories = getFilteredStories();
    storyGrid.innerHTML = '';
    if (stories.length === 0) {
      emptyState.style.display = '';
      resultsInfo.textContent = '';
    } else {
      emptyState.style.display = 'none';
      const count = stories.length;
      resultsInfo.textContent = searchQuery
        ? `${count} result${count !== 1 ? 's' : ''} for "${searchQuery}"`
        : `${count} ${activeCategory === 'all' ? '' : categoryLabel(activeCategory) + ' '}stor${count !== 1 ? 'ies' : 'y'}`;
      stories.forEach(s => storyGrid.appendChild(buildCard(s)));
    }
  }

  function renderFavorites() {
    const favIds = getFavorites();
    const stories = getAllStories().filter(s => favIds.includes(s.id));
    favGrid.innerHTML = '';
    if (stories.length === 0) {
      favEmpty.style.display = '';
    } else {
      favEmpty.style.display = 'none';
      stories.forEach(s => favGrid.appendChild(buildCard(s)));
    }
  }

  function renderCurrentView() {
    if (currentView === 'browse')    renderBrowse();
    if (currentView === 'favorites') renderFavorites();
    if (currentView === 'story' && currentStoryId) renderStoryDetail(currentStoryId);
  }

  /* ─────────────────────────────────────────────
     STORY DETAIL
  ───────────────────────────────────────────── */
  function canManageStory(story) {
    const isUserStory = getUserStories().some(userStory => userStory.id === story.id);
    const isSampleStory = SAMPLE_STORIES.some(sample => sample.id === story.id);
    const isFamilySample = (window.FAMILY_PRIVATE_STORIES || []).some(sample => sample.id === story.id && sample.familyId === getCurrentFamilyId());
    return isUserStory || isSampleStory || isFamilySample;
  }

  function beginStoryEdit(id) {
    const story = getAllStories().find(item => item.id === id);
    if (!story || !canManageStory(story)) return;
    editingStoryId = story.id;
    document.getElementById('storyTitle').value = story.title;
    document.getElementById('storyCategory').value = story.category;
    document.getElementById('storyAuthor').value = story.author;
    document.getElementById('storyRelation').value = story.relation || '';
    storyBodyTA.value = story.body;
    document.querySelector('input[name="storyVisibility"][value="' + (story.isPrivate ? 'private' : 'public') + '"]').checked = true;
    charCount.textContent = story.body.length.toLocaleString();
    clearPhoto();
    if (story.photo) showPhotoPreview(story.photo);
    storyFormHeading.textContent = 'Edit Story';
    submitStoryBtn.textContent = 'Save Changes';
    successToast.textContent = '✓ Story updated!';
    ['titleError','catError','authorError','bodyError'].forEach(errorId => { document.getElementById(errorId).textContent = ''; });
    updatePrompts(story.category);
    showView('add');
  }

  function resetStoryForm() {
    storyForm.reset();
    editingStoryId = null;
    charCount.textContent = '0';
    clearPhoto();
    storyFormHeading.textContent = 'Share a Story';
    submitStoryBtn.textContent = 'Publish Story';
    successToast.textContent = '✓ Story published!';
    ['titleError','catError','authorError','bodyError'].forEach(errorId => { document.getElementById(errorId).textContent = ''; });
    updatePrompts('default');
  }

  function deleteStory(id) {
    const stories = getUserStories();
    const story = getAllStories().find(item => item.id === id);
    if (!story || !canManageStory(story)) return;
    if (!window.confirm('Delete this story? This cannot be undone.')) return;
    if (stories.some(item => item.id === id)) saveUserStories(stories.filter(item => item.id !== id));
    else saveDeletedStoryIds([...new Set([...getDeletedStoryIds(), id])]);
    saveFavorites(getFavorites().filter(favoriteId => favoriteId !== id));
    const reactions = getReactions();
    delete reactions[id];
    saveReactions(reactions);
    currentStoryId = null;
    showView('browse');
    renderBrowse();
  }

  function openStory(id) {
    currentStoryId = id;
    stopSpeech();
    renderStoryDetail(id);
    showView('story');
  }

  function renderBodyHtml(body) {
    return body.split('\n').map(line => {
      if (line.trim() === '') return '';
      if (line.startsWith('---')) return '<hr style="border:none;border-top:1px solid var(--cream-mid);margin:24px 0">';
      if (line.startsWith('**') && line.endsWith('**')) return `<p><strong>${escHtml(line.slice(2,-2))}</strong></p>`;
      if (line.startsWith('- ')) return `<p style="padding-left:1em">• ${escHtml(line.slice(2))}</p>`;
      return `<p>${escHtml(line)}</p>`;
    }).join('');
  }

  function renderStoryDetail(id) {
    const story = getAllStories().find(s => s.id === id);
    if (!story) { showView('browse'); return; }
    const fav = isFav(story.id);
    const myReaction = getMyReaction(story.id);

    const photoHtml = story.photo
      ? `<div class="detail-photo"><img src="${story.photo}" alt="Story photo" /></div>`
      : '';

    const reactionsHtml = `
      <div class="detail-reactions">
        <span class="reactions-label">React:</span>
        ${REACTION_EMOJIS.map(e => `<button class="reaction-btn reaction-btn--detail ${myReaction === e ? 'active' : ''}" data-emoji="${e}" title="${e}">${e}</button>`).join('')}
      </div>`;

    storyDetail.innerHTML = `
      <div class="detail-labels">
        <span class="detail-category ${story.category}">${categoryLabel(story.category)}</span>
        ${story.isPrivate ? privateBadge() : ''}
      </div>
      <h1 class="detail-title">${escHtml(story.title)}</h1>
      <div class="detail-meta">
        <div class="detail-author">
          <strong>${escHtml(story.author)}</strong>${story.relation ? ` · ${escHtml(story.relation)}` : ''}
        </div>
        ${story.date ? `<div class="detail-date">${escHtml(story.date)}</div>` : ''}
        <button class="detail-fav-btn ${fav ? 'active' : ''}" id="detailFavBtn">
          ${fav ? '❤️ Saved' : '🤍 Save'}
        </button>
      </div>
      <div class="detail-divider"></div>
      ${photoHtml}
      <div class="detail-body" id="detailBodyText">${renderBodyHtml(story.body)}</div>
      ${canManageStory(story) ? `<div class="story-owner-actions"><button type="button" class="btn-ghost" id="editStoryBtn">Edit story</button><button type="button" class="btn-ghost story-delete-btn" id="deleteStoryBtn">Delete story</button></div>` : ''}
      ${reactionsHtml}
    `;

    document.getElementById('detailFavBtn').addEventListener('click', () => {
      toggleFav(story.id);
      renderStoryDetail(story.id);
    });
    const editStoryBtn = document.getElementById('editStoryBtn');
    if (editStoryBtn) editStoryBtn.addEventListener('click', () => beginStoryEdit(story.id));
    const deleteStoryBtn = document.getElementById('deleteStoryBtn');
    if (deleteStoryBtn) deleteStoryBtn.addEventListener('click', () => deleteStory(story.id));

    storyDetail.querySelectorAll('.reaction-btn--detail').forEach(btn => {
      btn.addEventListener('click', () => {
        setReaction(story.id, btn.dataset.emoji);
        renderStoryDetail(story.id);
      });
    });
  }

  /* ─────────────────────────────────────────────
     FEATURE 5 - READ ALOUD (Web Speech API)
  ───────────────────────────────────────────── */
  function getReadableText() {
    const story = getAllStories().find(s => s.id === currentStoryId);
    if (!story) return '';
    return `${story.title}. By ${story.author}. ${story.body.replace(/---/g, '').replace(/\*\*/g, '')}`;
  }

  function stopSpeech() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    isSpeaking = false;
    updateReadAloudBtn();
  }

  function updateReadAloudBtn() {
    if (!readAloudBtn) return;
    if (isSpeaking) {
      readAloudLabel.textContent = 'Stop';
      readAloudBtn.classList.add('speaking');
    } else {
      readAloudLabel.textContent = 'Read Aloud';
      readAloudBtn.classList.remove('speaking');
    }
  }

  readAloudBtn.addEventListener('click', () => {
    if (!('speechSynthesis' in window)) {
      alert('Read Aloud is not supported in this browser. Try Chrome or Safari.');
      return;
    }
    if (isSpeaking) {
      stopSpeech();
      return;
    }
    const text = getReadableText();
    if (!text) return;
    speechUtterance = new SpeechSynthesisUtterance(text);
    speechUtterance.rate  = 0.92;
    speechUtterance.pitch = 1;
    speechUtterance.onend = () => { isSpeaking = false; updateReadAloudBtn(); };
    window.speechSynthesis.speak(speechUtterance);
    isSpeaking = true;
    updateReadAloudBtn();
  });

  /* ── Print ── */
  printBtn.addEventListener('click', () => {
    const story = getAllStories().find(s => s.id === currentStoryId);
    if (!story) return;
    const printArea = document.getElementById('printArea');
    const photoHtml = story.photo ? `<img src="${story.photo}" style="max-width:100%;border-radius:8px;margin-bottom:24px;" alt="" />` : '';
    printArea.innerHTML = `
      <div style="font-family:Georgia,serif;max-width:680px;margin:0 auto;padding:40px 24px;color:#222;">
        <div style="font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:8px;">${categoryLabel(story.category)}</div>
        <h1 style="font-size:2rem;margin:0 0 12px;line-height:1.25;">${escHtml(story.title)}</h1>
        <p style="color:#666;font-size:.9rem;margin:0 0 32px;">${escHtml(story.author)}${story.relation ? ' · ' + escHtml(story.relation) : ''}${story.date ? ' · ' + escHtml(story.date) : ''}</p>
        ${photoHtml}
        <div style="font-size:1.05rem;line-height:1.85;white-space:pre-wrap;">${escHtml(story.body)}</div>
        <div style="margin-top:48px;padding-top:16px;border-top:1px solid #ddd;font-size:.8rem;color:#999;">Preserved on Generations</div>
      </div>`;
    printArea.style.display = '';
    // Hide everything else, print, restore
    document.querySelectorAll('body > *:not(#printArea)').forEach(el => el.style.display = 'none');
    window.print();
    document.querySelectorAll('body > *:not(#printArea)').forEach(el => el.style.display = '');
    printArea.style.display = 'none';
  });

  /* ─────────────────────────────────────────────
     ADD STORY FORM
  ───────────────────────────────────────────── */
  storyBodyTA.addEventListener('input', () => {
    charCount.textContent = storyBodyTA.value.length.toLocaleString();
  });

  function validateForm() {
    let valid = true;
    const title    = document.getElementById('storyTitle').value.trim();
    const category = document.getElementById('storyCategory').value;
    const author   = document.getElementById('storyAuthor').value.trim();
    const body     = storyBodyTA.value.trim();

    ['titleError','catError','authorError','bodyError'].forEach(id => {
      document.getElementById(id).textContent = '';
    });

    if (!title)                     { document.getElementById('titleError').textContent  = 'Please add a title.';           valid = false; }
    if (!category)                  { document.getElementById('catError').textContent    = 'Please choose a category.';     valid = false; }
    if (!author)                    { document.getElementById('authorError').textContent = 'Please enter your name.';       valid = false; }
    if (!body || body.length < 20)  { document.getElementById('bodyError').textContent  = 'Please write at least a few sentences.'; valid = false; }

    return valid;
  }

  storyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const bodyText = storyBodyTA.value.trim();
    const stories = getUserStories();
    const existingIndex = editingStoryId ? stories.findIndex(story => story.id === editingStoryId) : -1;
    const originalStory = editingStoryId ? getAllStories().find(story => story.id === editingStoryId) : null;
    const existingStory = existingIndex >= 0 ? stories[existingIndex] : originalStory;
    const savedStory = {
      ...(existingStory || {}),
      id:       existingStory ? existingStory.id : 'u_' + Date.now(),
      familyId: getCurrentFamilyId(),
      isPrivate: document.querySelector('input[name="storyVisibility"]:checked').value === 'private',
      title:    document.getElementById('storyTitle').value.trim(),
      category: document.getElementById('storyCategory').value,
      author:   document.getElementById('storyAuthor').value.trim(),
      relation: document.getElementById('storyRelation').value.trim(),
      date:     existingStory?.date || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      body:     bodyText,
      excerpt:  bodyText.slice(0, 140) + (bodyText.length > 140 ? '…' : ''),
      photo:    photoDataUrl || null,
    };
    const wasEditing = Boolean(existingStory);

    if (existingStory) stories[existingIndex] = savedStory;
    else stories.unshift(savedStory);
    if (existingStory && existingIndex < 0) {
      const overrides = getStoryOverrides();
      overrides[savedStory.id] = savedStory;
      saveStoryOverrides(overrides);
    } else saveUserStories(stories);

    const savedStoryId = savedStory.id;
    const toastMessage = wasEditing ? '✓ Story updated!' : '✓ Story published!';
    resetStoryForm();
    successToast.textContent = toastMessage;
    successToast.classList.add('show');
    setTimeout(() => {
      successToast.classList.remove('show');
      successToast.textContent = '✓ Story published!';
    }, 2800);

    setTimeout(() => {
      if (wasEditing) {
        currentStoryId = savedStoryId;
        renderStoryDetail(savedStoryId);
        showView('story');
        return;
      }
      activeCategory = 'all';
      searchQuery = '';
      searchInput.value = '';
      clearSearchBtn.classList.remove('visible');
      setActiveChip('all');
      showView('browse');
      renderBrowse();
    }, 600);
  });

  cancelAddBtn.addEventListener('click', () => {
    const returnToStoryId = editingStoryId;
    resetStoryForm();
    if (returnToStoryId) {
      currentStoryId = returnToStoryId;
      renderStoryDetail(returnToStoryId);
      showView('story');
    } else showView('browse');
  });

  /* ─────────────────────────────────────────────
     FILTER CHIPS
  ───────────────────────────────────────────── */
  function setActiveChip(cat) {
    filterChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.cat === cat));
  }

  filterChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    activeCategory = chip.dataset.cat;
    setActiveChip(activeCategory);
    renderBrowse();
  });

  /* ─────────────────────────────────────────────
     SEARCH
  ───────────────────────────────────────────── */
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    clearSearchBtn.classList.toggle('visible', searchQuery.length > 0);
    if (currentView !== 'browse') { activeCategory = 'all'; setActiveChip('all'); showView('browse'); }
    renderBrowse();
  });
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.remove('visible');
    renderBrowse();
    searchInput.focus();
  });

  /* ─────────────────────────────────────────────
     NAV
  ───────────────────────────────────────────── */
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const view = el.dataset.view;
      if (view === 'browse') {
        activeCategory = 'all';
        setActiveChip('all');
        searchQuery = '';
        searchInput.value = '';
        clearSearchBtn.classList.remove('visible');
        renderBrowse();
      }
      if (view === 'favorites') renderFavorites();
      if (view === 'add') resetStoryForm();
      showView(view);
    });
  });

  backBtn.addEventListener('click', () => { showView('browse'); renderBrowse(); });
  hamburger.addEventListener('click', () => mainNav.classList.toggle('open'));

  const familyAccessBtn = document.getElementById('familyAccessBtn');
  const familyAccessDialog = document.getElementById('familyAccessDialog');
  const familyAccounts = window.GENERATIONS_FAMILY_ACCOUNTS || [];
  const familyMemberList = document.getElementById('familyMemberList');
  const familyInviteStatus = document.getElementById('familyInviteStatus');
  const relativeLoginButton = document.getElementById('copyRelativeLogin');

  function renderFamilyAccess() {
    const members = familyAccounts.filter(account => account.familyId === getCurrentFamilyId());
    const familyName = members[0]?.familyName || 'Your family';
    document.getElementById('familyDialogTitle').textContent = `${familyName} access`;
    familyMemberList.innerHTML = members.map(member => `
      <div class="family-member-row"><span class="family-member-dot" aria-hidden="true"></span><div><strong>${member.role}</strong><span>${member.email}</span></div></div>`).join('');
    const relative = members.find(member => member.role === 'Invited relative');
    relativeLoginButton.disabled = !relative;
    relativeLoginButton.dataset.email = relative?.email || '';
    relativeLoginButton.dataset.password = relative?.password || '';
    familyInviteStatus.textContent = relative ? '' : 'No invited-relative account is set up for this family.';
  }

  if (familyAccessBtn) familyAccessBtn.addEventListener('click', () => {
    renderFamilyAccess();
    familyAccessDialog.showModal();
  });
  document.getElementById('closeFamilyDialog').addEventListener('click', () => familyAccessDialog.close());
  relativeLoginButton.addEventListener('click', async () => {
    const credentials = `${relativeLoginButton.dataset.email} / ${relativeLoginButton.dataset.password}`;
    try {
      await navigator.clipboard.writeText(credentials);
      familyInviteStatus.textContent = 'Relative sign-in details copied. Sign out to switch accounts.';
    } catch {
      familyInviteStatus.textContent = `Sign-in details: ${credentials}`;
    }
  });

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  renderBrowse();
  initStoryOfTheDay();

})();
