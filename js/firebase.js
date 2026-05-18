import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

const firebaseConfig = {
    apiKey: "AIzaSyBCY3JdkvbigRMmk3KTyg96ueFmIFJCnOQ",
    authDomain: "tres-enlinea.firebaseapp.com",
    projectId: "tres-enlinea",
    storageBucket: "tres-enlinea.firebasestorage.app",
    messagingSenderId: "966970300421",
    appId: "1:966970300421:web:fa5e4e93412c8cc2ba646c"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
export const storage = getStorage(app);
