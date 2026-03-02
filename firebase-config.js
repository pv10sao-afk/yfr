// ========== FIREBASE-CONFIG.JS ==========
// ES-модуль. Ініціалізує Firebase і виставляє об'єкти глобально.
//
// ВИПРАВЛЕННЯ (Issue #3 — змішання ES-модулів і звичайних скриптів):
//
//   Проблема: звичайні скрипти (game.js, progression.js) використовують
//   window.db / window._fs / window.auth, але якщо цей модуль ще не завершив
//   завантаження — вони отримують undefined і падають мовчки.
//
//   Рішення: window.firebaseReady — Promise, який дозволяє будь-якому
//   звичайному скрипту дочекатись Firebase перед використанням:
//
//     await window.firebaseReady;    // чекаємо
//     const db = window.db;          // тепер гарантовано існує
//
//   Якщо Firebase не вдалось ініціалізувати (CDN недоступний, невірний config,
//   тощо) — window.firebaseError буде рядком з описом помилки,
//   а window.firebaseReady відхилиться (reject).
//   Решта гри продовжує працювати в офлайн-режимі (тільки localStorage).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    collection, query, where,
    getDocs, addDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ======= Змінні на верхньому рівні модуля — export працює тільки звідси =======
// export не можна робити всередині try/catch, if або будь-якого блоку.
// Тому оголошуємо auth/db як let на верхньому рівні, заповнюємо в try.
let auth = null;
let db   = null;

export { auth, db };

// ======= Промис, який резолвиться коли Firebase готовий =======
let _resolveFirebase;
let _rejectFirebase;

window.firebaseReady = new Promise((resolve, reject) => {
    _resolveFirebase = resolve;
    _rejectFirebase  = reject;
});

// ======= Ініціалізація =======
try {
    const firebaseConfig = {
        apiKey:            "AIzaSyALVXdZPBn1_LBKlzhJPz2eMJ87uBzeysU",
        authDomain:        "project-ddb00f97-a506-4988-958.firebaseapp.com",
        projectId:         "project-ddb00f97-a506-4988-958",
        storageBucket:     "project-ddb00f97-a506-4988-958.appspot.com",
        messagingSenderId: "324508447335",
        appId:             "1:324508447335:web:7211c48a5444ce0b791ac2"
    };

    const app = initializeApp(firebaseConfig);
    // Присвоюємо у верхньорівневі змінні — export підхопить ці значення
    auth = getAuth(app);
    db   = getFirestore(app);

    // ======= Виставляємо глобально для не-модульних скриптів =======
    window.db   = db;
    window.auth = auth;
    window._fs  = { collection, query, where, getDocs, addDoc, deleteDoc, doc };

    // Firebase ініціалізовано — сповіщаємо всіх очікувачів
    window.firebaseError = null;
    _resolveFirebase({ auth, db });

    if (window.DEBUG) console.log('[firebase] Initialized ✅');

} catch (err) {
    // Firebase не вдалось ініціалізувати
    const msg = `[firebase] Init failed: ${err.message}`;
    console.error(msg);

    window.firebaseError = msg;
    window.db   = null;
    window.auth = null;
    window._fs  = null;

    // Відхиляємо промис — auth.js та інші можуть обробити це
    _rejectFirebase(new Error(msg));

    // Показуємо toast якщо ui.js вже завантажений, або чекаємо DOMContentLoaded
    const showOfflineNotice = () => {
        if (typeof window.showToast === 'function') {
            window.showToast('⚠️ Хмарне збереження недоступне. Дані зберігаються локально.', 'warning', '⚠️', 6000);
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showOfflineNotice);
    } else {
        setTimeout(showOfflineNotice, 500); // невелика затримка щоб ui.js встиг завантажитись
    }
}
