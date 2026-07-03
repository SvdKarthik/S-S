'use strict';

// ============================================================
//  GLOBAL STATE & HELPERS
// ============================================================

const API_BASE = '/api';

const state = {
    token: localStorage.getItem('accessToken'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    currentSection: 'dashboard',
    // Data caches
    items: [],
    feedback: [],
    events: [],
    aiHistory: []
};

// DOM shortcuts
function $(id) { return document.getElementById(id); }
function qs(selector) { return document.querySelector(selector); }
function qsa(selector) { return document.querySelectorAll(selector); }

// Toast notification
function showToast(message, type = 'info') {
    const toast = $('toast');
    toast.textContent = message;
    toast.className = 'toast show';
    toast.style.borderColor = 
        type === 'success' ? '#36d399' :
        type === 'error'   ? '#ff5f7a' :
        type === 'warning' ? '#ffcf5a' : 'rgba(255,255,255,0.1)';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// API client with automatic token refresh
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
            return apiCall(endpoint, options);
        }
        logout();
        throw new Error('Session expired. Please login again.');
    }

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

// Refresh token using stored refresh token
async function refreshToken() {
    try {
        const refresh = localStorage.getItem('refreshToken');
        if (!refresh) return false;
        const response = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${refresh}` }
        });
        if (response.ok) {
            const data = await response.json();
            state.token = data.access_token;
            localStorage.setItem('accessToken', data.access_token);
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

// Navigation between sections
function navigateTo(section) {
    state.currentSection = section;
    // Update section visibility
    qsa('.section').forEach(el => el.classList.remove('active'));
    const target = $(section);
    if (target) target.classList.add('active');
    // Update nav links
    qsa('.nav-link').forEach(el => {
        el.classList.toggle('active', el.dataset.section === section);
    });
    // Load data for that section
    switch(section) {
        case 'dashboard': loadDashboard(); break;
        case 'lost-found': loadItems(); break;
        case 'feedback': loadFeedback(); break;
        case 'events': loadEvents(); break;
        case 'ai': loadAIHistory(); break;
        case 'admin': loadAdminData(); break;
    }
}

// Auth functions (login/register/logout)
async function login(email, password) {
    const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    state.token = data.access_token;
    state.user = data.user;
    localStorage.setItem('accessToken', data.access_token);
    localStorage.setItem('refreshToken', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
}

async function register(userData) {
    return await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
    });
}

function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    updateAuthUI();
    navigateTo('dashboard');
    showToast('Logged out successfully');
}

function updateAuthUI() {
    const auth = $('navAuth');
    const userInfo = $('userInfo');
    const userName = $('userName');
    const loginBtn = $('loginBtn');
    const registerBtn = $('registerBtn');
    const adminLink = $('adminLink');

    if (state.user) {
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        userName.textContent = state.user.name || state.user.email;
        adminLink.style.display = state.user.role === 'admin' ? 'block' : 'none';
    } else {
        loginBtn.style.display = 'block';
        registerBtn.style.display = 'block';
        userInfo.style.display = 'none';
        adminLink.style.display = 'none';
    }
}

// Modal helpers
function openModal(id) { $(id).classList.add('active'); }
function closeModal(id) { $(id).classList.remove('active'); }

// ============================================================
//  INITIALISATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Restore session
    if (state.token && state.user) {
        updateAuthUI();
    }

    // Navigation links
    qsa('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.section);
        });
    });

    // Auth forms
    $('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = $('loginEmail').value;
        const password = $('loginPassword').value;
        try {
            await login(email, password);
            updateAuthUI();
            closeModal('loginModal');
            navigateTo('dashboard');
            showToast(`Welcome back, ${state.user.name}!`, 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    $('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            name: $('registerName').value,
            email: $('registerEmail').value,
            student_id: $('registerStudentId').value,
            password: $('registerPassword').value
        };
        try {
            await register(data);
            showToast('Registration successful! Please login.', 'success');
            closeModal('registerModal');
            openModal('loginModal');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Modal triggers
    $('loginBtn').addEventListener('click', () => openModal('loginModal'));
    $('registerBtn').addEventListener('click', () => openModal('registerModal'));
    $('logoutBtn').addEventListener('click', logout);

    // Close modals on X
    qsa('.modal-close').forEach(el => {
        el.addEventListener('click', () => closeModal(el.closest('.modal').id));
    });

    // Close modal on background click
    qsa('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    // Initial load
    navigateTo('dashboard');
});