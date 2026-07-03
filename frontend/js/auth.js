'use strict';

// Authentication-specific UI updates and helpers
// (most auth logic is already in app.js, this is for additional UI behaviours)

document.addEventListener('DOMContentLoaded', () => {
    // Show password toggle if needed
    // Handle "Forgot password" etc.
});

// Function to check if user is authenticated
function isAuthenticated() {
    return !!state.token;
}

// Function to check if user is admin
function isAdmin() {
    return state.user && state.user.role === 'admin';
}