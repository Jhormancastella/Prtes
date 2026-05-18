import { auth, db, storage } from './firebase.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
    doc, getDoc, setDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
    ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { mostrarPantalla } from './router.js';
import { cargarLobby } from './lobby.js';
import { AVATARES_BASE } from './avatares.js';
import { recalcularStatsDesdeJuegos } from './stats.js';

export const AVATARES = AVATARES_BASE;

let usuarioActual = null;
let perfilActual  = null;
let _onAvatarClick = null;

export function getUsuario() { return usuarioActual; }
export function getPerfil()  { return perfilActual; }
export function setOnAvatarClick(fn) { _onAvatarClick = fn; }

export async function initAuth() {
    return new Promise(resolve => {
        onAuthStateChanged(auth, async user => {
            if (user) {
                usuarioActual = user;
                perfilActual  = await fetchPerfil(user.uid);
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

async function fetchPerfil(uid) {
    const snap = await getDoc(doc(db, 'perfiles', uid));
    if (!snap.exists()) return null;
    const data = { id: uid, ...snap.data() };
    try {
        const stats = await recalcularStatsDesdeJuegos(uid);
        if (stats) {
            data.victorias = stats.victorias;
            data.derrotas  = stats.derrotas;
            data.empates   = stats.empates;
            data.partidas  = stats.partidas;
        }
    } catch (e) {
        console.warn('No se pudieron recalcular stats:', e);
    }
    return data;
}

export function initAuthUI() {
    document.getElementById('tabLogin').addEventListener('click', () => switchTab('login'));
    document.getElementById('tabRegistro').addEventListener('click', () => switchTab('registro'));
    document.getElementById('formLogin').addEventListener('submit', handleLogin);
    document.getElementById('formRegistro').addEventListener('submit', handleRegistro);
    renderAvatarSelector();
    document.getElementById('inputAvatarUpload').addEventListener('change', handleAvatarUpload);
}

function switchTab(tab) {
    document.getElementById('tabLogin').classList.toggle('tab-active', tab === 'login');
    document.getElementById('tabRegistro').classList.toggle('tab-active', tab === 'registro');
    document.getElementById('formLogin').style.display   = tab === 'login'    ? 'block' : 'none';
    document.getElementById('formRegistro').style.display = tab === 'registro' ? 'block' : 'none';
    mostrarError('authError', '');
}

function renderAvatarSelector() {
    const grid = document.getElementById('avatarGrid');
    grid.innerHTML = '';
    AVATARES.forEach((av, idx) => {
        const div = document.createElement('div');
        div.classList.add('avatar-opcion');
        div.dataset.id  = av.id;
        div.dataset.url = av.url;
        div.setAttribute('role', 'radio');
        div.setAttribute('aria-label', av.label);
        div.setAttribute('tabindex', '0');
        div.innerHTML = `<img src="${av.url}" alt="${av.label}">`;
        div.addEventListener('click', () => seleccionarAvatar(div, av.url));
        div.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') seleccionarAvatar(div, av.url); });
        if (idx === 0) div.classList.add('selected');
        grid.appendChild(div);
    });
    document.getElementById('avatarSeleccionado').value = AVATARES[0].url;
    document.getElementById('avatarTipo').value = 'predeterminado';
}

function seleccionarAvatar(div, url) {
    document.querySelectorAll('#avatarGrid .avatar-opcion').forEach(d => d.classList.remove('selected'));
    div.classList.add('selected');
    document.getElementById('avatarSeleccionado').value = url;
    document.getElementById('avatarTipo').value = 'predeterminado';
    const preview = document.getElementById('avatarPreview');
    preview.style.display = 'none';
    preview.src = '';
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['jpg','jpeg','png','gif','webp'].includes(ext)) {
        mostrarError('authError', 'Formato no permitido. Usa JPG, PNG o WEBP.');
        return;
    }
    setLoading('btnRegistro', true);
    mostrarError('authError', 'Subiendo imagen...');
    try {
        const storageRef = ref(storage, `temp/${Date.now()}.${ext}`);
        await uploadBytes(storageRef, file);
        const publicUrl = await getDownloadURL(storageRef);
        document.getElementById('avatarSeleccionado').value = publicUrl;
        document.getElementById('avatarTipo').value = 'subido';
        const preview = document.getElementById('avatarPreview');
        preview.src = publicUrl;
        preview.style.display = 'block';
        document.querySelectorAll('#avatarGrid .avatar-opcion').forEach(d => d.classList.remove('selected'));
        mostrarError('authError', '');
    } catch (err) {
        mostrarError('authError', 'Error subiendo imagen: ' + err.message);
    }
    setLoading('btnRegistro', false);
}

async function handleLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    mostrarError('authError', '');
    setLoading('btnLogin', true);
    try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        usuarioActual = cred.user;
        perfilActual  = await fetchPerfil(cred.user.uid);
        irAlLobby();
    } catch (err) {
        mostrarError('authError', traducirError(err.code));
    }
    setLoading('btnLogin', false);
}

async function handleRegistro(e) {
    e.preventDefault();
    const username  = document.getElementById('regUsername').value.trim();
    const email     = document.getElementById('regEmail').value.trim();
    const password  = document.getElementById('regPassword').value;
    const avatarUrl = document.getElementById('avatarSeleccionado').value;
    const avatarTipo = document.getElementById('avatarTipo').value;
    mostrarError('authError', '');

    if (username.length < 3) { mostrarError('authError', 'Username mínimo 3 caracteres'); return; }

    setLoading('btnRegistro', true);
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Crear perfil en Firestore
        await setDoc(doc(db, 'perfiles', cred.user.uid), {
            username,
            avatar_url: avatarUrl,
            avatar_tipo: avatarTipo,
            victorias: 0,
            derrotas: 0,
            empates: 0,
            partidas: 0,
            createdAt: Date.now()
        });
        usuarioActual = cred.user;
        perfilActual  = await fetchPerfil(cred.user.uid);
        irAlLobby();
    } catch (err) {
        mostrarError('authError', traducirError(err.code));
    }
    setLoading('btnRegistro', false);
}

function irAlLobby() {
    mostrarPantalla('screenLobby');
    cargarLobby();
    actualizarHeaderUsuario();
}

export function actualizarHeaderUsuario() {
    const p = perfilActual;
    if (!p) return;
    const el = document.getElementById('headerUsuario');
    if (!el) return;
    el.innerHTML = `
        <img src="${p.avatar_url || AVATARES[0].url}" class="header-avatar" alt="${p.username}">
        <span>${p.username}</span>
    `;
    el.onclick = () => { if (_onAvatarClick) _onAvatarClick(); };
}

export async function cerrarSesion() {
    const btn = document.getElementById('btnSalir');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    try { await signOut(auth); } catch (e) { console.warn('Error al cerrar sesión:', e); }
    usuarioActual = null;
    perfilActual  = null;
    if (btn) { btn.disabled = false; btn.textContent = 'Salir'; }
    mostrarPantalla('screenAuth');
}

export async function cambiarPassword(nueva) {
    await updatePassword(auth.currentUser, nueva);
}

function mostrarError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
}

function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled     = loading;
    btn.style.opacity = loading ? '0.7' : '1';
}

function traducirError(code) {
    const map = {
        'auth/invalid-credential':       'Correo o contraseña incorrectos',
        'auth/user-not-found':           'Correo o contraseña incorrectos',
        'auth/wrong-password':           'Correo o contraseña incorrectos',
        'auth/email-already-in-use':     'Este correo ya está registrado',
        'auth/weak-password':            'La contraseña debe tener al menos 6 caracteres',
        'auth/invalid-email':            'Correo inválido',
        'auth/too-many-requests':        'Demasiados intentos. Espera un momento',
    };
    return map[code] || code;
}
