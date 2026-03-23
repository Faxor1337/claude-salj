// Shared authentication module
const AUTH_KEY = 'claude-salj-auth';
const USERS_KEY = 'claude-salj-users';

// Default users (seeded on first load)
function getDefaultUsers() {
    return [
        { id: 1, username: "admin", password: "admin123", name: "Administratör", role: "admin" },
        { id: 2, username: "anna", password: "anna123", name: "Anna Svensson", role: "user" },
        { id: 3, username: "erik", password: "erik123", name: "Erik Johansson", role: "user" },
        { id: 4, username: "johan", password: "johan123", name: "Johan Lindberg", role: "user" },
    ];
}

function getUsers() {
    return JSON.parse(localStorage.getItem(USERS_KEY) || 'null') || getDefaultUsers();
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
    const data = localStorage.getItem(AUTH_KEY);
    return data ? JSON.parse(data) : null;
}

function login(username, password) {
    const users = getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        const session = { id: user.id, username: user.username, name: user.name, role: user.role };
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
        return session;
    }
    return null;
}

function logout() {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = 'login.html';
}

function requireAuth() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

function requireAdmin() {
    const user = requireAuth();
    if (user && user.role !== 'admin') {
        window.location.href = 'index.html';
        return null;
    }
    return user;
}
