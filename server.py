import struct
import os
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

# --- SETTINGS ---
EVENT_NODE = "/dev/input/event10"
PORT = 8000

# Linux Event Key Mapping for keyboard input injection
KEY_MAP = {
    "Enter": 28, "Backspace": 14, "Tab": 15, "Space": 57,
    "ArrowLeft": 105, "ArrowUp": 103, "ArrowRight": 106, "ArrowDown": 108,
    "Homepage": 172,
    "a": 30, "b": 48, "c": 46, "d": 32, "e": 18, "f": 33, "g": 34, "h": 35,
    "i": 23, "j": 36, "k": 37, "l": 38, "m": 50, "n": 49, "o": 24, "p": 25,
    "q": 16, "r": 19, "s": 31, "t": 20, "u": 22, "v": 47, "w": 17, "x": 45,
    "y": 21, "z": 44, "1": 2, "2": 3, "3": 4, "4": 5, "6": 7, "7": 8, "8": 9, "9": 10, "0":
11
}

MOUSE_MAP = { "0": 272, "2": 273 } # Left and Right click

def inject_event(type, code, value):
    try:
        with open(EVENT_NODE, 'wb') as f:
            # struct.pack format for input_event: time, time, type, code, value
            ev = struct.pack("llHHi", 0, 0, type, code, value)
            syn = struct.pack("llHHi", 0, 0, 0, 0, 0)
            f.write(ev + syn)
    except Exception as e:
        print(f"Injection Error: {e}")

class ControlHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        if self.path.startswith('/move'):
            inject_event(2, 0, int(query.get('x', [0])[0]))
            inject_event(2, 1, int(query.get('y', [0])[0]))
            self.send_response(204); self.end_headers()
        elif self.path.startswith('/click'):
            btn = query.get('b', [''])[0]
            state = int(query.get('s', [0])[0])
            if btn in MOUSE_MAP: inject_event(1, MOUSE_MAP[btn], state)
            self.send_response(204); self.end_headers()
        elif self.path.startswith('/key'):
            key = query.get('k', [''])[0]
            if key in KEY_MAP:
                code = KEY_MAP[key]
                inject_event(1, code, 1); inject_event(1, code, 0)
            self.send_response(204); self.end_headers()
        else:
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(HTML.encode())

HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0,
maximum-scale=1.0, user-scalable=no">
    <title>Chromeo Remote</title>
    <link
