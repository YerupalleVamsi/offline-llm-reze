import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- DOM ELEMENTS ---
const canvasContainer = document.getElementById('canvas-container');
const loadingScreen = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const askSpeakBtn = document.getElementById('askSpeakBtn');
const textInput = document.getElementById('textInput');
const voiceSelect = document.getElementById('voiceSelect');
const responseLang = document.getElementById('responseLang');
const statusEl = document.getElementById('status');

const SPEECH_RATE = 1;

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x111116, 5, 20);

// Camera framing chest-up
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 3.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvasContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.45, 0); // Focus on avatar face
controls.minDistance = 0.5;
controls.maxDistance = 5;
controls.maxPolarAngle = Math.PI / 2 + 0.1; // Limit rotating below plane

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(2, 3, 3);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x90b0ff, 1.5);
fillLight.position.set(-2, 1, -2);
scene.add(fillLight);

// --- AVATAR LOADING ---
let avatarGroup = new THREE.Group();
scene.add(avatarGroup);
let meshesWithMorphs = [];
window.MY_MESHES = meshesWithMorphs;

// A default realistic human model from ReadyPlayerMe with standard Oculus Visemes
const MODEL_URL = 'reze__stylized_anime_girl.glb';

const loader = new GLTFLoader();

loader.load(MODEL_URL, (gltf) => {
    const model = gltf.scene;
    
    // Position model on the floor plane
    model.position.y = 0;
    
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            // Identify meshes capable of facial animations
            if (child.morphTargetDictionary && child.morphTargetInfluences) {
                meshesWithMorphs.push(child);
            }
        }
        
        // T-pose → arms at sides, hands down (RPM / Mixamo-style naming)
        if (child.isBone) {
            const n = child.name;
            const isFore = n.includes('ForeArm') || n.includes('LowerArm');
            const isUpper = (n.includes('LeftArm') || n.includes('RightArm')) && !isFore;
            if (isUpper) {
                const left = n.includes('Left');
                child.rotation.z += left ? -0.72 : 0.72;
                child.rotation.x += 0.52;
                child.rotation.y += left ? 0.08 : -0.08;
            } else if (isFore) {
                child.rotation.x -= 0.12;
            } else if (n.includes('LeftShoulder')) {
                child.rotation.x += 0.06;
                child.rotation.z -= 0.06;
            } else if (n.includes('RightShoulder')) {
                child.rotation.x += 0.06;
                child.rotation.z += 0.06;
            } else if (n.includes('LeftHand') && !n.includes('Thumb') && !n.includes('Index')) {
                child.rotation.x += 0.15;
            } else if (n.includes('RightHand') && !n.includes('Thumb') && !n.includes('Index')) {
                child.rotation.x += 0.15;
            }
        }
    });

    avatarGroup.add(model);
    
    loadingScreen.style.opacity = '0';
    setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
    
}, (xhr) => {
    loadingText.innerText = `Loading Avatar Model: ${Math.round(xhr.loaded / xhr.total * 100)}%`;
}, (error) => {
    console.error("Error loading 3D model:", error);
    loadingText.innerText = "Failed to load model. Please place a 'model.glb' locally if using file protocol.";
    
    // Add instruction cube fallback so UI still works visually
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mat = new THREE.MeshStandardMaterial({color: 0xef4444});
    const cube = new THREE.Mesh(geo, mat);
    cube.position.y = 1.4;
    avatarGroup.add(cube);
    loadingScreen.style.display = 'none';
});

// --- SPEECH SYNTHESIS & LIP SYNC ---
let voices = [];
const synth = window.speechSynthesis;

function setStatus(text) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
}

function populateVoices() {
    voices = synth.getVoices();
    voiceSelect.innerHTML = voices.map(v => `<option value="${v.name}">${v.name} (${v.lang})</option>`).join('');
    
    const defaultVoice = voices.findIndex(v => v.name.includes('Google US English') || v.lang === 'en-US');
    if (defaultVoice !== -1) voiceSelect.selectedIndex = defaultVoice;
}
populateVoices();
if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = populateVoices;

let isSpeaking = false;
let currentVisemeKey = 'viseme_sil';
let blinkState = false;
let speechTimeouts = [];

