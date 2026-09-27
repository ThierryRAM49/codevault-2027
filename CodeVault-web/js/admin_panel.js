// Basic Admin Panel Logic

const btnCreateAdmin = document.getElementById('btn-create-admin');
const btnCreateUser = document.getElementById('btn-create-user');
const newTokenDisplay = document.getElementById('new-token-display');
const tokenValueEl = document.getElementById('token-value');
const listBody = document.getElementById('token-list');

// Generate Token
async function generateToken(role) {
    try {
        const token = await window.electronAPI.generateToken(role);
        showNewToken(token);
        loadTokens();
    } catch (err) {
        console.error(err);
        alert('Erreur lors de la génération du token');
    }
}

function showNewToken(token) {
    tokenValueEl.textContent = token;
    newTokenDisplay.classList.remove('hidden');
}

// Load List
async function loadTokens() {
    const tokens = await window.electronAPI.getTokens();
    renderList(tokens);
}

function renderList(tokens) {
    listBody.innerHTML = '';
    tokens.forEach(t => {
        const tr = document.createElement('tr');
        tr.className = t.is_active ? 'hover:bg-gray-700/50' : 'opacity-50 grayscale';

        // Mask token for display, show first 8 chars
        const masked = t.token.substring(0, 12) + '...';

        tr.innerHTML = `
      <td class="p-3 font-bold ${t.role === 'admin' ? 'text-red-400' : 'text-green-400'}">${t.role.toUpperCase()}</td>
      <td class="p-3 font-mono text-gray-300" title="${t.token}">${masked}</td>
      <td class="p-3 text-gray-400">${new Date(t.created_at).toLocaleDateString()}</td>
      <td class="p-3">
        ${t.is_active
                ? '<span class="px-2 py-1 bg-green-900 text-green-300 rounded text-xs">ACTIF</span>'
                : '<span class="px-2 py-1 bg-red-900 text-red-300 rounded text-xs">RÉVOQUÉ</span>'}
      </td>
      <td class="p-3">
        ${t.is_active ? `<button class="text-red-400 hover:text-white underline text-xs" onclick="revoke(${t.id})">Révoquer</button>` : '-'}
      </td>
    `;
        listBody.appendChild(tr);
    });
}

// Global revoke function
window.revoke = async (id) => {
    if (confirm('Révoquer ce token ?')) {
        await window.electronAPI.revokeToken(id);
        loadTokens();
    }
};

btnCreateAdmin.onclick = () => generateToken('admin');
btnCreateUser.onclick = () => generateToken('user');

// Copy on click
tokenValueEl.onclick = () => {
    navigator.clipboard.writeText(tokenValueEl.textContent);
    alert('Token copié !');
};

// Init
loadTokens();