href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500&display=swap"
rel="stylesheet">
    <style>
        body {
            background-color: #F8F9FA;
            font-family: 'Google Sans', Arial, sans-serif;
            margin: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            color: #3C4043;
            overflow: hidden;
            user-select: none;
            -webkit-user-select: none;
        }
        .header { margin-bottom: 20px; text-align: center; }
        .header h1 { font-size: 24px; font-weight: 500; margin-bottom: 4px; }
        .header p { color: #70757A; font-size: 14px; margin: 0; }

        #control-container {
            width: 90vw;
            max-width: 400px;
            height: 400px;
            position: relative;
        }

        #trackpad-card, #dpad-card {
            background: white;
            width: 100%;
            height: 100%;
            border-radius: 32px;
            box-shadow: 0 1px 3px rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15);
            position: absolute;
            transition: opacity 0.3s ease, visibility 0.3s;
        }

        #trackpad-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: crosshair;
            z-index: 2;
        }

        #dpad-card {
            display: grid;
            grid-template-areas:
                ". up ."
                "left ok right"
                ". down .";
            grid-template-columns: 1fr 1fr 1fr;
            grid-template-rows: 1fr 1fr 1fr;
            gap: 12px;
            padding: 24px;
            box-sizing: border-box;
            z-index: 1;
            visibility: hidden;
            opacity: 0;
        }

        .dbtn {
            background: #FFFFFF;
            border: 1px solid #DADCE0;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            color: #5F6368;
            transition: all 0.1s;
            box-shadow: 0 2px 0 #DADCE0;
            cursor: pointer;
        }
        .dbtn:active { background: #F1F3F4; transform: translateY(2px); box-shadow: none; }

        .up { grid-area: up; } .down { grid-area: down; }
        .left { grid-area: left; } .right { grid-area: right; }

        .ok {
            grid-area: ok;
            background: #F8F9FA;
            border: 2px solid #4285F4;
            color: #4285F4;
            font-weight: 500;
            border-radius: 50%;
            font-size: 18px;
            box-shadow: 0 4px 10px rgba(66, 133, 244, 0.2);
        }
        .ok:active { background: #E8F0FE; transform: scale(0.92); box-shadow: none; }

        .status-dot {
            width: 12px; height: 12px;
            background: #4285F4;
            border-radius: 50%;
            margin-bottom: 15px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

        .instruction { font-weight: 500; color: #1A73E8; pointer-events: none; }
        .footer { margin-top: 30px; display: flex; gap: 20px; }

        .icon-btn {
            background: #E8EAED;
            width: 56px; height: 56px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #5F6368;
            cursor: pointer;
            border: none;
        }

        .flash-on { background-color: #E6F4EA !important; color: #1E8E3E !important; }
        .flash-off { background-color: #FCE8E6 !important; color: #D93025 !important; }
    </style>
</head>
<body>

    <div class="header">
        <h1>Chromeo TV</h1>
        <p id="mode-status">Detecting Device...</p>
    </div>

    <div id="control-container">
        <div id="trackpad-card">
            <div class="status-dot"></div>
            <div class="instruction">Tap for Trackpad</div>
        </div>

        <div id="dpad-card">
            <button class="dbtn up" onclick="sendKey('ArrowUp')">▲</button>
            <button class="dbtn left" onclick="sendKey('ArrowLeft')">◀</button>
            <button class="dbtn ok" onclick="sendKey('Enter')">OK</button>
            <button class="dbtn right" onclick="sendKey('ArrowRight')">▶</button>
            <button class="dbtn down" onclick="sendKey('ArrowDown')">▼</button>
        </div>
    </div>

    <div class="footer">
        <button class="icon-btn" onclick="sendKey('Homepage')">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
        </button>

        <button class="icon-btn" id="toggle-btn" onclick="toggleMode()">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0
4h14v-2H7v2zM7 7v2h14V7H7z"/>
            </svg>
        </button>

        <button class="icon-btn" id="power-btn" onclick="rotatePower()">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0
3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0
4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
            </svg>
        </button>
    </div>

    <script>
        const trackpad = document.getElementById('trackpad-card');
        const dpad = document.getElementById('dpad-card');
        const modeStatus = document.getElementById('mode-status');
        let isTrackpadMode = true;
        let nextIsOn = true;

        function setMode(toTrackpad) {
            isTrackpadMode = toTrackpad;
            if (isTrackpadMode) {
                trackpad.style.visibility = 'visible';
                trackpad.style.opacity = '1';
                trackpad.style.zIndex = '2';
                dpad.style.visibility = 'hidden';
                dpad.style.opacity = '0';
                modeStatus.innerText = "Trackpad Mode";
            } else {
                trackpad.style.visibility = 'hidden';
                trackpad.style.opacity = '0';
                trackpad.style.zIndex = '1';
                dpad.style.visibility = 'visible';
                dpad.style.opacity = '1';
                modeStatus.innerText = "Button Mode";
                if (document.pointerLockElement === trackpad) document.exitPointerLock();
            }
        }

        function toggleMode() { setMode(!isTrackpadMode); }

        // Logic: Open D-Pad if width <= 768px, else Trackpad
        window.onload = () => {
            const isMobile = window.innerWidth <= 768;
            setMode(!isMobile);
        };

        function sendKey(key) { fetch(`/key?k=${key}`); }

        async function rotatePower() {
            const btn = document.getElementById('power-btn');
            const action = nextIsOn ? 'on' : 'standby';
            btn.classList.add(nextIsOn ? 'flash-on' : 'flash-off');
            nextIsOn = !nextIsOn;
            try {
                await fetch(`https://dj.dunc.app/control/${action}`, { method: 'POST',
mode: 'no-cors' });
            } catch (e) {}
            setTimeout(() => btn.classList.remove('flash-on', 'flash-off'), 800);
        }

        trackpad.onclick = () => { if(isTrackpadMode) trackpad.requestPointerLock(); };

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === trackpad) {
                fetch(`/move?x=${e.movementX}&y=${e.movementY}`);
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement === trackpad)
fetch(`/click?b=${e.button}&s=1`);
        });

        document.addEventListener('mouseup', (e) => {
            if (document.pointerLockElement === trackpad)
fetch(`/click?b=${e.button}&s=0`);
        });

        document.addEventListener('keydown', (e) => {
            if (document.pointerLockElement === trackpad) {
                e.preventDefault();
                sendKey(e.key);
            }
        });

        document.addEventListener('pointerlockchange', () => {
            const instr = document.querySelector('.instruction');
            if (document.pointerLockElement === trackpad) {
                instr.innerText = "Control Active (ESC to exit)";
                instr.style.color = "#34A853";
            } else {
                instr.innerText = "Tap for Trackpad";
                instr.style.color = "#1A73E8";
            }
        });
    </script>
</body>
</html>
"""

if __name__ == "__main__":
    print(f"Server starting on port {PORT}...")
    HTTPServer(('0.0.0.0', PORT), ControlHandler).serve_forever()
