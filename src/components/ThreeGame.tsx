import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Play, RotateCcw, AlertCircle } from 'lucide-react';
import { Track, Car, CarUpgrades, RaceParticipant } from '../types';

// --- MULTIPLAYER & 3D VISUALIZATION HELPERS ---
function createPlayerNameplateSprite(name: string, colorHex: string, health: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Semi-transparent rounded backdrop
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 56, 12);
    ctx.fill();
    
    // Border colored with player's custom accent
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Player Name Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 22);

    // Health/Integrity indicator bar underneath
    const barWidth = 180;
    const barHeight = 6;
    const barX = (256 - barWidth) / 2;
    const barY = 40;

    // Background of health bar (dark red)
    ctx.fillStyle = 'rgba(244, 63, 94, 0.3)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Filled health bar (green or red)
    ctx.fillStyle = health < 40 ? '#f43f5e' : '#10b981';
    ctx.fillRect(barX, barY, barWidth * (health / 100), barHeight);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.5, 1.125, 1);
  sprite.position.y = 2.4; // float above car
  return sprite;
}

function spawnFloatingEmojiSprite(parentGroup: THREE.Group, emoji: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = '72px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.5, 2.5, 1);
  sprite.position.set(0, 3.2, 0); // start just above nameplate
  parentGroup.add(sprite);

  // Animate sprite upward and fade out
  const startTime = performance.now();
  const duration = 1500; // 1.5s duration

  const animate = () => {
    const elapsed = performance.now() - startTime;
    const t = elapsed / duration;

    if (t < 1) {
      sprite.position.y = 3.2 + t * 2.5; // move up
      sprite.material.opacity = 1 - t;   // fade out
      requestAnimationFrame(animate);
    } else {
      parentGroup.remove(sprite);
      texture.dispose();
      material.dispose();
    }
  };
  animate();
}

function createRemotePlayerCarMesh(colorHex: string, name: string) {
  const remoteGroup = new THREE.Group();
  
  // Body
  const bodyGeo = new THREE.BoxGeometry(2.4, 0.7, 4.8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.25,
    metalness: 0.8,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.55;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  remoteGroup.add(bodyMesh);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(1.8, 0.6, 2.0);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.9,
  });
  const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
  cabinMesh.position.set(0, 1.05, -0.2);
  cabinMesh.castShadow = true;
  remoteGroup.add(cabinMesh);

  // Lights
  const lightGeo = new THREE.BoxGeometry(0.35, 0.15, 0.1);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb }); // glowing headlights
  const lLight = new THREE.Mesh(lightGeo, lightMat);
  lLight.position.set(-0.8, 0.5, 2.38);
  const rLight = lLight.clone();
  rLight.position.x = 0.8;
  remoteGroup.add(lLight);
  remoteGroup.add(rLight);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
  const wheelOffsets = [
    new THREE.Vector3(-1.15, 0.5, 1.4),
    new THREE.Vector3(1.15, 0.5, 1.4),
    new THREE.Vector3(-1.15, 0.5, -1.4),
    new THREE.Vector3(1.15, 0.5, -1.4),
  ];
  wheelOffsets.forEach((offset) => {
    const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
    wMesh.position.copy(offset);
    wMesh.castShadow = true;
    remoteGroup.add(wMesh);
  });

  return remoteGroup;
}

interface ThreeGameProps {
  activeTrack: Track;
  selectedCar: Car;
  upgrades: CarUpgrades;
  difficulty: 'easy' | 'medium' | 'hard';
  audioEnabled: boolean;
  volume: number;
  initialWeather?: 'clear' | 'rain' | 'snow' | 'fog';
  onRaceFinished: (standing: number, time: number, rewardCoins: number, fastestLap?: number) => void;
  onExit: () => void;
}

