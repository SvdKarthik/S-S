/**
 * Campus Assist Pro — Global Edition
 * ====================================
 * All data (lost items, found items, event ideas, mess feedback) is stored in a
 * globally shared RESTful cloud database. Every user who visits this site
 * sees and shares the same real-time data.
 *
 * Data auto-refreshes every 15 seconds so all users always see the latest entries.
 *
 * Modules:
 *  1. Global API Layer  — fetch/create/delete records via RESTful Table API
 *  2. State & Rendering — local mirror of cloud data for fast rendering
 *  3. Sentiment Engine  — offline keyword-based feedback analyzer
 *  4. Campus AI Bridge  — OpenRouter API integration (API key stored in browser only)
 *  5. Navigation        — section switching and scroll behavior
 *  6. Event Bindings    — wires all UI buttons to their handlers
 *  7. Init              — bootstraps the app on DOMContentLoaded
 */

'use strict';

// ─────────────────────────────────────────────
// 1. CONSTANTS & CONFIGURATION
// ─────────────────────────────────────────────

/** Browser-only storage key for the user's OpenRouter API key */
const STORAGE_KEYS = {
    apiKey: 'campusAssistPro_openRouterKey'
};

/** Auto-refresh interval in milliseconds (15 seconds) */
const AUTO_REFRESH_MS = 15000;

/** RESTful Table API endpoints (relative URLs, works on any host) */
const API = {
    lostItems:    'tables/lost_items',
    foundItems:   'tables/found_items',
    eventIdeas:   'tables/event_ideas',
    messFeedback: 'tables/mess_feedback'
};

// ─────────────────────────────────────────────
// 2. IN-MEMORY STATE (local mirror of cloud data)
// ─────────────────────────────────────────────

/**
 * Local state mirrors the cloud database.
 * Only used for rendering — all writes go to the cloud first.
 */
const state = {
    lostItems:    [],
    foundItems:   [],
    eventIdeas:   [],
    messFeedback: [],
    syncInProgress: false,
    autoRefreshTimer: null,
    lastSyncTime: null
};

/** Sentiment keyword lexicon for local offline analysis */
const sentimentLexicon = {
    positive: [
        'good', 'great', 'clean', 'fresh', 'tasty', 'excellent', 'nice',
        'amazing', 'fast', 'love', 'healthy', 'better', 'improved', 'friendly',
        'delicious', 'wonderful', 'perfect', 'satisfied', 'happy', 'quality'
    ],
    negative: [
        'bad', 'worst', 'dirty', 'late', 'cold', 'stale', 'slow', 'rude',
        'poor', 'awful', 'delay', 'unhygienic', 'issue', 'problem', 'crowded',
        'disgusting', 'terrible', 'horrible', 'disappointed', 'unacceptable'
    ]
};

// ─────────────────────────────────────────────
// 3. UTILITY HELPERS
// ─────────────────────────────────────────────

/** Shorthand for document.getElementById */
function $(id) {
    return document.getElementById(id);
}

/**
 * Escapes HTML special characters to prevent XSS.
 * Always use this before inserting user content into innerHTML.
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Formats a timestamp (milliseconds) into a human-readable relative string.
 * e.g. "2 minutes ago", "just now"
 */
