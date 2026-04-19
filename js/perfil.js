import { supabase } from './supabase.js';
import { mostrarPantalla } from './router.js';
import { getPerfil, getUsuario, AVATARES, actualizarHeaderUsuario } from './auth.js';
import { cargarLobby } from './lobby.js';

export function initPerfil() {
    document.getElementById('btnVolverPerfil').addEventListener('click', () => {
        mostrarPantalla('screenLobby');
        cargarLobby();
    });
    document.getElementById('formPerfil').addEventListener('submit', handleGuardarPerfil);
    document.getElementById('formCambiarClave').addEventListener('submit', handleCambiarClave);
    document.getElementById('inputAvatarPerfil').addEventListener('change', handleUploadAvatarPerfil);
}

export function abrirPerfil() {
    const p = getPerfil();
    if (!p) return;

    document.getElementById('perfilUsername').value = p.username || '';
    document.getElementById('perfilEmail').value = getUsuario()?.email || '';
    document.getElementById('perfilAvatarActual').src = p.avatar_url || AVATARES[0].url;
    document.getElementById('perfilAvatarUrl').value = p.avatar_url || '';
    document.getElementById('perfilMsg').textContent = '';
    document.getElementById('claveMsg').textContent = '';

    // Render avatares predeterminados
    const grid = document.getElementById('avatarGridPerfil');
    grid.innerHTML = '';
    AVATARES.forEach(av => {
        const div = document.createElement('div');
        div.classList.add('avatar-opcion');
        if (av.url === p.avatar_url) div.classList.add('selected');
        div.innerHTML = `<img src="${av.url}" alt="${av.label}" title="${av.label}">`;
        div.addEventListener('click', () => {
            document.querySelectorAll('#avatarGridPerfil .avatar-opcion').forEach(d => d.classList.remove('selected'));
            div.classList.add('selected');
            document.getElementById('perfilAvatarUrl').value = av.url;
            document.getElementById('perfilAvatarActual').src = av.url;
        });
        grid.appendChild(div);
    });

    mostrarPantalla('screenPerfil');
}

async function handleUploadAvatarPerfil(e) {
    const file = e.target.files[0];
    if (!file) return;
    const uid = getUsuario()?.id;
    if (!uid) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowed.includes(ext)) {
        document.getElementById('perfilMsg').textContent = 'Formato no permitido. Usa JPG, PNG o WEBP.';
        return;
    }

    document.getElementById('perfilMsg').textContent = 'Subiendo imagen...';
    const path = `${uid}/avatar.${ext}`;
    const { data, error } = await supabase.storage
        .from('avatares')
        .upload(path, file, { upsert: true, contentType: file.type });

    if (error) {
        document.getElementById('perfilMsg').textContent = 'Error al subir: ' + error.message;
        return;
    }

    const { data: urlData } = supabase.storage.from('avatares').getPublicUrl(data.path);
    // Forzar cache bust
    const publicUrl = urlData.publicUrl + '?t=' + Date.now();
    document.getElementById('perfilAvatarUrl').value = publicUrl;
    document.getElementById('perfilAvatarActual').src = publicUrl;
    document.querySelectorAll('#avatarGridPerfil .avatar-opcion').forEach(d => d.classList.remove('selected'));
    document.getElementById('perfilMsg').textContent = 'Imagen lista. Guarda los cambios.';
}

async function handleGuardarPerfil(e) {
    e.preventDefault();
    const username = document.getElementById('perfilUsername').value.trim();
    const avatarUrl = document.getElementById('perfilAvatarUrl').value;
    const msgEl = document.getElementById('perfilMsg');

    if (username.length < 3) { msgEl.textContent = 'Username mínimo 3 caracteres'; return; }
    msgEl.textContent = 'Guardando...';

    const perfil = getPerfil();
    const { error } = await supabase.from('perfiles').update({
        username,
        avatar_url: avatarUrl
    }).eq('id', perfil.id);

    if (error) { msgEl.textContent = 'Error: ' + error.message; return; }

    // Actualizar perfil local
    perfil.username = username;
    perfil.avatar_url = avatarUrl;
    actualizarHeaderUsuario();
    msgEl.style.color = '#4ade80';
    msgEl.textContent = '✅ Perfil actualizado';
    setTimeout(() => { msgEl.style.color = ''; msgEl.textContent = ''; }, 2500);
}

async function handleCambiarClave(e) {
    e.preventDefault();
    const nueva = document.getElementById('nuevaClave').value;
    const confirmar = document.getElementById('confirmarClave').value;
    const msgEl = document.getElementById('claveMsg');

    if (nueva.length < 6) { msgEl.textContent = 'Mínimo 6 caracteres'; return; }
    if (nueva !== confirmar) { msgEl.textContent = 'Las claves no coinciden'; return; }

    msgEl.textContent = 'Actualizando...';
    const { error } = await supabase.auth.updateUser({ password: nueva });

    if (error) { msgEl.textContent = 'Error: ' + error.message; return; }

    msgEl.style.color = '#4ade80';
    msgEl.textContent = '✅ Contraseña actualizada';
    document.getElementById('nuevaClave').value = '';
    document.getElementById('confirmarClave').value = '';
    setTimeout(() => { msgEl.style.color = ''; msgEl.textContent = ''; }, 2500);
}