export default function ThreeGame({
  activeTrack,
  selectedCar,
  upgrades,
  difficulty,
  audioEnabled,
  volume,
  initialWeather = 'clear',
  onRaceFinished,
  onExit,
}: ThreeGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Game state
  const [countdown, setCountdown] = useState<number | 'GO!' | null>(3);
  const [raceActive, setRaceActive] = useState<boolean>(false);
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [nitroLevel, setNitroLevel] = useState<number>(100);
  const [currentLap, setCurrentLap] = useState<number>(1);
  const [playerPos, setPlayerPos] = useState<number>(3);
  const [raceTime, setRaceTime] = useState<number>(0);
  const [participants, setParticipants] = useState<RaceParticipant[]>([]);
  const [cameraMode, setCameraMode] = useState<'thirdPerson' | 'hood' | 'cockpit'>('thirdPerson');
  const [paused, setPaused] = useState<boolean>(false);
  const [debugLog, setDebugLog] = useState<string>('');

  // Weather state
  const [weather, setWeather] = useState<'clear' | 'rain' | 'snow' | 'fog'>(initialWeather);
  const weatherRef = useRef<'clear' | 'rain' | 'snow' | 'fog'>(initialWeather);

  // Real-life simulation states
  const [fuel, setFuel] = useState<number>(100);
  const [tireWear, setTireWear] = useState<number>(0);
  const [tireTemp, setTireTemp] = useState<number>(80);
  const [carHealth, setCarHealth] = useState<number>(100);

  // Multiplayer & Damage FX States
  const [collisionFlash, setCollisionFlash] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; text: string; type: string }[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [activeInput, setActiveInput] = useState<boolean>(false);

  const socketRef = useRef<WebSocket | null>(null);
  const playerIdRef = useRef<string>('racer_' + Math.random().toString(36).substr(2, 6));
  const flashTimeoutRef = useRef<any>(null);

  const triggerCollisionFlash = () => {
    setCollisionFlash(true);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      setCollisionFlash(false);
    }, 250);
  };

  // Pit Stop states
  const [isPitting, setIsPitting] = useState<boolean>(false);
  const [pitServiceStatus, setPitServiceStatus] = useState<'idle' | 'refueling' | 'tire_change' | 'repair' | 'done'>('idle');
  const [rpm, setRpm] = useState<number>(1000);
  const [currentGear, setCurrentGear] = useState<number>(1);

  const handleWeatherChange = (newWeather: 'clear' | 'rain' | 'snow' | 'fog') => {
    setWeather(newWeather);
    weatherRef.current = newWeather;
  };

  useEffect(() => {
    setWeather(initialWeather);
    weatherRef.current = initialWeather;
  }, [initialWeather]);

  // Physics tuning values based on car & upgrades
  // Upgrades level 1-5 increase base stats by 10% per level
  const engineBonus = 1 + (upgrades.engine - 1) * 0.15;
  const tireBonus = 1 + (upgrades.tires - 1) * 0.12;
  const brakeBonus = 1 + (upgrades.brakes - 1) * 0.15;
  const nitroBonus = 1 + (upgrades.nitro - 1) * 0.15;

  const MAX_SPEED = (120 + selectedCar.speed * 12) * engineBonus; // Max speed in km/h
  const ACCELERATION = (0.2 + selectedCar.speed * 0.04) * engineBonus;
  const BRAKING = (0.35 + selectedCar.brakes * 0.05) * brakeBonus;
  const HANDBRAKE_FRICTION = 0.88;
  const DRIFT_GRIP = 0.95 * tireBonus;
  const NORMAL_GRIP = 0.985 * tireBonus;
  const NITRO_FORCE = 1.6 * nitroBonus;
  const TRACK_WIDTH = 28;

  // Refs to share with animation loop
  const stateRef = useRef({
    keys: { w: false, a: false, s: false, d: false, Shift: false, ' ': false },
    car: {
      pos: new THREE.Vector3(0, 0, 0),
      vel: new THREE.Vector3(0, 0, 0),
      dir: 0, // Radians rotation around Y
      speed: 0,
      driftAngle: 0,
      isDrifting: false,
      nitro: 100, // percentage
      health: 100,
      fuel: 100,
      tireWear: 0,
      tireTemp: 80,
      isPitting: false,
      pitProgress: 0,
      pitStatus: 'idle' as 'idle' | 'refueling' | 'tire_change' | 'repair' | 'done',
      lap: 1,
      checkpoint: 0,
      finished: false,
      finishTime: 0,
      lapStartTime: 0,
      lapTimes: [] as number[],
    },
    aiCars: [
      { id: 'ai-1', name: 'Viper Apex', speedFactor: 0.84, pos: new THREE.Vector3(), dir: 0, progress: 0.02, offset: -5, color: '#f43f5e', currentLap: 1, lastCheckpoint: 0, finished: false, finishTime: 0 },
      { id: 'ai-2', name: 'Phantom Drift', speedFactor: 0.90, pos: new THREE.Vector3(), dir: 0, progress: 0.04, offset: 5, color: '#a855f7', currentLap: 1, lastCheckpoint: 0, finished: false, finishTime: 0 },
    ],
    time: 0,
    countdownTimer: 3,
    raceActive: false,
    trackPoints: [] as THREE.Vector3[],
    trackSpline: null as THREE.CatmullRomCurve3 | null,
    checkpoints: [] as THREE.Vector3[],
    pitCenter: new THREE.Vector3(),
    pitResetReady: true,
    remotePlayers: new Map<string, {
      id: string;
      name: string;
      carId: string;
      color: string;
      pos: THREE.Vector3;
      targetPos: THREE.Vector3;
      dir: number;
      targetDir: number;
      speed: number;
      health: number;
      lap: number;
      checkpoint: number;
      finished: boolean;
      meshGroup: THREE.Group | null;
      nameplateSprite: THREE.Sprite | null;
    }>(),
  });

  // Sound refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const engineOscRef = useRef<OscillatorNode | null>(null);
  const engineGainRef = useRef<GainNode | null>(null);
  const screechOscRef = useRef<OscillatorNode | null>(null);
  const screechGainRef = useRef<GainNode | null>(null);
  const nitroOscRef = useRef<OscillatorNode | null>(null);
  const nitroGainRef = useRef<GainNode | null>(null);

  // Toggle camera
  const cycleCamera = () => {
    const modes: ('thirdPerson' | 'hood' | 'cockpit')[] = ['thirdPerson', 'hood', 'cockpit'];
    const nextIdx = (modes.indexOf(cameraMode) + 1) % modes.length;
    setCameraMode(modes[nextIdx]);
  };

  // Sound initialization (Web Audio Synthesizer)
  const initSynthSounds = () => {
    if (!audioEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      // Engine Rumble Synthesis
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(45, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, ctx.currentTime);

      gain.gain.setValueAtTime(0.0, ctx.currentTime); // start quiet

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      engineOscRef.current = osc;
      engineGainRef.current = gain;

      // Tire Screech Synthesis
      const sOsc = ctx.createOscillator();
      const sGain = ctx.createGain();

      sOsc.type = 'triangle';
      sOsc.frequency.setValueAtTime(350, ctx.currentTime);
      sGain.gain.setValueAtTime(0, ctx.currentTime); // silent initially

      sOsc.connect(sGain);
      sGain.connect(ctx.destination);
      sOsc.start();

      screechOscRef.current = sOsc;
      screechGainRef.current = sGain;

      // Nitro Boost jet-whistle Synthesis
      const nOsc = ctx.createOscillator();
      const nFilter = ctx.createBiquadFilter();
      const nGain = ctx.createGain();

      nOsc.type = 'sawtooth';
      nOsc.frequency.setValueAtTime(800, ctx.currentTime);

      nFilter.type = 'bandpass';
      nFilter.frequency.setValueAtTime(1200, ctx.currentTime);
      nFilter.Q.setValueAtTime(2.5, ctx.currentTime);

      nGain.gain.setValueAtTime(0.0, ctx.currentTime); // start silent

      nOsc.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(ctx.destination);
      nOsc.start();

      nitroOscRef.current = nOsc;
      nitroGainRef.current = nGain;
    } catch (e) {
      console.warn('Web Audio synthesis failed to boot:', e);
    }
  };

  // Modulate synthesized sounds in real-time
  const updateSynthSounds = (speedRatio: number, throttle: boolean, drifting: boolean, isBoosting: boolean) => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'suspended') return;

    // Modulate Engine sound frequency and gain based on speed and throttle
    if (engineOscRef.current && engineGainRef.current) {
      const baseFreq = 40 + speedRatio * 150;
      const throttleMod = throttle ? 25 : 0;
      const boostMod = isBoosting ? 40 : 0;
      engineOscRef.current.frequency.setTargetAtTime(baseFreq + throttleMod + boostMod, ctx.currentTime, 0.1);

      const targetGain = (0.05 + speedRatio * 0.15 + (throttle ? 0.08 : 0) + (isBoosting ? 0.04 : 0)) * volume;
      engineGainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.15);
    }

    // Modulate Drift Screech sound
    if (screechOscRef.current && screechGainRef.current) {
      if (drifting && speedRatio > 0.2) {
        // High-pitched drifting frequency
        const wobble = Math.sin(ctx.currentTime * 30) * 15;
        screechOscRef.current.frequency.setTargetAtTime(320 + speedRatio * 80 + wobble, ctx.currentTime, 0.05);
        screechGainRef.current.gain.setTargetAtTime(0.04 * volume, ctx.currentTime, 0.05);
      } else {
        screechGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
    }

    // Modulate Nitro Boost Jet wind whistle
    if (nitroOscRef.current && nitroGainRef.current) {
      if (isBoosting) {
        const freqWobble = 1100 + Math.sin(ctx.currentTime * 60) * 250;
        nitroOscRef.current.frequency.setTargetAtTime(freqWobble, ctx.currentTime, 0.05);
        nitroGainRef.current.gain.setTargetAtTime(0.08 * volume, ctx.currentTime, 0.1);
      } else {
        nitroGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      }
    }
  };

  const playPitRefuelingSound = () => {
    if (!audioEnabled) return;
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'suspended') return;
    try {
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(65, ctx.currentTime);
      
      lfo.type = 'sawtooth';
      lfo.frequency.setValueAtTime(8, ctx.currentTime);
      lfoGain.gain.setValueAtTime(25, ctx.currentTime);
      
      gainNode.gain.setValueAtTime(0.02 * volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      lfo.start();
      osc.start();
      lfo.stop(ctx.currentTime + 0.25);
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.error(e);
    }
  };

  const playPneumaticGunSound = () => {
    if (!audioEnabled) return;
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'suspended') return;
    try {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.025 * volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch (e) {
      console.error(e);
    }
  };

  const playWeldingSparkSound = () => {
    if (!audioEnabled) return;
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'suspended') return;
    try {
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3500, ctx.currentTime);
      filter.Q.setValueAtTime(8, ctx.currentTime);
      
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.015 * volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      
      noiseNode.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      noiseNode.start();
      noiseNode.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.error(e);
    }
  };

  // Play a procedural crash noise trigger
  const playCrashSound = () => {
    const ctx = audioContextRef.current;
    if (!ctx || !audioEnabled) return;

    try {
      // Noise buffer for crash crunch
      const bufferSize = ctx.sampleRate * 0.4; // 0.4 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.35);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18 * volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noiseNode.start();
    } catch (e) {
      console.warn(e);
    }
  };

  // Define splines for our 3 Tracks
  useEffect(() => {
    let pts: THREE.Vector3[] = [];
    if (activeTrack.id === 'track_city') {
      // Elegant grid-like, futuristic city bends
      pts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(120, 0, 0),
        new THREE.Vector3(180, 0, 60),
        new THREE.Vector3(180, 0, 180),
        new THREE.Vector3(100, 0, 240),
        new THREE.Vector3(-40, 0, 240),
        new THREE.Vector3(-120, 0, 160),
        new THREE.Vector3(-120, 0, 60),
        new THREE.Vector3(-40, 0, 0),
      ];
    } else if (activeTrack.id === 'track_desert') {
      // Sweeping sandy loop curves resembling dunes and canyon passes
      pts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(90, 0, 20),
        new THREE.Vector3(180, 5, -30),
        new THREE.Vector3(250, 0, 60),
        new THREE.Vector3(190, -5, 180),
        new THREE.Vector3(90, 0, 120),
        new THREE.Vector3(-30, 2, 210),
        new THREE.Vector3(-150, 0, 140),
        new THREE.Vector3(-210, -3, 30),
        new THREE.Vector3(-100, 0, -40),
      ];
    } else if (activeTrack.id === 'track_volcano') {
      // Volcanic rim with severe heat climbs and obsidian turns
      pts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(100, 8, -20),
        new THREE.Vector3(160, 18, 50),
        new THREE.Vector3(110, 22, 130),
        new THREE.Vector3(20, 12, 170),
        new THREE.Vector3(-60, 15, 120),
        new THREE.Vector3(-120, 5, 20),
        new THREE.Vector3(-70, 0, -40),
      ];
    } else if (activeTrack.id === 'track_cosmic') {
      // Cosmic track sweeping through stellar loops
      pts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(120, 15, 10),
        new THREE.Vector3(200, 35, 90),
        new THREE.Vector3(150, 45, 200),
        new THREE.Vector3(40, 30, 150),
        new THREE.Vector3(-80, 25, 240),
        new THREE.Vector3(-160, 12, 160),
        new THREE.Vector3(-180, 5, 60),
        new THREE.Vector3(-100, 0, -20),
      ];
    } else {
      // Mountain alpine pass with steep winding hairpins and climbs
      pts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(80, 15, 10),
        new THREE.Vector3(140, 28, 70),
        new THREE.Vector3(110, 32, 140),
        new THREE.Vector3(30, 20, 110),
        new THREE.Vector3(-40, 25, 180),
        new THREE.Vector3(-120, 10, 120),
        new THREE.Vector3(-140, 5, 40),
        new THREE.Vector3(-70, 0, -10),
      ];
    }

    const spline = new THREE.CatmullRomCurve3(pts, true);
    stateRef.current.trackPoints = pts;
    stateRef.current.trackSpline = spline;

    // Generate equidistant checkpoints (for cheating prevention and tracking)
    const ck: THREE.Vector3[] = [];
    const splits = 8;
    for (let i = 0; i < splits; i++) {
      ck.push(spline.getPointAt(i / splits));
    }
    stateRef.current.checkpoints = ck;

    // Scale AI speed factors based on game difficulty settings
    let diffMult = 0.8;
    if (difficulty === 'medium') diffMult = 0.93;
    if (difficulty === 'hard') diffMult = 1.05;

    stateRef.current.aiCars[0].speedFactor = 0.78 * diffMult;
    stateRef.current.aiCars[1].speedFactor = 0.85 * diffMult;
  }, [activeTrack, difficulty]);

  // Main 3D Canvas Assembly and Simulation Logic
  useEffect(() => {
    if (!canvasRef.current || !stateRef.current.trackSpline) return;

    // 1. WebGL Renderer
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 500;
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(activeTrack.skyColor);
    scene.fog = new THREE.FogExp2(activeTrack.skyColor, 0.002);

    // 3. Main Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 10, 20);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(120, 180, 80);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 400;
    const d = 150;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Secondary floor glow
    const floorLight = new THREE.DirectionalLight(0xa5f3fc, 0.3);
    floorLight.position.set(-100, -20, -50);
    scene.add(floorLight);

    // 5. Procedural Track Geometry Construction
    const roadSpline = stateRef.current.trackSpline;
    const pointsCount = 300;
    const roadPoints = roadSpline.getPoints(pointsCount);

    // Custom colors depending on active track
    let pavementColor = 0x22252a;
    let stripeColor = 0x10b981;
    if (activeTrack.id === 'track_desert') {
      pavementColor = 0x3d2819;
      stripeColor = 0xf59e0b;
    } else if (activeTrack.id === 'track_mountain') {
      pavementColor = 0x111827;
      stripeColor = 0x06b6d4;
    }

    // A. Procedural Asphalt Canvas Texture Generator
    const asphaltCanvas = document.createElement('canvas');
    asphaltCanvas.width = 512;
    asphaltCanvas.height = 512;
    const asphaltCtx = asphaltCanvas.getContext('2d');
    if (asphaltCtx) {
      // Asphalt base slate shade
      let asphaltHex = '#1e293b'; // Default City Slate
      if (activeTrack.id === 'track_desert') {
        asphaltHex = '#2c1b12'; // Dune Dusty Clay-slate
      } else if (activeTrack.id === 'track_mountain') {
        asphaltHex = '#090d16'; // Alpine Deep Midnight
      }
      asphaltCtx.fillStyle = asphaltHex;
      asphaltCtx.fillRect(0, 0, 512, 512);

      // Add high-frequency aggregate noise (sand/asphalt grains)
      const imgData = asphaltCtx.getImageData(0, 0, 512, 512);
      const data = imgData.data;
      for (let idx = 0; idx < data.length; idx += 4) {
        const grainNoise = (Math.random() - 0.5) * 16;
        data[idx] = Math.min(255, Math.max(0, data[idx] + grainNoise));
        data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + grainNoise));
        data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + grainNoise));
      }
      asphaltCtx.putImageData(imgData, 0, 0);

      // Overlay dark racing rubber tyre wear lines along typical lane centers
      asphaltCtx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      asphaltCtx.fillRect(70, 0, 40, 512);
      asphaltCtx.fillRect(145, 0, 40, 512);
      asphaltCtx.fillRect(325, 0, 40, 512);
      asphaltCtx.fillRect(400, 0, 40, 512);

      // Overlay tiny realistic asphalt surface cracks for additional fidelity
      asphaltCtx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      asphaltCtx.lineWidth = 1.2;
      for (let j = 0; j < 4; j++) {
        asphaltCtx.beginPath();
        let currX = Math.random() * 512;
        let currY = 0;
        asphaltCtx.moveTo(currX, currY);
        while (currY < 512) {
          currX += (Math.random() - 0.5) * 20;
          currY += 15 + Math.random() * 35;
          asphaltCtx.lineTo(currX, currY);
        }
        asphaltCtx.stroke();
      }
    }
    const asphaltTexture = new THREE.CanvasTexture(asphaltCanvas);
    asphaltTexture.wrapS = THREE.RepeatWrapping;
    asphaltTexture.wrapT = THREE.RepeatWrapping;
    asphaltTexture.repeat.set(1, 40); // Repeat along the length of the racetrack

    // Create a smooth extruded 3D ribbon road mesh
    const roadGeometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= pointsCount; i++) {
      const u = i / pointsCount;
      const point = roadSpline.getPointAt(u % 1.0);
      const tangent = roadSpline.getTangentAt(u % 1.0).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Road boundary vertices (left side and right side)
      const leftPt = point.clone().addScaledVector(normal, -TRACK_WIDTH / 2);
      const rightPt = point.clone().addScaledVector(normal, TRACK_WIDTH / 2);

      positions.push(leftPt.x, leftPt.y, leftPt.z);
      positions.push(rightPt.x, rightPt.y, rightPt.z);

      // Repeat textures smoothly along road loop
      uvs.push(0, u * 40);
      uvs.push(1, u * 40);

      if (i < pointsCount) {
        const currIdx = i * 2;
        indices.push(currIdx, currIdx + 1, currIdx + 2);
        indices.push(currIdx + 1, currIdx + 3, currIdx + 2);
      }
    }

    roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeometry.setIndex(indices);
    roadGeometry.computeVertexNormals();

    const roadMaterial = new THREE.MeshStandardMaterial({
      map: asphaltTexture,
      roughness: 0.85,
      metalness: 0.12,
      side: THREE.DoubleSide,
    });
    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // B. Build Custom 3D Raised Racing Curbs (Kerbs) with Alternating Colors
    const buildCurbGeometry = (side: 'left' | 'right') => {
      const curbGeo = new THREE.BufferGeometry();
      const curbPositions: number[] = [];
      const curbColors: number[] = [];
      const curbIndices: number[] = [];
      
      const curbWidth = 1.3;
      const curbHeight = 0.20;
      const primaryColor = new THREE.Color(stripeColor);
      const whiteColor = new THREE.Color(0xf8fafc); // Premium slate-50 pearl

      for (let i = 0; i <= pointsCount; i++) {
        const u = i / pointsCount;
        const point = roadSpline.getPointAt(u % 1.0);
        const tangent = roadSpline.getTangentAt(u % 1.0).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
        const multiplier = side === 'left' ? -1 : 1;

        // Base road boundary edge
        const v0 = point.clone().addScaledVector(normal, multiplier * (TRACK_WIDTH / 2));
        // Raised top outer corner
        const v1 = point.clone().addScaledVector(normal, multiplier * (TRACK_WIDTH / 2 + curbWidth)).add(new THREE.Vector3(0, curbHeight, 0));
        // Beveled outer ground touch down
        const v2 = point.clone().addScaledVector(normal, multiplier * (TRACK_WIDTH / 2 + curbWidth + 0.25));

        curbPositions.push(v0.x, v0.y, v0.z);
        curbPositions.push(v1.x, v1.y, v1.z);
        curbPositions.push(v2.x, v2.y, v2.z);

        // Alternating color blocks every 5 steps along the path
        const isStripe = (i % 10) < 5;
        const color = isStripe ? primaryColor : whiteColor;

        curbColors.push(color.r, color.g, color.b);
        curbColors.push(color.r, color.g, color.b);
        curbColors.push(color.r, color.g, color.b);

        if (i < pointsCount) {
          const currIdx = i * 3;
          const nextIdx = (i + 1) * 3;

          // Quad top sloped plane (v0 -> v1)
          curbIndices.push(currIdx, currIdx + 1, nextIdx);
          curbIndices.push(currIdx + 1, nextIdx + 1, nextIdx);

          // Quad outer ground drop (v1 -> v2)
          curbIndices.push(currIdx + 1, currIdx + 2, nextIdx + 1);
          curbIndices.push(currIdx + 2, nextIdx + 2, nextIdx + 1);
        }
      }

      curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
      curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
      curbGeo.setIndex(curbIndices);
      curbGeo.computeVertexNormals();
      return curbGeo;
    };

    const curbMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.7,
      metalness: 0.15,
      side: THREE.DoubleSide
    });

    const leftCurbMesh = new THREE.Mesh(buildCurbGeometry('left'), curbMaterial);
    const rightCurbMesh = new THREE.Mesh(buildCurbGeometry('right'), curbMaterial);
    leftCurbMesh.receiveShadow = true;
    leftCurbMesh.castShadow = true;
    rightCurbMesh.receiveShadow = true;
    rightCurbMesh.castShadow = true;
    scene.add(leftCurbMesh);
    scene.add(rightCurbMesh);

    // C. Dashed Glowing Centerline Ribbon
    const centerLinesGeo = new THREE.BufferGeometry();
    const clPositions: number[] = [];
    const clIndices: number[] = [];
    const lineThickness = 0.32;
    const clHeightOffset = 0.035;

    for (let i = 0; i < pointsCount; i++) {
      // Draw a dash for every 4 segments
      if (i % 4 === 0) {
        const u1 = i / pointsCount;
        const u2 = (i + 1.8) / pointsCount;

        const pt1 = roadSpline.getPointAt(u1 % 1.0);
        const tangent1 = roadSpline.getTangentAt(u1 % 1.0).normalize();
        const normal1 = new THREE.Vector3().crossVectors(tangent1, up).normalize();

        const pt2 = roadSpline.getPointAt(u2 % 1.0);
        const tangent2 = roadSpline.getTangentAt(u2 % 1.0).normalize();
        const normal2 = new THREE.Vector3().crossVectors(tangent2, up).normalize();

        const p1_l = pt1.clone().addScaledVector(normal1, -lineThickness / 2).add(new THREE.Vector3(0, clHeightOffset, 0));
        const p1_r = pt1.clone().addScaledVector(normal1, lineThickness / 2).add(new THREE.Vector3(0, clHeightOffset, 0));
        const p2_l = pt2.clone().addScaledVector(normal2, -lineThickness / 2).add(new THREE.Vector3(0, clHeightOffset, 0));
        const p2_r = pt2.clone().addScaledVector(normal2, lineThickness / 2).add(new THREE.Vector3(0, clHeightOffset, 0));

        const baseIdx = clPositions.length / 3;

        clPositions.push(p1_l.x, p1_l.y, p1_l.z);
        clPositions.push(p1_r.x, p1_r.y, p1_r.z);
        clPositions.push(p2_l.x, p2_l.y, p2_l.z);
        clPositions.push(p2_r.x, p2_r.y, p2_r.z);

        clIndices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        clIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
      }
    }

    centerLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(clPositions, 3));
    centerLinesGeo.setIndex(clIndices);
    centerLinesGeo.computeVertexNormals();

    const centerLinesMat = new THREE.MeshBasicMaterial({
      color: stripeColor,
      side: THREE.DoubleSide
    });
    const centerLinesMesh = new THREE.Mesh(centerLinesGeo, centerLinesMat);
    scene.add(centerLinesMesh);

    // D. Solid White Lane-Edge Boundaries (just inside racing curbs)
    const edgeLinesGeo = new THREE.BufferGeometry();
    const elPositions: number[] = [];
    const elIndices: number[] = [];
    const elWidth = 0.16;
    const elHeightOffset = 0.025;

    for (let i = 0; i <= pointsCount; i++) {
      const u = i / pointsCount;
      const pt = roadSpline.getPointAt(u % 1.0);
      const tangent = roadSpline.getTangentAt(u % 1.0).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Left-lane boundary line center
      const lLineCenter = pt.clone().addScaledVector(normal, -(TRACK_WIDTH / 2 - 0.7));
      const l_l = lLineCenter.clone().addScaledVector(normal, -elWidth / 2).add(new THREE.Vector3(0, elHeightOffset, 0));
      const l_r = lLineCenter.clone().addScaledVector(normal, elWidth / 2).add(new THREE.Vector3(0, elHeightOffset, 0));

      // Right-lane boundary line center
      const rLineCenter = pt.clone().addScaledVector(normal, (TRACK_WIDTH / 2 - 0.7));
      const r_l = rLineCenter.clone().addScaledVector(normal, -elWidth / 2).add(new THREE.Vector3(0, elHeightOffset, 0));
      const r_r = rLineCenter.clone().addScaledVector(normal, elWidth / 2).add(new THREE.Vector3(0, elHeightOffset, 0));

      const baseIdx = elPositions.length / 3;

      elPositions.push(l_l.x, l_l.y, l_l.z);
      elPositions.push(l_r.x, l_r.y, l_r.z);
      elPositions.push(r_l.x, r_l.y, r_l.z);
      elPositions.push(r_r.x, r_r.y, r_r.z);

      if (i < pointsCount) {
        // Connect left edge line quads
        elIndices.push(baseIdx, baseIdx + 1, baseIdx + 4);
        elIndices.push(baseIdx + 1, baseIdx + 5, baseIdx + 4);

        // Connect right edge line quads
        elIndices.push(baseIdx + 2, baseIdx + 3, baseIdx + 6);
        elIndices.push(baseIdx + 3, baseIdx + 7, baseIdx + 6);
      }
    }

    edgeLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(elPositions, 3));
    edgeLinesGeo.setIndex(elIndices);
    edgeLinesGeo.computeVertexNormals();

    const edgeLinesMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      opacity: 0.65,
      transparent: true,
      side: THREE.DoubleSide
    });
    const edgeLinesMesh = new THREE.Mesh(edgeLinesGeo, edgeLinesMat);
    scene.add(edgeLinesMesh);

    // E. Realistic Starter Grid Boxes at the Start-Finish Straight
    const starterGridMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.9,
      metalness: 0.05
    });

    for (let g = 0; g < 6; g++) {
      const uOffset = 1.0 - (0.012 + g * 0.014);
      const gridPt = roadSpline.getPointAt(uOffset % 1.0);
      const gridTangent = roadSpline.getTangentAt(uOffset % 1.0).normalize();
      const gridNormal = new THREE.Vector3().crossVectors(gridTangent, up).normalize();

      const sideMultiplier = g % 2 === 0 ? -1 : 1;
      const gridPos = gridPt.clone()
        .addScaledVector(gridNormal, sideMultiplier * (TRACK_WIDTH / 4.5))
        .add(new THREE.Vector3(0, 0.03, 0));

      const gridBoxGeo = new THREE.BoxGeometry(4.2, 0.02, 2.2);
      const gridBoxMesh = new THREE.Mesh(gridBoxGeo, starterGridMat);
      gridBoxMesh.position.copy(gridPos);
      gridBoxMesh.lookAt(gridPos.clone().add(gridTangent));
      scene.add(gridBoxMesh);
    }

    // F. Decorative Road Guardrails / Neon Borders & Support Pillars
    const leftRails: THREE.Vector3[] = [];
    const rightRails: THREE.Vector3[] = [];
    for (let i = 0; i <= pointsCount; i++) {
      const u = i / pointsCount;
      const point = roadSpline.getPointAt(u % 1.0);
      const tangent = roadSpline.getTangentAt(u % 1.0).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      
      leftRails.push(point.clone().addScaledVector(normal, -(TRACK_WIDTH / 2 + 0.65)));
      rightRails.push(point.clone().addScaledVector(normal, (TRACK_WIDTH / 2 + 0.65)));
    }

    const railMaterial = new THREE.MeshBasicMaterial({ color: stripeColor });
    
    const leftRailGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftRails, true), 120, 0.35, 6, true);
    const rightRailGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rightRails, true), 120, 0.35, 6, true);
    
    const leftRailMesh = new THREE.Mesh(leftRailGeo, railMaterial);
    const rightRailMesh = new THREE.Mesh(rightRailGeo, railMaterial);
    scene.add(leftRailMesh);
    scene.add(rightRailMesh);

    // G. Vertical Metallic Guardrail Support Pillars
    const supportPillarsGroup = new THREE.Group();
    const pillarGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.9, 6);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // Slate-600 Steel
      metalness: 0.85,
      roughness: 0.25
    });

    for (let i = 0; i <= pointsCount; i += 6) {
      const u = i / pointsCount;
      const pt = roadSpline.getPointAt(u % 1.0);
      const tangent = roadSpline.getTangentAt(u % 1.0).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Left support pillar
      const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
      leftPillar.position.copy(pt.clone().addScaledVector(normal, -(TRACK_WIDTH / 2 + 0.65)));
      leftPillar.position.y += 0.45;
      leftPillar.lookAt(pt.clone().add(tangent));
      leftPillar.castShadow = true;
      supportPillarsGroup.add(leftPillar);

      // Right support pillar
      const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
      rightPillar.position.copy(pt.clone().addScaledVector(normal, (TRACK_WIDTH / 2 + 0.65)));
      rightPillar.position.y += 0.45;
      rightPillar.lookAt(pt.clone().add(tangent));
      rightPillar.castShadow = true;
      supportPillarsGroup.add(rightPillar);
    }
    scene.add(supportPillarsGroup);

    // 6. Ground Base Plane Mesh
    const groundGeo = new THREE.PlaneGeometry(1200, 1200, 10, 10);
    const groundMat = new THREE.MeshStandardMaterial({
      color: activeTrack.groundColor,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    scene.add(ground);

    // 7. Track Decoration Elements (Skyscrapers for City, Pyramids for Desert, Alpine Trees for Snowy Mountains)
    const decorationGroup = new THREE.Group();
    const spawnRange = 450;
    const itemsCount = 120;

    for (let i = 0; i < itemsCount; i++) {
      // Pick random location
      const rx = (Math.random() - 0.5) * spawnRange;
      const rz = (Math.random() - 0.5) * spawnRange;
      const testPos = new THREE.Vector3(rx, 0, rz);

      // Verify asset is not spawned directly on road mesh
      const checkU = roadSpline.getUtoTmapping(0, 0); // rough check
      let tooClose = false;
      
      // Sample track segments to prevent overlap
      for (let s = 0; s < 30; s++) {
        const trackPt = roadSpline.getPointAt(s / 30);
        if (testPos.distanceTo(trackPt) < TRACK_WIDTH + 15) {
          tooClose = true;
          break;
        }
      }

      if (tooClose) continue;

      if (activeTrack.id === 'track_city') {
        // Neon grid towers
        const h = 40 + Math.random() * 80;
        const w = 15 + Math.random() * 20;
        const bGeo = new THREE.BoxGeometry(w, h, w);
        const randColor = [0x059669, 0x0284c7, 0x7c3aed, 0x2563eb][Math.floor(Math.random() * 4)];
        const bMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.5,
          emissive: randColor,
          emissiveIntensity: 0.15 + Math.random() * 0.2,
        });
        const building = new THREE.Mesh(bGeo, bMat);
        building.position.set(rx, h / 2 - 0.5, rz);
        building.castShadow = true;
        building.receiveShadow = true;
        decorationGroup.add(building);
      } else if (activeTrack.id === 'track_desert') {
        // Pyramids and Cactus blocks
        if (Math.random() > 0.45) {
          // Sand Pyramids
          const h = 18 + Math.random() * 32;
          const coneGeo = new THREE.ConeGeometry(h * 1.2, h, 4);
          const coneMat = new THREE.MeshStandardMaterial({
            color: 0xc27f38,
            roughness: 0.9,
          });
          const pyramid = new THREE.Mesh(coneGeo, coneMat);
          pyramid.position.set(rx, h / 2 - 0.5, rz);
          pyramid.rotation.y = Math.random() * Math.PI;
          pyramid.castShadow = true;
          decorationGroup.add(pyramid);
        } else {
          // Low-poly round boulders
          const bGeo = new THREE.DodecahedronGeometry(2 + Math.random() * 5);
          const bMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.9 });
          const rock = new THREE.Mesh(bGeo, bMat);
          rock.position.set(rx, 1, rz);
          rock.castShadow = true;
          decorationGroup.add(rock);
        }
      } else if (activeTrack.id === 'track_volcano') {
        // Volcanic Basalt spires and magma-emissive chunks
        if (Math.random() > 0.5) {
          const h = 15 + Math.random() * 25;
          const spireGeo = new THREE.ConeGeometry(2 + Math.random() * 3, h, 5);
          const spireMat = new THREE.MeshStandardMaterial({
            color: 0x141419,
            roughness: 0.9,
            metalness: 0.1,
          });
          const spire = new THREE.Mesh(spireGeo, spireMat);
          spire.position.set(rx, h / 2 - 0.5, rz);
          spire.castShadow = true;
          decorationGroup.add(spire);
        } else {
          const rGeo = new THREE.DodecahedronGeometry(2 + Math.random() * 4);
          const rMat = new THREE.MeshStandardMaterial({
            color: 0x1f1717,
            roughness: 0.8,
            emissive: 0xff4400,
            emissiveIntensity: 0.5 + Math.random() * 0.5,
          });
          const lavaRock = new THREE.Mesh(rGeo, rMat);
          lavaRock.position.set(rx, 1, rz);
          lavaRock.rotation.set(Math.random(), Math.random(), Math.random());
          lavaRock.castShadow = true;
          decorationGroup.add(lavaRock);
        }
      } else if (activeTrack.id === 'track_cosmic') {
        // Cosmic glowing spires and celestial structures
        if (Math.random() > 0.4) {
          const h = 10 + Math.random() * 15;
          const cryGeo = new THREE.CylinderGeometry(0, 2 + Math.random() * 2, h, 5);
          const cryMat = new THREE.MeshStandardMaterial({
            color: 0xa855f7,
            emissive: 0x7e22ce,
            emissiveIntensity: 0.6 + Math.random() * 0.4,
            metalness: 0.9,
            roughness: 0.1,
          });
          const crystal = new THREE.Mesh(cryGeo, cryMat);
          crystal.position.set(rx, h / 2 - 0.5, rz);
          crystal.rotation.set(Math.random() * 0.2, Math.random() * Math.PI, Math.random() * 0.2);
          crystal.castShadow = true;
          decorationGroup.add(crystal);
        } else {
          // Floating space beacon
          const beacon = new THREE.Group();
          beacon.position.set(rx, 6 + Math.random() * 4, rz);

          const coreGeo = new THREE.OctahedronGeometry(1.5, 0);
          const coreMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
          const coreMesh = new THREE.Mesh(coreGeo, coreMat);
          beacon.add(coreMesh);

          const ringGeo = new THREE.TorusGeometry(2.5, 0.2, 8, 16);
          const ringMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.8 });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.rotation.x = Math.PI / 2;
          beacon.add(ringMesh);

          decorationGroup.add(beacon);
        }
      } else {
        // Mountains: Alpine trees (cone foliage and cylinder trunk)
        const tree = new THREE.Group();
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 3, 5);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        tree.add(trunk);

        const leaveH = 5 + Math.random() * 6;
        const leaveGeo = new THREE.ConeGeometry(2.5, leaveH, 6);
        const leaveMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.8 });
        const leaves = new THREE.Mesh(leaveGeo, leaveMat);
        leaves.position.y = 3 + leaveH / 2;
        leaves.castShadow = true;
        tree.add(leaves);

        tree.position.set(rx, 0, rz);
        decorationGroup.add(tree);
      }
    }
    scene.add(decorationGroup);

    // 8. Visual Checkpoint Arches (Checkpoints overlaying the road)
    const archesGroup = new THREE.Group();
    const archCount = stateRef.current.checkpoints.length;
    const arches: THREE.Mesh[] = [];

    for (let i = 0; i < archCount; i++) {
      const pt = stateRef.current.checkpoints[i];
      // Get direction facing along road curve
      const ratio = i / archCount;
      const tangent = roadSpline.getTangentAt(ratio).normalize();
      const lookAtTarget = pt.clone().add(tangent);

      const archFrame = new THREE.Group();
      
      // Glowing chequered crossbar or portal loop
      const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, 12, 6);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
      
      const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
      leftPillar.position.set(-TRACK_WIDTH / 2, 6, 0);
      leftPillar.castShadow = true;
      archFrame.add(leftPillar);

      const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
      rightPillar.position.set(TRACK_WIDTH / 2, 6, 0);
      rightPillar.castShadow = true;
      archFrame.add(rightPillar);

      // Top crossbar
      const barGeo = new THREE.BoxGeometry(TRACK_WIDTH + 1, 1.5, 1.5);
      const barColor = i === 0 ? 0xffffff : stripeColor; // Start line is White/Chequered, rest are Neon Track Color
      const barMat = new THREE.MeshStandardMaterial({ color: barColor, roughness: 0.3 });
      const crossbar = new THREE.Mesh(barGeo, barMat);
      crossbar.position.set(0, 12, 0);
      crossbar.castShadow = true;
      archFrame.add(crossbar);

      // Semitransparent Trigger mesh inside arch
      const triggerGeo = new THREE.BoxGeometry(TRACK_WIDTH, 12, 1);
      const triggerMat = new THREE.MeshBasicMaterial({
        color: barColor,
        transparent: true,
        opacity: 0.08,
        wireframe: true
      });
      const triggerMesh = new THREE.Mesh(triggerGeo, triggerMat);
      triggerMesh.position.set(0, 6, 0);
      archFrame.add(triggerMesh);

      archFrame.position.copy(pt);
      archFrame.lookAt(lookAtTarget);

      archesGroup.add(archFrame);
    }
    scene.add(archesGroup);

    // 8b. Procedurally Generated 3D Pit Stop Bay next to Starting Gate
    const pitGroup = new THREE.Group();
    const startPt = stateRef.current.checkpoints[0];
    const startTangent = roadSpline.getTangentAt(0).normalize();
    const upVec = new THREE.Vector3(0, 1, 0);
    const rightVec = new THREE.Vector3().crossVectors(startTangent, upVec).normalize();
    
    // Position pit lane 14.5 units to the right of checkpoint 0
    const pitCenter = startPt.clone().addScaledVector(rightVec, 14.5);
    pitGroup.position.copy(pitCenter);
    stateRef.current.pitCenter.copy(pitCenter);
    
    // Orient parallel to starting road heading
    const pitLook = pitCenter.clone().add(startTangent);
    pitGroup.lookAt(pitLook);
    
    // Pit Lane ground pad
    const padGeo = new THREE.BoxGeometry(8, 0.1, 14);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.1
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.receiveShadow = true;
    pitGroup.add(padMesh);
    
    // Glowing green pit stop boundaries
    const boundGeo = new THREE.BoxGeometry(0.3, 0.15, 14);
    const boundMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const leftBound = new THREE.Mesh(boundGeo, boundMat);
    leftBound.position.set(-4, 0.05, 0);
    pitGroup.add(leftBound);
    
    const rightBound = new THREE.Mesh(boundGeo, boundMat);
    rightBound.position.set(4, 0.05, 0);
    pitGroup.add(rightBound);

    // Glowing grid lines on the ground
    const lineCount = 5;
    for (let l = 0; l < lineCount; l++) {
      const lineGeo = new THREE.BoxGeometry(7.8, 0.05, 0.15);
      const lineMesh = new THREE.Mesh(lineGeo, boundMat);
      lineMesh.position.set(0, 0.06, -7 + (14 * l) / (lineCount - 1));
      pitGroup.add(lineMesh);
    }
    
    // Canopy pillars
    const tentPillarGeo = new THREE.CylinderGeometry(0.18, 0.18, 5.5, 8);
    const tentPillarMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2 });
    
    const flPillar = new THREE.Mesh(tentPillarGeo, tentPillarMat);
    flPillar.position.set(-3.8, 2.75, -5.5);
    flPillar.castShadow = true;
    pitGroup.add(flPillar);
    
    const frPillar = new THREE.Mesh(tentPillarGeo, tentPillarMat);
    frPillar.position.set(3.8, 2.75, -5.5);
    frPillar.castShadow = true;
    pitGroup.add(frPillar);
    
    const blPillar = new THREE.Mesh(tentPillarGeo, tentPillarMat);
    blPillar.position.set(-3.8, 2.75, 5.5);
    blPillar.castShadow = true;
    pitGroup.add(blPillar);
    
    const brPillar = new THREE.Mesh(tentPillarGeo, tentPillarMat);
    brPillar.position.set(3.8, 2.75, 5.5);
    brPillar.castShadow = true;
    pitGroup.add(brPillar);
    
    // Canopy top roof
    const canopyGeo = new THREE.BoxGeometry(8.2, 0.6, 12);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.5 }); // Racing dark green
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 5.5, 0);
    canopy.castShadow = true;
    pitGroup.add(canopy);
    
    // Glowing Sign Board on canopy front facing oncoming cars
    const signGeo = new THREE.BoxGeometry(5, 1.2, 0.2);
    const signMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const frontSign = new THREE.Mesh(signGeo, signMat);
    frontSign.position.set(0, 5.5, -6.1);
    pitGroup.add(frontSign);

    const textPlatGeo = new THREE.BoxGeometry(4.6, 0.8, 0.05);
    const textPlatMat = new THREE.MeshBasicMaterial({ color: 0x10b981 }); // Glowing bright emerald plate!
    const frontTextSign = new THREE.Mesh(textPlatGeo, textPlatMat);
    frontTextSign.position.set(0, 5.5, -6.21);
    pitGroup.add(frontTextSign);

    scene.add(pitGroup);

    // 9. Interactive Player Car Model
    const carGroup = new THREE.Group();
    
    // Main fuselage box
    const bodyGeo = new THREE.BoxGeometry(2.4, 0.7, 4.8);
    
    // Custom Physical Material based on Paint Finish Selection
    let bodyMat: THREE.Material;
    const carColor = new THREE.Color(selectedCar.color || '#ef4444');
    const finish = selectedCar.paintFinish || 'glossy';

    if (finish === 'glossy') {
      bodyMat = new THREE.MeshPhysicalMaterial({
        color: carColor,
        roughness: 0.1,
        metalness: 0.25,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
      });
    } else if (finish === 'metallic') {
      bodyMat = new THREE.MeshPhysicalMaterial({
        color: carColor,
        roughness: 0.2,
        metalness: 0.95,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
      });
    } else if (finish === 'matte') {
      bodyMat = new THREE.MeshStandardMaterial({
        color: carColor,
        roughness: 0.85,
        metalness: 0.1,
      });
    } else { // 'pearl' iridescent pearlescence
      bodyMat = new THREE.MeshPhysicalMaterial({
        color: carColor,
        roughness: 0.15,
        metalness: 0.4,
        clearcoat: 0.8,
        emissive: carColor.clone().multiplyScalar(0.18), // elegant glow
      });
    }

    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.55;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    carGroup.add(bodyMesh);

    // Dynamic Decal Overlays
    const decalStyle = selectedCar.decalStyle || 'none';
    if (decalStyle === 'stripes') {
      // Elegant Dual White/Dark Center Racing Stripes
      const stripeColor = carColor.getHSL({ h: 0, s: 0, l: 0 }).l > 0.5 ? 0x111827 : 0xf8fafc;
      const decalMat = new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.2 });
      
      const leftStripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 4.6), decalMat);
      leftStripe.position.set(-0.25, 0.91, 0);
      carGroup.add(leftStripe);

      const rightStripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 4.6), decalMat);
      rightStripe.position.set(0.25, 0.91, 0);
      carGroup.add(rightStripe);
    } else if (decalStyle === 'cyber') {
      // Glowing Neon Cyan Grid Skirts
      const cyberMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
      
      const leftCyber = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.15, 3.8), cyberMat);
      leftCyber.position.set(-1.21, 0.45, 0);
      carGroup.add(leftCyber);

      const rightCyber = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.15, 3.8), cyberMat);
      rightCyber.position.set(1.21, 0.45, 0);
      carGroup.add(rightCyber);
    } else if (decalStyle === 'flames') {
      // Hot Orange and Yellow speed wedges on flanking panels
      const flameOrangeMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.3 });
      const flameYellowMat = new THREE.MeshStandardMaterial({ color: 0xffdd00, roughness: 0.3 });

      // Left flank flame layers
      const lFlame1 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.12, 1.8), flameOrangeMat);
      lFlame1.position.set(-1.21, 0.48, -0.2);
      lFlame1.rotation.y = 0.04;
      carGroup.add(lFlame1);

      const lFlame2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 1.2), flameYellowMat);
      lFlame2.position.set(-1.21, 0.45, -0.4);
      lFlame2.rotation.y = 0.06;
      carGroup.add(lFlame2);

      // Right flank flame layers
      const rFlame1 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.12, 1.8), flameOrangeMat);
      rFlame1.position.set(1.21, 0.48, -0.2);
      rFlame1.rotation.y = -0.04;
      carGroup.add(rFlame1);

      const rFlame2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 1.2), flameYellowMat);
      rFlame2.position.set(1.21, 0.45, -0.4);
      rFlame2.rotation.y = -0.06;
      carGroup.add(rFlame2);
    }

    // Cabin windshield
    const cabinGeo = new THREE.BoxGeometry(1.9, 0.65, 2.2);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.85,
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 1.1, -0.3);
    cabinMesh.castShadow = true;
    carGroup.add(cabinMesh);

    // Dynamic Spoiler Wing Customizations
    const spoilerStyle = selectedCar.spoilerStyle || 'none';
    if (spoilerStyle !== 'none') {
      const spoilerMat = new THREE.MeshStandardMaterial({ 
        color: spoilerStyle === 'drag' ? 0x18181b : 0x111827, 
        roughness: spoilerStyle === 'drag' ? 0.8 : 0.3,
        metalness: spoilerStyle === 'drag' ? 0.2 : 0.6
      });

      if (spoilerStyle === 'lowprofile') {
        // Flat trunk lip spoiler
        const lipGeo = new THREE.BoxGeometry(2.4, 0.15, 0.4);
        const lip = new THREE.Mesh(lipGeo, spoilerMat);
        lip.position.set(0, 0.85, -2.2);
        lip.castShadow = true;
        carGroup.add(lip);
      } else if (spoilerStyle === 'aero') {
        // Classic aerodynamic active wing
        const spoilerWingGeo = new THREE.BoxGeometry(2.6, 0.1, 0.8);
        const spoilerWing = new THREE.Mesh(spoilerWingGeo, spoilerMat);
        spoilerWing.position.set(0, 1.35, -2.1);
        spoilerWing.castShadow = true;
        carGroup.add(spoilerWing);

        const strutGeo = new THREE.BoxGeometry(0.12, 0.6, 0.3);
        const leftStrut = new THREE.Mesh(strutGeo, spoilerMat);
        leftStrut.position.set(-0.9, 1.05, -2.1);
        carGroup.add(leftStrut);
        const rightStrut = new THREE.Mesh(strutGeo, spoilerMat);
        rightStrut.position.set(0.9, 1.05, -2.1);
        carGroup.add(rightStrut);
      } else if (spoilerStyle === 'drag') {
        // Massive pro-drag wing with endplates and dual heavy angled supports
        const dragWingGeo = new THREE.BoxGeometry(2.8, 0.12, 0.9);
        const dragWing = new THREE.Mesh(dragWingGeo, spoilerMat);
        dragWing.position.set(0, 1.7, -2.3);
        dragWing.rotation.x = -0.15; // Aggressive angle of attack
        dragWing.castShadow = true;
        carGroup.add(dragWing);

        const plateGeo = new THREE.BoxGeometry(0.08, 0.5, 1.0);
        const leftPlate = new THREE.Mesh(plateGeo, spoilerMat);
        leftPlate.position.set(-1.4, 1.7, -2.3);
        carGroup.add(leftPlate);
        const rightPlate = new THREE.Mesh(plateGeo, spoilerMat);
        rightPlate.position.set(1.4, 1.7, -2.3);
        carGroup.add(rightPlate);

        const bigStrutGeo = new THREE.BoxGeometry(0.15, 1.0, 0.4);
        const leftBigStrut = new THREE.Mesh(bigStrutGeo, spoilerMat);
        leftBigStrut.position.set(-0.7, 1.25, -2.2);
        leftBigStrut.rotation.x = -0.1;
        carGroup.add(leftBigStrut);
        const rightBigStrut = new THREE.Mesh(bigStrutGeo, spoilerMat);
        rightBigStrut.position.set(0.7, 1.25, -2.2);
        rightBigStrut.rotation.x = -0.1;
        carGroup.add(rightBigStrut);
      }
    }

    // Neon Headlights
    const lightGeo = new THREE.BoxGeometry(0.4, 0.15, 0.1);
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const leftLight = new THREE.Mesh(lightGeo, headlightMat);
    leftLight.position.set(-0.9, 0.5, 2.41);
    carGroup.add(leftLight);
    const rightLight = new THREE.Mesh(lightGeo, headlightMat);
    rightLight.position.set(0.9, 0.5, 2.41);
    carGroup.add(rightLight);

    // Taillights
    const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const leftTail = new THREE.Mesh(lightGeo, tailLightMat);
    leftTail.position.set(-0.9, 0.55, -2.41);
    carGroup.add(leftTail);
    const rightTail = new THREE.Mesh(lightGeo, tailLightMat);
    rightTail.position.set(0.9, 0.55, -2.41);
    carGroup.add(rightTail);

    // Cylinder Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 24);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x111622, // Deep rubber charcoal black
      roughness: 0.95, // High roughness for realistic matte rubber look
      metalness: 0.05,
    });
    
    const wheels: THREE.Mesh[] = [];
    const frontSteerGroups: THREE.Group[] = [];
    const wheelOffsets = [
      { x: -1.25, y: 0.35, z: 1.5 },   // FL
      { x: 1.25, y: 0.35, z: 1.5 },    // FR
      { x: -1.25, y: 0.35, z: -1.4 },  // RL
      { x: 1.25, y: 0.35, z: -1.4 },   // RR
    ];

    const rimStyle = selectedCar.rimStyle || 'sports';

    wheelOffsets.forEach((offset, idx) => {
      // Create a wheel container to handle steering (Y-rotation) and position
      const wheelContainer = new THREE.Group();
      wheelContainer.position.set(offset.x, offset.y, offset.z);
      carGroup.add(wheelContainer);

      if (idx === 0 || idx === 1) {
        frontSteerGroups.push(wheelContainer);
      }

      const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
      wMesh.position.set(0, 0, 0); // centered inside container
      wMesh.castShadow = true;

      // 1. Proc Tread Block Rings: Add longitudinal tread grooves to the tire outer surface
      const grooveMat = new THREE.MeshStandardMaterial({ color: 0x070b12, roughness: 0.98 });
      // Add 2 deep grooves around the center of the tire
      const grooveGeo = new THREE.CylinderGeometry(0.554, 0.554, 0.03, 24);
      grooveGeo.rotateZ(Math.PI / 2);
      
      const leftGroove = new THREE.Mesh(grooveGeo, grooveMat);
      leftGroove.position.set(-0.1, 0, 0);
      wMesh.add(leftGroove);
      
      const rightGroove = new THREE.Mesh(grooveGeo, grooveMat);
      rightGroove.position.set(0.1, 0, 0);
      wMesh.add(rightGroove);

      // 2. Transverse Tread Blocks: Add radial tread blocks around the perimeter of the tires
      const treadCount = 16;
      const treadMat = new THREE.MeshStandardMaterial({ color: 0x151b26, roughness: 0.95 });
      const treadBarGeo = new THREE.BoxGeometry(0.44, 0.02, 0.07); // Width of tire, thickness, height of block
      
      for (let i = 0; i < treadCount; i++) {
        const angle = (i * Math.PI * 2) / treadCount;
        const treadBar = new THREE.Mesh(treadBarGeo, treadMat);
        // Position along the outer face of the wheel cylinder in Y-Z plane
        treadBar.position.set(0, Math.sin(angle) * 0.55, Math.cos(angle) * 0.55);
        treadBar.rotation.x = angle; // Align to circumference
        wMesh.add(treadBar);
      }

      // 3. Sidewall details (Sports lettering stripe matching performance tier)
      let sidewallStripeColor = 0x334155; // level 1: standard grey stripe
      if (upgrades.tires === 2) sidewallStripeColor = 0x3b82f6; // blue racing stripe
      else if (upgrades.tires === 3) sidewallStripeColor = 0xeab308; // yellow racing stripe
      else if (upgrades.tires === 4) sidewallStripeColor = 0xf97316; // orange racing stripe
      else if (upgrades.tires === 5) sidewallStripeColor = 0xef4444; // red racing stripe (highest tier!)

      const isLeft = offset.x < 0;
      const rimLocalX = isLeft ? -0.235 : 0.235;

      const ringGeo = new THREE.RingGeometry(0.38, 0.43, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: sidewallStripeColor,
        side: THREE.DoubleSide,
      });
      const sidewallStripe = new THREE.Mesh(ringGeo, ringMat);
      sidewallStripe.position.set(rimLocalX * 0.98, 0, 0); // flush on sidewall
      sidewallStripe.rotation.y = Math.PI / 2;
      wMesh.add(sidewallStripe);

      // Dynamic Alloy Rim Group added as child of the wheel mesh to rotate with it!
      const rimGroup = new THREE.Group();
      rimGroup.position.set(rimLocalX, 0, 0);
      
      // Orient rim flat face outward
      rimGroup.rotation.y = isLeft ? -Math.PI / 2 : Math.PI / 2;

      // Base rim cap disc
      const rimCapGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.04, 16);
      rimCapGeo.rotateX(Math.PI / 2);
      
      let rimColor = 0xd1d5db;
      let rimRough = 0.15;
      let rimMetal = 0.9;
      
      if (rimStyle === 'carbon') {
        rimColor = 0x1e293b;
        rimRough = 0.8;
        rimMetal = 0.2;
      } else if (rimStyle === 'goldstar') {
        rimColor = 0xd97706;
        rimRough = 0.1;
        rimMetal = 0.95;
      } else if (rimStyle === 'deepdish') {
        rimColor = 0xf1f5f9;
        rimRough = 0.05;
        rimMetal = 1.0;
      }

      const rimCapMat = new THREE.MeshStandardMaterial({
        color: rimColor,
        roughness: rimRough,
        metalness: rimMetal,
      });

      const rimCap = new THREE.Mesh(rimCapGeo, rimCapMat);
      rimGroup.add(rimCap);

      // Build procedurally accurate spokes
      if (rimStyle === 'sports') {
        const spokeGeo = new THREE.BoxGeometry(0.08, 0.44, 0.05);
        const spokeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
        for (let i = 0; i < 5; i++) {
          const spoke = new THREE.Mesh(spokeGeo, spokeMat);
          spoke.rotation.z = (i * Math.PI * 2) / 5;
          spoke.position.set(0, 0, 0.02);
          rimGroup.add(spoke);
        }
      } else if (rimStyle === 'carbon') {
        const spokeGeo = new THREE.BoxGeometry(0.05, 0.44, 0.03);
        const spokeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.1, roughness: 0.9 });
        for (let i = 0; i < 8; i++) {
          const spoke = new THREE.Mesh(spokeGeo, spokeMat);
          spoke.rotation.z = (i * Math.PI * 2) / 8;
          spoke.position.set(0, 0, 0.02);
          rimGroup.add(spoke);
        }
      } else if (rimStyle === 'goldstar') {
        const spokeGeo = new THREE.BoxGeometry(0.08, 0.44, 0.06);
        const spokeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.95, roughness: 0.15 });
        for (let i = 0; i < 5; i++) {
          const spoke = new THREE.Mesh(spokeGeo, spokeMat);
          spoke.rotation.z = (i * Math.PI * 2) / 5;
          spoke.position.set(0, 0, 0.03);
          rimGroup.add(spoke);
        }
        const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 6), spokeMat);
        centerCap.rotateX(Math.PI / 2);
        centerCap.position.set(0, 0, 0.04);
        rimGroup.add(centerCap);
      } else if (rimStyle === 'deepdish') {
        const lipGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.06, 12);
        lipGeo.rotateX(Math.PI / 2);
        const lipMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.2, roughness: 0.8 });
        const innerLip = new THREE.Mesh(lipGeo, lipMat);
        innerLip.position.set(0, 0, 0.02);
        rimGroup.add(innerLip);

        const spokeGeo = new THREE.BoxGeometry(0.04, 0.36, 0.02);
        const spokeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.05 });
        for (let i = 0; i < 12; i++) {
          const spoke = new THREE.Mesh(spokeGeo, spokeMat);
          spoke.rotation.z = (i * Math.PI * 2) / 12;
          spoke.position.set(0, 0, 0.03);
          rimGroup.add(spoke);
        }
      }

      wMesh.add(rimGroup);
      wheelContainer.add(wMesh);
      wheels.push(wMesh);
    });

    // Add Exhaust Flame Emitters for Nitro Boost
    const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 6);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const leftPipe = new THREE.Mesh(exhaustGeo, exhaustMat);
    leftPipe.position.set(-0.6, 0.28, -2.42);
    carGroup.add(leftPipe);
    const rightPipe = new THREE.Mesh(exhaustGeo, exhaustMat);
    rightPipe.position.set(0.6, 0.28, -2.42);
    carGroup.add(rightPipe);

    scene.add(carGroup);

    // Initial position on starting grid (slightly behind start line Checkpoint 0)
    const initialPos = roadSpline.getPointAt(0.995);
    const lookAtStart = roadSpline.getPointAt(0);
    carGroup.position.copy(initialPos);
    carGroup.lookAt(lookAtStart);
    
    // Extract base angle from spline facing
    const facingDir = new THREE.Vector3().subVectors(lookAtStart, initialPos).normalize();
    const baseAngle = Math.atan2(facingDir.x, facingDir.z);

    stateRef.current.car.pos.copy(initialPos);
    stateRef.current.car.dir = baseAngle;

    // 10. AI Opponent Vehicles Model Construction
    const aiGroups: THREE.Group[] = [];
    const aiWheelsList: THREE.Mesh[][] = [];

    stateRef.current.aiCars.forEach((aiSpec, idx) => {
      const g = new THREE.Group();
      
      const aBodyGeo = new THREE.BoxGeometry(2.4, 0.65, 4.8);
      const aBodyMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(aiSpec.color),
        roughness: 0.3,
        metalness: 0.7,
      });
      const aBodyMesh = new THREE.Mesh(aBodyGeo, aBodyMat);
      aBodyMesh.position.y = 0.55;
      aBodyMesh.castShadow = true;
      g.add(aBodyMesh);

      const aCabinGeo = new THREE.BoxGeometry(1.8, 0.6, 2.0);
      const aCabinMesh = new THREE.Mesh(aCabinGeo, cabinMat);
      aCabinMesh.position.set(0, 1.05, -0.2);
      aCabinMesh.castShadow = true;
      g.add(aCabinMesh);

      // Wheels
      const aiWheels: THREE.Mesh[] = [];
      wheelOffsets.forEach((offset) => {
        const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
        wMesh.position.set(offset.x, offset.y, offset.z);
        wMesh.castShadow = true;

        // Simple realistic treads for AI
        const treadCount = 12;
        const treadMat = new THREE.MeshStandardMaterial({ color: 0x151b26, roughness: 0.95 });
        const treadBarGeo = new THREE.BoxGeometry(0.44, 0.02, 0.07);
        for (let i = 0; i < treadCount; i++) {
          const angle = (i * Math.PI * 2) / treadCount;
          const treadBar = new THREE.Mesh(treadBarGeo, treadMat);
          treadBar.position.set(0, Math.sin(angle) * 0.55, Math.cos(angle) * 0.55);
          treadBar.rotation.x = angle;
          wMesh.add(treadBar);
        }

        // Sidewall stripe for AI
        const isLeft = offset.x < 0;
        const rimLocalX = isLeft ? -0.235 : 0.235;
        const ringGeo = new THREE.RingGeometry(0.38, 0.43, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xe11d48, side: THREE.DoubleSide }); // ROSY racing stripe for AI!
        const sidewallStripe = new THREE.Mesh(ringGeo, ringMat);
        sidewallStripe.position.set(rimLocalX * 0.98, 0, 0);
        sidewallStripe.rotation.y = Math.PI / 2;
        wMesh.add(sidewallStripe);

        // Simple metallic rims for AI
        const rimGroup = new THREE.Group();
        rimGroup.position.set(rimLocalX, 0, 0);
        rimGroup.rotation.y = isLeft ? -Math.PI / 2 : Math.PI / 2;
        const rimCapGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.04, 12);
        rimCapGeo.rotateX(Math.PI / 2);
        const rimCapMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.2, metalness: 0.8 });
        const rimCap = new THREE.Mesh(rimCapGeo, rimCapMat);
        rimGroup.add(rimCap);

        // Simple spokes for AI
        const spokeGeo = new THREE.BoxGeometry(0.08, 0.44, 0.05);
        for (let i = 0; i < 5; i++) {
          const spoke = new THREE.Mesh(spokeGeo, rimCapMat);
          spoke.rotation.z = (i * Math.PI * 2) / 5;
          rimGroup.add(spoke);
        }

        wMesh.add(rimGroup);
        g.add(wMesh);
        aiWheels.push(wMesh);
      });
      aiWheelsList.push(aiWheels);

      // Place AI slightly scattered on starting line grid
      const startingProgress = 0.985 - (idx * 0.01);
      const aiStartPos = roadSpline.getPointAt(startingProgress);
      const tangent = roadSpline.getTangentAt(startingProgress).normalize();
      const rightVec = new THREE.Vector3().crossVectors(tangent, up).normalize();
      
      // Shift left/right on grid lane
      aiStartPos.addScaledVector(rightVec, aiSpec.offset);
      
      g.position.copy(aiStartPos);
      g.lookAt(aiStartPos.clone().add(tangent));

      scene.add(g);
      aiGroups.push(g);
      
      aiSpec.pos.copy(aiStartPos);
      aiSpec.progress = startingProgress;
    });

    // 11. Visual Particle FX Systems
    // Smoke exhaust particles
    const particleCount = 25;
    const particleGeometry = new THREE.SphereGeometry(0.12, 4, 4);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.55,
    });
    const smokeParticles: { mesh: THREE.Mesh; age: number; maxAge: number; vel: THREE.Vector3 }[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      const pMesh = new THREE.Mesh(particleGeometry, particleMaterial);
      pMesh.visible = false;
      scene.add(pMesh);
      smokeParticles.push({
        mesh: pMesh,
        age: 0,
        maxAge: 0,
        vel: new THREE.Vector3(),
      });
    }

    // Nitro Flame particle geometry
    const nitroFlameMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.9,
    });
    const nitroParticles: { mesh: THREE.Mesh; age: number; maxAge: number; vel: THREE.Vector3 }[] = [];
    for (let i = 0; i < 15; i++) {
      const pMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 4, 4), nitroFlameMat);
      pMesh.visible = false;
      scene.add(pMesh);
      nitroParticles.push({
        mesh: pMesh,
        age: 0,
        maxAge: 0,
        vel: new THREE.Vector3(),
      });
    }

    // Collision sparks system
    const sparkParticles: { mesh: THREE.Mesh; age: number; maxAge: number; vel: THREE.Vector3 }[] = [];
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfab005 });
    for (let i = 0; i < 20; i++) {
      const sMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sparkMat);
      sMesh.visible = false;
      scene.add(sMesh);
      sparkParticles.push({
        mesh: sMesh,
        age: 0,
        maxAge: 0,
        vel: new THREE.Vector3(),
      });
    }

    const spawnSpark = (pos: THREE.Vector3) => {
      sparkParticles.forEach((sp) => {
        if (!sp.mesh.visible) {
          sp.mesh.visible = true;
          sp.mesh.position.copy(pos);
          sp.age = 0;
          sp.maxAge = 15 + Math.random() * 20;
          sp.vel.set(
            (Math.random() - 0.5) * 5,
            Math.random() * 4 + 2,
            (Math.random() - 0.5) * 5
          );
        }
      });
    };

    // 11b. Weather Particle FX (Rain / Snow)
    const weatherParticleCount = 400;
    const weatherGeometry = new THREE.BufferGeometry();
    const weatherPositions = new Float32Array(weatherParticleCount * 3);

    for (let i = 0; i < weatherParticleCount; i++) {
      weatherPositions[i * 3] = (Math.random() - 0.5) * 200;
      weatherPositions[i * 3 + 1] = Math.random() * 80;
      weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }

    weatherGeometry.setAttribute('position', new THREE.BufferAttribute(weatherPositions, 3));

    const weatherMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.45,
      transparent: true,
      opacity: 0.0, // starts invisible
      depthWrite: false,
    });

    const weatherPoints = new THREE.Points(weatherGeometry, weatherMaterial);
    scene.add(weatherPoints);

    // 12. Audio Context initialization on first click
    const startAudioContext = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    // Keyboard controls
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') {
        return;
      }
      startAudioContext();
      if (e.key === 'p' || e.key === 'Escape') {
        setPaused((prev) => !prev);
      }
      if (e.key in stateRef.current.keys) {
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key in stateRef.current.keys) {
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // --- WEBSOCKET CLIENT CONFIGURATION ---
    const playerName = localStorage.getItem('race_player_name') || 'YOU';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WS: Connected to multiplayer lobby as:', playerName);
      ws.send(JSON.stringify({
        type: 'join',
        playerId: playerIdRef.current,
        name: playerName,
        carId: selectedCar.id,
        color: selectedCar.color,
        trackId: activeTrack.id,
        pos: { x: stateRef.current.car.pos.x, y: stateRef.current.car.pos.y, z: stateRef.current.car.pos.z },
        dir: stateRef.current.car.dir,
        speed: stateRef.current.car.speed,
        health: stateRef.current.car.health,
        lap: stateRef.current.car.lap,
        checkpoint: stateRef.current.car.checkpoint,
        finished: stateRef.current.car.finished,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'join_ack') {
          playerIdRef.current = data.playerId;
        } else if (data.type === 'state_update') {
          const serverPlayers = data.players || [];
          const state = stateRef.current;
          
          serverPlayers.forEach((p: any) => {
            if (p.id === playerIdRef.current) return; // ignore self
            
            let existing = state.remotePlayers.get(p.id);
            if (!existing) {
              const meshGroup = createRemotePlayerCarMesh(p.color, p.name);
              scene.add(meshGroup);

              const nameplateSprite = createPlayerNameplateSprite(p.name, p.color, p.health);
              meshGroup.add(nameplateSprite);

              state.remotePlayers.set(p.id, {
                id: p.id,
                name: p.name,
                carId: p.carId,
                color: p.color,
                pos: new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z),
                targetPos: new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z),
                dir: p.dir,
                targetDir: p.dir,
                speed: p.speed,
                health: p.health,
                lap: p.lap,
                checkpoint: p.checkpoint,
                finished: p.finished,
                meshGroup,
                nameplateSprite,
              });
            } else {
              existing.targetPos.set(p.pos.x, p.pos.y, p.pos.z);
              existing.targetDir = p.dir;
              existing.speed = p.speed;
              existing.lap = p.lap;
              existing.checkpoint = p.checkpoint;
              existing.finished = p.finished;
              
              if (existing.health !== p.health) {
                existing.health = p.health;
                if (existing.meshGroup && existing.nameplateSprite) {
                  existing.meshGroup.remove(existing.nameplateSprite);
                  existing.nameplateSprite.material.map.dispose();
                  existing.nameplateSprite.material.dispose();
                  
                  const newSprite = createPlayerNameplateSprite(p.name, p.color, p.health);
                  existing.nameplateSprite = newSprite;
                  existing.meshGroup.add(newSprite);
                }
              }
            }
          });

          // Check if any player left
          const serverPlayerIds = new Set(serverPlayers.map((p: any) => p.id));
          state.remotePlayers.forEach((p, id) => {
            if (!serverPlayerIds.has(id)) {
              if (p.meshGroup) {
                scene.remove(p.meshGroup);
                p.meshGroup.traverse((child) => {
                  if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                      child.material.forEach((m) => m.dispose());
                    } else {
                      child.material.dispose();
                    }
                  }
                });
              }
              state.remotePlayers.delete(id);
            }
          });
        } else if (data.type === 'player_left') {
          const state = stateRef.current;
          const p = state.remotePlayers.get(data.playerId);
          if (p) {
            if (p.meshGroup) {
              scene.remove(p.meshGroup);
              p.meshGroup.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  child.geometry.dispose();
                  if (Array.isArray(child.material)) {
                    child.material.forEach((m) => m.dispose());
                  } else {
                    child.material.dispose();
                  }
                }
              });
            }
            state.remotePlayers.delete(data.playerId);
          }
        } else if (data.type === 'chat' || data.type === 'emoji') {
          setChatMessages((prev) => {
            const next = [...prev, {
              id: Math.random().toString(),
              sender: data.senderName,
              text: data.text,
              type: data.type,
            }];
            return next.slice(-20);
          });

          if (data.type === 'emoji' && data.text) {
            const senderId = data.playerId;
            const state = stateRef.current;
            const p = state.remotePlayers.get(senderId);
            if (p && p.meshGroup) {
              spawnFloatingEmojiSprite(p.meshGroup, data.text);
            } else if (senderId === playerIdRef.current) {
              spawnFloatingEmojiSprite(carGroup, data.text);
            }
          }
        }
      } catch (err) {
        console.error('Error handling ws message:', err);
      }
    };

    // Initial audio trigger
    initSynthSounds();

    // 13. Game Animation Tick Loop
    let lastTime = performance.now();
    let frameId: number;

    const gameLoop = () => {
      frameId = requestAnimationFrame(gameLoop);

      const currentTime = performance.now();
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1); // cap time step to prevent physics bursts
      lastTime = currentTime;

      const state = stateRef.current;

      if (paused) return;

      // Handle Starting Countdown clock ticking down
      if (!state.raceActive) {
        state.countdownTimer -= dt;
        if (state.countdownTimer <= 0 && countdown !== 'GO!') {
          setCountdown('GO!');
          state.raceActive = true;
          setRaceActive(true);
          state.car.lapStartTime = state.time;
          // Auto clear "GO!" banner after 1.5 seconds
          setTimeout(() => setCountdown(null), 1500);
        } else if (state.countdownTimer > 0) {
          const currentSec = Math.ceil(state.countdownTimer);
          if (countdown !== currentSec) {
            setCountdown(currentSec);
          }
        }
      } else {
        state.time += dt;
        setRaceTime(state.time);
      }

      // --- WEATHER SYSTEM VISUALS & PHYSICS COUPLING ---
      const activeWeather = weatherRef.current;
      
      let gripWeatherMult = 1.0;
      let accelWeatherMult = 1.0;
      let speedWeatherMult = 1.0;
      let aiWeatherMult = 1.0;

      let targetSkyColor = activeTrack.skyColor;
      let targetFogColor = activeTrack.skyColor;
      let targetFogDensity = 0.002;
      let targetOpacity = 0.0;
      let targetSize = 0.45;

      if (activeWeather === 'rain') {
        gripWeatherMult = 0.78; // slippery wet road
        accelWeatherMult = 0.94; // traction loss
        speedWeatherMult = 0.96;
        aiWeatherMult = 0.95;

        targetSkyColor = '#1e293b'; // dark rain overcast
        targetFogColor = '#27303f';
        targetFogDensity = 0.008;
        targetOpacity = 0.75;
        targetSize = 0.35;
      } else if (activeWeather === 'snow') {
        gripWeatherMult = 0.58; // extremely slick ice
        accelWeatherMult = 0.82; // massive wheelspin/power loss
        speedWeatherMult = 0.90;
        aiWeatherMult = 0.88;

        targetSkyColor = '#cbd5e1'; // frosty white snow overcast
        targetFogColor = '#cbd5e1';
        targetFogDensity = 0.012;
        targetOpacity = 0.85;
        targetSize = 0.55;
      } else if (activeWeather === 'fog') {
        gripWeatherMult = 0.92; // damp tarmac
        accelWeatherMult = 0.98;
        speedWeatherMult = 0.85; // reduced visibility safety cap
        aiWeatherMult = 0.82;

        targetSkyColor = '#475569'; // dense pea-soup fog
        targetFogColor = '#475569';
        targetFogDensity = 0.026; // extremely heavy fog!
        targetOpacity = 0.0; // no falling particles needed
      }

      // Smoothly interpolate scene visuals for cinematic look
      const skyColObj = new THREE.Color(targetSkyColor);
      const fogColObj = new THREE.Color(targetFogColor);
      
      if (scene.background && (scene.background as any).isColor) {
        (scene.background as THREE.Color).lerp(skyColObj, dt * 2.0);
      }
      if (scene.fog) {
        scene.fog.color.lerp(fogColObj, dt * 2.0);
        (scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp((scene.fog as THREE.FogExp2).density, targetFogDensity, dt * 2.0);
      }

      // Smoothly fade in/out weather particles
      weatherMaterial.opacity = THREE.MathUtils.lerp(weatherMaterial.opacity, targetOpacity, dt * 2.0);
      weatherMaterial.size = THREE.MathUtils.lerp(weatherMaterial.size, targetSize, dt * 2.0);

      // Animate falling rain or snow particles
      if (weatherMaterial.opacity > 0.01) {
        const positions = weatherGeometry.attributes.position.array as Float32Array;
        const carPos = state.car.pos;
        
        for (let i = 0; i < weatherParticleCount; i++) {
          let px = positions[i * 3];
          let py = positions[i * 3 + 1];
          let pz = positions[i * 3 + 2];

          // Move particles downwards
          if (activeWeather === 'rain') {
            py -= dt * 45; // rapid rain drops
            px += Math.sin(state.time * 2 + i) * 0.1; // mild wind sway
          } else if (activeWeather === 'snow') {
            py -= dt * 8; // gentle floating snow flakes
            px += Math.sin(state.time + i) * 0.25; // beautiful float sway
            pz += Math.cos(state.time * 0.5 + i) * 0.15;
          }

          // Bound checking: reset inside a cylinder dome around the car
          const dx = px - carPos.x;
          const dz = pz - carPos.z;
          const distSq = dx * dx + dz * dz;

          if (py < 0 || distSq > 90 * 90) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 85;
            px = carPos.x + Math.sin(angle) * radius;
            py = 40 + Math.random() * 25; // drop from cloud height
            pz = carPos.z + Math.cos(angle) * radius;
          }

          positions[i * 3] = px;
          positions[i * 3 + 1] = py;
          positions[i * 3 + 2] = pz;
        }
        weatherGeometry.attributes.position.needsUpdate = true;
      }

      // --- PLAYER PHYSICS ENGINE LOGIC ---
      const car = state.car;
      const keys = state.keys;

      // Pit Stop Entry and Servicing Logic
      const distToPit = car.pos.distanceTo(state.pitCenter);
      const inPitZone = distToPit < 8.5;

      // Handle Reset of pit trigger lock when player drives away
      if (distToPit > 12.0) {
        state.pitResetReady = true;
      }

      // Check for Pit entry conditions (Speed < 20 km/h inside the pit zone and reset ready)
      if (inPitZone && car.speed < 20.0 && state.pitResetReady && !car.finished && state.raceActive) {
        car.isPitting = true;
        state.pitResetReady = false;
        car.speed = 0;
        car.vel.set(0, 0, 0);
        car.pos.copy(state.pitCenter); // Snap perfectly to service grid
        car.pitProgress = 0;
        car.pitStatus = 'refueling';
        setIsPitting(true);
        setPitServiceStatus('refueling');
      }

      // Handle active pit stop servicing sequence
      if (car.isPitting) {
        car.speed = 0;
        car.vel.set(0, 0, 0);

        if (car.pitStatus === 'refueling') {
          car.fuel = Math.min(car.fuel + dt * 38, 100);
          if (Math.floor(state.time * 6) % 2 === 0) playPitRefuelingSound();
          if (car.fuel >= 100) {
            car.pitStatus = 'tire_change';
            setPitServiceStatus('tire_change');
          }
        } else if (car.pitStatus === 'tire_change') {
          car.tireWear = Math.max(car.tireWear - dt * 45, 0);
          car.tireTemp = THREE.MathUtils.lerp(car.tireTemp, 90, dt * 4); // Cool or warm towards ideal temp
          if (Math.floor(state.time * 4) % 2 === 0) playPneumaticGunSound();
          if (car.tireWear <= 0) {
            car.pitStatus = 'repair';
            setPitServiceStatus('repair');
          }
        } else if (car.pitStatus === 'repair') {
          car.health = Math.min(car.health + dt * 38, 100);
          if (Math.floor(state.time * 10) % 2 === 0) {
            playWeldingSparkSound();
            spawnSpark(car.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.5, 0.4, (Math.random() - 0.5) * 4)));
          }
          if (car.health >= 100) {
            car.pitStatus = 'done';
            setPitServiceStatus('done');
          }
        } else if (car.pitStatus === 'done') {
          // Servicing is complete! Wait 1 second then release the car
          car.pitProgress += dt;
          if (car.pitProgress > 1.2) {
            car.isPitting = false;
            setIsPitting(false);
            car.speed = 15; // Give a small forward boost out of pit lane
            car.vel.set(Math.sin(car.dir) * 15, 0, Math.cos(car.dir) * 15);
            setPitServiceStatus('idle');
          }
        }
      }

      // 1. Weather-Dependent Ambient Temperatures and Tire Thermal Math
      let ambientTemp = 25;
      if (activeWeather === 'rain') ambientTemp = 15;
      if (activeWeather === 'snow') ambientTemp = -5;
      if (activeWeather === 'fog') ambientTemp = 18;

      if (!car.isPitting) {
        if (car.isDrifting && car.speed > 8) {
          // Drifting heats up tires rapidly
          car.tireTemp = Math.min(car.tireTemp + dt * 26.0, 145);
          // Drifting increases tire wear significantly
          car.tireWear = Math.min(car.tireWear + dt * 1.6, 100);
        } else {
          // Cool or warm towards dynamic target running temperature
          const dynamicWarmth = car.speed > 5 ? 42 + (car.speed / MAX_SPEED) * 35 : 0;
          const targetTemp = ambientTemp + dynamicWarmth;
          car.tireTemp = THREE.MathUtils.lerp(car.tireTemp, targetTemp, dt * 0.12);
          
          // Small gradual tire wear in normal driving
          if (car.speed > 5) {
            car.tireWear = Math.min(car.tireWear + dt * 0.015 * (car.speed / MAX_SPEED), 100);
          }
        }
      }

      // Compute tire thermal and wear grip multiplier (0.45x to 1.0x grip scale)
      let wearGripMult = 1.0 - (car.tireWear / 100) * 0.52;
      let tempGripMult = 1.0;
      if (car.tireTemp < 60) {
        // Cold tires have lower traction
        tempGripMult = 0.82 + 0.18 * ((car.tireTemp + 5) / 65);
      } else if (car.tireTemp > 115) {
        // Overheated tires lose stability
        tempGripMult = Math.max(0.68, 1.0 - ((car.tireTemp - 115) / 30) * 0.32);
      }
      const finalTireGrip = wearGripMult * tempGripMult;

      // 2. Real-Life Fuel Burning Math
      if (state.raceActive && !car.finished && !car.isPitting) {
        const throttleApplied = keys.w || keys.Shift;
        const fuelBurnRate = throttleApplied ? (keys.Shift && car.nitro > 1 ? 0.92 : 0.30) : 0.05;
        car.fuel = Math.max(car.fuel - dt * fuelBurnRate * (car.speed / MAX_SPEED + 0.18), 0);
      }

      // Friction & Steering depending on drift status (handbrake or slide angle)
      const currentNormalGrip = (keys[' '] ? HANDBRAKE_FRICTION : NORMAL_GRIP) * gripWeatherMult * finalTireGrip;
      const currentDriftGrip = DRIFT_GRIP * gripWeatherMult * finalTireGrip;
      const turnPower = (keys[' '] ? 2.5 : 1.6) * (Math.PI / 180) * (2.0 - (car.speed / MAX_SPEED));

      // Steer turning input (lock steer turning input if pitting)
      let steeringInput = 0;
      if (!car.isPitting) {
        if (keys.a) steeringInput = 1;
        if (keys.d) steeringInput = -1;
      }

      // Steering Wheel Visual articulation
      if (frontSteerGroups[0] && frontSteerGroups[1]) {
        frontSteerGroups[0].rotation.y = steeringInput * 0.45;
        frontSteerGroups[1].rotation.y = steeringInput * 0.45;
      }

      car.dir += steeringInput * turnPower * Math.min(car.speed / 12, 1);

      // 3. Throttle Motor Power / Brake Torques (affected by damage and fuel levels)
      let isBoosting = false;
      
      const healthPenalty = 0.45 + 0.55 * (car.health / 100); // 45% speed at 0% health
      const isOutofFuel = car.fuel <= 0;
      let topCapSpeed = MAX_SPEED * speedWeatherMult * healthPenalty;
      let currentAccel = ACCELERATION * accelWeatherMult * healthPenalty;

      // Out of fuel limp mode overrides normal physics limits
      if (isOutofFuel) {
        topCapSpeed = 15;
        currentAccel = 0.04;
      }

      if (state.raceActive && !car.finished && !car.isPitting) {
        // Accelerating
        if (keys.w) {
          // Check Nitro triggers
          if (keys.Shift && car.nitro > 1 && !isOutofFuel) {
            isBoosting = true;
            topCapSpeed = MAX_SPEED * NITRO_FORCE * speedWeatherMult * healthPenalty;
            car.speed = Math.min(car.speed + currentAccel * 2.5, topCapSpeed);
            car.nitro = Math.max(car.nitro - dt * 25, 0);
          } else {
            car.speed = Math.min(car.speed + currentAccel, topCapSpeed);
          }
        } else if (keys.s) {
          // Reverse or Brake
          car.speed = Math.max(car.speed - BRAKING, -25);
        } else {
          // Engine braking friction
          car.speed *= 0.985;
        }
      }

      // Adjust dynamic tires lateral grip during drifts (drift angle formula)
      const velocityVec = new THREE.Vector3(Math.sin(car.dir), 0, Math.cos(car.dir)).multiplyScalar(car.speed);
      
      // Project velocity to side vector to compute slip ratio
      const sideVec = new THREE.Vector3(-Math.cos(car.dir), 0, Math.sin(car.dir));
      const lateralSlip = velocityVec.dot(sideVec);
      car.isDrifting = Math.abs(lateralSlip) > 12 || keys[' '];

      // Blend current car direction velocity with sliding momentum
      car.vel.lerp(velocityVec, car.isDrifting ? currentDriftGrip : currentNormalGrip);
      
      // Apply movement displacement
      car.pos.addScaledVector(car.vel, dt * 0.28); // scaling velocity scale to feel rapid in 3D scale

      // Track bounding check: Snap car to road surface mesh or collide with wall guardrails using highly-accurate 2D projection
      let bestCoarseU = 0;
      let minCoarseDistSq = Infinity;

      // 1. Coarse search (100 samples) across the track using horizontal 2D distance
      for (let s = 0; s <= 100; s++) {
        const u = s / 100;
        const pt = roadSpline.getPointAt(u);
        const dx = car.pos.x - pt.x;
        const dz = car.pos.z - pt.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < minCoarseDistSq) {
          minCoarseDistSq = distSq;
          bestCoarseU = u;
        }
      }

      // 2. Fine search around bestCoarseU (+/- 0.015) to locate the exact closest point
      const searchRange = 0.03;
      const fineSteps = 12;
      let closestPointOnSpline = new THREE.Vector3();
      let splineU = bestCoarseU;
      let minFineDistSq = Infinity;

      for (let s = 0; s <= fineSteps; s++) {
        const offset = -searchRange / 2 + (s / fineSteps) * searchRange;
        // Wrap u value nicely between 0.0 and 1.0
        const u = (bestCoarseU + offset + 1.0) % 1.0;
        const pt = roadSpline.getPointAt(u);
        const dx = car.pos.x - pt.x;
        const dz = car.pos.z - pt.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < minFineDistSq) {
          minFineDistSq = distSq;
          closestPointOnSpline.copy(pt);
          splineU = u;
        }
      }

      const minDistance = Math.sqrt(minFineDistSq);

      // Check height elevation snap - Time-corrected highly-responsive snapping to prevent car from sinking on steep hills
      car.pos.y = THREE.MathUtils.lerp(car.pos.y, closestPointOnSpline.y, Math.min(1.0, dt * 25.0));

      // Handle track boundary collision triggers (if car flies offroad limit)
      const limitDist = TRACK_WIDTH / 2 - 1.2;
      if (minDistance > limitDist) {
        // Push vehicle back inside track borders
        const pushDir = new THREE.Vector3().subVectors(closestPointOnSpline, car.pos).normalize();
        pushDir.y = 0; // lock flat
        
        car.pos.addScaledVector(pushDir, minDistance - limitDist);
        car.speed = -car.speed * 0.35; // bounce bounce
        
        playCrashSound();
        spawnSpark(car.pos);
        
        car.health = Math.max(car.health - 4, 0);
        triggerCollisionFlash();
      }

      // Sync player 3D mesh Transform
      carGroup.position.copy(car.pos);
      carGroup.rotation.y = car.dir;

      // Rotate wheel visuals representing rotational speed
      const rotDelta = (car.speed * dt * 0.5);
      wheels.forEach((w) => w.rotateX(rotDelta));

      // --- EMIT TIRE DUST / EXHAUST SMOKE FX ---
      smokeParticles.forEach((sp) => {
        if (sp.mesh.visible) {
          sp.mesh.position.addScaledVector(sp.vel, dt);
          sp.mesh.scale.multiplyScalar(1.02);
          sp.age += 1;
          if (sp.age >= sp.maxAge) {
            sp.mesh.visible = false;
          }
        }
      });

      // Spawn puff from tail pipes
      if (Math.random() > 0.4) {
        const pipeSelect = Math.random() > 0.5 ? leftPipe : rightPipe;
        const spawnWorldPos = new THREE.Vector3();
        pipeSelect.getWorldPosition(spawnWorldPos);

        const freeP = smokeParticles.find((p) => !p.mesh.visible);
        if (freeP) {
          freeP.mesh.visible = true;
          freeP.mesh.position.copy(spawnWorldPos);
          freeP.mesh.scale.set(1, 1, 1);
          freeP.age = 0;
          freeP.maxAge = 15 + Math.random() * 10;
          freeP.vel.set(
            (Math.random() - 0.5) * 1.5,
            Math.random() * 0.5 + 0.2,
            -Math.sin(car.dir) * 4 + (Math.random() - 0.5) * 1
          );
        }
      }

      // Nitro Flame particles logic
      nitroParticles.forEach((np) => {
        if (np.mesh.visible) {
          np.mesh.position.addScaledVector(np.vel, dt);
          np.mesh.scale.multiplyScalar(0.95);
          np.age += 1;
          if (np.age >= np.maxAge) {
            np.mesh.visible = false;
          }
        }
      });

      if (isBoosting) {
        for (let i = 0; i < 2; i++) {
          const pipeSelect = i === 0 ? leftPipe : rightPipe;
          const spawnWorldPos = new THREE.Vector3();
          pipeSelect.getWorldPosition(spawnWorldPos);

          const freeNp = nitroParticles.find((np) => !np.mesh.visible);
          if (freeNp) {
            freeNp.mesh.visible = true;
            freeNp.mesh.position.copy(spawnWorldPos);
            freeNp.mesh.scale.set(1.5, 1.5, 1.5);
            freeNp.age = 0;
            freeNp.maxAge = 8 + Math.random() * 6;
            // Flare backward
            const backDir = new THREE.Vector3(Math.sin(car.dir + Math.PI), 0, Math.cos(car.dir + Math.PI)).normalize();
            freeNp.vel.copy(backDir).multiplyScalar(15).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
          }
        }
      }

      // Crash Spark particles ticks
      sparkParticles.forEach((sp) => {
        if (sp.mesh.visible) {
          sp.mesh.position.addScaledVector(sp.vel, dt);
          sp.vel.y -= 9.8 * dt; // gravity
          sp.age += 1;
          if (sp.age >= sp.maxAge) {
            sp.mesh.visible = false;
          }
        }
      });

      // --- AI RACER BEHAVIOR SIMULATION ---
      state.aiCars.forEach((ai, idx) => {
        if (!state.raceActive || ai.finished) return;

        // Progress AI position along track spline curve smoothly
        const topAiSpeed = 0.045 * ai.speedFactor * aiWeatherMult;
        
        // Braking slightly around sharp corners to make AI drive realistic curves
        const tangent = roadSpline.getTangentAt(ai.progress % 1.0).normalize();
        const lookAheadTangent = roadSpline.getTangentAt((ai.progress + 0.01) % 1.0).normalize();
        const curveDelta = tangent.angleTo(lookAheadTangent);
        const bendBrake = curveDelta > 0.08 ? 0.65 : 1.0;

        ai.progress += dt * topAiSpeed * bendBrake;

        const rawPos = roadSpline.getPointAt(ai.progress % 1.0);
        const upVec = new THREE.Vector3(0, 1, 0);
        const leftVec = new THREE.Vector3().crossVectors(tangent, upVec).normalize();

        // Add lateral offset so AI doesn't drive single file
        ai.pos.copy(rawPos).addScaledVector(leftVec, ai.offset);
        
        // Orient AI car direction
        const nextPos = roadSpline.getPointAt((ai.progress + 0.002) % 1.0).addScaledVector(leftVec, ai.offset);
        
        aiGroups[idx].position.copy(ai.pos);
        aiGroups[idx].lookAt(nextPos);

        // Spin AI wheels
        aiWheelsList[idx].forEach((w) => w.rotateX(dt * 15));

        // Checkpoint verification for AI
        const checkIdx = ai.lastCheckpoint;
        const nextCheckIdx = (checkIdx + 1) % state.checkpoints.length;
        const checkPt = state.checkpoints[nextCheckIdx];

        if (ai.pos.distanceTo(checkPt) < TRACK_WIDTH + 10) {
          ai.lastCheckpoint = nextCheckIdx;
          if (nextCheckIdx === 0) {
            // Completed lap!
            if (ai.currentLap >= 3) {
              ai.finished = true;
              ai.finishTime = state.time;
            } else {
              ai.currentLap++;
            }
          }
        }
      });

      // --- PLAYER CHECKPOINTS & LAPS PROGRESSION DETECTORS ---
      const activeCheckIdx = car.checkpoint;
      const targetCheckIdx = (activeCheckIdx + 1) % state.checkpoints.length;
      const targetCheckPt = state.checkpoints[targetCheckIdx];

      if (car.pos.distanceTo(targetCheckPt) < TRACK_WIDTH + 5) {
        car.checkpoint = targetCheckIdx;
        
        if (targetCheckIdx === 0) {
          // Cross start/finish gate
          const lapTime = state.time - car.lapStartTime;
          car.lapTimes.push(lapTime);
          car.lapStartTime = state.time;

          if (car.lap >= 3) {
            // Finished!
            car.finished = true;
            car.finishTime = state.time;
            
            // Calculate standing position
            const finalStandings = [...state.aiCars].filter((ai) => ai.finished && ai.finishTime < car.finishTime).length + 1;
            
            // Trigger completion callback
            const reward = finalStandings === 1 ? 300 : finalStandings === 2 ? 180 : finalStandings === 3 ? 120 : 60;
            const fastestLap = car.lapTimes.length > 0 ? Math.min(...car.lapTimes) : state.time / 3;
            onRaceFinished(finalStandings, state.time, reward, fastestLap);
          } else {
            car.lap++;
            setCurrentLap(car.lap);
          }
        }
      }

      // Smoothly interpolate remote players (LERP) in 3D
      state.remotePlayers.forEach((p: any) => {
        p.pos.lerp(p.targetPos, Math.min(1.0, dt * 10.0));
        p.dir = THREE.MathUtils.lerp(p.dir, p.targetDir, Math.min(1.0, dt * 10.0));
        if (p.meshGroup) {
          p.meshGroup.position.copy(p.pos);
          p.meshGroup.rotation.y = p.dir;
          // Spin remote car wheels representing speed
          p.meshGroup.children.forEach((w: any) => {
            if (w instanceof THREE.Mesh && w.geometry instanceof THREE.CylinderGeometry) {
              w.rotateX(dt * p.speed * 0.15);
            }
          });
        }
      });

      // Broadcast our state to other players
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "update",
          pos: { x: car.pos.x, y: car.pos.y, z: car.pos.z },
          dir: car.dir,
          speed: car.speed,
          health: car.health,
          lap: car.lap,
          checkpoint: car.checkpoint,
          finished: car.finished,
          finishTime: car.finishTime,
        }));
      }

      // --- CALCULATE ACTIVE PLACEMENTS ---
      // Position calculation based on Lap progress, Checkpoint level, and distance to next checkpoint
      const remoteRacersToSort = Array.from(state.remotePlayers.values() as any).map((p: any) => {
        const nextCheck = (p.checkpoint + 1) % state.checkpoints.length;
        const targetCheckPt = state.checkpoints[nextCheck];
        const dist = targetCheckPt ? p.pos.distanceTo(targetCheckPt) : 0;
        return { id: p.id, lap: p.lap, check: p.checkpoint, dist, finished: p.finished, time: p.finished ? 100 : 0 };
      });

      const racersToSort = [
        { id: 'player', lap: car.lap, check: car.checkpoint, dist: car.pos.distanceTo(state.checkpoints[(car.checkpoint + 1) % state.checkpoints.length]), finished: car.finished, time: car.finishTime },
        ...state.aiCars.map((ai) => ({ id: ai.id, lap: ai.currentLap, check: ai.lastCheckpoint, dist: ai.pos.distanceTo(state.checkpoints[(ai.lastCheckpoint + 1) % state.checkpoints.length]), finished: ai.finished, time: ai.finishTime })),
        ...remoteRacersToSort,
      ];

      racersToSort.sort((a, b) => {
        if (a.finished && b.finished) return a.time - b.time;
        if (a.finished) return -1;
        if (b.finished) return 1;

        if (a.lap !== b.lap) return b.lap - a.lap;
        if (a.check !== b.check) return b.check - a.check;
        return a.dist - b.dist; // smaller distance to checkpoint is ahead
      });

      const activePlayerRank = racersToSort.findIndex((r) => r.id === 'player') + 1;
      setPlayerPos(activePlayerRank);

      // Map details to state HUD
      setSpeedKmh(Math.abs(Math.round(car.speed)));
      setNitroLevel(Math.round(car.nitro));
      setFuel(Math.round(car.fuel));
      setTireWear(Math.round(car.tireWear));
      setTireTemp(Math.round(car.tireTemp));
      setCarHealth(Math.round(car.health));

      // Calculate realistic Gear and RPM
      let gear = 1;
      let gearMinSpeed = 0;
      let gearMaxSpeed = 40;
      const currentSpeedAbs = Math.abs(car.speed);
      
      if (currentSpeedAbs > 200) {
        gear = 6;
        gearMinSpeed = 200;
        gearMaxSpeed = MAX_SPEED;
      } else if (currentSpeedAbs > 145) {
        gear = 5;
        gearMinSpeed = 145;
        gearMaxSpeed = 210;
      } else if (currentSpeedAbs > 100) {
        gear = 4;
        gearMinSpeed = 100;
        gearMaxSpeed = 155;
      } else if (currentSpeedAbs > 65) {
        gear = 3;
        gearMinSpeed = 65;
        gearMaxSpeed = 110;
      } else if (currentSpeedAbs > 35) {
        gear = 2;
        gearMinSpeed = 35;
        gearMaxSpeed = 70;
      } else {
        gear = 1;
        gearMinSpeed = 0;
        gearMaxSpeed = 40;
      }
      
      setCurrentGear(gear);
      
      const speedRatioForGear = (currentSpeedAbs - gearMinSpeed) / Math.max(1, gearMaxSpeed - gearMinSpeed);
      let calculatedRpm = 1000 + Math.max(0, speedRatioForGear * 7000);
      if (keys.w && !car.isPitting) {
        calculatedRpm += Math.sin(state.time * 45) * 80; // Needle vibration!
      }
      if (calculatedRpm > 8200) {
        calculatedRpm = 8200 + Math.random() * 50; // Rev limiter bounce!
      }
      if (calculatedRpm < 1000) {
        calculatedRpm = 1000;
      }
      
      setRpm(Math.round(calculatedRpm));

      // Slowly recharge nitro
      if (!isBoosting && car.nitro < 100) {
        car.nitro = Math.min(car.nitro + dt * 4, 100);
      }

      // Set participant distances for mini-map visual placements
      const remoteParticipants = Array.from(state.remotePlayers.values() as any).map((p: any) => {
        const nextCheck = (p.checkpoint + 1) % state.checkpoints.length;
        const targetCheckPt = state.checkpoints[nextCheck];
        const dist = targetCheckPt ? p.pos.distanceTo(targetCheckPt) : 0;
        return {
          id: p.id,
          name: p.name,
          carId: p.carId,
          color: p.color,
          isPlayer: false,
          lap: p.lap,
          currentCheckpoint: p.checkpoint,
          distanceToNextCheckpoint: dist,
          totalDistance: p.lap * 1000 + p.checkpoint * 100,
          finished: p.finished,
          speed: Math.abs(p.speed),
        };
      });

      const currentParticipants: RaceParticipant[] = [
        { id: 'player', name: 'You', carId: selectedCar.id, color: selectedCar.color, isPlayer: true, lap: car.lap, currentCheckpoint: car.checkpoint, distanceToNextCheckpoint: car.pos.distanceTo(state.checkpoints[(car.checkpoint + 1) % state.checkpoints.length]), totalDistance: car.lap * 1000 + car.checkpoint * 100, finished: car.finished, speed: car.speed },
        ...state.aiCars.map((ai) => ({ id: ai.id, name: ai.name, carId: 'ai', color: ai.color, isPlayer: false, lap: ai.currentLap, currentCheckpoint: ai.lastCheckpoint, distanceToNextCheckpoint: ai.pos.distanceTo(state.checkpoints[(ai.lastCheckpoint + 1) % state.checkpoints.length]), totalDistance: ai.currentLap * 1000 + ai.lastCheckpoint * 100, finished: ai.finished, speed: ai.speedFactor * 140 })),
        ...remoteParticipants,
      ];
      setParticipants(currentParticipants);

      // --- DYNAMIC CAMERA CONTROLS AND VIEWPORT BENDS ---
      if (cameraMode === 'thirdPerson') {
        // Standard third-person chase camera
        const backOffset = new THREE.Vector3(-Math.sin(car.dir) * 11, 4.2, -Math.cos(car.dir) * 11);
        const targetCamPos = car.pos.clone().add(backOffset);
        camera.position.lerp(targetCamPos, 0.08);
        camera.lookAt(car.pos.clone().add(new THREE.Vector3(0, 1, 0)));
      } else if (cameraMode === 'hood') {
        // First-person hood bumper
        const frontOffset = new THREE.Vector3(Math.sin(car.dir) * 2.2, 0.8, Math.cos(car.dir) * 2.2);
        const targetCamPos = car.pos.clone().add(frontOffset);
        camera.position.copy(targetCamPos);
        
        const cameraHeading = car.pos.clone().add(new THREE.Vector3(Math.sin(car.dir) * 10, 0.6, Math.cos(car.dir) * 10));
        camera.lookAt(cameraHeading);
      } else {
        // Interior Cockpit View
        const interiorOffset = new THREE.Vector3(Math.sin(car.dir) * 0.1 - Math.cos(car.dir) * 0.45, 1.15, Math.cos(car.dir) * 0.1 + Math.sin(car.dir) * 0.45);
        const targetCamPos = car.pos.clone().add(interiorOffset);
        camera.position.copy(targetCamPos);

        const lookTarget = car.pos.clone().add(new THREE.Vector3(Math.sin(car.dir) * 12, 0.9, Math.cos(car.dir) * 12));
        camera.lookAt(lookTarget);
      }

      // Sound update modulation (procedural frequencies)
      updateSynthSounds(car.speed / MAX_SPEED, keys.w, car.isDrifting, isBoosting);

      // Render frames
      renderer.render(scene, camera);
    };

    // Begin looping
    gameLoop();

    // Resize handlers
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Cleanups
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      
      // Stop dynamic synthesized audios
      if (engineOscRef.current) engineOscRef.current.stop();
      if (screechOscRef.current) screechOscRef.current.stop();
      if (nitroOscRef.current) nitroOscRef.current.stop();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [activeTrack, selectedCar, cameraMode, paused]);

  // Format race timer output strings
  const formatTime = (t: number) => {
    const minutes = Math.floor(t / 60);
    const seconds = Math.floor(t % 60);
    const ms = Math.floor((t * 100) % 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col" ref={containerRef} id="3d-game-viewport">
      {/* Three.js Canvas Element */}
      <canvas ref={canvasRef} className="w-full h-full flex-1 block" />

      {/* Collision Red Flash Overlay */}
      {collisionFlash && (
        <div className="absolute inset-0 bg-red-600/35 pointer-events-none z-50 border-[10px] border-red-600 animate-pulse" />
      )}

      {/* Real-time Integrity & Damage Status Banner at Top-Center */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-1.5 select-none pointer-events-none z-30">
        <div className={`px-4 py-2 rounded-xl backdrop-blur-md border ${carHealth < 40 ? 'bg-rose-950/85 border-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse' : 'bg-slate-950/85 border-slate-800'} flex items-center gap-3 transition-all duration-300`}>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">CAR INTEGRITY</span>
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`h-4 w-2 rounded-sm transition-all ${
                  carHealth > i * 20
                    ? carHealth < 40
                      ? 'bg-rose-500 animate-pulse'
                      : 'bg-emerald-400'
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
          <span className={`font-mono text-sm font-bold leading-none ${carHealth < 40 ? 'text-rose-400 font-black animate-pulse' : 'text-emerald-400'}`}>
            {carHealth}%
          </span>
        </div>
      </div>

      {/* Real-time Multiplayer Chat & Reaction Panel */}
      <div className="absolute top-20 left-4 w-80 max-h-72 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-slate-800/80 flex flex-col p-3 z-30 select-none pointer-events-auto shadow-2xl">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800/60 mb-2">
          <span className="text-[10px] text-emerald-400 font-extrabold tracking-widest uppercase flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
            LIVE RACING LOBBY
          </span>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            {participants.length} Active Players
          </span>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800 max-h-36">
          {chatMessages.length === 0 ? (
            <div className="text-[10px] text-slate-500 italic text-center py-4">No race logs yet. Type a message or send an emoji!</div>
          ) : (
            chatMessages.map((msg) => (
              <div key={msg.id} className="text-xs break-all leading-relaxed">
                <span className="font-extrabold mr-1.5" style={{ color: msg.sender === 'YOU' || msg.sender === localStorage.getItem('race_player_name') ? '#10b981' : '#38bdf8' }}>
                  {msg.sender}:
                </span>
                <span className={msg.type === 'emoji' ? 'text-base font-bold' : 'text-slate-200'}>{msg.text}</span>
              </div>
            ))
          )}
        </div>

        {/* Quick Emoji Reaction Palette */}
        <div className="grid grid-cols-6 gap-1 mt-2.5 pb-2 border-b border-slate-800/40">
          {['👍', '🔥', '😂', '👑', '😮', '💀'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                  socketRef.current.send(JSON.stringify({
                    type: 'emoji',
                    text: emoji,
                    senderName: localStorage.getItem('race_player_name') || 'YOU',
                  }));
                }
              }}
              className="text-base hover:scale-125 transition-all duration-75 py-1 rounded-md bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-750 pointer-events-auto cursor-pointer flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Chat input box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!chatInput.trim()) return;
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({
                type: 'chat',
                text: chatInput,
                senderName: localStorage.getItem('race_player_name') || 'YOU',
              }));
            }
            setChatInput('');
          }}
          className="flex gap-2 mt-2 pointer-events-auto"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onFocus={() => setActiveInput(true)}
            onBlur={() => setActiveInput(false)}
            placeholder="Type a message..."
            maxLength={60}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 font-sans"
          />
          <button
            type="submit"
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-extrabold tracking-wider transition-all cursor-pointer uppercase shrink-0 font-sans"
          >
            SEND
          </button>
        </form>
      </div>

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-xs select-none">
          <div className="animate-ping absolute w-48 h-48 rounded-full bg-emerald-500/10"></div>
          <span className="text-8xl font-black text-emerald-400 font-sans tracking-tight drop-shadow-[0_4px_12px_rgba(16,185,129,0.3)] animate-bounce select-none">
            {countdown}
          </span>
        </div>
      )}

      {/* Standard Racing HUD Overlay */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none select-none">
        {/* Race info panel (Laps & Placements) */}
        <div className="flex gap-3">
          <div className="bg-slate-950/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800 flex items-center gap-3">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">POS</span>
            <span className="text-2xl font-black text-white font-mono leading-none">
              {playerPos}
              <span className="text-xs text-slate-400 font-semibold leading-none ml-0.5">/ 3</span>
            </span>
          </div>

          <div className="bg-slate-950/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800 flex items-center gap-3">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">LAP</span>
            <span className="text-2xl font-black text-emerald-400 font-mono leading-none">
              {currentLap}
              <span className="text-xs text-slate-500 font-normal leading-none ml-1">/ 3</span>
            </span>
          </div>
        </div>

        {/* Timers */}
        <div className="bg-slate-950/85 backdrop-blur-md px-5 py-2.5 rounded-xl border border-slate-800 flex items-center gap-2">
          <span className="font-mono text-xl text-white font-bold leading-none">
            {formatTime(raceTime)}
          </span>
        </div>
      </div>

      {/* Pit Stop Servicing Overlay */}
      {isPitting && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center z-20 select-none pointer-events-auto">
          <div className="bg-slate-900 border border-emerald-500/30 p-8 rounded-2xl shadow-2xl max-w-md w-full flex flex-col gap-6 items-center mx-4">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">PIT CREW SERVICING</span>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Active Pit Stop</h3>
              <p className="text-xs text-slate-400">Your vehicle is locked in the service bay. Restoring engine systems and mechanics...</p>
            </div>

            <div className="flex flex-col gap-4 w-full">
              {/* Refueling Stage */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className={pitServiceStatus === 'refueling' ? 'text-emerald-400 animate-pulse font-black' : (pitServiceStatus !== 'idle' && pitServiceStatus !== 'refueling') ? 'text-emerald-500' : 'text-slate-600'}>
                      {pitServiceStatus === 'refueling' ? '⚡' : (pitServiceStatus !== 'idle' && pitServiceStatus !== 'refueling') ? '✓' : '○'}
                    </span>
                    <span>REFUELING ENERGY</span>
                  </div>
                  <span className="font-mono text-emerald-400">{fuel}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-900/40">
                  <div className="h-full bg-emerald-500 transition-all duration-150" style={{ width: `${fuel}%` }} />
                </div>
              </div>

              {/* Changing Tires Stage */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className={pitServiceStatus === 'tire_change' ? 'text-emerald-400 animate-pulse font-black' : (pitServiceStatus === 'repair' || pitServiceStatus === 'done') ? 'text-emerald-500' : 'text-slate-600'}>
                      {pitServiceStatus === 'tire_change' ? '⚙️' : (pitServiceStatus === 'repair' || pitServiceStatus === 'done') ? '✓' : '○'}
                    </span>
                    <span>MOUNTING RACING SLICKS</span>
                  </div>
                  <span className="font-mono text-emerald-400">{100 - tireWear}% Condition</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-900/40">
                  <div className="h-full bg-emerald-500 transition-all duration-150" style={{ width: `${100 - tireWear}%` }} />
                </div>
              </div>

              {/* Repairs Stage */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className={pitServiceStatus === 'repair' ? 'text-emerald-400 animate-pulse font-black' : pitServiceStatus === 'done' ? 'text-emerald-500' : 'text-slate-600'}>
                      {pitServiceStatus === 'repair' ? '🔧' : pitServiceStatus === 'done' ? '✓' : '○'}
                    </span>
                    <span>CARBON BODYWORK REPAIRS</span>
                  </div>
                  <span className="font-mono text-emerald-400">{carHealth}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-900/40">
                  <div className="h-full bg-emerald-500 transition-all duration-150" style={{ width: `${carHealth}%` }} />
                </div>
              </div>
            </div>

            {pitServiceStatus === 'done' ? (
              <div className="mt-2 text-center animate-bounce">
                <span className="bg-emerald-500 text-slate-950 font-black text-lg px-6 py-2 rounded-xl tracking-wider shadow-lg shadow-emerald-500/20">
                  GO GO GO!
                </span>
              </div>
            ) : (
              <div className="mt-2 text-slate-500 font-bold text-[10px] tracking-widest animate-pulse">
                SERVICING VEHICLE... PLEASE WAIT
              </div>
            )}
          </div>
        </div>
      )}

      {/* Speedometer, RPM Cockpit DashboardHUD indicators at the bottom */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-col md:flex-row justify-between items-stretch md:items-end pointer-events-none select-none gap-4">
        {/* Left Cockpit Dial Cluster (Speed & RPM Tachometer) */}
        <div className="bg-slate-950/85 backdrop-blur-md p-4 rounded-2xl border border-slate-800/80 flex items-center gap-4 shadow-2xl min-w-[280px]">
          {/* Circular SVG Tachometer (RPM) */}
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background ring */}
              <circle cx="40" cy="40" r="34" className="stroke-slate-800" strokeWidth="5.5" fill="transparent" />
              {/* Dynamic RPM gauge */}
              <circle
                cx="40"
                cy="40"
                r="34"
                className={`${rpm > 7200 ? 'stroke-rose-500 animate-pulse' : 'stroke-emerald-400'}`}
                strokeWidth="5.5"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={2 * Math.PI * 34 * (1 - rpm / 8200)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[8px] text-slate-500 font-bold tracking-wider uppercase">GEAR</span>
              <span className="text-xl font-black text-white font-mono leading-none">{currentGear}</span>
              <span className="text-[7px] text-slate-500 font-semibold font-mono leading-none mt-0.5">{rpm}</span>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-0.5">
            <span className="text-4xl font-black text-slate-100 font-mono leading-none">
              {speedKmh}
            </span>
            <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase flex items-center gap-1.5">
              <span>KM/H</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-ping" />
            </span>
          </div>
        </div>

        {/* Controls Tutorial Note */}
        <div className="hidden xl:flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800/80 text-[10px] text-slate-400 font-semibold gap-1 shrink-0">
          <div><kbd className="bg-slate-800 px-1 py-0.5 rounded text-white text-[9px] font-mono mr-1">W A S D</kbd> Drive & Steering</div>
          <div><kbd className="bg-slate-800 px-1 py-0.5 rounded text-white text-[9px] font-mono mr-1">Shift</kbd> Nitro Boost | <kbd className="bg-slate-800 px-1 py-0.5 rounded text-white text-[9px] font-mono mr-1">Space</kbd> Handbrake Drift</div>
          <div className="text-emerald-400 font-bold mt-1 uppercase text-[8px] tracking-wider animate-pulse">🚗 Stop inside the green Pit Box near starting arch to change tires, refuel & repair!</div>
        </div>

        {/* Right Cockpit Cluster (Fuel, Damage, Tire Slicks thermal monitoring) */}
        <div className="bg-slate-950/85 backdrop-blur-md p-4 rounded-2xl border border-slate-800/80 flex flex-col md:flex-row gap-4 shadow-2xl min-w-[320px]">
          {/* Diagnostic Stats */}
          <div className="flex-1 flex flex-col gap-2 justify-center">
            {/* Nitro Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                <span>NITRO BOOST</span>
                <span className="text-cyan-400 font-mono">{nitroLevel}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-900/40">
                <div
                  className="h-full bg-linear-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-75"
                  style={{ width: `${nitroLevel}%` }}
                />
              </div>
            </div>

            {/* Fuel Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                <span>FUEL CAPACITY</span>
                <span className={`font-mono ${fuel < 25 ? 'text-rose-500 animate-pulse' : 'text-amber-400'}`}>
                  {fuel}% {fuel < 25 && '(LOW)'}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-900/40">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${fuel < 25 ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'}`}
                  style={{ width: `${fuel}%` }}
                />
              </div>
            </div>

            {/* Chassis Damage Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                <span>ENGINE CONDITION</span>
                <span className={`font-mono ${carHealth < 40 ? 'text-rose-500 animate-pulse font-bold' : 'text-emerald-400'}`}>
                  {carHealth}% {carHealth < 40 && '(DAMAGED)'}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-900/40">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${carHealth < 40 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`}
                  style={{ width: `${carHealth}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tires thermal schematic diagram */}
          <div className="flex flex-col items-center justify-center shrink-0 border-l border-slate-800/80 pl-4">
            <span className="text-[8px] text-slate-500 font-bold tracking-widest uppercase mb-1.5">Tire Telemetry</span>
            <div className="grid grid-cols-2 gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/60">
              {/* Front Left */}
              <div className="flex flex-col items-center justify-center border border-slate-800 rounded bg-slate-950/80 p-1 w-11 h-11">
                <span className="text-[7px] text-slate-500 font-bold">FL</span>
                <span className={`text-[8px] font-bold ${tireTemp < 60 ? 'text-cyan-400' : tireTemp > 115 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>
                  {tireTemp}°C
                </span>
                <span className="text-[7px] text-slate-400 font-mono">{100 - tireWear}%</span>
              </div>
              {/* Front Right */}
              <div className="flex flex-col items-center justify-center border border-slate-800 rounded bg-slate-950/80 p-1 w-11 h-11">
                <span className="text-[7px] text-slate-500 font-bold">FR</span>
                <span className={`text-[8px] font-bold ${tireTemp < 60 ? 'text-cyan-400' : tireTemp > 115 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>
                  {tireTemp}°C
                </span>
                <span className="text-[7px] text-slate-400 font-mono">{100 - tireWear}%</span>
              </div>
              {/* Rear Left */}
              <div className="flex flex-col items-center justify-center border border-slate-800 rounded bg-slate-950/80 p-1 w-11 h-11">
                <span className="text-[7px] text-slate-500 font-bold">RL</span>
                <span className={`text-[8px] font-bold ${tireTemp < 60 ? 'text-cyan-400' : tireTemp > 115 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>
                  {tireTemp}°C
                </span>
                <span className="text-[7px] text-slate-400 font-mono">{100 - tireWear}%</span>
              </div>
              {/* Rear Right */}
              <div className="flex flex-col items-center justify-center border border-slate-800 rounded bg-slate-950/80 p-1 w-11 h-11">
                <span className="text-[7px] text-slate-500 font-bold">RR</span>
                <span className={`text-[8px] font-bold ${tireTemp < 60 ? 'text-cyan-400' : tireTemp > 115 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>
                  {tireTemp}°C
                </span>
                <span className="text-[7px] text-slate-400 font-mono">{100 - tireWear}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weather Selector Panel */}
      <div className="absolute top-18 left-4 flex flex-col gap-2 pointer-events-auto select-none z-10">
        <span className="text-[9px] text-slate-500 font-bold tracking-widest uppercase ml-1">Weather System</span>
        <div className="flex bg-slate-950/85 backdrop-blur-md p-1 rounded-xl border border-slate-800 flex-col md:flex-row gap-1">
          {([
            { id: 'clear', label: '☀️ Clear', color: 'hover:text-amber-400', activeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
            { id: 'rain', label: '🌧️ Rain', color: 'hover:text-blue-400', activeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
            { id: 'snow', label: '❄️ Snow', color: 'hover:text-cyan-400', activeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
            { id: 'fog', label: '🌫️ Fog', color: 'hover:text-slate-300', activeBg: 'bg-slate-300/20 text-slate-200 border-slate-400/30' }
          ] as const).map((wOption) => (
            <button
              key={wOption.id}
              onClick={() => handleWeatherChange(wOption.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                weather === wOption.id
                  ? `${wOption.activeBg} border-solid`
                  : `text-slate-400 ${wOption.color} border-transparent hover:bg-slate-900/60`
              }`}
            >
              {wOption.label}
            </button>
          ))}
        </div>
        {/* Weather Effect telemetry read-out */}
        <div className="bg-slate-950/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/60 text-[9px] font-mono flex flex-col gap-0.5 text-slate-400">
          <div className="flex justify-between gap-4">
            <span>Tire Grip:</span>
            <span className={`font-bold ${weather === 'clear' ? 'text-emerald-400' : weather === 'fog' ? 'text-amber-400' : 'text-rose-400'}`}>
              {weather === 'clear' ? '100%' : weather === 'fog' ? '92%' : weather === 'rain' ? '78%' : '58%'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Traction Power:</span>
            <span className={`font-bold ${weather === 'clear' ? 'text-emerald-400' : weather === 'fog' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {weather === 'clear' ? '100%' : weather === 'fog' ? '98%' : weather === 'rain' ? '94%' : '82%'}
            </span>
          </div>
        </div>
      </div>

      {/* Floating Control buttons (Camera & Exit/Pause) */}
      <div className="absolute top-18 right-4 flex flex-col gap-2 pointer-events-auto z-10">
        <button
          onClick={cycleCamera}
          className="bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white p-2.5 rounded-xl border border-slate-800 transition-all font-semibold text-xs flex items-center gap-2 shadow-lg active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-emerald-400 rotate-45" /> Cam ({cameraMode === 'thirdPerson' ? 'Rear' : cameraMode === 'hood' ? 'Hood' : 'Cockpit'})
        </button>
        <button
          onClick={onExit}
          className="bg-slate-950/80 hover:bg-red-950 text-slate-300 hover:text-red-300 p-2.5 rounded-xl border border-slate-800 transition-all font-semibold text-xs flex items-center justify-center shadow-lg active:scale-95 cursor-pointer"
        >
          Exit Race
        </button>
      </div>

      {/* Pause menu panels */}
      {paused && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto">
          <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 text-center max-w-sm flex flex-col gap-5 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-100 flex items-center justify-center gap-2">
              <AlertCircle className="w-6 h-6 text-emerald-400 animate-pulse" /> Race Paused
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Take a breather! Click Resume below to jump back into the seat.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setPaused(false)}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all text-sm active:scale-95"
              >
                Resume Race
              </button>
              <button
                onClick={onExit}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all text-sm active:scale-95"
              >
                Return to Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
