'use strict';

async function askAI(question) {
    if (!question || !question.trim()) {
        showToast('Please enter a question', 'warning');
        return;
    }
    const btn = $('askAiBtn');
    btn.disabled = true;
    btn.textContent = 'Thinking...';

    try {
        const data = await apiCall('/ai/ask', {
            method: 'POST',
            body: JSON.stringify({ question })
        });
        addMessage('user', question);
        addMessage('system', data.answer);
        $('aiQuestion').value = '';
        loadAIHistory();
        showToast('AI responded!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Ask';
    }
}

function addMessage(role, content) {
    const container = $('aiMessages');
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.textContent = content;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function loadAIHistory() {
    try {
        const data = await apiCall('/ai/history?limit=20');
        state.aiHistory = data.history || [];
        renderHistory(state.aiHistory);
    } catch (err) {
        // History might not be available; ignore
    }
}

function renderHistory(history) {
    const container = $('aiHistory');
    if (!container) return;
    if (!history || history.length === 0) {
        container.innerHTML = '<p class="empty-state">No conversation history.</p>';
        return;
    }
    container.innerHTML = history.map(conv => `
        <div class="history-item">
            <div class="question">${escapeHtml(conv.question)}</div>
            <div class="answer">${escapeHtml(conv.answer.substring(0, 100))}...</div>
            <small>${new Date(conv.created_at).toLocaleString()}</small>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    $('askAiBtn')?.addEventListener('click', () => {
        const q = $('aiQuestion').value;
        askAI(q);
    });

    // Quick prompt chips
    document.querySelectorAll('.quick-prompts .btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.dataset.prompt;
            if (prompt) {
                $('aiQuestion').value = prompt;
                askAI(prompt);
            }
        });
    });

    // Enter key to submit (Shift+Enter for new line)
    $('aiQuestion')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            $('askAiBtn').click();
        }
    });
});