(function () {
    const isMobile = ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0) ||
                     window.matchMedia('(pointer: coarse)').matches;
    if (!isMobile) return;
    const style = document.createElement('style');
    style.innerHTML = `
        #virtual_controls {
            position: fixed !important;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 2147483646 !important;
            pointer-events: none !important;
            touch-action: none;
            transition: opacity 0.2s ease;
            overflow: hidden;
            display: flex !important;
        }
        #virtual_controls.hidden {
            opacity: 0;
            visibility: hidden;
        }
        #joystick_base {
            position: absolute;
            bottom: 60px;
            left: 28px;
            width: 110px;
            height: 110px;
            background: rgba(255, 255, 255, 0.15);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            pointer-events: auto !important;
            display: flex;
            align-items: center;
            justify-content: center;
            touch-action: none;
        }
        #joystick_stick {
            width: 48px;
            height: 48px;
            background: rgba(255, 255, 255, 0.85);
            border-radius: 50%;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            position: absolute;
            will-change: transform;
        }
        #action_buttons {
            position: absolute;
            bottom: 60px;
            right: 24px;
            width: 155px;
            height: 155px;
            pointer-events: auto !important;
        }
        .action-btn {
            position: absolute;
            width: 54px;
            height: 54px;
            background: rgba(255, 255, 255, 0.22);
            border: 2px solid rgba(255, 255, 255, 0.45);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(0,0,0,0.35);
            user-select: none;
            font-size: 18px;
            font-weight: bold;
            color: #ffffff;
            text-shadow: 0 1px 2px rgba(0,0,0,0.6);
            pointer-events: auto !important;
        }
        .action-btn:active, .action-btn.active {
            background: rgba(255, 255, 255, 0.55);
            transform: scale(0.92);
        }
        #btn_drift {
            top: 0px;
            left: 48px;
        }
        #btn_backview {
            top: 50px;
            left: 0px;
        }
        #btn_fire {
            bottom: 0px;
            right: 0px;
        }
        #toggle_btn {
            position: fixed !important;
            top: 10px;
            right: 10px;
            z-index: 2147483647 !important;
            width: 34px;
            height: 34px;
            background: rgba(0, 0, 0, 0.4);
            border: 2px solid rgba(255, 255, 255, 0.4);
            border-radius: 8px;
            cursor: pointer;
            display: flex !important;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            user-select: none;
            pointer-events: auto !important;
        }
        #toggle_btn svg {
            width: 16px;
            height: 16px;
            fill: #ffffff;
            transition: transform 0.2s ease;
        }
        #toggle_btn.collapsed svg {
            transform: rotate(180deg);
        }
    `;
    document.head.appendChild(style);
    function createControlsDOM() {
        if (document.getElementById('virtual_controls')) return;
        const controlsDiv = document.createElement('div');
        controlsDiv.id = 'virtual_controls';
        controlsDiv.innerHTML = `
            <div id="joystick_base">
                <div id="joystick_stick"></div>
            </div>
            <div id="action_buttons">
                <div id="btn_drift" class="action-btn">V</div>
                <div id="btn_backview" class="action-btn">B</div>
                <div id="btn_fire" class="action-btn"></div>
            </div>
        `;
        document.body.appendChild(controlsDiv);
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'toggle_btn';
        toggleBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>`;
        document.body.appendChild(toggleBtn);
    }
    function sendKeyEvent(type, key, code) {
        const event = new KeyboardEvent(type, {
            key: key,
            code: code,
            bubbles: true,
            cancelable: true,
            composed: true
        });
        window.dispatchEvent(event);
    }
    function setupActionButton(elementId, key, code) {
        const btn = document.getElementById(elementId);
        if (!btn) return;
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.classList.add('active');
            sendKeyEvent('keydown', key, code);
        });
        const release = (e) => {
            e.preventDefault();
            if (btn.classList.contains('active')) {
                btn.classList.remove('active');
                sendKeyEvent('keyup', key, code);
            }
        };
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointerleave', release);
        btn.addEventListener('pointercancel', release);
    }
    let vLocked = false;
    function setupToggleButton(elementId, key, code) {
        const btn = document.getElementById(elementId);
        if (!btn) return;
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (vLocked) return;
            vLocked = true;
            btn.classList.add('active');
            sendKeyEvent('keydown', key, code);
            setTimeout(() => {
                btn.classList.remove('active');
                vLocked = false;
            }, 400);
        }, { passive: false });
    }
    function setupVirtualJoystick() {
        const base = document.getElementById('joystick_base');
        const stick = document.getElementById('joystick_stick');
        if (!base || !stick) return;
        const maxDist = 32;
        let activePointerId = null;
        let currentKeys = { w: false, s: false, a: false, d: false };
        let centerX = 0;
        let centerY = 0;
        let rafId = null;
        let lastClientX = 0;
        let lastClientY = 0;
        const updateKeys = (newKeys) => {
            const keyMap = {
                w: { key: 'w', code: 'KeyW' },
                s: { key: 's', code: 'KeyS' },
                a: { key: 'a', code: 'KeyA' },
                d: { key: 'd', code: 'KeyD' }
            };
            ['w', 's', 'a', 'd'].forEach(k => {
                if (currentKeys[k] !== newKeys[k]) {
                    currentKeys[k] = newKeys[k];
                    sendKeyEvent(newKeys[k] ? 'keydown' : 'keyup', keyMap[k].key, keyMap[k].code);
                }
            });
        };
        base.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (activePointerId !== null) return;
            activePointerId = e.pointerId;
            base.setPointerCapture(activePointerId);
            const rect = base.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;
            lastClientX = e.clientX;
            lastClientY = e.clientY;
            processMove();
        }, { passive: false });
        base.addEventListener('pointermove', (e) => {
            if (e.pointerId !== activePointerId) return;
            lastClientX = e.clientX;
            lastClientY = e.clientY;
            if (!rafId) {
                rafId = requestAnimationFrame(() => {
                    processMove();
                    rafId = null;
                });
            }
        }, { passive: true });
        const handleUp = (e) => {
            if (e.pointerId !== activePointerId) return;
            resetJoystick();
        };
        base.addEventListener('pointerup', handleUp);
        base.addEventListener('pointercancel', handleUp);
        function processMove() {
            let dx = lastClientX - centerX;
            let dy = lastClientY - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
            }
            stick.style.transform = `translate(${dx}px, ${dy}px)`;
            const threshold = 10;
            const newKeys = {
                w: dy < -threshold,
                s: dy > threshold,
                a: dx < -threshold,
                d: dx > threshold
            };
            updateKeys(newKeys);
        }
        function resetJoystick() {
            activePointerId = null;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            stick.style.transform = 'translate(0px, 0px)';
            updateKeys({ w: false, s: false, a: false, d: false });
        }
    }
    window.addEventListener('DOMContentLoaded', () => {
        createControlsDOM();
        setupVirtualJoystick();
        setupToggleButton('btn_drift', 'v', 'KeyV');
        setupActionButton('btn_backview', 'b', 'KeyB');
        setupActionButton('btn_fire', ' ', 'Space');
        const toggleBtn = document.getElementById('toggle_btn');
        const virtualControls = document.getElementById('virtual_controls');
        if (toggleBtn && virtualControls) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleBtn.classList.toggle('collapsed');
                virtualControls.classList.toggle('hidden');
            });
        }
    });
})();
