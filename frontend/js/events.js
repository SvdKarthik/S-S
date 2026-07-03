'use strict';

async function loadEvents() {
    try {
        const data = await apiCall('/events');
        state.events = data.events || [];
        renderEvents(state.events);
    } catch (err) {
        showToast('Failed to load events', 'error');
    }
}

function renderEvents(events) {
    const container = $('eventsContainer');
    if (!container) return;
    if (!events || events.length === 0) {
        container.innerHTML = '<p class="empty-state">No events suggested yet.</p>';
        return;
    }
    container.innerHTML = events.map(ev => `
        <div class="event-item">
            <h3>${escapeHtml(ev.title)}</h3>
            <p>${escapeHtml(ev.description)}</p>
            ${ev.venue ? `<p><strong>Venue:</strong> ${escapeHtml(ev.venue)}</p>` : ''}
            ${ev.date ? `<p><strong>Date:</strong> ${new Date(ev.date).toLocaleString()}</p>` : ''}
            <p><strong>Status:</strong> ${ev.status}</p>
            <p><small>Votes: ${ev.votes || 0}</small></p>
            <div class="vote-buttons">
                <button class="btn btn-sm btn-primary" data-event="${ev.id}" data-vote="up">▲ Upvote</button>
                <button class="btn btn-sm btn-secondary" data-event="${ev.id}" data-vote="down">▼ Downvote</button>
            </div>
        </div>
    `).join('');

    // Attach vote listeners
    container.querySelectorAll('[data-event]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const eventId = btn.dataset.event;
            const voteType = btn.dataset.vote;
            try {
                await apiCall(`/events/${eventId}/vote`, {
                    method: 'POST',
                    body: JSON.stringify({ vote_type: voteType })
                });
                showToast('Vote recorded!', 'success');
                loadEvents();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });
}

// Submit event suggestion
async function submitEvent(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', $('eventTitle').value);
    formData.append('description', $('eventDescription').value);
    formData.append('date', $('eventDate').value);
    formData.append('venue', $('eventVenue').value);
    // image upload optional
    const file = $('eventImage')?.files[0];
    if (file) formData.append('image', file);

    try {
        await apiCall('/events', {
            method: 'POST',
            headers: { 'Content-Type': undefined },
            body: formData
        });
        showToast('Event suggestion submitted!', 'success');
        $('eventForm').reset();
        loadEvents();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    $('eventForm')?.addEventListener('submit', submitEvent);
});