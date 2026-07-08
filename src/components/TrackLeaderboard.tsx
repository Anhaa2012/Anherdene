import React, { useState, useEffect } from 'react';
import { Trophy, Clock, Award, Star, User } from 'lucide-react';

interface LeaderboardEntry {
  trackId: string;
  carName: string;
  playerName: string;
  time: number; // in seconds
  date: string;
  isPlayer?: boolean;
}

interface TrackLeaderboardProps {
  selectedTrackId: string;
  bestTimes: Record<string, number>; // Personal best total or lap times
  tracks: { id: string; name: string; color: string; difficulty: string }[];
  triggerUpdate?: number; // Increment to force reload
}

export const formatLapTime = (timeInSeconds: number): string => {
  if (!timeInSeconds || isNaN(timeInSeconds) || timeInSeconds <= 0) return '--:--.--';
  const mins = Math.floor(timeInSeconds / 60);
  const secs = Math.floor(timeInSeconds % 60);
  const ms = Math.floor((timeInSeconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

const FICTIONAL_AI_RECORDS: Record<string, Omit<LeaderboardEntry, 'trackId'>[]> = {
  track_city: [
    { playerName: 'Apex Phantom', carName: 'Zenith F1', time: 20.15, date: 'AI Champion Record' },
    { playerName: 'Neon Samurai', carName: 'Kansai Drift', time: 21.80, date: 'AI Veteran Record' },
    { playerName: 'Grid Razer', carName: 'Volt EV', time: 23.10, date: 'AI Pro Record' },
    { playerName: 'Street Hawk', carName: 'Specter GT', time: 24.90, date: 'AI Club Record' },
    { playerName: 'Slow Turbo', carName: 'Rebel V8', time: 26.50, date: 'AI Novice Record' },
  ],
  track_desert: [
    { playerName: 'Sandstorm', carName: 'Zenith F1', time: 26.30, date: 'AI Champion Record' },
    { playerName: 'Dune Raider', carName: 'Kansai Drift', time: 28.80, date: 'AI Veteran Record' },
    { playerName: 'Canyon Carver', carName: 'Rebel V8', time: 31.40, date: 'AI Pro Record' },
    { playerName: 'Dust Kicker', carName: 'Specter GT', time: 33.70, date: 'AI Club Record' },
    { playerName: 'Oasis Mirage', carName: 'Vortex R', time: 36.10, date: 'AI Novice Record' },
  ],
  track_mountain: [
    { playerName: 'Avalanche', carName: 'Zenith F1', time: 29.50, date: 'AI Champion Record' },
    { playerName: 'Ice Slider', carName: 'Kansai Drift', time: 32.20, date: 'AI Veteran Record' },
    { playerName: 'Peak Performer', carName: 'Volt EV', time: 35.60, date: 'AI Pro Record' },
    { playerName: 'Snow Plow', carName: 'Rebel V8', time: 38.40, date: 'AI Club Record' },
    { playerName: 'Frostbite', carName: 'Vortex R', time: 41.30, date: 'AI Novice Record' },
  ],
  track_volcano: [
    { playerName: 'Magma Lord', carName: 'Zenith F1', time: 27.20, date: 'AI Champion Record' },
    { playerName: 'Asphalt Burner', carName: 'Kansai Drift', time: 29.90, date: 'AI Veteran Record' },
    { playerName: 'Pyromaniac', carName: 'Rebel V8', time: 32.80, date: 'AI Pro Record' },
    { playerName: 'Lava Glider', carName: 'Volt EV', time: 35.50, date: 'AI Club Record' },
    { playerName: 'Ash Drifter', carName: 'Specter GT', time: 39.10, date: 'AI Novice Record' },
  ],
  track_cosmic: [
    { playerName: 'Nebula', carName: 'Zenith F1', time: 33.10, date: 'AI Champion Record' },
    { playerName: 'Star Voyager', carName: 'Volt EV', time: 36.40, date: 'AI Veteran Record' },
    { playerName: 'Orbit Ranger', carName: 'Vortex R', time: 39.90, date: 'AI Pro Record' },
    { playerName: 'Solar Wind', carName: 'Specter GT', time: 43.50, date: 'AI Club Record' },
    { playerName: 'Meteor', carName: 'Rebel V8', time: 47.20, date: 'AI Novice Record' },
  ],
};

export default function TrackLeaderboard({
  selectedTrackId,
  bestTimes,
  tracks,
  triggerUpdate = 0,
}: TrackLeaderboardProps) {
  const [activeTrackTab, setActiveTrackTab] = useState<string>(selectedTrackId);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerRankInfo, setPlayerRankInfo] = useState<{ rank: number; total: number } | null>(null);

  // Sync active track tab when selected track in the main menu changes
  useEffect(() => {
    setActiveTrackTab(selectedTrackId);
  }, [selectedTrackId]);

  useEffect(() => {
    // 1. Get predefined fictional AI times for active track
    const aiEntries: LeaderboardEntry[] = (FICTIONAL_AI_RECORDS[activeTrackTab] || []).map((entry) => ({
      ...entry,
      trackId: activeTrackTab,
      isPlayer: false,
    }));

    // 2. Load custom player records for active track from localStorage
    let playerEntries: LeaderboardEntry[] = [];
    try {
      const stored = localStorage.getItem(`race_leaderboard_v1_${activeTrackTab}`);
      if (stored) {
        playerEntries = JSON.parse(stored).map((entry: any) => ({
          ...entry,
          isPlayer: true,
        }));
      } else {
        // Fallback or migration from legacy bestTimes if present
        const legacyTime = bestTimes[activeTrackTab];
        if (legacyTime && legacyTime > 0) {
          // If bestTimes is actually total race time (3 laps), we store an estimated lap time as bestTimes
          // But to be safe, if it's over 40-50s for track_city, let's treat it as total and divide by 3
          const estLapTime = activeTrackTab === 'track_city' && legacyTime > 40
            ? legacyTime / 3
            : activeTrackTab === 'track_desert' && legacyTime > 55
            ? legacyTime / 3
            : activeTrackTab === 'track_mountain' && legacyTime > 65
            ? legacyTime / 3
            : activeTrackTab === 'track_volcano' && legacyTime > 60
            ? legacyTime / 3
            : activeTrackTab === 'track_cosmic' && legacyTime > 75
            ? legacyTime / 3
            : legacyTime;

          const storedPlayerName = localStorage.getItem('race_player_name') || 'YOU';
          playerEntries = [
            {
              trackId: activeTrackTab,
              carName: 'Specter GT',
              playerName: storedPlayerName,
              time: estLapTime,
              date: new Date().toLocaleDateString(),
              isPlayer: true,
            },
          ];
        }
      }
    } catch (e) {
      console.error('Error loading leaderboard entries', e);
    }

    // 3. Combine both and sort by fastest time (ascending)
    const combined = [...aiEntries, ...playerEntries];
    combined.sort((a, b) => a.time - b.time);

    // 4. Find the player's actual rank among all records
    const playerIndex = combined.findIndex((item) => item.isPlayer);
    if (playerIndex !== -1) {
      setPlayerRankInfo({
        rank: playerIndex + 1,
        total: combined.length,
      });
    } else {
      setPlayerRankInfo(null);
    }

    // 5. Keep only the top 5 fastest lap times for the display board
    const top5 = combined.slice(0, 5);
    setLeaderboard(top5);
  }, [activeTrackTab, bestTimes, triggerUpdate]);

  const activeTrackObj = tracks.find((t) => t.id === activeTrackTab) || tracks[0];

  return (
    <div
      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4"
      id="leaderboard-container-panel"
    >
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-100 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500 animate-pulse" /> Speed Records Leaderboard
        </h3>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
          Fastest Laps
        </span>
      </div>

      {/* Mini Track Selector Tabs */}
      <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/60">
        {tracks.map((track) => {
          const isActive = activeTrackTab === track.id;
          return (
            <button
              key={track.id}
              onClick={() => setActiveTrackTab(track.id)}
              className={`flex-1 text-center py-2 px-1 rounded-lg text-[10px] font-extrabold uppercase transition-all tracking-wider ${
                isActive
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              style={isActive ? { borderBottom: `2px solid ${track.color}` } : {}}
            >
              {track.name.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* Leaderboard Table Grid */}
      <div className="space-y-2">
        <div className="grid grid-cols-12 text-[10px] text-slate-500 font-bold uppercase tracking-wider px-3 pb-1">
          <div className="col-span-2">Rank</div>
          <div className="col-span-4">Driver</div>
          <div className="col-span-3">Vehicle</div>
          <div className="col-span-3 text-right">Lap Time</div>
        </div>

        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
          {leaderboard.map((entry, index) => {
            const rank = index + 1;
            const isPlayerRow = entry.isPlayer;

            // Rank visual styles
            let rankBadge = `${rank}`;
            let rankColorClass = 'text-slate-400 bg-slate-950';
            if (rank === 1) {
              rankBadge = '🥇';
              rankColorClass = 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
            } else if (rank === 2) {
              rankBadge = '🥈';
              rankColorClass = 'text-slate-300 bg-slate-300/10 border border-slate-300/20';
            } else if (rank === 3) {
              rankBadge = '🥉';
              rankColorClass = 'text-amber-600 bg-amber-600/10 border border-amber-600/20';
            }

            return (
              <div
                key={`${entry.playerName}-${index}`}
                className={`grid grid-cols-12 items-center text-xs px-3 py-2.5 rounded-xl transition-all border ${
                  isPlayerRow
                    ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[inset_0_0_8px_rgba(16,185,129,0.15)]'
                    : 'bg-slate-950/40 border-slate-800/40 hover:bg-slate-950/70 hover:border-slate-800'
                }`}
              >
                {/* Rank Badge */}
                <div className="col-span-2">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold font-mono text-[11px] ${rankColorClass}`}
                  >
                    {rankBadge}
                  </span>
                </div>

                {/* Driver Profile */}
                <div className="col-span-4 flex items-center gap-1.5 font-semibold truncate text-slate-200">
                  {isPlayerRow && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  )}
                  <span className={isPlayerRow ? 'text-emerald-400 font-bold' : ''}>
                    {entry.playerName}
                  </span>
                </div>

                {/* Car ID/Name */}
                <div className="col-span-3 text-[11px] text-slate-400 font-medium truncate">
                  {entry.carName}
                </div>

                {/* Fastest Record Lap Time */}
                <div className="col-span-3 text-right font-mono font-bold text-slate-100">
                  <span className={isPlayerRow ? 'text-emerald-400 font-black' : ''}>
                    {formatLapTime(entry.time)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver Position Context Info */}
      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/60 mt-1">
        {playerRankInfo ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">
              #{playerRankInfo.rank}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-emerald-400/80 font-bold tracking-widest uppercase block leading-none">
                Your Standing Rank
              </span>
              <p className="text-xs text-slate-300 mt-1 truncate">
                You are ranked <strong className="text-emerald-400 font-extrabold">#{playerRankInfo.rank}</strong> of{' '}
                {playerRankInfo.total} drivers on {activeTrackObj?.name}!
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center text-sm font-black shrink-0">
              --
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase block leading-none">
                No Record Yet
              </span>
              <p className="text-xs text-slate-400 mt-1">
                Race on <strong className="text-slate-300 font-bold">{activeTrackObj?.name}</strong> to register your lap time!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
