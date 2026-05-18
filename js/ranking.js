import { db } from './firebase.js';
import {
    collection, getDocs, query, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { mostrarPantalla } from './router.js';

export async function cargarRanking() {
    mostrarPantalla('screenRanking');
    const tabla = document.getElementById('rankingTabla');
    tabla.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">Cargando...</td></tr>';

    try {
        const q = query(
            collection(db, 'perfiles'),
            orderBy('victorias', 'desc'),
            limit(20)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            tabla.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">Sin datos aún</td></tr>';
            return;
        }

        const data = snap.docs.map(d => d.data());
        tabla.innerHTML = data.map((p, i) => `
            <tr class="${i === 0 ? 'rank-oro' : i === 1 ? 'rank-plata' : i === 2 ? 'rank-bronce' : ''}">
                <td class="rank-pos">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                <td class="rank-jugador">
                    <img src="${p.avatar_url || 'https://api.dicebear.com/7.x/adventurer/svg?seed=default'}" class="rank-avatar">
                    ${p.username}
                </td>
                <td class="rank-v" style="color:#4ade80">${p.victorias || 0}</td>
                <td class="rank-e" style="color:#facc15">${p.empates   || 0}</td>
                <td class="rank-d" style="color:#f87171">${p.derrotas  || 0}</td>
            </tr>
        `).join('');
    } catch (err) {
        tabla.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#f87171">Error: ${err.message}</td></tr>`;
    }
}