// Phoneme to Oculus Viseme mapping (Standard in ReadyPlayerMe)
const visemeMapping = {
    a: 'viseme_aa', e: 'viseme_E', i: 'viseme_I', o: 'viseme_O', u: 'viseme_U',
    w: 'viseme_U', q: 'viseme_CH', m: 'viseme_PP', b: 'viseme_PP', p: 'viseme_PP',
    f: 'viseme_FF', v: 'viseme_FF', c: 'viseme_SS', d: 'viseme_DD', g: 'viseme_kk',
    h: 'viseme_aa', j: 'viseme_CH', k: 'viseme_kk', l: 'viseme_nn', n: 'viseme_nn',
    r: 'viseme_RR', s: 'viseme_SS', t: 'viseme_DD', x: 'viseme_kk', y: 'viseme_I', z: 'viseme_SS',
    th: 'viseme_TH', sh: 'viseme_CH', ch: 'viseme_CH', rest: 'viseme_sil'
};

// Fallback logic for differently-named morph targets
const fallbackMapping = {
    'viseme_aa': 'mouthOpen',
    'viseme_O': 'mouthPucker',
    'viseme_PP': 'mouthRollUpper' // lips closed
};

// Numeric mapping for unnamed morph targets (common in some exports like VRM to GLB)
// Assuming standard A, I, U, E, O vowels are indices 0, 1, 2, 3, 4 on the main face mesh
const numericMapping = {
    'viseme_aa': '0', 'viseme_E': '3', 'viseme_I': '1', 'viseme_O': '4', 'viseme_U': '2',
    'viseme_CH': '2', 'viseme_FF': '2', 'viseme_TH': '0', 'viseme_DD': '3', 'viseme_kk': '1',
    'viseme_nn': '1', 'viseme_RR': '2', 'viseme_SS': '1', 'viseme_sil': null, 'viseme_PP': null
};

function getVisumesForWord(word) {
    const sequence = [];
    let i = 0;
    while(i < word.length) {
        let char = word[i].toLowerCase();
        let next = word[i+1] ? word[i+1].toLowerCase() : '';
        let combo = char + next;
        
        if (['th', 'sh', 'ch'].includes(combo)) {
            sequence.push(visemeMapping[combo]);
            i += 2;
            continue;
        }
        sequence.push(visemeMapping[char] || 'viseme_sil');
        i++;
    }
    return sequence;
}

