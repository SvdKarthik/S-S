'use strict';

async function loadDashboard() {
    if (!state.token) {
        // Show placeholder or login prompt
        return;
    }
    try {
        const stats = await apiCall('/dashboard/stats');
        // Update stat cards
        $('totalUsers').textContent = stats.total_users || 0;
        $('totalLost').textContent = stats.total_lost || 0;
        $('totalFound').textContent = stats.total_found || 0;
        $('totalFeedback').textContent = stats.total_feedback || 0;
        $('totalEvents').textContent = stats.total_events || 0;
    } catch (err) {
        showToast('Failed to load dashboard stats', 'error');
    }
}