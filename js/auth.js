import { supabase } from './supabase.js';
import { mostrarPantalla } from './router.js';
import { cargarLobby } from './lobby.js';

// Avatares predeterminados
export const AVATARES = [
    { id: 'h1', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix&backgroundColor=b6e3f4', label: 'Hombre 1' },
    { id: 'h2', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Max&backgroundColor=c0aede', label: 'Hombre 2' },
    { id: 'h3', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Leo&backgroundColor=d1d4f9', label: 'Hombre 3' },
    { id: 'm1', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Luna&backgroundColor=ffdfbf', label: 'Mujer 1' },
    { id: 'm2', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sofia&backgroundColor=ffd5dc', label: 'Mujer 2' },
    { id: 'm3', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Mia&backgroundColor=c1f4c5', label: 'Mujer 3' },
];

let usuarioActual = null;
let perfilActual = null;
let pendingEmail = null;

export function getUsuario() { return usuarioActual; }
export function getPerfil() { return perfilActual; }

export async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        usuarioActual = session.user;
        perfilActual = await fetchPerfil(session.user.id);
        return true;
    }
    return false;
}

async function fetchPerfil(uid) {
    const { data } = await supabase.from('perfiles').select('*').eq('id', uid).single();
    return data;
}

export function initAuthUI() {
    // Tabs login/registro
    document.getElementById('tabLogin').addEventListener('click', () => switchTab('login'));
    document.getElementById('tabRegistro').addEventListener('click', () => switchTab('registro'));

    // Forms
    document.getElementById('formLogin').addEventListener('submit', handleLogin);
    document.getElementById('formRegistro').addEventListener('submit', handleRegistro);
    document.getElementById('formOtp').addEventListener('submit', handleOtp);
    document.getElementById('btnReenviarOtp').addEventListener('click', handleReenviarOtp);

    // Avatar selector en registro
    renderAvatarSelector();

    // Upload avatar
    document.getElementById('inputAvatarUpload').addEventListener('change', handleAvatarUpload);
}

function switchTab(tab) {
    document.getElementById('tabLogin').classList.toggle('tab-active', tab === 'login');
    document.getElementById('tabRegistro').classList.toggle('tab-active', tab === 'registro');
    document.getElementById('formLogin').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('formRegistro').style.display = tab === 'registro' ? 'block' : 'none';
}

function renderAvatarSelector() {
    const grid = document.getElementById('avatarGrid');
    grid.innerHTML = '';
    AVATARES.forEach(av => {
        const div = document.createElement('div');
        div.classList.add('avatar-opcion');
        div.dataset.id = av.id;
        div.dataset.url = av.url;
        div.innerHTML = `<img src="${av.url}" alt="${av.label}" title="${av.label}">`;
        div.addEventListener('click', () => {
            document.querySelectorAll('.avatar-opcion').forEach(d => d.classList.remove('selected'));
            div.classList.add('selected');
            document.getElementById('avatarSeleccionado').value = av.url;
            document.getElementById('avatarTipo').value = 'predeterminado';
        });
        grid.appendChild(div);
    });
    // Seleccionar el primero por defecto
    grid.firstChild.classList.add('selected');
    document.getElementById('avatarSeleccionado').value = AVATARES[0].url;
    document.getElementById('avatarTipo').value = 'predeterminado';
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowed.includes(ext)) { mostrarError('authError', 'Formato no permitido. Usa JPG, PNG o WEBP.'); return; }

    mostrarError('authError', 'Subiendo imagen...');
    const path = `temp/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('avatares').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { mostrarError('authError', 'Error subiendo imagen: ' + error.message); return; }
    const { data: urlData } = supabase.storage.from('avatares').getPublicUrl(data.path);
    const publicUrl = urlData.publicUrl + '?t=' + Date.now();
    document.getElementById('avatarSeleccionado').value = publicUrl;
    document.getElementById('avatarTipo').value = 'subido';
    document.getElementById('avatarPreview').src = publicUrl;
    document.getElementById('avatarPreview').style.display = 'block';
    document.querySelectorAll('.avatar-opcion').forEach(d => d.classList.remove('selected'));
    mostrarError('authError', '');
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    mostrarError('authError', '');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { mostrarError('authError', error.message); return; }
    usuarioActual = data.user;
    perfilActual = await fetchPerfil(data.user.id);
    irAlLobby();
}

async function handleRegistro(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const avatarUrl = document.getElementById('avatarSeleccionado').value;
    const avatarTipo = document.getElementById('avatarTipo').value;
    mostrarError('authError', '');

    if (username.length < 3) { mostrarError('authError', 'Username mínimo 3 caracteres'); return; }

    const { error } = await supabase.auth.signUp({
        email, password,
        options: {
            data: { username, avatar_url: avatarUrl, avatar_tipo: avatarTipo },
            emailRedirectTo: null
        }
    });

    if (error) { mostrarError('authError', error.message); return; }

    pendingEmail = email;
    mostrarPantalla('screenOtp');
    document.getElementById('otpEmailLabel').textContent = email;
}

async function handleOtp(e) {
    e.preventDefault();
    const token = document.getElementById('otpInput').value.trim();
    mostrarError('otpError', '');

    const { data, error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token,
        type: 'signup'
    });

    if (error) { mostrarError('otpError', 'Código incorrecto o expirado'); return; }
    usuarioActual = data.user;
    perfilActual = await fetchPerfil(data.user.id);
    irAlLobby();
}

async function handleReenviarOtp() {
    if (!pendingEmail) return;
    await supabase.auth.resend({ type: 'signup', email: pendingEmail });
    mostrarError('otpError', 'Código reenviado');
}

function irAlLobby() {
    mostrarPantalla('screenLobby');
    cargarLobby();
    actualizarHeaderUsuario();
}

let _onAvatarClick = null;
export function setOnAvatarClick(fn) { _onAvatarClick = fn; }

export function actualizarHeaderUsuario() {
    const p = perfilActual;
    if (!p) return;
    const el = document.getElementById('headerUsuario');
    if (el) {
        el.innerHTML = `
            <img src="${p.avatar_url || AVATARES[0].url}" class="header-avatar" title="Editar perfil">
            <span>${p.username}</span>
        `;
        el.style.cursor = 'pointer';
        el.onclick = () => { if (_onAvatarClick) _onAvatarClick(); };
    }
}

export async function cerrarSesion() {
    await supabase.auth.signOut();
    usuarioActual = null;
    perfilActual = null;
    mostrarPantalla('screenAuth');
}

function mostrarError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
}
