'use strict';

async function loadFeedback() {
    try {
        const data = await apiCall('/feedback?per_page=50');
        state.feedback = data.items || [];
        renderFeedback(state.feedback);
        loadSentimentStats();
    } catch (err) {
        showToast('Failed to load feedback', 'error');
    }
}

function renderFeedback(items) {
    const container = $('feedbackContainer');
    if (!container) return;
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="empty-state">No feedback yet.</p>';
        return;
    }
    container.innerHTML = items.map(fb => `
        <div class="feedback-item">
            <div class="meta">
                <span class="sentiment-tag tag-${fb.sentiment}">${fb.sentiment || 'Neutral'}</span>
                <small>${new Date(fb.created_at).toLocaleString()}</small>
            </div>
            <p>${escapeHtml(fb.text)}</p>
            ${fb.category ? `<small>Category: ${escapeHtml(fb.category)}</small>` : ''}
        </div>
    `).join('');
}

async function loadSentimentStats() {
    try {
        const stats = await apiCall('/feedback/stats');
        const { positive, negative, neutral, total } = stats;
        const posPct = total ? Math.round((positive/total)*100) : 0;
        const negPct = total ? Math.round((negative/total)*100) : 0;
        const neuPct = total ? Math.round((neutral/total)*100) : 0;

        // Update bars
        $('positiveBar').style.width = posPct + '%';
        $('negativeBar').style.width = negPct + '%';
        $('neutralBar').style.width = neuPct + '%';

        // Update sentiment display
        const display = $('sentimentDisplay');
        if (display) {
            const max = Math.max(positive, negative, neutral);
            if (max === 0) {
                display.className = 'sentiment-neutral';
                display.innerHTML = '<span class="sentiment-icon">😐</span><span class="sentiment-label">No data</span>';
            } else if (positive >= negative && positive >= neutral) {
                display.className = 'sentiment-positive';
                display.innerHTML = '<span class="sentiment-icon">😊</span><span class="sentiment-label">Positive</span>';
            } else if (negative >= positive && negative >= neutral) {
                display.className = 'sentiment-negative';
                display.innerHTML = '<span class="sentiment-icon">😞</span><span class="sentiment-label">Negative</span>';
            } else {
                display.className = 'sentiment-neutral';
                display.innerHTML = '<span class="sentiment-icon">😐</span><span class="sentiment-label">Neutral</span>';
            }
        }
    } catch (err) {
        // Stats may be admin-only; ignore if not admin
    }
}

// Submit feedback
async function submitFeedback(e) {
    e.preventDefault();
    const text = $('feedbackText').value.trim();
    if (!text) {
        showToast('Please enter feedback', 'warning');
        return;
    }
    const category = $('feedbackCategory').value;
    try {
        await apiCall('/feedback', {
            method: 'POST',
            body: JSON.stringify({ text, category })
        });
        showToast('Feedback submitted!', 'success');
        $('feedbackForm').reset();
        loadFeedback();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    $('feedbackForm')?.addEventListener('submit', submitFeedback);
});