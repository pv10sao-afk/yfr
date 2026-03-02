// ========== TUTORIAL.JS ==========
// Туторіал для нових гравців: показується при першому відкритті гри.
// Залежності:
//   - translations.js (TRANSLATIONS, currentLang)
//   - sound.js        (SoundEngine)
// Підключається в index.html ПІСЛЯ ui.js, ПЕРЕД game.js.

// ========== SHOW TUTORIAL ==========

function showTutorial() {
    if (localStorage.getItem('tutorialDone')) return;
    const overlay = document.getElementById('tutorial-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');

    const T = window.TRANSLATIONS[window.currentLang];
    const steps = [
        { icon: '🃏', text: T.tutorialStep1 },
        { icon: '🎯', text: T.tutorialStep2 },
        { icon: '⚔️', text: T.tutorialStep3 },
        { icon: '⏳', text: T.tutorialStep4 }
    ];
    let current = 0;

    function render() {
        overlay.innerHTML = `
            <div class="tutorial-box">
                <h2>${T.tutorialWelcome}</h2>
                <div class="tutorial-icon">${steps[current].icon}</div>
                <p>${steps[current].text}</p>
                <div class="tutorial-steps">
                    ${steps.map((_, i) => `<div class="tutorial-dot ${i === current ? 'active' : ''}"></div>`).join('')}
                </div>
                <div style="display:flex;gap:10px;justify-content:center;margin-top:15px;">
                    <button class="tutorial-btn" id="tutorial-next-btn">${current < steps.length - 1 ? T.tutorialNext : T.tutorialFinish}</button>
                    <button class="tutorial-btn tutorial-skip" id="tutorial-skip-btn">${T.tutorialSkip}</button>
                </div>
            </div>
        `;
        document.getElementById('tutorial-next-btn').onclick = () => {
            window.SoundEngine?.play('click');
            current++;
            if (current >= steps.length) { closeTutorial(); } else { render(); }
        };
        document.getElementById('tutorial-skip-btn').onclick = () => {
            window.SoundEngine?.play('click');
            closeTutorial();
        };
    }

    function closeTutorial() {
        overlay.classList.add('hidden');
        localStorage.setItem('tutorialDone', 'true');
    }

    render();
}

window.showTutorial = showTutorial;

// ========== AUTO-TRIGGER ON FIRST VISIT ==========
// Показуємо туторіал при першому відкритті — одразу на головному меню,
// не чекаючи початку гри.

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('tutorialDone')) {
        // Невелика затримка, щоб усі скрипти ініціалізувались
        setTimeout(showTutorial, 800);
    }
});