function timeAgo(timestampMs) {
    if (!timestampMs) return '';
    const seconds = Math.floor((Date.now() - timestampMs) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/**
 * Formats a timestamp to a readable date/time string.
 */
function formatDateTime(timestampMs) {
    if (!timestampMs) return '';
    return new Date(timestampMs).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ─────────────────────────────────────────────
// 4. GLOBAL API LAYER — RESTful Table API calls
// ─────────────────────────────────────────────

/**
 * Generic GET request to fetch all records from a table.
 * Returns an array of records sorted by creation time (newest first).
 * @param {string} endpoint - The API table endpoint
 * @param {number} limit - Maximum records to fetch (default 200)
 * @returns {Promise<Array>}
 */
async function apiGetAll(endpoint, limit = 200) {
    const url = `${endpoint}?limit=${limit}&sort=created_at`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load data from ${endpoint}: ${response.status}`);
    }
    const json = await response.json();
    // The API returns { data: [], total: number, ... }
    const records = Array.isArray(json.data) ? json.data : [];
    // Sort newest first
    return records.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

/**
 * Generic POST request to create a new record in a table.
 * @param {string} endpoint - The API table endpoint
 * @param {Object} payload - The record data to create
 * @returns {Promise<Object>} The created record (includes system fields like id, created_at)
 */
async function apiCreate(endpoint, payload) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save data: ${response.status} — ${errorText}`);
    }
    return await response.json();
}

/**
 * Generic DELETE request to remove a record by ID.
 * @param {string} endpoint - The API table endpoint
 * @param {string} recordId - The record ID to delete
 * @returns {Promise<void>}
 */
async function apiDelete(endpoint, recordId) {
    const response = await fetch(`${endpoint}/${recordId}`, {
        method: 'DELETE'
    });
    if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to delete record: ${response.status}`);
    }
}

// ─────────────────────────────────────────────
// 5. SYNC STATUS UI
// ─────────────────────────────────────────────

/**
 * Updates the sync status pill in the topbar.
 * @param {'connected'|'syncing'|'error'|'muted'} tone - Visual tone
 * @param {string} message - Status message to display
 */
function setSyncStatus(tone, message) {
    const pill = $('syncStatusPill');
    const text = $('syncStatusText');
    const dot  = $('syncDot');

    if (pill) pill.dataset.tone = tone;
    if (text) text.textContent = message;

    if (dot) {
        dot.className = 'status-dot';
        if (tone === 'connected') dot.classList.add('dot-green');
        else if (tone === 'syncing') dot.classList.add('dot-blue');
        else if (tone === 'error') dot.classList.add('dot-red');
    }
}

/**
 * Updates the "last sync" pill with a relative time string.
 */
function updateLastSyncTime() {
    const pill = $('lastSyncPill');
    if (!pill) return;
    if (state.lastSyncTime) {
        pill.textContent = `🔄 Last sync: ${timeAgo(state.lastSyncTime)}`;
    } else {
        pill.textContent = '🔄 Last sync: —';
    }
}

/**
 * Updates the total record count shown on the dashboard stat card.
 */
function updateTotalCount() {
    const el = $('totalRecordsCount');
    if (el) {
        const total = state.lostItems.length + state.foundItems.length + state.eventIdeas.length;
        el.textContent = total > 0 ? String(total) : '0';
    }
}

// ─────────────────────────────────────────────
// 6. TOAST NOTIFICATION
// ─────────────────────────────────────────────

/**
 * Displays a brief toast notification at the bottom of the screen.
 * @param {string} message - The message to display
 */
function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// ─────────────────────────────────────────────
// 7. NAVIGATION
// ─────────────────────────────────────────────

/**
 * Shows the specified section and hides all others.
 * Also updates the active state on nav buttons.
 * @param {string} sectionId - The id of the section to show
 */
function showSection(sectionId) {
    document.querySelectorAll('.section-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === sectionId);
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });

    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ─────────────────────────────────────────────
// 8. RENDER FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Renders the lost items list from state.lostItems.
 * All items come from the global cloud database.
 */
function renderLostItems() {
    const container = $('items');
    const countEl   = $('lostCount');

    if (countEl) {
        countEl.textContent = `${state.lostItems.length} item${state.lostItems.length === 1 ? '' : 's'}`;
    }

    if (!container) return;

    if (!state.lostItems.length) {
        container.className = 'list-stack empty-state';
        container.innerHTML = 'No lost items reported yet.';
        return;
    }

    container.className = 'list-stack';
    container.innerHTML = state.lostItems.map(item => `
        <article class="list-item slide-up">
            <div class="list-item-header">
                <h4>🔴 ${escapeHtml(item.item_description)}</h4>
                <small class="item-time">${formatDateTime(item.created_at)}</small>
            </div>
            <p>
                <strong>Name:</strong> ${escapeHtml(item.student_name)}<br>
                <strong>ID:</strong> ${escapeHtml(item.student_id)}<br>
                <strong>Contact:</strong> ${escapeHtml(item.contact)}
            </p>
        </article>
    `).join('');
}

/**
 * Renders the found items list from state.foundItems.
 */
function renderFoundItems() {
    const container = $('foundList');
    const countEl   = $('foundCount');

    if (countEl) {
        countEl.textContent = `${state.foundItems.length} item${state.foundItems.length === 1 ? '' : 's'}`;
    }

    if (!container) return;

    if (!state.foundItems.length) {
        container.className = 'list-stack empty-state';
        container.innerHTML = 'No found items reported yet.';
        return;
    }

    container.className = 'list-stack';
    container.innerHTML = state.foundItems.map(item => `
        <article class="list-item slide-up">
            <div class="list-item-header">
                <h4>🟢 Found Item</h4>
                <small class="item-time">${formatDateTime(item.created_at)}</small>
            </div>
            <p>${escapeHtml(item.item_description)}${item.reporter ? `<br><strong>Reported by:</strong> ${escapeHtml(item.reporter)}` : ''}</p>
        </article>
    `).join('');
}

/**
 * Renders the event ideas list from state.eventIdeas.
 */
function renderEvents() {
    const container = $('eventList');
    const countEl   = $('eventCount');

    if (countEl) {
        countEl.textContent = `${state.eventIdeas.length} idea${state.eventIdeas.length === 1 ? '' : 's'}`;
    }

    if (!container) return;

    if (!state.eventIdeas.length) {
        container.className = 'list-stack empty-state';
        container.innerHTML = 'No event suggestions submitted yet.';
        return;
    }

    container.className = 'list-stack';
    container.innerHTML = state.eventIdeas.map((idea, index) => `
        <article class="list-item slide-up">
            <div class="list-item-header">
                <h4>📌 Suggestion ${index + 1}</h4>
                <small class="item-time">${formatDateTime(idea.created_at)}</small>
            </div>
            <p>${escapeHtml(idea.idea)}</p>
        </article>
    `).join('');
}

/**
 * Renders the global mess feedback log from state.messFeedback.
 */
function renderFeedbackLog() {
    const container = $('feedbackList');
    const countEl   = $('feedbackCount');

    if (countEl) {
        countEl.textContent = `${state.messFeedback.length} entr${state.messFeedback.length === 1 ? 'y' : 'ies'}`;
    }

    if (!container) return;

    if (!state.messFeedback.length) {
        container.className = 'list-stack empty-state';
        container.innerHTML = 'No feedback submitted yet.';
        return;
    }

    container.className = 'list-stack';
    container.innerHTML = state.messFeedback.map(entry => {
        const sentimentClass = (entry.sentiment || 'Neutral').toLowerCase();
        return `
            <article class="list-item slide-up">
                <div class="list-item-header">
                    <span class="pill ${sentimentClass}" style="font-size:0.8rem;padding:5px 10px;">${escapeHtml(entry.sentiment || 'Neutral')}</span>
                    <small class="item-time">${formatDateTime(entry.created_at)}</small>
                </div>
                <p style="margin-top:10px;">${escapeHtml(entry.feedback_text)}</p>
            </article>
        `;
    }).join('');
}

// ─────────────────────────────────────────────
// 9. GLOBAL DATA SYNC
// ─────────────────────────────────────────────

/**
 * Fetches all data from the global cloud database and updates local state.
 * Renders all lists after a successful sync.
 * @param {boolean} showStatus - Whether to show the syncing status pill animation
 */
async function syncAllData(showStatus = true) {
    if (state.syncInProgress) return;
    state.syncInProgress = true;

    if (showStatus) {
        setSyncStatus('syncing', 'Syncing…');
    }

    try {
        // Fetch all four tables in parallel for speed
        const [lostItems, foundItems, eventIdeas, messFeedback] = await Promise.all([
            apiGetAll(API.lostItems),
            apiGetAll(API.foundItems),
            apiGetAll(API.eventIdeas),
            apiGetAll(API.messFeedback)
        ]);

        state.lostItems    = lostItems;
        state.foundItems   = foundItems;
        state.eventIdeas   = eventIdeas;
        state.messFeedback = messFeedback;
        state.lastSyncTime = Date.now();

        // Render all sections
        renderLostItems();
        renderFoundItems();
        renderEvents();
        renderFeedbackLog();
        updateTotalCount();
        updateLastSyncTime();

        setSyncStatus('connected', '✓ Connected — Global data live');

    } catch (error) {
        console.error('[CampusAssist] Sync error:', error);
        setSyncStatus('error', '⚠ Sync failed — retrying…');
    } finally {
        state.syncInProgress = false;
    }
}

/**
 * Starts the auto-refresh timer.
 * Every AUTO_REFRESH_MS milliseconds, syncs data silently (no status flash).
 */
function startAutoRefresh() {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = setInterval(async () => {
        // Don't sync while the user is actively typing in a form field
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
            updateLastSyncTime(); // still update the time display
            return;
        }
        await syncAllData(false);
        updateLastSyncTime();
    }, AUTO_REFRESH_MS);
}

// ─────────────────────────────────────────────
// 10. SENTIMENT ANALYSIS ENGINE (local, offline)
// ─────────────────────────────────────────────

/**
 * Analyzes feedback text using a keyword-based sentiment lexicon.
 * Returns a result object with score, mood, CSS class, summary, and suggestion.
 * @param {string} text - The raw feedback text
 * @returns {{ score: number, mood: string, moodClass: string, summary: string, suggestion: string }}
 */
function analyzeFeedbackText(text) {
    const normalized = text.toLowerCase();
    let score = 0;

    sentimentLexicon.positive.forEach(word => {
        if (normalized.includes(word)) score += 1;
    });

    sentimentLexicon.negative.forEach(word => {
        if (normalized.includes(word)) score -= 1;
    });

    let mood      = 'Neutral';
    let moodClass = 'neutral';
    let summary   = 'The feedback is balanced and does not strongly indicate satisfaction or dissatisfaction.';
    let suggestion = 'Ask for one more specific detail such as taste, hygiene, queue time, or menu variety.';

    if (score > 0) {
        mood      = 'Positive';
        moodClass = 'positive';
        summary   = 'Students seem satisfied overall. The feedback reflects a generally positive dining experience.';
        suggestion = 'Keep the current quality level consistent and highlight what students appreciated the most.';
    } else if (score < 0) {
        mood      = 'Negative';
        moodClass = 'negative';
        summary   = 'The feedback indicates dissatisfaction and suggests that the dining experience needs improvement.';
        suggestion = 'Review service speed, food quality, cleanliness, and staff responsiveness as immediate action points.';
    }

    if (!normalized.trim()) {
        score      = 0;
        mood      = 'Neutral';
        moodClass = 'neutral';
        summary   = 'Please enter feedback text to analyze.';
        suggestion = 'Add a real student comment to get a meaningful result.';
    }

    return { score, mood, moodClass, summary, suggestion };
}

/**
 * Reads the feedback textarea, runs analysis, and updates the result panel.
 */
function analyzeFeedback() {
    const text   = $('feedback').value.trim();
    const result = analyzeFeedbackText(text);

    $('feedbackMood').textContent = result.mood;
    $('feedbackMood').className   = `pill ${result.moodClass}`;
    $('feedbackScore').textContent = `Score: ${result.score}`;
    $('feedbackResult').textContent    = result.summary;
    $('feedbackSuggestion').textContent = result.suggestion;
}

/**
 * Clears the feedback textarea and resets the result panel.
 */
function clearFeedback() {
    $('feedback').value = '';
    analyzeFeedback();
    showToast('Feedback panel cleared');
}

/**
 * Submits the current feedback text to the global feedback log.
 * Includes the locally-computed sentiment so it is visible in the global log.
 */
async function submitFeedbackToGlobal() {
    const text = $('feedback').value.trim();

    if (!text) {
        showToast('Please enter feedback text first');
        return;
    }

    const analysis = analyzeFeedbackText(text);
    const btn = $('submitFeedbackBtn');
    if (btn) btn.disabled = true;

    try {
        const record = await apiCreate(API.messFeedback, {
            feedback_text: text,
            sentiment:     analysis.mood,
            score:         analysis.score
        });

        // Optimistically add to top of local state
        state.messFeedback.unshift(record);
        renderFeedbackLog();
        updateTotalCount();

        $('feedback').value = '';
        analyzeFeedback();
        showToast('✓ Feedback submitted to global log');
    } catch (error) {
        console.error('[CampusAssist] Submit feedback error:', error);
        showToast('Error submitting feedback — please try again');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ─────────────────────────────────────────────
// 11. LOST & FOUND HANDLERS
// ─────────────────────────────────────────────

/**
 * Submits a new lost item report to the global database.
 * Validates all four required fields before submitting.
 */
async function addLostItem() {
    const name      = $('studentName').value.trim();
    const studentId = $('studentId').value.trim();
    const contact   = $('contact').value.trim();
    const item      = $('lostItem').value.trim();

    if (!name || !studentId || !contact || !item) {
        showToast('Please complete all lost item fields');
        return;
    }

    const btn     = $('addLostBtn');
    const btnText = $('addLostBtnText');
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Submitting…';

    try {
        const record = await apiCreate(API.lostItems, {
            student_name:     name,
            student_id:       studentId,
            contact:          contact,
            item_description: item,
            status:           'lost'
        });

        // Optimistically prepend to local state
        state.lostItems.unshift(record);
        renderLostItems();
        updateTotalCount();

        // Clear form fields
        $('studentName').value = '';
        $('studentId').value   = '';
        $('contact').value     = '';
        $('lostItem').value    = '';

        showToast('✓ Lost item report submitted globally');
    } catch (error) {
        console.error('[CampusAssist] Add lost item error:', error);
        showToast('Error submitting report — please try again');
    } finally {
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = 'Submit lost report';
    }
}

/**
 * Submits a new found item report to the global database.
 */
async function addFoundItem() {
    const foundInfo = $('foundInfo').value.trim();
    const reporter  = $('foundReporter').value.trim();

    if (!foundInfo) {
        showToast('Please enter found item information');
        return;
    }

    const btn     = $('addFoundBtn');
    const btnText = $('addFoundBtnText');
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Submitting…';

    try {
        const record = await apiCreate(API.foundItems, {
            item_description: foundInfo,
            reporter:         reporter || 'Anonymous'
        });

        state.foundItems.unshift(record);
        renderFoundItems();
        updateTotalCount();

        $('foundInfo').value     = '';
        $('foundReporter').value = '';

        showToast('✓ Found item report submitted globally');
    } catch (error) {
        console.error('[CampusAssist] Add found item error:', error);
        showToast('Error submitting report — please try again');
    } finally {
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = 'Submit found report';
    }
}

// ─────────────────────────────────────────────
// 12. EVENTS HANDLER
// ─────────────────────────────────────────────

/**
 * Submits a new event idea to the global database.
 */
async function addEvent() {
    const eventIdea = $('eventIdea').value.trim();

    if (!eventIdea) {
        showToast('Please enter an event suggestion');
        return;
    }

    const btn     = $('addEventBtn');
    const btnText = $('addEventBtnText');
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Submitting…';

    try {
        const record = await apiCreate(API.eventIdeas, {
            idea: eventIdea
        });

        state.eventIdeas.unshift(record);
        renderEvents();
        updateTotalCount();

        $('eventIdea').value = '';

        showToast('✓ Event suggestion submitted globally');
    } catch (error) {
        console.error('[CampusAssist] Add event error:', error);
        showToast('Error submitting suggestion — please try again');
    } finally {
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = 'Add suggestion';
    }
}

// ─────────────────────────────────────────────
// 13. CAMPUS AI — OpenRouter Integration
// ─────────────────────────────────────────────

/**
 * Formats a raw AI response string into a clean bullet-pointed list.
 * Strips markdown-style bullet characters and limits to 8 bullet points.
 * @param {string} content - Raw AI response text
 * @returns {string} Formatted multi-line string with "• " bullets
 */
function formatAiAnswer(content) {
    const cleaned = String(content || 'No response received.')
        .replace(/\r/g, '')
        .trim();

    if (!cleaned) {
        return '• No response received.';
    }

    const lines = cleaned
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 8);

    if (lines.length > 1) {
        return lines.map(line => `• ${line}`).join('\n');
    }

    // Single paragraph — split into sentences
    return cleaned
        .split(/(?<=[.!?])\s+/)
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 6)
        .map(line => `• ${line}`)
        .join('\n');
}

/**
 * Calls the OpenRouter API with the user's question and displays the response.
 * The API key is read from the input field and also persisted in localStorage.
 * @param {string} [prefilledPrompt] - Optional pre-filled question (bypasses input field)
 */
async function askCampusAi(prefilledPrompt = '') {
    const apiKey       = $('apiKey').value.trim();
    const questionField = $('aiQuestion');
    const question     = (prefilledPrompt || questionField.value).trim();
    const answerBox    = $('aiAnswer');
    const statusEl     = $('aiStatus');
    const askBtn       = $('askAiBtn');

    if (!apiKey) {
        showToast('Add your OpenRouter API key first');
        showSection('ai');
        return;
    }

    if (!question) {
        showToast('Type a question for Campus AI');
        return;
    }

    // Persist the API key in browser local storage
    localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);

    // Pre-fill the question field if a prompt was injected
    if (prefilledPrompt) {
        questionField.value = prefilledPrompt;
    }

    answerBox.textContent  = 'Generating response…';
    if (statusEl) statusEl.textContent = 'Thinking…';
    if (askBtn) askBtn.disabled = true;

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type':  'application/json',
                'HTTP-Referer':  window.location.href,
                'X-Title':       'Campus Assist Pro'
            },
            body: JSON.stringify({
                model: 'openrouter/free',
                messages: [
                    {
                        role: 'system',
                        content: [
                            'You are Campus Assist Pro, a helpful assistant for university students.',
                            'Give practical, concise, friendly answers focused on campus life, academics,',
                            'announcements, services, and event ideas.',
                            'Keep answers short and structured.',
                            'Prefer 3 to 6 bullet points or a small numbered list.',
                            'Avoid long paragraphs unless absolutely necessary.'
                        ].join(' ')
                    },
                    {
                        role: 'user',
                        content: question
                    }
                ]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data?.error?.message || 'Unable to fetch AI response.';
            throw new Error(errorMessage);
        }

        const content   = data?.choices?.[0]?.message?.content || 'No response received.';
        const modelUsed = data?.model || 'openrouter/free';

        answerBox.textContent = formatAiAnswer(content);
        answerBox.classList.remove('fade-in');
        void answerBox.offsetWidth; // Force reflow for animation restart
        answerBox.classList.add('fade-in');

        if (statusEl) statusEl.textContent = `Done · ${modelUsed}`;
        showToast('✓ AI response generated');

    } catch (error) {
        console.error('[CampusAssist] AI request error:', error);
        answerBox.textContent = `Error: ${error.message}`;
        if (statusEl) statusEl.textContent = 'Error';
        showToast('AI request failed — check your API key');
    } finally {
        if (askBtn) askBtn.disabled = false;
    }
}

/**
 * Sends the current feedback text to Campus AI for improvement suggestions.
 * Switches to the AI section automatically.
 */
function sendFeedbackToAi() {
    const feedback = $('feedback').value.trim();

    if (!feedback) {
        showToast('Enter feedback first');
        return;
    }

    showSection('ai');
    askCampusAi(
        `Analyze this student mess feedback and give 3 concise practical improvement points:\n\n${feedback}`
    );
}

/**
 * Clears the AI question and answer fields.
 */
function clearAi() {
    $('aiQuestion').value  = '';
    $('aiAnswer').textContent = 'Your AI response will appear here in a concise, structured format.';
    const statusEl = $('aiStatus');
    if (statusEl) statusEl.textContent = 'Idle';
    showToast('AI panel cleared');
}

// ─────────────────────────────────────────────
// 14. EVENT BINDINGS
// ─────────────────────────────────────────────

/**
 * Wires all UI buttons and interactive elements to their handler functions.
 * Called once during initialization.
 */
function bindEvents() {
    // Navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    // Feature card and hero button jump links
    document.querySelectorAll('[data-jump]').forEach(element => {
        element.addEventListener('click', () => showSection(element.dataset.jump));
    });

    // Mess Feedback section
    const analyzeFeedbackBtn = $('analyzeFeedbackBtn');
    const clearFeedbackBtn   = $('clearFeedbackBtn');
    const submitFeedbackBtn  = $('submitFeedbackBtn');
    const sendToAiBtn        = $('sendFeedbackToAiBtn');

    if (analyzeFeedbackBtn) analyzeFeedbackBtn.addEventListener('click', analyzeFeedback);
    if (clearFeedbackBtn)   clearFeedbackBtn.addEventListener('click', clearFeedback);
    if (submitFeedbackBtn)  submitFeedbackBtn.addEventListener('click', submitFeedbackToGlobal);
    if (sendToAiBtn)        sendToAiBtn.addEventListener('click', sendFeedbackToAi);

    // Real-time analysis as user types
    const feedbackTextarea = $('feedback');
    if (feedbackTextarea) {
        feedbackTextarea.addEventListener('input', analyzeFeedback);
    }

    // Lost & Found section
    const addLostBtn  = $('addLostBtn');
    const addFoundBtn = $('addFoundBtn');
    if (addLostBtn)  addLostBtn.addEventListener('click', addLostItem);
    if (addFoundBtn) addFoundBtn.addEventListener('click', addFoundItem);

    // Events section
    const addEventBtn = $('addEventBtn');
    if (addEventBtn) addEventBtn.addEventListener('click', addEvent);

    // Campus AI section
    const askAiBtn   = $('askAiBtn');
    const clearAiBtn = $('clearAiBtn');
    if (askAiBtn)   askAiBtn.addEventListener('click', () => askCampusAi());
    if (clearAiBtn) clearAiBtn.addEventListener('click', clearAi);

    // Quick prompt chips
    document.querySelectorAll('.chip-btn').forEach(button => {
        button.addEventListener('click', () => {
            const promptField = $('aiQuestion');
            if (promptField) promptField.value = button.dataset.prompt;
        });
    });

    // API key persistence on change
    const apiKeyInput = $('apiKey');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('change', event => {
            localStorage.setItem(STORAGE_KEYS.apiKey, event.target.value.trim());
        });
    }

    // Manual refresh on clicking the sync status pill
    const syncPill = $('syncStatusPill');
    if (syncPill) {
        syncPill.style.cursor = 'pointer';
        syncPill.title = 'Click to refresh data now';
        syncPill.addEventListener('click', async () => {
            await syncAllData(true);
            showToast('🔄 Data refreshed');
        });
    }

    // Manual refresh on clicking the last sync pill
    const lastSyncPill = $('lastSyncPill');
    if (lastSyncPill) {
        lastSyncPill.style.cursor = 'pointer';
        lastSyncPill.title = 'Click to refresh data now';
        lastSyncPill.addEventListener('click', async () => {
            await syncAllData(true);
            showToast('🔄 Data refreshed');
        });
    }
}

// ─────────────────────────────────────────────
// 15. INITIALISATION
// ─────────────────────────────────────────────

/**
 * Application bootstrap function.
 * Runs once when the DOM is ready.
 */
async function init() {
    // 1. Wire all UI events
    bindEvents();

    // 2. Restore the saved API key from browser local storage
    const savedApiKey = localStorage.getItem(STORAGE_KEYS.apiKey);
    const apiKeyInput = $('apiKey');
    if (apiKeyInput && savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    // 3. Show the dashboard section by default
    showSection('dashboard');

    // 4. Run initial feedback analysis to seed the result panel
    analyzeFeedback();

    // 5. Set status to "connecting" while we fetch
    setSyncStatus('syncing', 'Connecting to global database…');

    // 6. Perform initial data sync from the cloud
    await syncAllData(true);

    // 7. Start auto-refresh cycle
    startAutoRefresh();

    // 8. Keep the "last sync" time display updated every 30 seconds
    setInterval(updateLastSyncTime, 30000);
}

// Boot the app when the DOM is fully parsed
document.addEventListener('DOMContentLoaded', init);