function normalizeForLipSync(s) {
    // Strip diacritics for latin-based languages (é->e, ñ->n, etc.)
    const latin = (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Very small transliteration helpers for common scripts so lips still move.
    // (Not phonemically perfect, but better than silence.)
    return latin
        .replace(/[АаЯя]/g, 'a')
        .replace(/[ОоЁё]/g, 'o')
        .replace(/[ИиЫыЙй]/g, 'i')
        .replace(/[УуЮю]/g, 'u')
        .replace(/[ЭэЕе]/g, 'e')
        .replace(/[ΆάΑα]/g, 'a')
        .replace(/[ΈέΕε]/g, 'e')
        .replace(/[ΊίΙι]/g, 'i')
        .replace(/[ΌόΟο]/g, 'o')
        .replace(/[ΎύΥυ]/g, 'u');
}

function speakText(text) {
    const rawText = (text || '').trim();
    if (!rawText || synth.speaking) return;

    setStatus('');

    // Clear playback sequence
    speechTimeouts.forEach(clearTimeout);
    speechTimeouts = [];

    const ut = new SpeechSynthesisUtterance(rawText);
    const selectedVoice = voices.find(v => v.name === voiceSelect.value);
    if (selectedVoice) ut.voice = selectedVoice;
    ut.rate = SPEECH_RATE;

    const lipText = normalizeForLipSync(rawText);

    // Trigger Camera Zoom Focus on Speech
    zoomCamera(true);

    ut.onstart = () => { isSpeaking = true; };
    ut.onend = () => {
        isSpeaking = false;
        currentVisemeKey = 'viseme_sil';
        zoomCamera(false);
    };
    ut.onerror = () => { isSpeaking = false; zoomCamera(false); };

    // Accurately capture word boundaries emitted by OS text-to-speech engine
    ut.onboundary = (event) => {
        if (event.name === 'word') {
            const slice = lipText.substring(event.charIndex);
            const match = slice.match(/^[\p{L}]+/u);
            if (!match) return;

            const word = match[0];
            const visemes = getVisumesForWord(word);

            // Adaptive char duration
            const charDuration = 90 / ut.rate;
            let delay = 0;

            visemes.forEach(vis => {
                speechTimeouts.push(setTimeout(() => { currentVisemeKey = vis; }, delay));
                delay += charDuration;
            });

            // Rest briefly after each word
            speechTimeouts.push(setTimeout(() => { currentVisemeKey = 'viseme_PP'; }, delay));
        }
    };

    synth.speak(ut);

    // Fallback sync estimation sequence (for browsers/voices lacking onboundary triggers)
    setTimeout(() => {
        if (isSpeaking && speechTimeouts.length === 0) {
            const charDuration = 90 / ut.rate;
            let delay = 0;
            lipText.split(/\s+/).forEach(word => {
                const clean = word.replace(/[^\p{L}]/gu, '');
                if (clean) {
                    getVisumesForWord(clean).forEach(vis => {
                        speechTimeouts.push(setTimeout(() => { currentVisemeKey = vis; }, delay));
                        delay += charDuration;
                    });
                    speechTimeouts.push(setTimeout(() => { currentVisemeKey = 'viseme_PP'; }, delay));
                    delay += charDuration;
                }
                delay += 120; // inter-word gap
            });

            speechTimeouts.push(setTimeout(() => { currentVisemeKey = 'viseme_sil'; }, delay));
        }
    }, 400);
}

window.addEventListener('message', (event) => {
    const data = event?.data;
    if (!data || data.type !== 'AVATAR_SPEAK') return;
    const incoming = (data.text || '').trim();
    if (!incoming) return;
    speakText(incoming);
});

const API_BASE = "http://127.0.0.1:8000";
const USER_ID_KEY = "chat_user_id";

function getStoredUserId() {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
        const legacy = localStorage.getItem("shittytest_user_id");
        if (legacy) {
            localStorage.setItem(USER_ID_KEY, legacy);
            id = legacy;
        }
    }
    if (!id) {
        id = String(Math.floor(Math.random() * 900000000) + 100000000);
        localStorage.setItem(USER_ID_KEY, id);
    }
    const n = parseInt(id, 10);
    return Number.isFinite(n) ? n : 1;
}

