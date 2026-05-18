/**
 * ui.js — Monta todas las pantallas en el body.
 * Modulariza el HTML que antes estaba en index.html.
 */

const LOGO = 'https://res.cloudinary.com/dipv76dpn/image/upload/v1776627650/a_agregemos_el_X_l_O_d_r0nubi.png';

function screenAuth() {
    return `
<div class="screen active" id="screenAuth">
    <div class="auth-hero">
        <img src="${LOGO}" alt="Tres Online" class="auth-logo">
        <div class="auth-title">TRES ONLINE</div>
        <div class="auth-sub">El clásico juego, ahora en tiempo real</div>

        <!-- Tablero animado decorativo -->
        <div class="auth-tablero-preview" aria-hidden="true">
            <div class="atp-cell" id="atp0"></div>
            <div class="atp-cell" id="atp1"></div>
            <div class="atp-cell" id="atp2"></div>
            <div class="atp-cell" id="atp3"></div>
            <div class="atp-cell" id="atp4"></div>
            <div class="atp-cell" id="atp5"></div>
            <div class="atp-cell" id="atp6"></div>
            <div class="atp-cell" id="atp7"></div>
            <div class="atp-cell" id="atp8"></div>
        </div>

        <!-- Top 3 jugadores en vivo -->
        <div class="auth-top3" id="authTop3">
            <div class="auth-top3-titulo">🏆 Top jugadores</div>
            <div class="auth-top3-lista" id="authTop3Lista">
                <div class="auth-top3-loading">Cargando...</div>
            </div>
        </div>

        <!-- Stats globales -->
        <div class="auth-stats-globales" id="authStatsGlobales"></div>
    </div>

    <div class="auth-card">
        <div class="tabs">
            <button class="tab-btn tab-active" id="tabLogin">Iniciar sesión</button>
            <button class="tab-btn" id="tabRegistro">Registrarse</button>
        </div>
        <form id="formLogin">
            <div class="form-group">
                <label for="loginEmail">Correo</label>
                <input type="email" id="loginEmail" placeholder="tu@correo.com" autocomplete="email" required>
            </div>
            <div class="form-group">
                <label for="loginPassword">Contraseña</label>
                <input type="password" id="loginPassword" placeholder="••••••••" autocomplete="current-password" required>
            </div>
            <button type="submit" class="btn-primary" id="btnLogin">Entrar</button>
        </form>
        <form id="formRegistro" style="display:none">
            <div class="form-group">
                <label for="regUsername">Nombre de usuario</label>
                <input type="text" id="regUsername" placeholder="jugador123" autocomplete="username" required minlength="3">
            </div>
            <div class="form-group">
                <label for="regEmail">Correo</label>
                <input type="email" id="regEmail" placeholder="tu@correo.com" autocomplete="email" required>
            </div>
            <div class="form-group">
                <label for="regPassword">Contraseña</label>
                <input type="password" id="regPassword" placeholder="mínimo 6 caracteres" autocomplete="new-password" required minlength="6">
            </div>
            <div class="form-group">
                <label>Elige tu avatar</label>
                <div class="avatar-grid" id="avatarGrid"></div>
                <label class="avatar-upload-label">
                    📷 Subir foto
                    <input type="file" id="inputAvatarUpload" accept="image/*" style="display:none">
                </label>
                <img id="avatarPreview" alt="preview">
                <input type="hidden" id="avatarSeleccionado">
                <input type="hidden" id="avatarTipo">
            </div>
            <button type="submit" class="btn-primary" id="btnRegistro">Crear cuenta</button>
        </form>
        <div class="auth-error" id="authError" role="alert"></div>
    </div>
</div>`;
}


function screenLobby() {
    return `
<div class="screen" id="screenLobby">
    <div class="top-bar">
        <div class="header-usuario" id="headerUsuario" role="button" tabindex="0" aria-label="Ver perfil"></div>
        <div class="lobby-brand">
            <img src="${LOGO}" alt="Tres Online" class="lobby-logo">
            <span class="lobby-brand-name">TRES ONLINE</span>
        </div>
        <div class="top-bar-btns">
            <button class="btn-icon" id="btnRanking" aria-label="Ver ranking">🏆</button>
            <button class="btn-icon btn-salir" id="btnSalir" aria-label="Cerrar sesión">Salir</button>
        </div>
    </div>
    <div class="lobby-title">Salas</div>
    <div class="lobby-sub">Elige una sala disponible para jugar</div>
    <div class="salas-grid" id="salasGrid" role="list"></div>
    <div style="text-align:center; margin-top:12px">
        <button class="btn-reset-salas" id="btnResetSalas" title="Limpia jugadores desconectados">
            🔄 Limpiar salas
        </button>
    </div>
</div>`;
}

