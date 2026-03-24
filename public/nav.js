// Shared navigation component
function renderNav(activePage) {
    const user = getCurrentUser();
    if (!user) return;

    const pages = [
        { id: 'prospects', label: 'Prospekt', href: 'index.html' },
        { id: 'clients', label: 'Våra butiker', href: 'clients.html' },
        { id: 'invoices', label: 'Alla fakturor', href: 'invoices.html' },
    ];

    pages.push({ id: 'analytics', label: 'Statistik', href: 'analytics.html' });

    if (user.role === 'admin') {
        pages.push({ id: 'admin', label: 'Admin', href: 'admin.html' });
    }

    const nav = document.createElement('nav');
    nav.className = 'main-nav';
    nav.innerHTML = `
        <div class="nav-left">
            <span class="nav-logo">V</span>
            <span class="nav-brand">Virea AB</span>
            <div class="nav-links">
                ${pages.map(p => `<a href="${p.href}" class="nav-link ${activePage === p.id ? 'active' : ''}">${p.label}</a>`).join('')}
            </div>
        </div>
        <div class="nav-right">
            <span class="nav-user">${esc(user.name)}</span>
            <button onclick="logout()" class="nav-logout">Logga ut</button>
        </div>
    `;

    document.body.prepend(nav);
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
