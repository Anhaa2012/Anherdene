export interface Track {
  id: string;
  name: string;
  description: string;
  color: string;
  length: number; // in meters
  difficulty: 'Easy' | 'Medium' | 'Hard';
  baseReward: number;
  skyColor: string;
  groundColor: string;
}

export interface Car {
  id: string;
  name: string;
  category: string;   // e.g., 'Exotic Hypercar', 'Japanese Tuner'
  speed: number;      // 1-10 base rating
  handling: number;   // 1-10 base rating
  brakes: number;     // 1-10 base rating
  nitro: number;      // 1-10 base rating
  color: string;
  cost: number;
  unlocked: boolean;
  description: string;
  // Customization choices
  paintFinish?: 'glossy' | 'metallic' | 'matte' | 'pearl';
  rimStyle?: 'sports' | 'carbon' | 'deepdish' | 'goldstar';
  spoilerStyle?: 'lowprofile' | 'aero' | 'drag' | 'none';
  decalStyle?: 'stripes' | 'cyber' | 'flames' | 'none';
}

export interface CarUpgrades {
  engine: number;   // level 1 to 5
  tires: number;    // level 1 to 5
  brakes: number;   // level 1 to 5
  nitro: number;    // level 1 to 5
}

export interface UpgradeCost {
  engine: number[];
  tires: number[];
  brakes: number[];
  nitro: number[];
}

export interface LeaderboardEntry {
  trackId: string;
  carId: string;
  playerName: string;
  time: number; // in seconds
  date: string;
}

export interface RaceParticipant {
  id: string; // 'player' or 'ai-1', 'ai-2', etc.
  name: string;
  carId: string;
  color: string;
  isPlayer: boolean;
  lap: number;
  currentCheckpoint: number;
  distanceToNextCheckpoint: number;
  totalDistance: number; // accumulated distance traveled
  finished: boolean;
  finishTime?: number;
  speed: number; // current speed km/h
}
