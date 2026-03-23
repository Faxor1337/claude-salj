let _currentUser = null;

async function initAuth() {
    try {
        const res = await fetch('/api/me', { credentials: 'same-origin' });
        if (res.ok) { _currentUser = await res.json(); }
        else { _currentUser = null; }
    } catch(e) { _currentUser = null; }
    return _currentUser;
}

function getCurrentUser() { return _currentUser; }

async function logout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.href = '/login.html';
}

async function requireAuth() {
    const user = await initAuth();
    if (!user) { window.location.href = '/login.html'; return null; }
    return user;
}

async function requireAdmin() {
    const user = await requireAuth();
    if (user && user.role !== 'admin') { window.location.href = '/index.html'; return null; }
    return user;
}
