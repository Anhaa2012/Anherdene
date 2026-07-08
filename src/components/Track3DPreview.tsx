import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCw, Compass, Eye, ShieldAlert, Award, TrendingUp, Info } from 'lucide-react';

interface Track3DPreviewProps {
  selectedTrackId: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export default function Track3DPreview({ selectedTrackId, difficulty }: Track3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Interaction State
  const [cameraMode, setCameraMode] = useState<'orbit' | 'isometric' | 'topdown' | 'chase'>('orbit');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showDecorations, setShowDecorations] = useState<boolean>(true);
  const [speedMult, setSpeedMult] = useState<number>(1.0);

  // Spherical Coordinates for Orbit
  const orbitAngleRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: 0.8,
    phi: 1.1,
    radius: 350,
  });

  const isDraggingRef = useRef<boolean>(false);
  const prevPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Get track stats & name for the preview overlay
  const getTrackStats = () => {
    switch (selectedTrackId) {
      case 'track_city':
        return {
          name: 'Neon Gridway',
          difficultyText: 'Easy',
          color: '#10b981',
          corners: '5 Sharp Turns',
          elevation: 'Flat (0m)',
          hazardRating: 'Low',
          desc: 'Simple layout with high traction neon grid road surfaces.',
          bgGradient: 'from-emerald-500/10 to-transparent',
        };
      case 'track_desert':
        return {
          name: 'Canyon Dune',
          difficultyText: 'Medium',
          color: '#f59e0b',
          corners: '8 Sweeping Turns',
          elevation: 'Moderate (10m)',
          hazardRating: 'Medium',
          desc: 'Bumpy dune elevations and sweeping canyon curves.',
          bgGradient: 'from-amber-500/10 to-transparent',
        };
      case 'track_volcano':
        return {
          name: 'Volcanic Rim',
          difficultyText: 'Medium',
          color: '#f97316',
          corners: '7 Twisting S-curves',
          elevation: 'High (22m)',
          hazardRating: 'High',
          desc: 'A rugged route carved directly into basalt rock around active magma venting rivers.',
          bgGradient: 'from-orange-500/10 to-transparent',
        };
      case 'track_cosmic':
        return {
          name: 'Cosmic Drift',
          difficultyText: 'Hard',
          color: '#a855f7',
          corners: '10 Interstellar Loops',
          elevation: 'Extreme (45m)',
          hazardRating: 'Severe',
          desc: 'A futuristic floating ring tracking a meteor trail in deep vacuum space with high altitude climbs.',
          bgGradient: 'from-purple-500/10 to-transparent',
        };
      case 'track_mountain':
      default:
        return {
          name: 'Alpine Drift',
          difficultyText: 'Hard',
          color: '#06b6d4',
          corners: '11 Hairpin Bends',
          elevation: 'Severe (32m)',
          hazardRating: 'High',
          desc: 'Extreme mountain climbs, low traction snowy passes, and tight hairpins.',
          bgGradient: 'from-cyan-500/10 to-transparent',
        };
    }
  };

  const stats = getTrackStats();

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // --- 1. Scene setup ---
    const width = containerRef.current.clientWidth;
    const height = 280;

    const scene = new THREE.Scene();
    // Match dark elegant styling of the game menu
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.FogExp2(0x020617, 0.0018);

    // --- 2. Camera setup ---
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1500);
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // --- 3. Lights ---
    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.8);
    scene.add(ambientLight);

    // Dynamic directional light for shadows
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(120, 200, 80);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 800;
    const d = 250;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Cyber grid base ground
    const gridColor = new THREE.Color(stats.color);
    const gridHelper = new THREE.GridHelper(600, 40, gridColor, 0x1e293b);
    gridHelper.position.y = -10;
    scene.add(gridHelper);

    // Glowy infinite ground plane
    const floorGeo = new THREE.PlaneGeometry(1200, 1200);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x020617,
      roughness: 0.95,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -10.1;
    floor.receiveShadow = true;
    scene.add(floor);

    // --- 4. Get track control points ---
    let controlPoints: THREE.Vector3[] = [];
    if (selectedTrackId === 'track_city') {
      controlPoints = [
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
    } else if (selectedTrackId === 'track_desert') {
      controlPoints = [
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
    } else if (selectedTrackId === 'track_volcano') {
      controlPoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(100, 8, -20),
        new THREE.Vector3(160, 18, 50),
        new THREE.Vector3(110, 22, 130),
        new THREE.Vector3(20, 12, 170),
        new THREE.Vector3(-60, 15, 120),
        new THREE.Vector3(-120, 5, 20),
        new THREE.Vector3(-70, 0, -40),
      ];
    } else if (selectedTrackId === 'track_cosmic') {
      controlPoints = [
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
      controlPoints = [
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

    // Build Spline Curve
    const spline = new THREE.CatmullRomCurve3(controlPoints, true);

    const ROAD_WIDTH_PREVIEW = 22;
    const previewPointsCount = 200;
    const upVec = new THREE.Vector3(0, 1, 0);

    // 1. Procedural Asphalt Canvas Texture for the Preview Track
    const asphaltCanvas = document.createElement('canvas');
    asphaltCanvas.width = 256;
    asphaltCanvas.height = 256;
    const asphaltCtx = asphaltCanvas.getContext('2d');
    if (asphaltCtx) {
      // Base asphalt color
      let asphaltHex = '#1e293b';
      if (selectedTrackId === 'track_desert') {
        asphaltHex = '#2d1c12';
      } else if (selectedTrackId === 'track_mountain') {
        asphaltHex = '#090e18';
      } else if (selectedTrackId === 'track_volcano') {
        asphaltHex = '#240c0c';
      } else if (selectedTrackId === 'track_cosmic') {
        asphaltHex = '#12091c';
      }
      asphaltCtx.fillStyle = asphaltHex;
      asphaltCtx.fillRect(0, 0, 256, 256);

      // Add high-frequency aggregate noise
      const imgData = asphaltCtx.getImageData(0, 0, 256, 256);
      const data = imgData.data;
      for (let idx = 0; idx < data.length; idx += 4) {
        const grainNoise = (Math.random() - 0.5) * 14;
        data[idx] = Math.min(255, Math.max(0, data[idx] + grainNoise));
        data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + grainNoise));
        data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + grainNoise));
      }
      asphaltCtx.putImageData(imgData, 0, 0);

      // Soft rubber wear stripes
      asphaltCtx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      asphaltCtx.fillRect(35, 0, 22, 256);
      asphaltCtx.fillRect(70, 0, 22, 256);
      asphaltCtx.fillRect(165, 0, 22, 256);
      asphaltCtx.fillRect(200, 0, 22, 256);
    }
    const asphaltTex = new THREE.CanvasTexture(asphaltCanvas);
    asphaltTex.wrapS = THREE.RepeatWrapping;
    asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.repeat.set(1, 30);

    // 2. Generate flat-ribbon preview road geometry
    const roadGeo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= previewPointsCount; i++) {
      const u = i / previewPointsCount;
      const point = spline.getPointAt(u % 1.0);
      const tangent = spline.getTangentAt(u % 1.0).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, upVec).normalize();

      const leftPt = point.clone().addScaledVector(normal, -ROAD_WIDTH_PREVIEW / 2);
      const rightPt = point.clone().addScaledVector(normal, ROAD_WIDTH_PREVIEW / 2);

      positions.push(leftPt.x, leftPt.y, leftPt.z);
      positions.push(rightPt.x, rightPt.y, rightPt.z);

      uvs.push(0, u * 30);
      uvs.push(1, u * 30);

      if (i < previewPointsCount) {
        const currIdx = i * 2;
        indices.push(currIdx, currIdx + 1, currIdx + 2);
        indices.push(currIdx + 1, currIdx + 3, currIdx + 2);
      }
    }

    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.8,
      metalness: 0.15,
      side: THREE.DoubleSide
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // 3. Beautiful 3D raised racing curbs (kerbs) with alternating track colors
    const buildPreviewCurbGeo = (side: 'left' | 'right') => {
      const curbGeo = new THREE.BufferGeometry();
      const curbPositions: number[] = [];
      const curbColors: number[] = [];
      const curbIndices: number[] = [];

      const curbWidth = 1.0;
      const curbHeight = 0.16;
      const stripeColorObj = new THREE.Color(stats.color);
      const whiteColorObj = new THREE.Color(0xf1f5f9);

      for (let i = 0; i <= previewPointsCount; i++) {
        const u = i / previewPointsCount;
        const point = spline.getPointAt(u % 1.0);
        const tangent = spline.getTangentAt(u % 1.0).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, upVec).normalize();
        const multiplier = side === 'left' ? -1 : 1;

        const v0 = point.clone().addScaledVector(normal, multiplier * (ROAD_WIDTH_PREVIEW / 2));
        const v1 = point.clone().addScaledVector(normal, multiplier * (ROAD_WIDTH_PREVIEW / 2 + curbWidth)).add(new THREE.Vector3(0, curbHeight, 0));
        const v2 = point.clone().addScaledVector(normal, multiplier * (ROAD_WIDTH_PREVIEW / 2 + curbWidth + 0.2));

        curbPositions.push(v0.x, v0.y, v0.z);
        curbPositions.push(v1.x, v1.y, v1.z);
        curbPositions.push(v2.x, v2.y, v2.z);

        const isStripe = (i % 8) < 4;
        const color = isStripe ? stripeColorObj : whiteColorObj;

        curbColors.push(color.r, color.g, color.b);
        curbColors.push(color.r, color.g, color.b);
        curbColors.push(color.r, color.g, color.b);

        if (i < previewPointsCount) {
          const currIdx = i * 3;
          const nextIdx = (i + 1) * 3;

          curbIndices.push(currIdx, currIdx + 1, nextIdx);
          curbIndices.push(currIdx + 1, nextIdx + 1, nextIdx);

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

    const curbMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.75,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const leftCurb = new THREE.Mesh(buildPreviewCurbGeo('left'), curbMat);
    const rightCurb = new THREE.Mesh(buildPreviewCurbGeo('right'), curbMat);
    scene.add(leftCurb);
    scene.add(rightCurb);

    // 4. Glowing Dashed Centerline
    const centerGeo = new THREE.BufferGeometry();
    const clPositions: number[] = [];
    const clIndices: number[] = [];
    const thickness = 0.25;
    const hOffset = 0.03;

    for (let i = 0; i < previewPointsCount; i++) {
      if (i % 4 === 0) {
        const u1 = i / previewPointsCount;
        const u2 = (i + 1.8) / previewPointsCount;

        const pt1 = spline.getPointAt(u1 % 1.0);
        const tangent1 = spline.getTangentAt(u1 % 1.0).normalize();
        const normal1 = new THREE.Vector3().crossVectors(tangent1, upVec).normalize();

        const pt2 = spline.getPointAt(u2 % 1.0);
        const tangent2 = spline.getTangentAt(u2 % 1.0).normalize();
        const normal2 = new THREE.Vector3().crossVectors(tangent2, upVec).normalize();

        const p1_l = pt1.clone().addScaledVector(normal1, -thickness / 2).add(new THREE.Vector3(0, hOffset, 0));
        const p1_r = pt1.clone().addScaledVector(normal1, thickness / 2).add(new THREE.Vector3(0, hOffset, 0));
        const p2_l = pt2.clone().addScaledVector(normal2, -thickness / 2).add(new THREE.Vector3(0, hOffset, 0));
        const p2_r = pt2.clone().addScaledVector(normal2, thickness / 2).add(new THREE.Vector3(0, hOffset, 0));

        const baseIdx = clPositions.length / 3;

        clPositions.push(p1_l.x, p1_l.y, p1_l.z);
        clPositions.push(p1_r.x, p1_r.y, p1_r.z);
        clPositions.push(p2_l.x, p2_l.y, p2_l.z);
        clPositions.push(p2_r.x, p2_r.y, p2_r.z);

        clIndices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        clIndices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
      }
    }

    centerGeo.setAttribute('position', new THREE.Float32BufferAttribute(clPositions, 3));
    centerGeo.setIndex(clIndices);
    centerGeo.computeVertexNormals();

    const centerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(stats.color),
      side: THREE.DoubleSide
    });
    const centerMesh = new THREE.Mesh(centerGeo, centerMat);
    scene.add(centerMesh);

    // 5. Solid Edge Boundaries
    const edgesGeo = new THREE.BufferGeometry();
    const elPositions: number[] = [];
    const elIndices: number[] = [];
    const elWidth = 0.12;

    for (let i = 0; i <= previewPointsCount; i++) {
      const u = i / previewPointsCount;
      const pt = spline.getPointAt(u % 1.0);
      const tangent = spline.getTangentAt(u % 1.0).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, upVec).normalize();

      const lLine = pt.clone().addScaledVector(normal, -(ROAD_WIDTH_PREVIEW / 2 - 0.5));
      const l_l = lLine.clone().addScaledVector(normal, -elWidth / 2).add(new THREE.Vector3(0, 0.02, 0));
      const l_r = lLine.clone().addScaledVector(normal, elWidth / 2).add(new THREE.Vector3(0, 0.02, 0));

      const rLine = pt.clone().addScaledVector(normal, (ROAD_WIDTH_PREVIEW / 2 - 0.5));
      const r_l = rLine.clone().addScaledVector(normal, -elWidth / 2).add(new THREE.Vector3(0, 0.02, 0));
      const r_r = rLine.clone().addScaledVector(normal, elWidth / 2).add(new THREE.Vector3(0, 0.02, 0));

      const baseIdx = elPositions.length / 3;

      elPositions.push(l_l.x, l_l.y, l_l.z);
      elPositions.push(l_r.x, l_r.y, l_r.z);
      elPositions.push(r_l.x, r_l.y, r_l.z);
      elPositions.push(r_r.x, r_r.y, r_r.z);

      if (i < previewPointsCount) {
        elIndices.push(baseIdx, baseIdx + 1, baseIdx + 4);
        elIndices.push(baseIdx + 1, baseIdx + 5, baseIdx + 4);

        elIndices.push(baseIdx + 2, baseIdx + 3, baseIdx + 6);
        elIndices.push(baseIdx + 3, baseIdx + 7, baseIdx + 6);
      }
    }

    edgesGeo.setAttribute('position', new THREE.Float32BufferAttribute(elPositions, 3));
    edgesGeo.setIndex(elIndices);
    edgesGeo.computeVertexNormals();

    const edgesMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      opacity: 0.5,
      transparent: true,
      side: THREE.DoubleSide
    });
    const edgesMesh = new THREE.Mesh(edgesGeo, edgesMat);
    scene.add(edgesMesh);

    // 6. Glowing Rails and Guardrail support posts for the preview
    const leftRails: THREE.Vector3[] = [];
    const rightRails: THREE.Vector3[] = [];
    for (let i = 0; i <= previewPointsCount; i++) {
      const u = i / previewPointsCount;
      const point = spline.getPointAt(u % 1.0);
      const tangent = spline.getTangentAt(u % 1.0).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, upVec).normalize();
      
      leftRails.push(point.clone().addScaledVector(normal, -(ROAD_WIDTH_PREVIEW / 2 + 0.5)));
      rightRails.push(point.clone().addScaledVector(normal, (ROAD_WIDTH_PREVIEW / 2 + 0.5)));
    }

    const railMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(stats.color) });
    const leftRailGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftRails, true), 100, 0.25, 4, true);
    const rightRailGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rightRails, true), 100, 0.25, 4, true);
    
    const leftRailMesh = new THREE.Mesh(leftRailGeo, railMaterial);
    const rightRailMesh = new THREE.Mesh(rightRailGeo, railMaterial);
    scene.add(leftRailMesh);
    scene.add(rightRailMesh);

    const previewSupports = new THREE.Group();
    const suppPillGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.6, 5);
    const suppPillMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.3
    });

    for (let i = 0; i <= previewPointsCount; i += 8) {
      const u = i / previewPointsCount;
      const pt = spline.getPointAt(u % 1.0);
      const tangent = spline.getTangentAt(u % 1.0).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, upVec).normalize();

      const leftPill = new THREE.Mesh(suppPillGeo, suppPillMat);
      leftPill.position.copy(pt.clone().addScaledVector(normal, -(ROAD_WIDTH_PREVIEW / 2 + 0.5)));
      leftPill.position.y += 0.3;
      leftPill.lookAt(pt.clone().add(tangent));
      previewSupports.add(leftPill);

      const rightPill = new THREE.Mesh(suppPillGeo, suppPillMat);
      rightPill.position.copy(pt.clone().addScaledVector(normal, (ROAD_WIDTH_PREVIEW / 2 + 0.5)));
      rightPill.position.y += 0.3;
      rightPill.lookAt(pt.clone().add(tangent));
      previewSupports.add(rightPill);
    }
    scene.add(previewSupports);

    // --- 5. Spawn decorative terrain elements based on difficulty & track ---
    const decorationGroup = new THREE.Group();
    scene.add(decorationGroup);

    if (showDecorations) {
      // Spawn items alongside track points
      const count = 35;
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const pt = spline.getPointAt(t);
        const tangent = spline.getTangentAt(t).normalize();
        
        // Find right-angle vector to place items off-road
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const offsetDist = 12 + Math.random() * 20;
        const decorationPos = pt.clone().addScaledVector(normal, side * offsetDist);
        decorationPos.y = pt.y - 0.5; // match track elevation

        if (selectedTrackId === 'track_city') {
          // --- EASY / CITY: Cyber buildings ---
          const bH = 15 + Math.random() * 45;
          const bW = 6 + Math.random() * 12;
          const buildGeo = new THREE.BoxGeometry(bW, bH, bW);
          const buildMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.5,
            metalness: 0.8,
          });
          const build = new THREE.Mesh(buildGeo, buildMat);
          build.position.copy(decorationPos);
          build.position.y += bH / 2 - 10;
          build.castShadow = true;
          build.receiveShadow = true;

          // Glowing neon structural bands on building
          const ringGeo = new THREE.BoxGeometry(bW + 0.2, 0.8, bW + 0.2);
          const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(stats.color) });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.y = bH / 4;
          build.add(ring);

          decorationGroup.add(build);

        } else if (selectedTrackId === 'track_desert') {
          // --- MEDIUM / DESERT: Dune structures and Sandstone rock arches ---
          const isArch = Math.random() > 0.7;
          if (isArch) {
            // Arch geometry
            const archGroup = new THREE.Group();
            archGroup.position.copy(decorationPos);

            const pillarGeo = new THREE.CylinderGeometry(1.8, 2.5, 18, 5);
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0x8a5cf5, roughness: 0.9 }); // purple-tint sandstone
            
            const p1 = new THREE.Mesh(pillarGeo, pillarMat);
            p1.position.set(-6, 9 - 10, 0);
            p1.castShadow = true;
            p1.receiveShadow = true;
            archGroup.add(p1);

            const p2 = p1.clone();
            p2.position.set(6, 9 - 10, 0);
            archGroup.add(p2);

            const topGeo = new THREE.BoxGeometry(15, 3, 4);
            const top = new THREE.Mesh(topGeo, pillarMat);
            top.position.set(0, 18 - 10, 0);
            top.castShadow = true;
            top.receiveShadow = true;
            archGroup.add(top);

            decorationGroup.add(archGroup);
          } else {
            // Dune pyramids
            const pyrGeo = new THREE.ConeGeometry(5 + Math.random() * 8, 12 + Math.random() * 10, 4);
            const pyrMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 1.0 }); // Sand amber
            const pyr = new THREE.Mesh(pyrGeo, pyrMat);
            pyr.position.copy(decorationPos);
            pyr.position.y += 6 - 10;
            pyr.castShadow = true;
            pyr.receiveShadow = true;
            decorationGroup.add(pyr);
          }

        } else if (selectedTrackId === 'track_volcano') {
          // --- VOLCANO: Obsidian spires and venting lava pools/boulders ---
          const isSpire = Math.random() > 0.5;
          if (isSpire) {
            // Dark sharp basalt spires
            const spireGeo = new THREE.ConeGeometry(2 + Math.random() * 4, 15 + Math.random() * 15, 4);
            const spireMat = new THREE.MeshStandardMaterial({
              color: 0x111115,
              roughness: 0.9,
              metalness: 0.2,
            });
            const spire = new THREE.Mesh(spireGeo, spireMat);
            spire.position.copy(decorationPos);
            spire.position.y += spireGeo.parameters.height / 2 - 10;
            spire.castShadow = true;
            decorationGroup.add(spire);
          } else {
            // Jagged magma rocks (obsidian with red glowing cracks)
            const rockGeo = new THREE.DodecahedronGeometry(3 + Math.random() * 4);
            const rockMat = new THREE.MeshStandardMaterial({
              color: 0x181212,
              roughness: 0.8,
              emissive: 0xff3300,
              emissiveIntensity: 0.4 + Math.random() * 0.4,
            });
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.position.copy(decorationPos);
            rock.position.y += 2 - 10;
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            rock.castShadow = true;
            decorationGroup.add(rock);
          }

        } else if (selectedTrackId === 'track_cosmic') {
          // --- COSMIC: Cosmic crystals and floating space beacons ---
          const isCrystal = Math.random() > 0.4;
          if (isCrystal) {
            // Glowing cosmic crystal formations
            const crystalGeo = new THREE.CylinderGeometry(0, 2 + Math.random() * 3, 10 + Math.random() * 8, 5);
            const crystalMat = new THREE.MeshStandardMaterial({
              color: 0x8b5cf6, // Violet
              emissive: 0x6d28d9,
              emissiveIntensity: 0.6 + Math.random() * 0.5,
              metalness: 0.9,
              roughness: 0.1,
            });
            const crystal = new THREE.Mesh(crystalGeo, crystalMat);
            crystal.position.copy(decorationPos);
            crystal.position.y += crystalGeo.parameters.height / 2 - 10;
            crystal.rotation.set(Math.random() * 0.2, Math.random() * Math.PI, Math.random() * 0.2);
            crystal.castShadow = true;
            decorationGroup.add(crystal);
          } else {
            // Floating star beacons
            const beaconGroup = new THREE.Group();
            beaconGroup.position.copy(decorationPos);
            beaconGroup.position.y += 5; // hover in space

            const coreGeo = new THREE.OctahedronGeometry(2, 0);
            const coreMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 }); // bright light blue
            const core = new THREE.Mesh(coreGeo, coreMat);
            beaconGroup.add(core);

            const ringGeo = new THREE.TorusGeometry(3.5, 0.3, 8, 24);
            const ringMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.8 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            beaconGroup.add(ring);

            decorationGroup.add(beaconGroup);
          }

        } else {
          // --- HARD / MOUNTAIN: Snowy evergreens and ice crystals ---
          const isTree = Math.random() > 0.4;
          if (isTree) {
            // High fidelity Pine tree
            const treeGroup = new THREE.Group();
            treeGroup.position.copy(decorationPos);

            const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 4, 6);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 2 - 10;
            trunk.castShadow = true;
            treeGroup.add(trunk);

            const foliageGeo = new THREE.ConeGeometry(3.5, 10, 6);
            const foliageMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.8 }); // ice-blue pine
            const foliage = new THREE.Mesh(foliageGeo, foliageMat);
            foliage.position.y = 8 - 10;
            foliage.castShadow = true;
            treeGroup.add(foliage);

            // Snow top on tree
            const snowGeo = new THREE.ConeGeometry(2, 3, 6);
            const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
            const snow = new THREE.Mesh(snowGeo, snowMat);
            snow.position.y = 11.5 - 10;
            treeGroup.add(snow);

            decorationGroup.add(treeGroup);
          } else {
            // Ice crystal crystals
            const iceGeo = new THREE.OctahedronGeometry(3 + Math.random() * 4, 0);
            const iceMat = new THREE.MeshStandardMaterial({
              color: 0x06b6d4,
              metalness: 0.9,
              roughness: 0.1,
              transparent: true,
              opacity: 0.85,
            });
            const ice = new THREE.Mesh(iceGeo, iceMat);
            ice.position.copy(decorationPos);
            ice.position.y += 2 - 10;
            ice.rotation.set(Math.random(), Math.random(), Math.random());
            ice.castShadow = true;
            decorationGroup.add(ice);
          }
        }
      }
    }

    // --- 5b. Start-Finish line location marker ---
    const startMarkerGroup = new THREE.Group();
    const startPos = spline.getPointAt(0);
    const startTangent = spline.getTangentAt(0).normalize();
    
    startMarkerGroup.position.copy(startPos);
    
    // Checkered Start-Finish crossing plate on the road
    const plateGeo = new THREE.BoxGeometry(10.5, 0.2, 2.5);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.8,
      metalness: 0.1
    });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.position.y = 0.05; // slightly above road to prevent clipping
    
    // Create actual checkered blocks on the starting plate
    const checkerCountX = 6;
    const checkerCountZ = 2;
    const checkerGroup = new THREE.Group();
    for (let cx = 0; cx < checkerCountX; cx++) {
      for (let cz = 0; cz < checkerCountZ; cz++) {
        if ((cx + cz) % 2 === 0) {
          const blockGeo = new THREE.BoxGeometry(10.5 / checkerCountX, 0.22, 2.5 / checkerCountZ);
          const blockMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
          const blockMesh = new THREE.Mesh(blockGeo, blockMat);
          blockMesh.position.set(
            -10.5 / 2 + (cx + 0.5) * (10.5 / checkerCountX),
            0.05,
            -2.5 / 2 + (cz + 0.5) * (2.5 / checkerCountZ)
          );
          checkerGroup.add(blockMesh);
        }
      }
    }
    plateMesh.add(checkerGroup);
    
    // Align starting plate rotation to track tangent direction
    const lookAtPos = startPos.clone().add(startTangent);
    plateMesh.lookAt(lookAtPos);
    
    startMarkerGroup.add(plateMesh);
    
    // Vertical energy beacon/light column
    const beamGeo = new THREE.CylinderGeometry(0.5, 0.5, 14, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(stats.color),
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.y = 7;
    startMarkerGroup.add(beamMesh);
    
    // Floating high-tech location pointer (inverted diamond / cone)
    const markerPointerGroup = new THREE.Group();
    markerPointerGroup.position.y = 15;
    
    const coneTopGeo = new THREE.ConeGeometry(2.5, 3.5, 4);
    const coneTopMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(stats.color),
      metalness: 0.9,
      roughness: 0.1,
      emissive: new THREE.Color(stats.color),
      emissiveIntensity: 0.6
    });
    const coneTop = new THREE.Mesh(coneTopGeo, coneTopMat);
    coneTop.rotation.x = Math.PI; // point down
    coneTop.castShadow = true;
    markerPointerGroup.add(coneTop);
    
    // Floating horizontal orbital rings around pointer
    const orbitRingGeo = new THREE.TorusGeometry(3.5, 0.18, 8, 32);
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(stats.color),
      transparent: true,
      opacity: 0.8
    });
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRing.rotation.x = Math.PI / 2;
    markerPointerGroup.add(orbitRing);
    
    startMarkerGroup.add(markerPointerGroup);
    
    // Expanding & fading pulsating ground ring waves (radial pulses)
    const waveCount = 2;
    const waveRings: THREE.Mesh[] = [];
    const waveMats: THREE.MeshBasicMaterial[] = [];
    
    for (let w = 0; w < waveCount; w++) {
      const waveGeo = new THREE.RingGeometry(4.5, 5.0, 32);
      waveGeo.rotateX(-Math.PI / 2);
      const waveMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(stats.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0
      });
      const waveMesh = new THREE.Mesh(waveGeo, waveMat);
      waveMesh.position.y = 0.15;
      
      startMarkerGroup.add(waveMesh);
      waveRings.push(waveMesh);
      waveMats.push(waveMat);
    }
    
    scene.add(startMarkerGroup);

    // --- 6. Mini 3D Race Car model driving along the track spline ---
    const carGroup = new THREE.Group();
    scene.add(carGroup);

    // Elegant aerodynamic body capsule
    const carBodyGeo = new THREE.BoxGeometry(4.5, 1.2, 8);
    const carBodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(stats.color),
      roughness: 0.1,
      metalness: 0.8,
    });
    const carBody = new THREE.Mesh(carBodyGeo, carBodyMat);
    carBody.castShadow = true;
    carBody.position.y = 0.6;
    carGroup.add(carBody);

    // Glowing headlights
    const lightGeo = new THREE.BoxGeometry(0.8, 0.4, 0.2);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headlightL = new THREE.Mesh(lightGeo, lightMat);
    headlightL.position.set(-1.4, 0.4, 4);
    const headlightR = headlightL.clone();
    headlightR.position.x = 1.4;
    carGroup.add(headlightL);
    carGroup.add(headlightR);

    // Cabin cockpit bubble
    const cabinGeo = new THREE.SphereGeometry(1.4, 8, 8);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.9,
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.scale.set(1.1, 0.8, 1.8);
    cabin.position.set(0, 1.2, -0.5);
    carGroup.add(cabin);

    // Performance rear wing
    const wingGeo = new THREE.BoxGeometry(6, 0.2, 1.8);
    const wing = new THREE.Mesh(wingGeo, carBodyMat);
    wing.position.set(0, 1.8, -3.5);
    const wingSupportL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), carBodyMat);
    wingSupportL.position.set(-2, 1.2, -3.5);
    const wingSupportR = wingSupportL.clone();
    wingSupportR.position.x = 2;
    carGroup.add(wing);
    carGroup.add(wingSupportL);
    carGroup.add(wingSupportR);

    // --- 7. Animation Loop ---
    let progress = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const dt = clock.getDelta();
      const time = clock.getElapsedTime();

      // Slow Orbit Auto-Rotation if allowed
      if (autoRotate && cameraMode === 'orbit' && !isDraggingRef.current) {
        orbitAngleRef.current.theta += dt * 0.18;
      }

      // Constrain Polar angle to stay above ground
      orbitAngleRef.current.phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, orbitAngleRef.current.phi));

      // 8. Update Camera View angle based on Mode Selection
      if (cameraMode === 'topdown') {
        camera.position.set(0, 310, 0);
        camera.lookAt(0, 0, 0);
        camera.up.set(0, 0, -1);
      } else if (cameraMode === 'isometric') {
        camera.position.set(220, 180, 220);
        camera.lookAt(0, 0, 0);
        camera.up.set(0, 1, 0);
      } else if (cameraMode === 'chase') {
        // Find position slightly behind and above the moving car
        const carT = progress % 1;
        const carPos = spline.getPointAt(carT);
        const nextPos = spline.getPointAt((carT + 0.02) % 1);
        const direction = new THREE.Vector3().subVectors(nextPos, carPos).normalize();
        
        const cameraTarget = carPos.clone().add(new THREE.Vector3(0, 3, 0));
        const cameraPos = carPos.clone().addScaledVector(direction, -35).add(new THREE.Vector3(0, 18, 0));
        
        camera.position.lerp(cameraPos, 0.08);
        camera.lookAt(cameraTarget);
        camera.up.set(0, 1, 0);
      } else {
        // FREE ORBIT MODE
        const theta = orbitAngleRef.current.theta;
        const phi = orbitAngleRef.current.phi;
        const radius = orbitAngleRef.current.radius;

        camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
        camera.position.y = radius * Math.cos(phi);
        camera.position.z = radius * Math.sin(phi) * Math.cos(theta);

        camera.lookAt(0, 0, 0);
        camera.up.set(0, 1, 0);
      }

      // Move the Mini-Car along spline loop
      progress += dt * 0.065 * speedMult;
      const carT = progress % 1;
      const pos = spline.getPointAt(carT);
      const nextPos = spline.getPointAt((carT + 0.005) % 1);

      carGroup.position.copy(pos);
      carGroup.lookAt(nextPos);

      // Animate Start-Finish Location Marker
      if (markerPointerGroup) {
        markerPointerGroup.position.y = 13.5 + Math.sin(time * 3.5) * 1.5;
        markerPointerGroup.rotation.y = time * 1.8;
      }
      if (orbitRing) {
        orbitRing.rotation.z = time * -2.5;
        orbitRing.rotation.y = Math.sin(time * 2.0) * 0.25;
      }
      if (waveRings && waveMats) {
        for (let w = 0; w < waveCount; w++) {
          const waveProgress = ((time * 0.8) + (w / waveCount)) % 1.0;
          const currentRing = waveRings[w];
          const currentMat = waveMats[w];
          if (currentRing && currentMat) {
            const scale = 1.0 + waveProgress * 2.5;
            currentRing.scale.set(scale, scale, 1);
            currentMat.opacity = 0.85 * (1.0 - waveProgress);
          }
        }
      }

      // Render Scene
      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Run first frame
    animate();

    // --- 9. Pointer Event Handlers for Custom Drag Orbit ---
    const canvas = canvasRef.current;

    const handlePointerDown = (e: PointerEvent) => {
      if (cameraMode !== 'orbit') return;
      isDraggingRef.current = true;
      canvas.setPointerCapture(e.pointerId);
      prevPointerPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || cameraMode !== 'orbit') return;
      const deltaX = e.clientX - prevPointerPosRef.current.x;
      const deltaY = e.clientY - prevPointerPosRef.current.y;

      prevPointerPosRef.current = { x: e.clientX, y: e.clientY };

      orbitAngleRef.current.theta -= deltaX * 0.008;
      orbitAngleRef.current.phi -= deltaY * 0.008;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (cameraMode !== 'orbit') return;
      isDraggingRef.current = false;
      canvas.releasePointerCapture(e.pointerId);
    };

    const handleWheel = (e: WheelEvent) => {
      if (cameraMode !== 'orbit') return;
      e.preventDefault();
      orbitAngleRef.current.radius = Math.max(100, Math.min(650, orbitAngleRef.current.radius + e.deltaY * 0.4));
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // --- 10. Resize handler ---
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      camera.aspect = newWidth / height;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, height);
    };

    window.addEventListener('resize', handleResize);

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      if (canvas) {
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerup', handlePointerUp);
        canvas.removeEventListener('wheel', handleWheel);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      scene.clear();
      renderer.dispose();
    };
  }, [selectedTrackId, cameraMode, autoRotate, showDecorations, speedMult, stats.color]);

  return (
    <div
      ref={containerRef}
      className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col shadow-xl select-none"
      id="track-3d-preview-card"
    >
      {/* Header section with badge */}
      <div className={`p-4 bg-linear-to-r ${stats.bgGradient} border-b border-slate-800/60 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <div className="h-2.5 w-2.5 rounded-full animate-ping shrink-0" style={{ backgroundColor: stats.color }} />
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Interactive Track Preview</span>
            <span className="text-sm font-black text-white uppercase tracking-tight">{stats.name}</span>
          </div>
        </div>
        <span
          className="text-[9px] font-black uppercase px-2.5 py-1 rounded-md border border-slate-700/60"
          style={{ color: stats.color, borderColor: `${stats.color}30`, backgroundColor: `${stats.color}08` }}
        >
          {stats.difficultyText} Rating
        </span>
      </div>

      {/* Render Canvas */}
      <div className="relative w-full h-[280px]">
        <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

        {/* Floating Overlay Viewpoint Presets */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {(['orbit', 'isometric', 'topdown', 'chase'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setCameraMode(mode);
                if (mode !== 'orbit') setAutoRotate(false);
              }}
              className={`p-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-sm transition-all text-left px-2.5 ${
                cameraMode === mode
                  ? 'bg-slate-100 text-slate-950 border-white shadow'
                  : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Eye className="h-3 w-3" />
              <span>{mode}</span>
            </button>
          ))}
        </div>

        {/* Toggle options */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {cameraMode === 'orbit' && (
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`p-2 rounded-lg border backdrop-blur-sm transition-all flex items-center justify-center ${
                autoRotate
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-950/80 text-slate-400 border-slate-800'
              }`}
              title="Toggle Auto Rotation"
            >
              <RotateCw className={`h-3.5 w-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            </button>
          )}

          <button
            onClick={() => setShowDecorations(!showDecorations)}
            className={`p-2 rounded-lg border backdrop-blur-sm transition-all flex items-center justify-center ${
              showDecorations
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-950/80 text-slate-400 border-slate-800'
            }`}
            title="Toggle Scenic Decorations"
          >
            <Compass className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Interactive Pointer Instruction Tip overlay */}
        {cameraMode === 'orbit' && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-800 text-[9px] text-slate-500 font-bold tracking-wider pointer-events-none uppercase">
            🖱️ Drag to rotate preview | Scroll to zoom
          </div>
        )}
      </div>

      {/* Track Stats / Obstacles breakdown */}
      <div className="p-5 bg-slate-950 flex-1 flex flex-col gap-4 border-t border-slate-800/50">
        <div>
          <span className="text-[9px] text-slate-500 font-bold tracking-widest uppercase flex items-center gap-1">
            <Info className="h-3 w-3 text-slate-400 inline" /> CIRCUIT DESCRIPTION
          </span>
          <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">{stats.desc}</p>
        </div>

        {/* Dynamic difficulty parameter boxes */}
        <div className="grid grid-cols-2 gap-3 mt-1 text-xs">
          <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 font-bold tracking-wider uppercase flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-400" /> Elevation Slope
            </span>
            <span className="font-mono font-bold text-slate-200">{stats.elevation}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 font-bold tracking-wider uppercase flex items-center gap-1">
              <Award className="h-3 w-3 text-amber-400" /> Curve Severity
            </span>
            <span className="font-mono font-bold text-slate-200">{stats.corners}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 font-bold tracking-wider uppercase flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-rose-400" /> Slip Hazard Index
            </span>
            <span className="font-mono font-bold text-slate-200">{stats.hazardRating}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 font-bold tracking-wider uppercase">Preview Car Speed</span>
            <div className="flex items-center gap-2 mt-0.5">
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.1"
                value={speedMult}
                onChange={(e) => setSpeedMult(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <span className="font-mono text-[9px] font-bold text-emerald-400 shrink-0 w-8 text-right">
                {speedMult.toFixed(1)}x
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
