import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Play, RotateCcw, AlertCircle } from 'lucide-react';
import { Track, Car, CarUpgrades, RaceParticipant } from '../types';

interface ThreeGameProps {
  activeTrack: Track;
  selectedCar: Car;
  upgrades: CarUpgrades;
  difficulty: 'easy' | 'medium' | 'hard';
  audioEnabled: boolean;
  volume: number;
  onRaceFinished: (standing: number, time: number, rewardCoins: number) => void;
  onExit: () => void;
}

export default function ThreeGame({
  activeTrack,
  selectedCar,
  upgrades,
  difficulty,
  audioEnabled,
  volume,
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
      lap: 1,
      checkpoint: 0,
      finished: false,
      finishTime: 0,
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

    // Custom textured materials depending on active track
    let pavementColor = 0x22252a;
    let stripeColor = 0x10b981;
    if (activeTrack.id === 'track_desert') {
      pavementColor = 0x3d2819;
      stripeColor = 0xf59e0b;
    } else if (activeTrack.id === 'track_mountain') {
      pavementColor = 0x111827;
      stripeColor = 0x06b6d4;
    }

    const roadMaterial = new THREE.MeshStandardMaterial({
      color: pavementColor,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // Decorative Road Guardrails / Neon Borders
    const leftRails: THREE.Vector3[] = [];
    const rightRails: THREE.Vector3[] = [];
    for (let i = 0; i <= pointsCount; i++) {
      const u = i / pointsCount;
      const point = roadSpline.getPointAt(u % 1.0);
      const tangent = roadSpline.getTangentAt(u % 1.0).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      
      leftRails.push(point.clone().addScaledVector(normal, -(TRACK_WIDTH / 2 + 0.5)));
      rightRails.push(point.clone().addScaledVector(normal, (TRACK_WIDTH / 2 + 0.5)));
    }

    const railMaterial = new THREE.MeshBasicMaterial({ color: stripeColor });
    
    const leftRailGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftRails, true), 120, 0.4, 6, true);
    const rightRailGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rightRails, true), 120, 0.4, 6, true);
    
    const leftRailMesh = new THREE.Mesh(leftRailGeo, railMaterial);
    const rightRailMesh = new THREE.Mesh(rightRailGeo, railMaterial);
    scene.add(leftRailMesh);
    scene.add(rightRailMesh);

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
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    
    const wheels: THREE.Mesh[] = [];
    const wheelOffsets = [
      { x: -1.25, y: 0.35, z: 1.5 },   // FL
      { x: 1.25, y: 0.35, z: 1.5 },    // FR
      { x: -1.25, y: 0.35, z: -1.4 },  // RL
      { x: 1.25, y: 0.35, z: -1.4 },   // RR
    ];

    const rimStyle = selectedCar.rimStyle || 'sports';

    wheelOffsets.forEach((offset) => {
      const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
      wMesh.position.set(offset.x, offset.y, offset.z);
      wMesh.castShadow = true;

      // Dynamic Alloy Rim Group added as child of the wheel mesh to rotate with it!
      const rimGroup = new THREE.Group();
      
      // Outer face is at local x = -0.235 (left side wheels) or local x = 0.235 (right side wheels)
      const isLeft = offset.x < 0;
      const rimLocalX = isLeft ? -0.235 : 0.235;
      rimGroup.position.set(rimLocalX, 0, 0);
      
      // Orient rim flat face outward
      rimGroup.rotation.y = isLeft ? -Math.PI / 2 : Math.PI / 2;

      // Base rim cap disc
      const rimCapGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.04, 12);
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
      carGroup.add(wMesh);
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

    // 12. Audio Context initialization on first click
    const startAudioContext = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    // Keyboard controls
    const handleKeyDown = (e: KeyboardEvent) => {
      startAudioContext();
      if (e.key === 'p' || e.key === 'Escape') {
        setPaused((prev) => !prev);
      }
      if (e.key in stateRef.current.keys) {
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key in stateRef.current.keys) {
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

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

      // --- PLAYER PHYSICS ENGINE LOGIC ---
      const car = state.car;
      const keys = state.keys;

      // 1. Friction & Steering depending on drift status (handbrake or slide angle)
      const currentNormalGrip = keys[' '] ? HANDBRAKE_FRICTION : NORMAL_GRIP;
      const turnPower = (keys[' '] ? 2.5 : 1.6) * (Math.PI / 180) * (2.0 - (car.speed / MAX_SPEED));

      // Steer turning input
      let steeringInput = 0;
      if (keys.a) steeringInput = 1;
      if (keys.d) steeringInput = -1;

      // Steering Wheel Visual articulation
      wheels[0].rotation.y = steeringInput * 0.45;
      wheels[1].rotation.y = steeringInput * 0.45;

      car.dir += steeringInput * turnPower * Math.min(car.speed / 12, 1);

      // 2. Throttle Motor Power / Brake Torques
      let isBoosting = false;
      let topCapSpeed = MAX_SPEED;

      if (state.raceActive && !car.finished) {
        // Accelerating
        if (keys.w) {
          // Check Nitro triggers
          if (keys.Shift && car.nitro > 1) {
            isBoosting = true;
            topCapSpeed = MAX_SPEED * NITRO_FORCE;
            car.speed = Math.min(car.speed + ACCELERATION * 2.5, topCapSpeed);
            car.nitro = Math.max(car.nitro - dt * 25, 0);
          } else {
            car.speed = Math.min(car.speed + ACCELERATION, topCapSpeed);
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
      car.vel.lerp(velocityVec, car.isDrifting ? DRIFT_GRIP : currentNormalGrip);
      
      // Apply movement displacement
      car.pos.addScaledVector(car.vel, dt * 0.28); // scaling velocity scale to feel rapid in 3D scale

      // Track bounding check: Snap car to road surface mesh or collide with wall guardrails
      const nearestT = roadSpline.getUtoTmapping(0, 0); // rough check
      let minDistance = 9999;
      let closestPointOnSpline = new THREE.Vector3();
      let splineU = 0;

      // Sample local points for speed
      for (let s = 0; s <= 100; s++) {
        const u = s / 100;
        const pt = roadSpline.getPointAt(u);
        const dist = car.pos.distanceTo(pt);
        if (dist < minDistance) {
          minDistance = dist;
          closestPointOnSpline.copy(pt);
          splineU = u;
        }
      }

      // Check height elevation snap
      car.pos.y = THREE.MathUtils.lerp(car.pos.y, closestPointOnSpline.y, 0.1);

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
        const topAiSpeed = 0.045 * ai.speedFactor;
        
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
          if (car.lap >= 3) {
            // Finished!
            car.finished = true;
            car.finishTime = state.time;
            
            // Calculate standing position
            const finalStandings = [...state.aiCars].filter((ai) => ai.finished && ai.finishTime < car.finishTime).length + 1;
            
            // Trigger completion callback
            const reward = finalStandings === 1 ? 300 : finalStandings === 2 ? 180 : finalStandings === 3 ? 120 : 60;
            onRaceFinished(finalStandings, state.time, reward);
          } else {
            car.lap++;
            setCurrentLap(car.lap);
          }
        }
      }

      // --- CALCULATE ACTIVE PLACEMENTS ---
      // Position calculation based on Lap progress, Checkpoint level, and distance to next checkpoint
      const racersToSort = [
        { id: 'player', lap: car.lap, check: car.checkpoint, dist: car.pos.distanceTo(state.checkpoints[(car.checkpoint + 1) % state.checkpoints.length]), finished: car.finished, time: car.finishTime },
        ...state.aiCars.map((ai) => ({ id: ai.id, lap: ai.currentLap, check: ai.lastCheckpoint, dist: ai.pos.distanceTo(state.checkpoints[(ai.lastCheckpoint + 1) % state.checkpoints.length]), finished: ai.finished, time: ai.finishTime })),
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

      // Slowly recharge nitro
      if (!isBoosting && car.nitro < 100) {
        car.nitro = Math.min(car.nitro + dt * 4, 100);
      }

      // Set participant distances for mini-map visual placements
      const currentParticipants: RaceParticipant[] = [
        { id: 'player', name: 'You', carId: selectedCar.id, color: selectedCar.color, isPlayer: true, lap: car.lap, currentCheckpoint: car.checkpoint, distanceToNextCheckpoint: car.pos.distanceTo(state.checkpoints[(car.checkpoint + 1) % state.checkpoints.length]), totalDistance: car.lap * 1000 + car.checkpoint * 100, finished: car.finished, speed: car.speed },
        ...state.aiCars.map((ai) => ({ id: ai.id, name: ai.name, carId: 'ai', color: ai.color, isPlayer: false, lap: ai.currentLap, currentCheckpoint: ai.lastCheckpoint, distanceToNextCheckpoint: ai.pos.distanceTo(state.checkpoints[(ai.lastCheckpoint + 1) % state.checkpoints.length]), totalDistance: ai.currentLap * 1000 + ai.lastCheckpoint * 100, finished: ai.finished, speed: ai.speedFactor * 140 })),
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

      {/* Speedometer, Nitro HUD indicators at the bottom */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none select-none">
        {/* Dynamic Speedometer */}
        <div className="bg-slate-950/85 backdrop-blur-md p-4 rounded-2xl border border-slate-800 flex flex-col items-center min-w-[120px]">
          <span className="text-4xl font-black text-slate-100 font-mono leading-none">{speedKmh}</span>
          <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-1">KM/H</span>
        </div>

        {/* Controls Tutorial Note */}
        <div className="hidden lg:flex flex-col items-center bg-slate-950/60 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800 text-[10px] text-slate-400 font-semibold gap-1">
          <div><kbd className="bg-slate-800 px-1 py-0.5 rounded text-white text-[9px] font-mono mr-1">W A S D</kbd> Drive & Steering</div>
          <div><kbd className="bg-slate-800 px-1 py-0.5 rounded text-white text-[9px] font-mono mr-1">Shift</kbd> Nitro Boost | <kbd className="bg-slate-800 px-1 py-0.5 rounded text-white text-[9px] font-mono mr-1">Space</kbd> Handbrake Drift</div>
        </div>

        {/* Nitro bar gauge */}
        <div className="bg-slate-950/85 backdrop-blur-md p-4 rounded-2xl border border-slate-800 flex flex-col gap-2 min-w-[180px]">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span>NITRO SYSTEM</span>
            <span className="text-emerald-400 font-mono">{nitroLevel}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-900/40">
            <div
              className="h-full bg-linear-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-75"
              style={{ width: `${nitroLevel}%` }}
            />
          </div>
        </div>
      </div>

      {/* Floating Control buttons (Camera & Exit/Pause) */}
      <div className="absolute top-18 right-4 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={cycleCamera}
          className="bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white p-2.5 rounded-xl border border-slate-800 transition-all font-semibold text-xs flex items-center gap-2 shadow-lg active:scale-95"
        >
          <RotateCcw className="w-4 h-4 text-emerald-400 rotate-45" /> Cam ({cameraMode === 'thirdPerson' ? 'Rear' : cameraMode === 'hood' ? 'Hood' : 'Cockpit'})
        </button>
        <button
          onClick={onExit}
          className="bg-slate-950/80 hover:bg-red-950 text-slate-300 hover:text-red-300 p-2.5 rounded-xl border border-slate-800 transition-all font-semibold text-xs flex items-center justify-center shadow-lg active:scale-95"
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
