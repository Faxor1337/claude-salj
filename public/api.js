// Shared API client - replaces localStorage with server calls
const API = {
    async fetch(url, opts = {}) {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...opts.headers },
            credentials: 'same-origin',
            ...opts
        });
        if (res.status === 401) {
            window.location.href = '/login.html';
            return null;
        }
        return res;
    },

    // Auth
    async login(username, password) {
        const res = await this.fetch('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        if (!res || !res.ok) return null;
        return res.json();
    },
    async logout() {
        await this.fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
    },
    async me() {
        const res = await this.fetch('/api/me');
        if (!res || !res.ok) return null;
        return res.json();
    },

    // Users
    async getUsers() { const r = await this.fetch('/api/users'); return r ? r.json() : []; },
    async createUser(data) { const r = await this.fetch('/api/users', { method: 'POST', body: JSON.stringify(data) }); return r ? r.json() : null; },
    async updateUser(id, data) { await this.fetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    async deleteUser(id) { await this.fetch(`/api/users/${id}`, { method: 'DELETE' }); },

    // Customers (prospects)
    async getCustomers() { const r = await this.fetch('/api/customers'); return r ? r.json() : []; },
    async createCustomer(data) { const r = await this.fetch('/api/customers', { method: 'POST', body: JSON.stringify(data) }); return r ? r.json() : null; },
    async updateCustomer(id, data) { await this.fetch(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    async deleteCustomer(id) { await this.fetch(`/api/customers/${id}`, { method: 'DELETE' }); },

    // Clients
    async getClients() { const r = await this.fetch('/api/clients'); return r ? r.json() : []; },
    async createClient(data) { const r = await this.fetch('/api/clients', { method: 'POST', body: JSON.stringify(data) }); return r ? r.json() : null; },
    async updateClient(id, data) { await this.fetch(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    async deleteClient(id) { await this.fetch(`/api/clients/${id}`, { method: 'DELETE' }); },

    // Contracts
    async getContract(clientId) { const r = await this.fetch(`/api/contracts/${clientId}`); return r ? r.json() : null; },
    async saveContract(clientId, data) { await this.fetch(`/api/contracts/${clientId}`, { method: 'PUT', body: JSON.stringify(data) }); },

    // Invoices
    async getInvoices(clientId) {
        const url = clientId ? `/api/invoices?client_id=${clientId}` : '/api/invoices';
        const r = await this.fetch(url);
        return r ? r.json() : [];
    },
    async createInvoice(data) { const r = await this.fetch('/api/invoices', { method: 'POST', body: JSON.stringify(data) }); return r ? r.json() : null; },
    async updateInvoice(id, data) { await this.fetch(`/api/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    async deleteInvoice(id) { await this.fetch(`/api/invoices/${id}`, { method: 'DELETE' }); },
    async getNextInvoiceNr() { const r = await this.fetch('/api/invoices/next-nr'); const d = await r.json(); return d.nr; },

    // Notes
    async getNotes(type, entityId) { const r = await this.fetch(`/api/notes/${type}/${entityId}`); return r ? r.json() : []; },
    async addNote(data) { const r = await this.fetch('/api/notes', { method: 'POST', body: JSON.stringify(data) }); return r ? r.json() : null; },

    // Products (global catalog)
    async getProducts() { const r = await this.fetch('/api/products'); return (r && r.ok) ? r.json() : []; },
    async createProduct(data) { const r = await this.fetch('/api/products', { method: 'POST', body: JSON.stringify(data) }); return r ? r.json() : null; },
    async updateProduct(id, data) { await this.fetch(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    async deleteProduct(id) { await this.fetch(`/api/products/${id}`, { method: 'DELETE' }); },

    // Seed
    async seedCustomers(customers) { const r = await this.fetch('/api/seed-customers', { method: 'POST', body: JSON.stringify({ customers }) }); return r ? r.json() : null; }
};
