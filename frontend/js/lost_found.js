'use strict';

// Load lost/found items
async function loadItems() {
    try {
        const search = $('itemSearch')?.value || '';
        const status = $('itemStatus')?.value || '';
        let url = '/lost-found/lost?';
        if (search) url += `search=${encodeURIComponent(search)}&`;
        if (status) url += `status=${encodeURIComponent(status)}&`;
        const data = await apiCall(url);
        state.items = data.items || [];
        renderItems(state.items);
    } catch (err) {
        showToast('Failed to load items', 'error');
    }
}

function renderItems(items) {
    const container = $('itemsContainer');
    if (!container) return;
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="empty-state">No items found.</p>';
        return;
    }
    container.innerHTML = items.map(item => `
        <div class="item-card">
            ${item.image_url ? `<img src="${item.image_url}" alt="${item.title}">` : ''}
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.description)}</p>
            <p><strong>Location:</strong> ${escapeHtml(item.location || 'N/A')}</p>
            <span class="status status-${item.status}">${item.status.toUpperCase()}</span>
            <p><small>${new Date(item.created_at).toLocaleString()}</small></p>
            ${item.user ? `<p><small>Reported by: ${escapeHtml(item.user.name)}</small></p>` : ''}
        </div>
    `).join('');
}

// Submit lost item
async function submitLost(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', $('lostTitle').value);
    formData.append('description', $('lostDescription').value);
    formData.append('location', $('lostLocation').value);
    formData.append('date_lost', $('lostDate').value);
    const file = $('lostImage').files[0];
    if (file) formData.append('image', file);

    try {
        await apiCall('/lost-found/lost', {
            method: 'POST',
            headers: { 'Content-Type': undefined }, // let browser set boundary
            body: formData
        });
        showToast('Lost item reported!', 'success');
        $('lostForm').reset();
        loadItems();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Submit found item
async function submitFound(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', $('foundTitle').value);
    formData.append('description', $('foundDescription').value);
    formData.append('location', $('foundLocation').value);
    formData.append('date_found', $('foundDate').value);
    const file = $('foundImage').files[0];
    if (file) formData.append('image', file);

    try {
        await apiCall('/lost-found/found', {
            method: 'POST',
            headers: { 'Content-Type': undefined },
            body: formData
        });
        showToast('Found item reported!', 'success');
        $('foundForm').reset();
        loadItems();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    $('lostForm')?.addEventListener('submit', submitLost);
    $('foundForm')?.addEventListener('submit', submitFound);
    $('itemSearch')?.addEventListener('input', loadItems);
    $('itemStatus')?.addEventListener('change', loadItems);
});

// HTML escaping helper
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}