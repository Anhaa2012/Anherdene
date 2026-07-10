import React, { useState, useEffect } from 'react';
import { Play, Shield, Settings, Volume2, VolumeX, RotateCcw, Award, Check, HardDrive, ShoppingBag, Flame, Zap, Wrench, ChevronRight, BarChart2, Star, Clock, Users } from 'lucide-react';
import { Track, Car, CarUpgrades, LeaderboardEntry } from './types';
import ThreeGame from './components/ThreeGame';
import UnityExporter from './components/UnityExporter';
import Track3DPreview from './components/Track3DPreview';
import ParticleExplosion from './components/ParticleExplosion';
import TrackLeaderboard from './components/TrackLeaderboard';
import { motion, AnimatePresence } from 'motion/react';
import ProfileFriendsSection from './components/ProfileFriendsSection';
import { auth, saveUserProfileToCloud } from './firebase';

// Constant Tracks List
const TRACKS: Track[] = [
  {
    id: 'track_city',
    name: 'Neon Gridway',
    description: 'A glowing retro-cyber track surrounded by towering skyscrapers and sharp 90-degree street corners.',
    color: '#10b981', // emerald green
    length: 1200,
    difficulty: 'Easy',
    baseReward: 100,
    skyColor: '#070a13',
    groundColor: '#0f172a'
  },
  {
    id: 'track_desert',
    name: 'Canyon Dune',
    description: 'A wide sweeping canyon loop tracing towering sandstone arches, pyramids, and massive rolling dunes.',
    color: '#f59e0b', // amber orange
    length: 1600,
    difficulty: 'Medium',
    baseReward: 180,
    skyColor: '#3c2317',
    groundColor: '#451a03'
  },
  {
    id: 'track_mountain',
    name: 'Alpine Drift',
    description: 'A treacherous, winding snow-covered pass climbing severe hillsides with heavy visual elevation hairpins.',
    color: '#06b6d4', // cyan
    length: 1400,
    difficulty: 'Hard',
    baseReward: 250,
    skyColor: '#082f49',
    groundColor: '#020617'
  },
  {
    id: 'track_volcano',
    name: 'Volcanic Rim',
    description: 'A high-stakes volcanic ridge loop with glowing lava pools, obsidian rock pillars, and dense ash skies.',
    color: '#f97316', // orange
    length: 1500,
    difficulty: 'Medium',
    baseReward: 210,
    skyColor: '#1e0505',
    groundColor: '#100101'
  },
  {
    id: 'track_cosmic',
    name: 'Cosmic Drift',
    description: 'An outer space circuit tracing a starry meteor ring, featuring floating crystal pillars and beautiful galactic views.',
    color: '#a855f7', // purple/violet
    length: 1800,
    difficulty: 'Hard',
    baseReward: 300,
    skyColor: '#070212',
    groundColor: '#04010a'
  }
];

// Constant Cars List
const CARS: Car[] = [
  {
    id: 'car_specter',
    name: 'Specter GT',
    category: 'European Luxury Sports Car',
    speed: 5,
    handling: 6,
    brakes: 5,
    nitro: 5,
    color: '#94a3b8', // metallic silver
    cost: 0,
    unlocked: true,
    description: 'A high-performance European luxury grand tourer. Sleek aerodynamic body, aggressive front grille, and sharp LED headlights designed for precise handling.'
  },
  {
    id: 'car_rebel',
    name: 'V8 Interceptor',
    category: 'Classic Muscle Car',
    speed: 6,
    handling: 4,
    brakes: 7,
    nitro: 5,
    color: '#ef4444', // racing red
    cost: 350,
    unlocked: false,
    description: 'An aggressive American classic. Brutal supercharged engine torque, heavy-duty muscle frame, custom carbon spoiler options, and raw straightaway speed.'
  },
  {
    id: 'car_vortex',
    name: 'Vortex S-Spec',
    category: 'Supercar',
    speed: 8,
    handling: 7,
    brakes: 6,
    nitro: 7,
    color: '#f8fafc', // pearl white
    cost: 750,
    unlocked: false,
    description: 'Mid-engine high-aerodynamics supercar. Highly sculpted body lines, low-profile performance tires, premium pearl paint, and high speed thresholds.'
  },
  {
    id: 'car_apocalypse',
    name: 'Apex Hyperion',
    category: 'Exotic Hypercar',
    speed: 10,
    handling: 9,
    brakes: 8,
    nitro: 9,
    color: '#eab308', // gold
    cost: 1200,
    unlocked: false,
    description: 'An elite, ultra-rare carbon fiber exotic hypercar. Active aerodynamic wing, aggressive styling, and a monstrous engine delivering AAA-grade speed.'
  },
  {
    id: 'car_kansai',
    name: 'Kansai Drift-R',
    category: 'Japanese Tuner Car',
    speed: 5,
    handling: 9,
    brakes: 6,
    nitro: 7,
    color: '#10b981', // emerald green
    cost: 500,
    unlocked: false,
    description: 'A legendary Japanese tuner car built for drifting. Lightweight body kit, massive double-deck racing wing, and customized high-grip tire compounds.'
  },
  {
    id: 'car_volt',
    name: 'Volt Surge EV',
    category: 'Electric Performance Car',
    speed: 7,
    handling: 8,
    brakes: 9,
    nitro: 6,
    color: '#3b82f6', // electric blue
    cost: 950,
    unlocked: false,
    description: 'Next-gen electric performance car. Instant low-end torque acceleration, futuristic neon light strip highlights, and state-of-the-art battery cooling.'
  },
  {
    id: 'car_zenith',
    name: 'Zenith Vision',
    category: 'Futuristic Concept Car',
    speed: 9,
    handling: 9,
    brakes: 9,
    nitro: 10,
    color: '#18181b', // matte black
    cost: 1500,
    unlocked: false,
    description: 'A futuristic concept canopy car designed with advanced carbon fiber channels, glowing rims, integrated spoiler, and experimental propulsion.'
  }
];

const UPGRADE_COST = 120; // flat rate coins per upgrade level

