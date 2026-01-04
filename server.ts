import { openSync, writeSync } from "node:fs";

// --- SETTINGS ---
const EVENT_NODE = "/dev/input/event10";
const PORT = 8000;

// Linux Event Codes
const EV_KEY = 1;
const EV_REL = 2;
const REL_X = 0;
const REL_Y = 1;
const REL_WHEEL = 8;

const KEY_MAP: Record<string, number> = {
  "Enter": 28, "Backspace": 14, "Tab": 15, "Space": 57,
  "ArrowLeft": 105, "ArrowUp": 103, "ArrowRight": 106, "ArrowDown": 108,
  "Homepage": 172, "VolumeUp": 115, "VolumeDown": 114,
  "a": 30, "b": 48, "c": 46, "d": 32, "e": 18, "f": 33, "g": 34, "h": 35,
  "i": 23, "j": 36, "k": 37, "l": 38, "m": 50, "n": 49, "o": 24, "p": 25,
  "q": 16, "r": 19, "s": 31, "t": 20, "u": 22, "v": 47, "w": 17, "x": 45,
  "y": 21, "z": 44, "1": 2, "2": 3, "3": 4, "4": 5, "6": 7, "7": 8, "8": 9, "9": 10, "0": 11
};

const MOUSE_MAP: Record<string, number> = { "0": 272, "2": 273 };

let fd: number;
try {
  fd = openSync(EVENT_NODE, "w");
} catch (e) {
  console.error(`ERROR: Could not open ${EVENT_NODE}. Use 'sudo bun remote.ts'`);
  process.exit(1);
}

function injectEvent(type: number, code: number, value: number) {
  const buf = Buffer.alloc(24);
  buf.writeUInt16LE(type, 16);
  buf.writeUInt16LE(code, 18);
  buf.writeInt32LE(value, 20);
  const syn = Buffer.alloc(24);
  try {
    writeSync(fd, buf);
    writeSync(fd, syn);
  } catch (e) {
    console.error("Injection Error:", e);
  }
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    const params = url.searchParams;

    if (url.pathname === "/move") {
      injectEvent(EV_REL, REL_X, parseInt(params.get("x") || "0"));
      injectEvent(EV_REL, REL_Y, parseInt(params.get("y") || "0"));
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/scroll") {
      // Logic: standard mouse wheel events are usually 1 or -1
      injectEvent(EV_REL, REL_WHEEL, parseInt(params.get("y") || "0"));
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/click") {
      const btn = params.get("b") || "";
      const state = parseInt(params.get("s") || "0");
      if (MOUSE_MAP[btn] !== undefined) injectEvent(EV_KEY, MOUSE_MAP[btn], state);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/key") {
      const key = params.get("k") || "";
      if (KEY_MAP[key] !== undefined) {
        injectEvent(EV_KEY, KEY_MAP[key], 1);
        injectEvent(EV_KEY, KEY_MAP[key], 0);
      }
      return new Response(null, { status: 204 });
    }
    return new Response(HTML, { headers: { "Content-Type": "text/html" } });
  },
});

console.log(`🚀 Chromeo Remote running on port ${PORT}`);

const HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>Chromeo Remote</title>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500&display=swap" rel="stylesheet">
    <style>
        body {
            background-color: #F8F9FA; font-family: 'Google Sans', Arial, sans-serif;
            margin: 0; display: flex; flex-direction: column; align-items: center;
            justify-content: space-between; height: 100vh; height: 100svh; color: #3C4043; overflow: hidden;
            user-select: none; -webkit-user-select: none; touch-action: none; padding: 20px 0; box-sizing: border-box;
        }
        .header { text-align: center; flex-shrink: 0; }
        .header h1 { font-size: clamp(20px, 6vw, 26px); font-weight: 500; margin: 0; }
        #mode-status { color: #70757A; font-size: 14px; margin-top: 4px; }

        #control-container { width: 90vw; max-width: 400px; height: 60vh; max-height: 450px; position: relative; flex-grow: 1; margin: 15px 0; }

        #trackpad-card, #dpad-card {
            background: white; width: 100%; height: 100%; border-radius: 32px;
            box-shadow: 0 1px 3px rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15);
            position: absolute; top: 0; left: 0;
        }

        #trackpad-card { display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: crosshair; }

        #dpad-card {
            display: grid;
            grid-template-areas:
                ". up ."
                "left ok right"
                ". down ."
                "vdown . vup";
            grid-template-columns: 1fr 1fr 1fr;
            grid-template-rows: 1fr 1fr 1fr 1fr;
            gap: 15px; padding: 20px; box-sizing: border-box;
        }

        .dbtn {
            background: #FFFFFF; border: 1px solid #DADCE0; border-radius: 20px;
            display: flex; align-items: center; justify-content: center; font-size: 24px;
            color: #5F6368; box-shadow: 0 3px 0 #DADCE0; cursor: pointer;
        }
        .dbtn:active { background: #F1F3F4; transform: translateY(2px); box-shadow: none; }

        .up { grid-area: up; } .down { grid-area: down; } .left { grid-area: left; } .right { grid-area: right; }
        .ok { grid-area: ok; border: 2px solid #4285F4; color: #4285F4; border-radius: 50%; font-size: 18px; font-weight: 500; }
        .vol-down { grid-area: vdown; font-size: 16px; font-weight: 500; }
        .vol-up { grid-area: vup; font-size: 16px; font-weight: 500; }

        .instruction { font-weight: 500; color: #1A73E8; pointer-events: none; text-align: center; }
        .footer { display: flex; gap: 20px; flex-shrink: 0; padding-bottom: 10px; }
        .icon-btn {
            background: #E8EAED; width: 60px; height: 60px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center; border: none; cursor: pointer;
        }
        .flash-on { background-color: #E6F4EA !important; color: #1E8E3E !important; }
        .flash-off { background-color: #FCE8E6 !important; color: #D93025 !important; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Chromeo TV</h1>
        <p id="mode-status">Mode</p>
    </div>

    <div id="control-container">
        <div id="trackpad-card">
            <div class="instruction">Tap to Start</div>
        </div>
        <div id="dpad-card" style="display: none;">
            <button class="dbtn up" onclick="sendKey('ArrowUp')">▲</button>
            <button class="dbtn left" onclick="sendKey('ArrowLeft')">◀</button>
            <button class="dbtn ok" onclick="sendKey('Enter')"></button>
            <button class="dbtn right" onclick="sendKey('ArrowRight')">▶</button>
            <button class="dbtn down" onclick="sendKey('ArrowDown')">▼</button>
            <button class="dbtn vol-down" onclick="sendKey('VolumeDown')">VOL -</button>
            <button class="dbtn vol-up" onclick="sendKey('VolumeUp')">VOL +</button>
        </div>
    </div>

    <div class="footer">
        <button class="icon-btn" onclick="sendKey('Homepage')"><svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg></button>
        <button class="icon-btn" onclick="toggleMode()"><svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg></button>
        <button class="icon-btn" id="power-btn" onclick="rotatePower()"><svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/></svg></button>
    </div>

    <script>
        const trackpad = document.getElementById('trackpad-card');
        const dpad = document.getElementById('dpad-card');
        const modeStatus = document.getElementById('mode-status');
        let isTrackpadMode = true;
        let nextIsOn = true;

        function setMode(toTrackpad) {
            isTrackpadMode = toTrackpad;
            if (toTrackpad) {
                trackpad.style.display = 'flex';
                dpad.style.display = 'none';
                modeStatus.innerText = "Control Mode";
            } else {
                trackpad.style.display = 'none';
                dpad.style.display = 'grid';
                modeStatus.innerText = "Button Mode";
                if (document.pointerLockElement) document.exitPointerLock();
            }
        }

        window.addEventListener('load', () => {
            const isPhone = window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
            setMode(!isPhone);
        });

        function toggleMode() { setMode(!isTrackpadMode); }
        function sendKey(key) { fetch(\`/key?k=\${key}\`); }

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (document.pointerLockElement === trackpad) {
                e.preventDefault();
                sendKey(e.key);
            }
        });

        // Trackpad Click Logic
        trackpad.onclick = () => { if(isTrackpadMode) trackpad.requestPointerLock(); };

        // Mouse Move
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === trackpad) fetch(\`/move?x=\${e.movementX}&y=\${e.movementY}\`);
        });

        // Mouse Click
        document.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement === trackpad) fetch(\`/click?b=\${e.button}&s=1\`);
        });
        document.addEventListener('mouseup', (e) => {
            if (document.pointerLockElement === trackpad) fetch(\`/click?b=\${e.button}&s=0\`);
        });

        // Physical Mouse Wheel Scroll
        document.addEventListener('wheel', (e) => {
            if (document.pointerLockElement === trackpad) {
                e.preventDefault();
                // Normalize deltaY: positive scroll sends 1, negative sends -1
                const scrollDir = e.deltaY > 0 ? -1 : 1;
                fetch(\`/scroll?y=\${scrollDir}\`);
            }
        }, { passive: false });

        async function rotatePower() {
            const btn = document.getElementById('power-btn');
            const action = nextIsOn ? 'epg' : 'standby';
            btn.classList.add(nextIsOn ? 'flash-on' : 'flash-off');
            try {
                await fetch(\`https://dj.dunc.app/control/\${action}\`, { method: 'POST', mode: 'no-cors' });
                nextIsOn = !nextIsOn;
            } catch (e) {}
            setTimeout(() => btn.classList.remove('flash-on', 'flash-off'), 800);
        }

        document.addEventListener('pointerlockchange', () => {
            const instr = document.querySelector('.instruction');
            if (document.pointerLockElement === trackpad) {
                instr.innerHTML = "Control Active<br><span style='color: #34A853'>Esc to exit</span>";
            } else {
                instr.innerHTML = "Tap to Start";
            }
        });
    </script>
</body>
</html>
`;
