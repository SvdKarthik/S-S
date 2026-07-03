'use strict';

// Admin-only functions
async function loadAdminData() {
    if (!state.user || state.user.role !== 'admin') {
        $('admin').style.display = 'none';
        return;
    }
    try {
        // Load users
        const usersData = await apiCall('/admin/users');
        const users = usersData.users || [];
        renderAdminUsers(users);
        // You could also load content for moderation
        // For example, list all items, feedback, events with delete buttons
        loadModerationContent();
    } catch (err) {
        showToast('Failed to load admin data', 'error');
    }
}

function renderAdminUsers(users) {
    const container = $('adminUsers');
    if (!container) return;
    if (!users || users.length === 0) {
        container.innerHTML = '<p>No users found.</p>';
        return;
    }
    container.innerHTML = users.map(user => `
        <div class="admin-user-item" style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.05);">
            <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)})
            <span style="color:${user.role === 'admin' ? '#7c5cff' : '#c0cae7'}">${user.role}</span>
            ${user.is_active !== undefined ? `Active: ${user.is_active}` : ''}
            <button class="btn btn-sm btn-danger" data-user="${user.id}">Delete</button>
            ${user.role !== 'admin' ? `<button class="btn btn-sm btn-primary" data-promote="${user.id}">Make Admin</button>` : ''}
        </div>
    `).join('');

    // Add event listeners for admin actions
    container.querySelectorAll('[data-user]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.user;
            if (confirm('Delete this user?')) {
                try {
                    await apiCall(`/admin/users/${userId}`, { method: 'DELETE' });
                    showToast('User deleted', 'success');
                    loadAdminData();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            }
        });
    });

    container.querySelectorAll('[data-promote]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.promote;
            if (confirm('Promote this user to admin?')) {
                try {
                    await apiCall(`/admin/users/${userId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ role: 'admin' })
                    });
                    showToast('User promoted', 'success');
                    loadAdminData();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            }
        });
    });
}

async function loadModerationContent() {
    // Example: load feedback with delete buttons
    try {
        const data = await apiCall('/feedback?per_page=100');
        const items = data.items || [];
        const container = $('adminContent');
        if (!container) return;
        if (items.length === 0) {
            container.innerHTML = '<p>No content to moderate.</p>';
            return;
        }
        container.innerHTML = items.map(fb => `
            <div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.05);">
                <p>${escapeHtml(fb.text)}</p>
                <small>${new Date(fb.created_at).toLocaleString()}</small>
                <button class="btn btn-sm btn-danger" data-feedback="${fb.id}">Delete</button>
            </div>
        `).join('');

        container.querySelectorAll('[data-feedback]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fbId = btn.dataset.feedback;
                if (confirm('Delete this feedback?')) {
                    try {
                        await apiCall(`/feedback/${fbId}`, { method: 'DELETE' });
                        showToast('Feedback deleted', 'success');
                        loadModerationContent();
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                }
            });
        });
    } catch (err) {
        // Maybe not admin
    }
}

// Admin section visibility is handled in app.js updateAuthUI
document.addEventListener('DOMContentLoaded', () => {
    // Additional admin initialisation if needed
});