export default function App() {
  // Screen Router
  const [activeScreen, setActiveScreen] = useState<'menu' | 'garage' | 'settings' | 'race' | 'unity-export' | 'profile'>('menu');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('track_city');
  const [selectedCarId, setSelectedCarId] = useState<string>('car_specter');
  const [selectedWeather, setSelectedWeather] = useState<'clear' | 'rain' | 'snow' | 'fog'>('clear');

  // Player Progression state
  const [coins, setCoins] = useState<number>(1000); // Give slightly higher starting coins so they can immediately buy or upgrade some cars
  const [unlockedCarIds, setUnlockedCarIds] = useState<string[]>(['car_specter']);
  const [carUpgrades, setCarUpgrades] = useState<Record<string, CarUpgrades>>({
    car_specter: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
    car_rebel: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
    car_vortex: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
    car_apocalypse: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
    car_kansai: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
    car_volt: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
    car_zenith: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
  });
  const [carCustomizations, setCarCustomizations] = useState<Record<string, {
    color: string;
    paintFinish: 'glossy' | 'metallic' | 'matte' | 'pearl';
    rimStyle: 'sports' | 'carbon' | 'deepdish' | 'goldstar';
    spoilerStyle: 'lowprofile' | 'aero' | 'drag' | 'none';
    decalStyle: 'stripes' | 'cyber' | 'flames' | 'none';
  }>>({
    car_specter: { color: '#94a3b8', paintFinish: 'metallic', rimStyle: 'sports', spoilerStyle: 'lowprofile', decalStyle: 'none' },
    car_rebel: { color: '#ef4444', paintFinish: 'matte', rimStyle: 'deepdish', spoilerStyle: 'drag', decalStyle: 'stripes' },
    car_vortex: { color: '#f8fafc', paintFinish: 'pearl', rimStyle: 'carbon', spoilerStyle: 'aero', decalStyle: 'none' },
    car_apocalypse: { color: '#eab308', paintFinish: 'pearl', rimStyle: 'goldstar', spoilerStyle: 'aero', decalStyle: 'none' },
    car_kansai: { color: '#10b981', paintFinish: 'metallic', rimStyle: 'goldstar', spoilerStyle: 'drag', decalStyle: 'flames' },
    car_volt: { color: '#3b82f6', paintFinish: 'glossy', rimStyle: 'sports', spoilerStyle: 'none', decalStyle: 'cyber' },
    car_zenith: { color: '#18181b', paintFinish: 'matte', rimStyle: 'carbon', spoilerStyle: 'aero', decalStyle: 'none' },
  });
  const [bestTimes, setBestTimes] = useState<Record<string, number>>({
    track_city: 0,
    track_desert: 0,
    track_mountain: 0,
    track_volcano: 0,
    track_cosmic: 0,
  });

  // Settings state
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'legend'>('easy');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.5);

  // Active Race session result
  const [raceResult, setRaceResult] = useState<{
    standing: number;
    time: number;
    rewardCoins: number;
    prevBest: number;
    isNewRecord: boolean;
  } | null>(null);

  // Particle explosion trigger and styling state
  const [buyTrigger, setBuyTrigger] = useState<number>(0);
  const [boughtCarColor, setBoughtCarColor] = useState<string>('');

  // Leaderboard states
  const [playerName, setPlayerNameState] = useState<string>('YOU');
  const [leaderboardUpdateTrigger, setLeaderboardUpdateTrigger] = useState<number>(0);

  // Save/Load hooks
  useEffect(() => {
    const savedCoins = localStorage.getItem('race_coins');
    const savedUnlocked = localStorage.getItem('race_unlocked_cars');
    const savedUpgrades = localStorage.getItem('race_upgrades');
    const savedCustoms = localStorage.getItem('race_customizations');
    const savedRecords = localStorage.getItem('race_best_times');
    const savedDifficulty = localStorage.getItem('race_difficulty');
    const savedAudio = localStorage.getItem('race_audio');
    const savedVol = localStorage.getItem('race_volume');
    const savedPlayerName = localStorage.getItem('race_player_name');

    if (savedCoins) setCoins(parseInt(savedCoins));
    if (savedUnlocked) setUnlockedCarIds(JSON.parse(savedUnlocked));
    if (savedUpgrades) setCarUpgrades(JSON.parse(savedUpgrades));
    if (savedCustoms) setCarCustomizations(JSON.parse(savedCustoms));
    if (savedRecords) setBestTimes(JSON.parse(savedRecords));
    if (savedDifficulty) setDifficulty(savedDifficulty as 'easy' | 'medium' | 'legend');
    if (savedAudio) setAudioEnabled(savedAudio === 'true');
    if (savedVol) setVolume(parseFloat(savedVol));
    if (savedPlayerName) setPlayerNameState(savedPlayerName);
  }, []);

  const saveProgression = (
    newCoins: number,
    newUnlocked: string[],
    newUpgrades: any,
    newRecords: any,
    newCustoms: any = carCustomizations
  ) => {
    localStorage.setItem('race_coins', newCoins.toString());
    localStorage.setItem('race_unlocked_cars', JSON.stringify(newUnlocked));
    localStorage.setItem('race_upgrades', JSON.stringify(newUpgrades));
    localStorage.setItem('race_best_times', JSON.stringify(newRecords));
    localStorage.setItem('race_customizations', JSON.stringify(newCustoms));

    if (auth.currentUser) {
      saveUserProfileToCloud(auth.currentUser.uid, {
        coins: newCoins,
        unlockedCarIds: newUnlocked,
        carUpgrades: newUpgrades,
        bestTimes: newRecords,
        carCustomizations: newCustoms
      });
    }
  };

  const updatePlayerName = (name: string) => {
    const cleanName = name.slice(0, 16) || 'YOU';
    setPlayerNameState(cleanName);
    localStorage.setItem('race_player_name', cleanName);

    // Sync current name change across all active leaderboard collections
    TRACKS.forEach((track) => {
      try {
        const stored = localStorage.getItem(`race_leaderboard_v1_${track.id}`);
        if (stored) {
          const list = JSON.parse(stored);
          const updatedList = list.map((entry: any) => {
            if (entry.isPlayer) {
              return { ...entry, playerName: cleanName };
            }
            return entry;
          });
          localStorage.setItem(`race_leaderboard_v1_${track.id}`, JSON.stringify(updatedList));
        }
      } catch (e) {
        console.error('Error updating name in stored leaderboards', e);
      }
    });
    setLeaderboardUpdateTrigger((prev) => prev + 1);
  };

  const updateCustomization = (carId: string, fields: Partial<typeof carCustomizations[string]>) => {
    const nextCustoms = {
      ...carCustomizations,
      [carId]: {
        ...carCustomizations[carId],
        ...fields
      }
    };
    setCarCustomizations(nextCustoms);
    saveProgression(coins, unlockedCarIds, carUpgrades, bestTimes, nextCustoms);
  };

  // Upgrades buying mechanics
  const buyUpgrade = (carId: string, stat: keyof CarUpgrades) => {
    const currentLvl = carUpgrades[carId]?.[stat] || 1;
    if (currentLvl >= 5) return; // capped at level 5

    if (coins >= UPGRADE_COST) {
      const nextCoins = coins - UPGRADE_COST;
      const nextUpgrades = {
        ...carUpgrades,
        [carId]: {
          ...carUpgrades[carId],
          [stat]: currentLvl + 1
        }
      };
      setCoins(nextCoins);
      setCarUpgrades(nextUpgrades);
      saveProgression(nextCoins, unlockedCarIds, nextUpgrades, bestTimes);
    }
  };

  // Unlock car mechanics
  const buyCar = (car: Car) => {
    if (coins >= car.cost && !unlockedCarIds.includes(car.id)) {
      const nextCoins = coins - car.cost;
      const nextUnlocked = [...unlockedCarIds, car.id];
      setCoins(nextCoins);
      setUnlockedCarIds(nextUnlocked);
      setSelectedCarId(car.id);
      saveProgression(nextCoins, nextUnlocked, carUpgrades, bestTimes);
      // Trigger canvas particle explosion
      setBoughtCarColor(car.color);
      setBuyTrigger((prev) => prev + 1);
    }
  };

  // Reset progress handler
  const resetProgress = () => {
    localStorage.clear();
    setCoins(1000);
    setUnlockedCarIds(['car_specter']);
    setPlayerNameState('YOU');
    setLeaderboardUpdateTrigger((prev) => prev + 1);
    setCarUpgrades({
      car_specter: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
      car_rebel: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
      car_vortex: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
      car_apocalypse: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
      car_kansai: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
      car_volt: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
      car_zenith: { engine: 1, tires: 1, brakes: 1, nitro: 1 },
    });
    setCarCustomizations({
      car_specter: { color: '#94a3b8', paintFinish: 'metallic', rimStyle: 'sports', spoilerStyle: 'lowprofile', decalStyle: 'none' },
      car_rebel: { color: '#ef4444', paintFinish: 'matte', rimStyle: 'deepdish', spoilerStyle: 'drag', decalStyle: 'stripes' },
      car_vortex: { color: '#f8fafc', paintFinish: 'pearl', rimStyle: 'carbon', spoilerStyle: 'aero', decalStyle: 'none' },
      car_apocalypse: { color: '#eab308', paintFinish: 'pearl', rimStyle: 'goldstar', spoilerStyle: 'aero', decalStyle: 'none' },
      car_kansai: { color: '#10b981', paintFinish: 'metallic', rimStyle: 'goldstar', spoilerStyle: 'drag', decalStyle: 'flames' },
      car_volt: { color: '#3b82f6', paintFinish: 'glossy', rimStyle: 'sports', spoilerStyle: 'none', decalStyle: 'cyber' },
      car_zenith: { color: '#18181b', paintFinish: 'matte', rimStyle: 'carbon', spoilerStyle: 'aero', decalStyle: 'none' },
    });
    setBestTimes({
      track_city: 0,
      track_desert: 0,
      track_mountain: 0,
      track_volcano: 0,
      track_cosmic: 0,
    });
    setDifficulty('easy');
    setAudioEnabled(true);
    setVolume(0.5);
    setActiveScreen('menu');
  };

  // Completion stats calculation after a race finishes
  const handleRaceFinish = (standing: number, time: number, rewardCoins: number, fastestLap?: number) => {
    const trackId = selectedTrackId;
    const prevBest = bestTimes[trackId] || 0;
    const isNewRecord = prevBest === 0 || time < prevBest;

    const nextCoins = coins + rewardCoins;
    const nextBestTimes = {
      ...bestTimes,
      [trackId]: isNewRecord ? time : prevBest
    };

    // Calculate player's fastest lap time
    const calculatedLapTime = fastestLap && fastestLap > 0 ? fastestLap : (time / 3);

    // Save/Update player record on the specific track's leaderboard
    try {
      let playerLeaderboard: any[] = [];
      const stored = localStorage.getItem(`race_leaderboard_v1_${trackId}`);
      if (stored) {
        playerLeaderboard = JSON.parse(stored);
      }

      const storedPlayerName = localStorage.getItem('race_player_name') || playerName || 'YOU';
      const existingPlayerIndex = playerLeaderboard.findIndex(
        (entry) => entry.playerName === storedPlayerName || entry.isPlayer
      );

      if (existingPlayerIndex !== -1) {
        const existingEntry = playerLeaderboard[existingPlayerIndex];
        if (calculatedLapTime < existingEntry.time) {
          playerLeaderboard[existingPlayerIndex] = {
            trackId,
            carName: activeCar.name,
            playerName: storedPlayerName,
            time: calculatedLapTime,
            date: new Date().toLocaleDateString(),
            isPlayer: true
          };
        }
      } else {
        playerLeaderboard.push({
          trackId,
          carName: activeCar.name,
          playerName: storedPlayerName,
          time: calculatedLapTime,
          date: new Date().toLocaleDateString(),
          isPlayer: true
        });
      }

      localStorage.setItem(`race_leaderboard_v1_${trackId}`, JSON.stringify(playerLeaderboard));
      setLeaderboardUpdateTrigger((prev) => prev + 1);
    } catch (e) {
      console.error('Error updating leaderboard on race finish', e);
    }

    setCoins(nextCoins);
    setBestTimes(nextBestTimes);
    setRaceResult({
      standing,
      time,
      rewardCoins,
      prevBest,
      isNewRecord
    });
    saveProgression(nextCoins, unlockedCarIds, carUpgrades, nextBestTimes);
    setActiveScreen('menu');
  };

  // Get active selected configurations
  const activeTrack = TRACKS.find((t) => t.id === selectedTrackId) || TRACKS[0];
  const activeCar = CARS.find((c) => c.id === selectedCarId) || CARS[0];
  const activeUpgrades = carUpgrades[selectedCarId] || { engine: 1, tires: 1, brakes: 1, nitro: 1 };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Particle Celebration Canvas */}
      <ParticleExplosion trigger={buyTrigger} accentColor={boughtCarColor} />

      {/* Visual background lines */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-slate-950 to-slate-950 pointer-events-none z-0" />

      {/* Global Gaming Header Bar */}
      {activeScreen !== 'race' && (
        <header className="relative z-10 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0" id="main-header">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500 text-slate-950 font-black p-2 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight uppercase flex items-center gap-2">
                  Apex Overload <span className="text-xs text-emerald-400 font-semibold bg-emerald-950 border border-emerald-800/40 px-2 py-0.5 rounded">3D Prototype</span>
                </h1>
                <p className="text-xs text-slate-500 font-medium">Procedural 3D Web & Unity C# Developer Center</p>
              </div>
            </div>

            {/* Header Right Stats and Nav */}
            <div className="flex items-center flex-wrap gap-4">
              {/* Coins counter */}
              <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800/60" id="coins-payout-panel">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">COINS</span>
                <span className="font-mono text-lg font-black text-amber-400">{coins}</span>
              </div>

              {/* Navigation Options */}
              <nav className="flex bg-slate-900 p-1 rounded-xl border border-slate-800/60 text-sm font-semibold flex-wrap gap-1 md:gap-0">
                <button
                  onClick={() => { setActiveScreen('menu'); setRaceResult(null); }}
                  className={`px-3 md:px-4 py-2 rounded-lg transition-all ${
                    activeScreen === 'menu' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Race Track
                </button>
                <button
                  onClick={() => { setActiveScreen('garage'); setRaceResult(null); }}
                  className={`px-3 md:px-4 py-2 rounded-lg transition-all ${
                    activeScreen === 'garage' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Garage Room
                </button>
                <button
                  onClick={() => { setActiveScreen('settings'); setRaceResult(null); }}
                  className={`px-3 md:px-4 py-2 rounded-lg transition-all ${
                    activeScreen === 'settings' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Settings
                </button>
                <button
                  onClick={() => { setActiveScreen('profile'); setRaceResult(null); }}
                  className={`px-3 md:px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                    activeScreen === 'profile' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Profile & Friends
                </button>
                <button
                  onClick={() => { setActiveScreen('unity-export'); setRaceResult(null); }}
                  className={`px-3 md:px-4 py-2 rounded-lg transition-all ${
                    activeScreen === 'unity-export' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Unity Hub
                </button>
              </nav>
            </div>
          </div>
        </header>
      )}

      {/* Main Container screen views router */}
      <main className="flex-1 relative z-10 max-w-7xl w-full mx-auto p-6 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* VIEW 1: RACE SIMULATOR */}
          {activeScreen === 'race' && (
            <motion.div
              key="race"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 min-h-[500px] h-[calc(100vh-120px)] flex flex-col"
            >
            <ThreeGame
              activeTrack={activeTrack}
              selectedCar={{
                ...activeCar,
                color: carCustomizations[activeCar.id]?.color || activeCar.color,
                paintFinish: carCustomizations[activeCar.id]?.paintFinish || 'glossy',
                rimStyle: carCustomizations[activeCar.id]?.rimStyle || 'sports',
                spoilerStyle: carCustomizations[activeCar.id]?.spoilerStyle || 'lowprofile',
                decalStyle: carCustomizations[activeCar.id]?.decalStyle || 'none'
              }}
              upgrades={activeUpgrades}
              difficulty={difficulty}
              audioEnabled={audioEnabled}
              volume={volume}
              initialWeather={selectedWeather}
              onRaceFinished={handleRaceFinish}
              onExit={() => setActiveScreen('menu')}
            />
          </motion.div>
        )}

        {/* VIEW 2: RACE RESULTS PANEL OVERLAY */}
        {raceResult && activeScreen !== 'race' && (
          <motion.section
            key="results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8 text-center max-w-2xl mx-auto shadow-2xl relative overflow-hidden"
            id="results-panel"
          >
            {/* Visual shine */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-emerald-500 via-teal-400 to-cyan-500" />
            
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <Award className="w-8 h-8" />
            </div>

            <h2 className="text-3xl font-black tracking-tight text-white uppercase">Race Finished!</h2>
            <p className="text-slate-400 text-sm mt-1">Completion stats and standings recap</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 my-8">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Standing</span>
                <div className="text-3xl font-black text-emerald-400 font-mono mt-1">
                  {raceResult.standing === 1 ? '1ST' : raceResult.standing === 2 ? '2ND' : raceResult.standing === 3 ? '3RD' : '4TH'}
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Race Time</span>
                <div className="text-xl font-black text-slate-100 font-mono mt-2">
                  {Math.floor(raceResult.time / 60)}:{(raceResult.time % 60).toFixed(2).padStart(5, '0')}
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 col-span-2 md:col-span-1">
                <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Earned Payout</span>
                <div className="text-xl font-black text-amber-400 font-mono mt-2 flex items-center justify-center gap-1">
                  +{raceResult.rewardCoins} <span className="text-xs text-slate-500 font-semibold">Coins</span>
                </div>
              </div>
            </div>

            {raceResult.isNewRecord && (
              <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3 mb-6 text-sm text-emerald-400 font-semibold flex items-center justify-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> NEW TRACK RECORD TIME SET!
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setActiveScreen('race')}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all text-sm shadow-lg shadow-emerald-500/10 flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Restart Race
              </button>
              <button
                onClick={() => setRaceResult(null)}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all text-sm active:scale-95 cursor-pointer"
              >
                Return to Menu
              </button>
            </div>
          </motion.section>
        )}

        {/* VIEW 3: TRACK SELECTION MENU */}
        {activeScreen === 'menu' && !raceResult && (
          <motion.section
            key="menu"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="flex flex-col gap-8"
            id="track-menu-panel"
          >
            {/* Title / Hero card Banner */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-8 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase">Choose Your Race Circuit</h2>
                <p className="text-slate-400 text-sm mt-1 max-w-lg">
                  Set your performance limits. Race against smart AI opponents across complex curves and climb the leaderboards.
                </p>
              </div>

              {/* Difficulty Level selector */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Opponents Difficulty</span>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['easy', 'medium', 'legend'] as const).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => {
                        setDifficulty(diff);
                        localStorage.setItem('race_difficulty', diff);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                        difficulty === diff
                          ? diff === 'legend'
                            ? 'bg-red-500 text-slate-950 font-black shadow shadow-red-500/20'
                            : 'bg-emerald-500 text-slate-950 shadow'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {diff === 'legend' ? '🔥 LEGEND' : diff}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Split Layout: Tracks Selection + Interactive 3D Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Side: Track Cards Grid */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {TRACKS.map((track) => {
                  const isSelected = selectedTrackId === track.id;
                  const personalBest = bestTimes[track.id] || 0;

                  return (
                    <div
                      key={track.id}
                      onClick={() => setSelectedTrackId(track.id)}
                      className={`group bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-300 flex flex-col cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 shadow-lg shadow-emerald-500/5 -translate-y-1'
                          : 'border-slate-800/80 hover:border-slate-700/80'
                      }`}
                    >
                      {/* Visual representative track banner */}
                      <div
                        className="h-32 flex items-center justify-center relative bg-slate-950 overflow-hidden"
                        style={{ borderBottom: `2.5px solid ${track.color}` }}
                      >
                        <div className="absolute inset-0 bg-slate-950/20" />
                        {/* Stylized road vector graphic */}
                        <svg viewBox="0 0 100 40" className="w-2/3 opacity-30 group-hover:scale-110 transition-transform duration-500">
                          <path
                            d={
                              track.id === 'track_city' ? "M10 20 H90 V30 H10 Z" :
                              track.id === 'track_desert' ? "M10 20 Q50 40, 90 20 T10 20" :
                              track.id === 'track_volcano' ? "M10 30 Q50 0, 90 30 T10 30" :
                              track.id === 'track_cosmic' ? "M10 20 Q50 -10, 90 20 T10 20 Z" :
                              "M10 10 Q30 30, 50 10 T90 30"
                            }
                            fill="none"
                            stroke={track.color}
                            strokeWidth="2.5"
                          />
                        </svg>
                        {/* Difficulty overlay pill */}
                        <span className="absolute top-3 right-3 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-slate-900/90 border border-slate-800 text-slate-300">
                          {track.difficulty}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">{track.name}</h3>
                          <p className="text-slate-400 text-xs mt-2 leading-relaxed">{track.description}</p>
                        </div>

                        <div className="border-t border-slate-800/60 mt-5 pt-4 flex flex-col gap-2 text-xs">
                          <div className="flex justify-between text-slate-500">
                            <span>Circuit Length:</span>
                            <span className="font-mono text-slate-300 font-bold">{track.length} M</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>Lap Count:</span>
                            <span className="font-mono text-slate-300 font-bold">3 Laps</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>Personal Best:</span>
                            <span className="font-mono text-emerald-400 font-bold">
                              {personalBest > 0 ? `${Math.floor(personalBest / 60)}:${(personalBest % 60).toFixed(2).padStart(5, '0')}` : 'No Time Rec'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Side: Interactive 3D Map Preview & Speed Records Leaderboard */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <Track3DPreview selectedTrackId={selectedTrackId} difficulty={difficulty} />
                <TrackLeaderboard
                  selectedTrackId={selectedTrackId}
                  bestTimes={bestTimes}
                  tracks={TRACKS}
                  triggerUpdate={leaderboardUpdateTrigger}
                />
              </div>
            </div>

            {/* Start Driving Call to action */}
            <div className="flex flex-col lg:flex-row items-center justify-between p-6 bg-slate-900 border border-slate-800/80 rounded-2xl gap-6 shadow-md">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-slate-800/80 text-lg font-bold"
                  style={{ backgroundColor: `${activeCar.color}15`, color: activeCar.color }}
                >
                  🏎️
                </div>
                <div>
                  <h4 className="font-bold text-slate-100">Ready to compete in: {activeCar.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Stat upgrades: Engine Lvl {activeUpgrades.engine} | Tires Lvl {activeUpgrades.tires}</p>
                </div>
              </div>

              {/* Pre-race Weather Selector */}
              <div className="flex flex-col gap-1.5 shrink-0 items-center lg:items-start">
                <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Select Race Weather</span>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {([
                    { id: 'clear', label: '☀️ Clear' },
                    { id: 'rain', label: '🌧️ Rain' },
                    { id: 'snow', label: '❄️ Snow' },
                    { id: 'fog', label: '🌫️ Fog' }
                  ] as const).map((wOption) => (
                    <button
                      key={wOption.id}
                      onClick={() => setSelectedWeather(wOption.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedWeather === wOption.id
                          ? 'bg-emerald-500 text-slate-950 shadow font-black'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {wOption.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 w-full lg:w-auto">
                <button
                  onClick={() => setActiveScreen('garage')}
                  className="w-full lg:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-all active:scale-95 text-center cursor-pointer"
                >
                  Tune in Garage
                </button>
                <button
                  onClick={() => setActiveScreen('race')}
                  className="w-full lg:w-auto px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Play className="w-4.5 h-4.5 fill-slate-950" /> Start Race
                </button>
              </div>
            </div>
          </motion.section>
        )}

        {/* VIEW 4: GARAGE & VEHICLE UPGRADE ROOM */}
        {activeScreen === 'garage' && (
          <motion.section
            key="garage"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="flex flex-col gap-8"
            id="garage-panel"
          >
            {/* Garage Title Banner */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-8 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
              <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase flex items-center gap-2">
                  <Wrench className="w-7 h-7 text-emerald-400" /> Apex Styling & Customization Hub
                </h2>
                <p className="text-slate-400 text-sm mt-1 max-w-lg">
                  Tweak high-end sports cars, upgrade engine blocks, configure aerodynamic spoilers, swap rims, and paint carbon fiber bodies.
                </p>
              </div>
              <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs font-bold text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Customizer Studio Active
              </div>
            </div>

            {/* TOP ROW: Active Car Showcase Card */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden flex flex-col lg:flex-row items-center gap-8 shadow-lg">
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none transition-colors duration-500"
                style={{ 
                  background: `radial-gradient(circle at center, ${carCustomizations[selectedCarId]?.color || activeCar.color} 0%, transparent 70%)` 
                }} 
              />
              
              {/* Car Visual Preview */}
              <div className="w-full lg:w-1/3 flex flex-col items-center justify-center p-8 bg-slate-950/80 border border-slate-800/60 rounded-xl relative overflow-hidden min-h-[220px]">
                {/* Simulated Glowing neon underglow */}
                <div 
                  className="absolute bottom-6 w-32 h-3.5 rounded-full blur-md opacity-70 transition-all duration-500 animate-pulse"
                  style={{ backgroundColor: carCustomizations[selectedCarId]?.color || activeCar.color }}
                />
                
                {/* Giant 3D feeling icon */}
                <span className="text-7xl drop-shadow-[0_10px_15px_rgba(0,0,0,0.6)] z-10 select-none animate-bounce" style={{ animationDuration: '3s' }}>
                  🏎️
                </span>

                <div className="mt-8 text-center relative z-10">
                  <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800/30">
                    {activeCar.category}
                  </span>
                  <h3 className="text-xl font-extrabold text-white mt-3">{activeCar.name}</h3>
                  <p className="text-slate-500 text-xs mt-1 italic">
                    Paint: <span className="text-slate-300 font-semibold uppercase">{carCustomizations[selectedCarId]?.paintFinish || 'glossy'}</span> | 
                    Rims: <span className="text-slate-300 font-semibold uppercase">{carCustomizations[selectedCarId]?.rimStyle || 'sports'}</span>
                  </p>
                </div>
              </div>

              {/* Active Specs Breakdown */}
              <div className="flex-1 flex flex-col justify-between h-full gap-4">
                <div>
                  <h4 className="text-xs font-black tracking-wider text-slate-500 uppercase">Selected Vehicle Description</h4>
                  <p className="text-slate-300 text-sm mt-1.5 leading-relaxed">{activeCar.description}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/40 text-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Top Speed</span>
                    <span className="font-mono text-lg font-black text-rose-400 mt-1 block">
                      {((activeCar.speed + activeUpgrades.engine) * 32).toFixed(0)} km/h
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/40 text-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Handling Rating</span>
                    <span className="font-mono text-lg font-black text-emerald-400 mt-1 block">
                      {((activeCar.handling + activeUpgrades.tires) * 10).toFixed(0)} / 150
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/40 text-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Spoiler Setup</span>
                    <span className="font-mono text-xs font-bold text-cyan-400 mt-1.5 block uppercase">
                      {carCustomizations[selectedCarId]?.spoilerStyle || 'lowprofile'}
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/40 text-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Active Decal Wrap</span>
                    <span className="font-mono text-xs font-bold text-amber-400 mt-1.5 block uppercase">
                      {carCustomizations[selectedCarId]?.decalStyle || 'none'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* THREE COLUMN WORKSPACE GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* COLUMN 1: VEHICLE FLEET SELECTOR (SHOWROOM) */}
              <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-md flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-200">The Fleet Showroom</h3>
                  <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-bold text-slate-500">
                    7 CATEGORIES
                  </span>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed -mt-2">
                  Acquire premium hypercars and customize their parameters.
                </p>

                <div className="flex flex-col gap-3.5 max-h-[500px] overflow-y-auto pr-1">
                  {CARS.map((car) => {
                    const isUnlocked = unlockedCarIds.includes(car.id);
                    const isSelected = selectedCarId === car.id;
                    const customColor = carCustomizations[car.id]?.color || car.color;

                    return (
                      <div
                        key={car.id}
                        onClick={() => { if (isUnlocked) setSelectedCarId(car.id); }}
                        className={`group bg-slate-950 border rounded-xl p-4 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-950/10 shadow-sm'
                            : 'border-slate-800/60 hover:border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {/* Colorful thumbnail with exact active color */}
                            <div 
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 border border-slate-800 relative"
                              style={{ backgroundColor: `${customColor}20` }}
                            >
                              🏎️
                              <span 
                                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950" 
                                style={{ backgroundColor: customColor }}
                              />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-200 text-sm group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                                {car.name}
                              </h4>
                              <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">
                                {car.category}
                              </span>
                            </div>
                          </div>
                          
                          {/* Locked indicator / stats short */}
                          {!isUnlocked && (
                            <span className="text-[10px] font-black text-amber-400 uppercase bg-amber-950/50 px-2 py-0.5 rounded border border-amber-900/30">
                              LOCKED
                            </span>
                          )}
                        </div>

                        {/* Buy section for locked cars */}
                        {!isUnlocked && (
                          <div className="mt-3 pt-3 border-t border-slate-900 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Dealership Value:</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); buyCar(car); }}
                              disabled={coins < car.cost}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                coins >= car.cost
                                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                                  : 'bg-slate-900 text-slate-600 border border-slate-800/40 cursor-not-allowed'
                              }`}
                            >
                              Unlock: {car.cost} Coins
                            </button>
                          </div>
                        )}

                        {isUnlocked && isSelected && (
                          <div className="mt-2.5 flex justify-end">
                            <span className="text-[8px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md uppercase">
                              Active Driver
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COLUMN 2: STATS & PERFORMANCE TUNING BAY */}
              <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-md flex flex-col gap-6">
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-200 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-rose-500 animate-pulse" /> Performance Tuning
                  </h3>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    Tweak performance coefficients. Each level adds +15% torque multipliers, capped at Lvl 5.
                  </p>
                </div>

                {/* Upgrades bars */}
                <div className="space-y-5">
                  {/* ENGINE */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-end text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-rose-500" /> Engine Block (Top Speed)
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        LVL {activeUpgrades.engine}/5
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-linear-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${(activeCar.speed + activeUpgrades.engine) * 10}%` }}
                        />
                      </div>
                      {activeUpgrades.engine < 5 && (
                        <button
                          onClick={() => buyUpgrade(selectedCarId, 'engine')}
                          disabled={coins < UPGRADE_COST}
                          className={`px-2.5 py-1 text-[10px] rounded-lg font-bold transition-all ${
                            coins >= UPGRADE_COST
                              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer'
                              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          +{UPGRADE_COST}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* TIRES */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-end text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-emerald-500" /> Performance Tires (Handling)
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        LVL {activeUpgrades.tires}/5
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-linear-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-300"
                          style={{ width: `${(activeCar.handling + activeUpgrades.tires) * 10}%` }}
                        />
                      </div>
                      {activeUpgrades.tires < 5 && (
                        <button
                          onClick={() => buyUpgrade(selectedCarId, 'tires')}
                          disabled={coins < UPGRADE_COST}
                          className={`px-2.5 py-1 text-[10px] rounded-lg font-bold transition-all ${
                            coins >= UPGRADE_COST
                              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer'
                              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          +{UPGRADE_COST}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* BRAKES */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-end text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-orange-500" /> Brembo Brake Rotors
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        LVL {activeUpgrades.brakes}/5
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-linear-to-r from-orange-500 to-yellow-500 rounded-full transition-all duration-300"
                          style={{ width: `${(activeCar.brakes + activeUpgrades.brakes) * 10}%` }}
                        />
                      </div>
                      {activeUpgrades.brakes < 5 && (
                        <button
                          onClick={() => buyUpgrade(selectedCarId, 'brakes')}
                          disabled={coins < UPGRADE_COST}
                          className={`px-2.5 py-1 text-[10px] rounded-lg font-bold transition-all ${
                            coins >= UPGRADE_COST
                              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer'
                              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          +{UPGRADE_COST}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* NITRO */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-end text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-purple-500 animate-pulse" /> Nitro Burners Charge Rate
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        LVL {activeUpgrades.nitro}/5
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-linear-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                          style={{ width: `${(activeCar.nitro + activeUpgrades.nitro) * 10}%` }}
                        />
                      </div>
                      {activeUpgrades.nitro < 5 && (
                        <button
                          onClick={() => buyUpgrade(selectedCarId, 'nitro')}
                          disabled={coins < UPGRADE_COST}
                          className={`px-2.5 py-1 text-[10px] rounded-lg font-bold transition-all ${
                            coins >= UPGRADE_COST
                              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer'
                              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          +{UPGRADE_COST}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mt-2 text-[11px] text-slate-500 leading-relaxed">
                  <span className="text-slate-300 font-bold block mb-1">Active Core Tuning</span>
                  Top Speed capability multiplier: <span className="text-emerald-400 font-bold">x{(1 + activeUpgrades.engine * 0.15).toFixed(2)}</span> | 
                  Nitro recharge multiplier: <span className="text-purple-400 font-bold">x{(1 + activeUpgrades.nitro * 0.2).toFixed(2)}</span>
                </div>
              </div>

              {/* COLUMN 3: STYLING & AESTHETICS STUDIO (THE NEW VISUAL CUSTOMIZATION SUITE) */}
              <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-md flex flex-col gap-6">
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-200 flex items-center gap-2">
                    🎨 Visual Aesthetics Studio
                  </h3>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    Apply high-end body modifications. Paint, rims, wings, and decals are completely free to swap on unlocked cars.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Paint Color Chips */}
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-slate-300 block">Body Paint Color</span>
                    <div className="flex flex-wrap gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800/60">
                      {[
                        { hex: '#18181b', name: 'Matte Black' },
                        { hex: '#94a3b8', name: 'Metallic Silver' },
                        { hex: '#f8fafc', name: 'Pearl White' },
                        { hex: '#ef4444', name: 'Racing Red' },
                        { hex: '#3b82f6', name: 'Electric Blue' },
                        { hex: '#10b981', name: 'Emerald Green' },
                        { hex: '#eab308', name: 'Gold Speed' },
                      ].map((paint) => {
                        const activeColor = carCustomizations[selectedCarId]?.color || activeCar.color;
                        const isActive = activeColor.toLowerCase() === paint.hex.toLowerCase();
                        return (
                          <button
                            key={paint.hex}
                            onClick={() => updateCustomization(selectedCarId, { color: paint.hex })}
                            title={paint.name}
                            className={`w-7 h-7 rounded-full border-2 transition-all relative cursor-pointer active:scale-95 ${
                              isActive ? 'border-emerald-400 scale-110 shadow shadow-emerald-400/50' : 'border-slate-800 hover:border-slate-500'
                            }`}
                            style={{ backgroundColor: paint.hex }}
                          >
                            {isActive && (
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-emerald-400 font-bold">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Paint Finish Selection */}
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-slate-300 block">Paint Coat Finish</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'glossy', label: 'Mirror Glossy' },
                        { key: 'metallic', label: 'Metallic Sheen' },
                        { key: 'matte', label: 'Stealth Matte' },
                        { key: 'pearl', label: 'Pearl Iridescent' },
                      ].map((finish) => {
                        const activeFinish = carCustomizations[selectedCarId]?.paintFinish || 'glossy';
                        const isActive = activeFinish === finish.key;
                        return (
                          <button
                            key={finish.key}
                            onClick={() => updateCustomization(selectedCarId, { paintFinish: finish.key as any })}
                            className={`py-2 px-3 rounded-lg font-bold border transition-all text-left uppercase text-[10px] cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200'
                            }`}
                          >
                            {finish.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rim Styles Selection */}
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-slate-300 block">Performance Rim Design</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'sports', label: 'Sports Alloys' },
                        { key: 'carbon', label: 'Carbon Fiber Spoke' },
                        { key: 'deepdish', label: 'Deep-Dish Slit' },
                        { key: 'goldstar', label: 'Gold Star Forge' },
                      ].map((rim) => {
                        const activeRim = carCustomizations[selectedCarId]?.rimStyle || 'sports';
                        const isActive = activeRim === rim.key;
                        return (
                          <button
                            key={rim.key}
                            onClick={() => updateCustomization(selectedCarId, { rimStyle: rim.key as any })}
                            className={`py-2 px-3 rounded-lg font-bold border transition-all text-left uppercase text-[10px] cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200'
                            }`}
                          >
                            {rim.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Spoiler Wings Selection */}
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-slate-300 block">Aerodynamic Spoiler Wing</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'none', label: 'No Spoiler' },
                        { key: 'lowprofile', label: 'Low lip' },
                        { key: 'aero', label: 'Active Aero Wing' },
                        { key: 'drag', label: 'Carbon Drag Spoiler' },
                      ].map((spoiler) => {
                        const activeSpoiler = carCustomizations[selectedCarId]?.spoilerStyle || 'none';
                        const isActive = activeSpoiler === spoiler.key;
                        return (
                          <button
                            key={spoiler.key}
                            onClick={() => updateCustomization(selectedCarId, { spoilerStyle: spoiler.key as any })}
                            className={`py-2 px-3 rounded-lg font-bold border transition-all text-left uppercase text-[10px] cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200'
                            }`}
                          >
                            {spoiler.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Vinyl Decals Wraps Selection */}
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-slate-300 block">Vinyl Body Wrap Decal</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'none', label: 'Clean (None)' },
                        { key: 'stripes', label: 'Racing Stripes' },
                        { key: 'cyber', label: 'Cyber Hex Grid' },
                        { key: 'flames', label: 'Speed Flames' },
                      ].map((decal) => {
                        const activeDecal = carCustomizations[selectedCarId]?.decalStyle || 'none';
                        const isActive = activeDecal === decal.key;
                        return (
                          <button
                            key={decal.key}
                            onClick={() => updateCustomization(selectedCarId, { decalStyle: decal.key as any })}
                            className={`py-2 px-3 rounded-lg font-bold border transition-all text-left uppercase text-[10px] cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200'
                            }`}
                          >
                            {decal.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </motion.section>
        )}

        {/* VIEW 5: SETTINGS & INPUT TUTORIAL */}
        {activeScreen === 'settings' && (
          <motion.section
            key="settings"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="flex flex-col gap-8 max-w-3xl mx-auto text-slate-200"
            id="settings-panel"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-md">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
                <Settings className="w-6 h-6 text-emerald-400" /> Game Settings
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                Adjust dynamic physics audio, synthesizer volume, or clear personal progress tracking here.
              </p>

              <div className="space-y-6">
                {/* Driver Profile Nickname */}
                <div className="flex flex-col gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                      👤 Driver Profile Name
                    </label>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Customize your name displayed on the speed record leaderboards.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={playerName === 'YOU' ? '' : playerName}
                      maxLength={16}
                      onChange={(e) => updatePlayerName(e.target.value || 'YOU')}
                      placeholder="Enter Driver Name"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 font-bold focus:outline-none focus:border-emerald-500 transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Audio parameters */}
                <div className="flex flex-col gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                      {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />} Engine Procedural Sound Synthesis
                    </label>
                    <input
                      type="checkbox"
                      checked={audioEnabled}
                      onChange={(e) => {
                        setAudioEnabled(e.target.checked);
                        localStorage.setItem('race_audio', e.target.checked.toString());
                      }}
                      className="w-4 h-4 text-emerald-500 bg-slate-900 border-slate-700 rounded-md focus:ring-emerald-500 focus:ring-offset-slate-900"
                    />
                  </div>

                  {audioEnabled && (
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex justify-between text-xs text-slate-400 font-semibold">
                        <span>Volume Level</span>
                        <span>{Math.round(volume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setVolume(v);
                          localStorage.setItem('race_volume', v.toString());
                        }}
                        className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer appearance-none"
                      />
                    </div>
                  )}
                </div>

                {/* PC Key tutorial panel */}
                <div className="p-5 bg-slate-950 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-slate-200 text-sm mb-3 flex items-center gap-2">
                    ⌨️ PC Keyboard Driver Controls
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
                    <div className="flex flex-col gap-2 bg-slate-900/60 p-3 rounded border border-slate-800/40">
                      <div><strong className="text-emerald-400">W</strong> / <strong className="text-emerald-400">S</strong> : Accelerate / Brake or Reverse</div>
                      <div><strong className="text-emerald-400">A</strong> / <strong className="text-emerald-400">D</strong> : Steering maneuvers (Left/Right)</div>
                    </div>
                    <div className="flex flex-col gap-2 bg-slate-900/60 p-3 rounded border border-slate-800/40">
                      <div><strong className="text-cyan-400">Space</strong> : Handbrake Drift slides</div>
                      <div><strong className="text-cyan-400">Left Shift</strong> : Ignite Nitro thrust burners</div>
                      <div><strong className="text-cyan-400">P</strong> / <strong className="text-cyan-400">Esc</strong> : Pause race</div>
                    </div>
                  </div>
                </div>

                {/* Dangerous reset action */}
                <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-red-300 text-sm">Dangerous Area: Progress Deletion</h4>
                    <p className="text-xs text-red-400/80 mt-1">Clears all saved vehicle unlocks, levels, best record times, and coins.</p>
                  </div>
                  <button
                    onClick={resetProgress}
                    className="px-4 py-2 bg-red-900 hover:bg-red-800 text-slate-200 text-xs font-bold rounded-lg transition-all active:scale-95 shrink-0"
                  >
                    Reset Progress
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* VIEW 7: PROFILE & FRIENDS PANEL */}
        {activeScreen === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="flex-1 flex flex-col min-h-[500px]"
          >
            <ProfileFriendsSection
              coins={coins}
              unlockedCarIds={unlockedCarIds}
              carUpgrades={carUpgrades}
              carCustomizations={carCustomizations}
              bestTimes={bestTimes}
              difficulty={difficulty}
              audioEnabled={audioEnabled}
              volume={volume}
              onLoadProgression={(prog) => {
                if (prog.coins !== undefined) setCoins(prog.coins);
                if (prog.unlockedCarIds !== undefined) setUnlockedCarIds(prog.unlockedCarIds);
                if (prog.carUpgrades !== undefined) setCarUpgrades(prog.carUpgrades);
                if (prog.carCustomizations !== undefined) setCarCustomizations(prog.carCustomizations);
                if (prog.bestTimes !== undefined) setBestTimes(prog.bestTimes);
                if (prog.playerName !== undefined) {
                  setPlayerNameState(prog.playerName);
                  localStorage.setItem('race_player_name', prog.playerName);
                }
                if (prog.difficulty !== undefined) setDifficulty(prog.difficulty);
                if (prog.audioEnabled !== undefined) setAudioEnabled(prog.audioEnabled);
                if (prog.volume !== undefined) setVolume(prog.volume);
              }}
              onSelectTrackAndStart={(trackId) => {
                setSelectedTrackId(trackId);
                setActiveScreen('race');
              }}
            />
          </motion.div>
        )}

        {/* VIEW 6: UNITY SCRIPT EXPORTER CODE CENTER */}
        {activeScreen === 'unity-export' && (
          <motion.div
            key="unity-export"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="flex-1 flex flex-col min-h-[600px]"
          >
            <UnityExporter />
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* Footer bar */}
      {activeScreen !== 'race' && (
        <footer className="border-t border-slate-900/80 bg-slate-950/40 py-6 text-center text-xs text-slate-600 mt-auto select-none">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <p>© 2026 Apex Overload Racing. All rights reserved.</p>
            <p className="font-semibold text-slate-500">
              Coded beautifully inside AI Studio with React, Three.js, and procedural sound generation.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