async function askMistral(composedMessage) {
    const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: getStoredUserId(),
            message: composedMessage,
            mode: "friendly tutor",
            history_limit: 10,
        }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Backend error ${res.status}${body ? `: ${body}` : ""}`);
    }
    return res.json();
}

function resolveRequestedLanguage() {
    const selected = responseLang?.value || 'auto';
    if (selected !== 'auto') return selected;
    const v = voices.find(v => v.name === voiceSelect.value);
    if (!v?.lang) return 'en';
    return String(v.lang).split('-')[0] || 'en';
}

function buildPromptWithLanguage(userText) {
    const lang = resolveRequestedLanguage();
    // Keep it lightweight and robust: we just constrain the output language.
    return `Reply in ${lang}. Keep the response concise and conversational.\n\nUser: ${userText}`;
}

askSpeakBtn.addEventListener('click', async () => {
    const userText = (textInput.value || '').trim();
    if (!userText || synth.speaking) return;

    try {
        setStatus('Thinking…');
        askSpeakBtn.disabled = true;

        const res = await askMistral(buildPromptWithLanguage(userText));
        const answer = (res && (res.response || res.message || res.text)) ? (res.response || res.message || res.text) : '';
        if (!answer) throw new Error('No response field in /chat result');

        textInput.value = '';
        setStatus('');
        speakText(answer);
    } catch (e) {
        console.error(e);
        setStatus(`Error: ${e.message || 'Failed to chat'}`);
    } finally {
        askSpeakBtn.disabled = false;
    }
});

// Camera Zoom Animation logic
function zoomCamera(zoomIn) {
    const targetZ = zoomIn ? 1.8 : 3.2; // Focus tightly when speaking, reset otherwise
    const targetY = zoomIn ? 1.55 : 1.50; // Move up towards face
    
    const startZ = camera.position.z;
    const startY = camera.position.y;
    const duration = 1200; // ms
    const startT = performance.now();
    
    const tick = () => {
        const timeElapsed = performance.now() - startT;
        const t = Math.min(timeElapsed / duration, 1);
        
        // Cubic ease out function
        const ease = 1 - Math.pow(1 - t, 3);
        
        camera.position.z = startZ + (targetZ - startZ) * ease;
        camera.position.y = startY + (targetY - startY) * ease;
        
        if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

// --- MICRO ANIMATIONS SYSTEM ---
function scheduleBlink() {
    setTimeout(() => {
        blinkState = true;
        setTimeout(() => { blinkState = false; scheduleBlink(); }, 150); // fast blink
    }, 2000 + Math.random() * 4000);
}
scheduleBlink();

const clock = new THREE.Clock();

function updateMorphs(delta) {
    if (!meshesWithMorphs.length) return;
    
    meshesWithMorphs.forEach(mesh => {
        const dict = mesh.morphTargetDictionary;
        const influences = mesh.morphTargetInfluences;
        if (!dict) return;
        
        // Face mesh is typically the one with multiple blendshapes
        const isFaceMesh = Object.keys(dict).length > 2;

        // 1. Reset/Decay Visemes + Activate Target Viseme
        Object.keys(dict).forEach(key => {
            const isNamedViseme = key.startsWith('viseme_') || key.startsWith('mouth') || key.toLowerCase().includes('smile');
            const isNumericViseme = isFaceMesh && ['0', '1', '2', '3', '4'].includes(key);
            
            if (isNamedViseme || isNumericViseme) {
                const idx = dict[key];
                let targetValue = 0;
                
                if (key === currentVisemeKey || fallbackMapping[currentVisemeKey] === key) {
                    targetValue = 1.0;
                } else if (isNumericViseme && numericMapping[currentVisemeKey] === key) {
                    targetValue = 1.0;
                }
                
                // Add soft smile while speaking to increase engagement (named targets only)
                if (isSpeaking && key.toLowerCase().includes('smile')) {
                    targetValue = Math.max(targetValue, 0.4); 
                }

                // Smooth linear interpolation applied every frame per blendshape
                influences[idx] = THREE.MathUtils.lerp(influences[idx], targetValue, delta * 20); // Fast lerp for snappy lip sync
            }
        });
        
        // 2. Eye Blink Update
        const blinkIndices = [];
        if (dict['eyeBlinkLeft'] !== undefined) blinkIndices.push(dict['eyeBlinkLeft']);
        if (dict['eyeBlinkRight'] !== undefined) blinkIndices.push(dict['eyeBlinkRight']);
        if (dict['eyesClosed'] !== undefined) blinkIndices.push(dict['eyesClosed']);
        
        // Also map numeric target '0' on meshes with 1 or 2 targets to blink (like Object_19)
        if (!isFaceMesh && dict['0'] !== undefined) {
            blinkIndices.push(dict['0']);
        }
        
        const targetBlink = blinkState ? 1.0 : 0.0;
        blinkIndices.forEach(idx => {
            influences[idx] = THREE.MathUtils.lerp(influences[idx], targetBlink, delta * 25);
        });
    });
}

// --- MAIN RENDER LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    
    // Apply lip sync and micro animations
    updateMorphs(delta);
    
    // Physics / Transform idle animations
    if (avatarGroup) {
        // Subtle constant sway
        avatarGroup.rotation.y = Math.sin(time * 0.3) * 0.05;
        
        if (isSpeaking) {
            // Emphasized bobbing while vocalizing
            avatarGroup.rotation.x = Math.sin(time * 4) * 0.015;
            avatarGroup.position.y = Math.sin(time * 8) * 0.005;
        } else {
            // Return to rest position smoothly
            avatarGroup.rotation.x = THREE.MathUtils.lerp(avatarGroup.rotation.x, 0, delta * 3);
            avatarGroup.position.y = THREE.MathUtils.lerp(avatarGroup.position.y, 0, delta * 3);
        }
    }
    
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Resizer logic
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