function screenJuego() {
    return `
<div class="screen" id="screenJuego">
    <div class="container">
        <div class="game-header">
            <button class="btn-volver" id="btnVolver" aria-label="Volver al lobby">← Lobby</button>
            <div class="game-title-wrap">
                <img src="${LOGO}" alt="Tres Online" class="game-logo">
                <h1>TRES ONLINE</h1>
            </div>
            <div class="sala-id-label" id="salaLabel">Sala 1</div>
        </div>
        <div class="marcador" role="status" aria-live="polite">
            <div class="marcador-item">
                <div class="marcador-label">X gana</div>
                <div class="marcador-valor x" id="puntosX">0</div>
            </div>
            <div class="marcador-sep" aria-hidden="true">|</div>
            <div class="marcador-item">
                <div class="marcador-label">Empates</div>
                <div class="marcador-valor empate" id="puntosEmpate">0</div>
            </div>
            <div class="marcador-sep" aria-hidden="true">|</div>
            <div class="marcador-item">
                <div class="marcador-label">O gana</div>
                <div class="marcador-valor o" id="puntosO">0</div>
            </div>
        </div>

        <!-- Temporizador de turno -->
        <div class="turno-timer-wrap" id="turnoTimerWrap" style="display:none">
            <svg class="turno-timer-svg" viewBox="0 0 36 36" aria-hidden="true">
                <circle class="turno-timer-bg" cx="18" cy="18" r="15.9"/>
                <circle class="turno-timer-arc" id="turnoTimerArc" cx="18" cy="18" r="15.9"
                    stroke-dasharray="100 100" stroke-dashoffset="0"/>
            </svg>
            <span class="turno-timer-num" id="turnoTimerNum">15</span>
        </div>

        <div class="estado" id="estado" role="status" aria-live="polite">Conectando...</div>
        <div class="reinicio-auto" id="reinicioAuto" aria-live="polite"></div>
        <div class="tablero" id="tablero" role="grid" aria-label="Tablero de juego"></div>
        <button id="reiniciar" class="btn-reiniciar">Reiniciar partida</button>
        <div class="logs-area" id="logsPanel" aria-label="Registro de eventos">
            <div class="log-entry">Iniciando...</div>
        </div>
    </div>
</div>`;
}

function screenPerfil() {
    return `
<div class="screen" id="screenPerfil">
    <div class="top-bar">
        <button class="btn-icon" id="btnVolverPerfil" aria-label="Volver al lobby">← Lobby</button>
        <div class="ranking-title">👤 Mi Perfil</div>
        <div style="width:70px"></div>
    </div>
    <div class="perfil-card">
        <div class="perfil-avatar-wrap">
            <img id="perfilAvatarActual" src="" alt="Tu avatar" class="perfil-avatar-grande">
            <div class="perfil-username-display" id="perfilUsernameDisplay"></div>
            <label class="perfil-cambiar-foto">
                📷 Cambiar foto
                <input type="file" id="inputAvatarPerfil" accept="image/*" style="display:none">
            </label>
        </div>
        <div class="perfil-stats" id="perfilStats"></div>
        <div class="form-group" style="margin-top:12px">
            <label>O elige un avatar</label>
            <div id="avatarGridPerfil"></div>
        </div>
        <input type="hidden" id="perfilAvatarUrl">
        <form id="formPerfil">
            <div class="form-group">
                <label for="perfilUsername">Nombre de usuario</label>
                <input type="text" id="perfilUsername" required minlength="3" autocomplete="username">
            </div>
            <div class="form-group">
                <label for="perfilEmail">Correo (no editable)</label>
                <input type="email" id="perfilEmail" disabled style="opacity:0.5" autocomplete="email">
            </div>
            <button type="submit" class="btn-primary">Guardar cambios</button>
        </form>
        <div class="auth-error" id="perfilMsg" role="alert"></div>
        <div class="perfil-seccion">
            <div class="perfil-seccion-titulo">Cambiar contraseña</div>
            <form id="formCambiarClave">
                <div class="form-group">
                    <label for="nuevaClave">Nueva contraseña</label>
                    <input type="password" id="nuevaClave" placeholder="mínimo 6 caracteres" minlength="6" autocomplete="new-password" required>
                </div>
                <div class="form-group">
                    <label for="confirmarClave">Confirmar contraseña</label>
                    <input type="password" id="confirmarClave" placeholder="repite la contraseña" autocomplete="new-password" required>
                </div>
                <button type="submit" class="btn-primary">Actualizar contraseña</button>
            </form>
            <div class="auth-error" id="claveMsg" role="alert"></div>
        </div>
    </div>
</div>`;
}

function screenRanking() {
    return `
<div class="screen" id="screenRanking">
    <div class="top-bar">
        <button class="btn-icon" id="btnVolverLobby" aria-label="Volver al lobby">← Lobby</button>
        <div class="ranking-title">🏆 Ranking Global</div>
        <div style="width:70px"></div>
    </div>
    <div class="ranking-card">
        <table class="ranking-table" aria-label="Tabla de ranking global">
            <thead>
                <tr>
                    <th scope="col">#</th>
                    <th scope="col">Jugador</th>
                    <th scope="col">✅ V</th>
                    <th scope="col">🤝 E</th>
                    <th scope="col">❌ D</th>
                </tr>
            </thead>
            <tbody id="rankingTabla"></tbody>
        </table>
    </div>
</div>`;
}

/** Monta todas las pantallas en el body */
export function montarUI() {
    document.body.insertAdjacentHTML('afterbegin',
        screenAuth() +
        screenLobby() +
        screenJuego() +
        screenPerfil() +
        screenRanking()
    );
    iniciarTableroAnimado();
    cargarDatosPublicos();
}

// ── Tablero animado en la pantalla de inicio ──────────────────────────────────
const PARTIDAS_DEMO = [
    ['X','O','X', 'O','X','O', '','O','X'],   // X gana diagonal
    ['O','X','O', 'X','X','O', 'X','O','X'],   // tablero lleno
    ['X','','X',  '','X','',  'O','O','X'],    // X gana columna
];

function iniciarTableroAnimado() {
    let partidaIdx = 0;
    let paso = 0;
    const orden = [4,0,8,2,6,1,3,5,7]; // orden de llenado

    function tick() {
        const tablero = PARTIDAS_DEMO[partidaIdx];
        const celdas = document.querySelectorAll('.atp-cell');
        if (!celdas.length) return;

        if (paso === 0) {
            celdas.forEach(c => { c.textContent = ''; c.className = 'atp-cell'; });
        }

        if (paso < 9) {
            const idx = orden[paso];
            const val = tablero[idx];
            if (val) {
                celdas[idx].textContent = val;
                celdas[idx].classList.add(val.toLowerCase());
            }
            paso++;
            setTimeout(tick, 500);
        } else {
            // Pausa antes de la siguiente partida
            paso = 0;
            partidaIdx = (partidaIdx + 1) % PARTIDAS_DEMO.length;
            setTimeout(tick, 2000);
        }
    }
    setTimeout(tick, 800);
}

// ── Top 3 y stats globales desde Firebase ────────────────────────────────────
async function cargarDatosPublicos() {
    const { db } = await import('./firebase.js');
    const { collection, getDocs, query, orderBy, limit } =
        await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    // Top 3 jugadores
    try {
        const q    = query(collection(db, 'perfiles'), orderBy('victorias', 'desc'), limit(3));
        const snap = await getDocs(q);
        const top  = snap.docs.map(d => d.data());
        const lista = document.getElementById('authTop3Lista');
        if (lista && top.length) {
            const medallas = ['🥇','🥈','🥉'];
            lista.innerHTML = top.map((p, i) => `
                <div class="auth-top3-item">
                    <span class="auth-top3-medal">${medallas[i]}</span>
                    <img src="${p.avatar_url || 'https://api.dicebear.com/7.x/adventurer/svg?seed=default'}"
                         class="auth-top3-avatar" alt="${p.username}">
                    <span class="auth-top3-name">${p.username}</span>
                    <span class="auth-top3-v">${p.victorias || 0}V</span>
                </div>
            `).join('');
        } else if (lista) {
            lista.innerHTML = '<div class="auth-top3-loading">Sé el primero en jugar</div>';
        }

        // Stats globales
        const perfilesSnap = await getDocs(collection(db, 'perfiles'));
        const salasSnap    = await getDocs(collection(db, 'juegos'));
        let totalPartidas  = 0;
        salasSnap.forEach(d => {
            const sc = d.data().scores || {};
            totalPartidas += (sc.x || 0) + (sc.o || 0) + (sc.empate || 0);
        });

        const statsEl = document.getElementById('authStatsGlobales');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="auth-stat-item">
                    <span class="auth-stat-val">${perfilesSnap.size}</span>
                    <span class="auth-stat-lbl">Jugadores</span>
                </div>
                <div class="auth-stat-sep">·</div>
                <div class="auth-stat-item">
                    <span class="auth-stat-val">${totalPartidas}</span>
                    <span class="auth-stat-lbl">Partidas jugadas</span>
                </div>
                <div class="auth-stat-sep">·</div>
                <div class="auth-stat-item">
                    <span class="auth-stat-val">6</span>
                    <span class="auth-stat-lbl">Salas activas</span>
                </div>
            `;
        }
    } catch (e) {
        console.warn('cargarDatosPublicos:', e);
    }
}
