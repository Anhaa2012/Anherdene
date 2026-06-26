import React, { useState } from 'react';
import { Copy, Check, FileCode, Folder, Play, Lightbulb, Layers, Settings, ChevronRight, Info, BookOpen } from 'lucide-react';
import { unityScripts, UnityScript } from '../unityScripts';

export default function UnityExporter() {
  const [activeTab, setActiveTab] = useState<'scripts' | 'hierarchy' | 'guide'>('scripts');
  const [selectedScript, setSelectedScript] = useState<UnityScript>(unityScripts[0]);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const handleCopy = (code: string, name: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(name);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex flex-col h-full text-slate-100 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl" id="unity-exporter-panel">
      {/* Exporter Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-950 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
            <Layers className="w-6 h-6" /> Unity C# Code Hub
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Production-ready scripts, scene architectures, and asset recommendations to build this game in Unity.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-sm font-medium self-start md:self-auto">
          <button
            onClick={() => setActiveTab('scripts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'scripts'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileCode className="w-4 h-4" /> C# Scripts
          </button>
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'hierarchy'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" /> Scene Hierarchy
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'guide'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Setup Guide
          </button>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-hidden min-h-[500px]">
        {activeTab === 'scripts' && (
          <div className="flex flex-col lg:flex-row h-full">
            {/* Left sidebar: script selector */}
            <div className="w-full lg:w-80 bg-slate-950 border-r border-slate-800 p-4 flex flex-col gap-2 overflow-y-auto max-h-[300px] lg:max-h-none">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2 flex items-center gap-2">
                <Folder className="w-3.5 h-3.5" /> Project Scripts (C#)
              </div>
              {unityScripts.map((script) => (
                <button
                  key={script.name}
                  onClick={() => setSelectedScript(script)}
                  className={`flex items-start gap-3 p-3 rounded-xl text-left transition-all group ${
                    selectedScript.name === script.name
                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                  }`}
                >
                  <FileCode className={`w-5 h-5 mt-0.5 shrink-0 ${
                    selectedScript.name === script.name ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'
                  }`} />
                  <div>
                    <div className="font-semibold text-sm">{script.name}</div>
                    <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{script.description}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Right container: code viewport */}
            <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden h-full">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-6 py-3 bg-slate-950 border-b border-slate-800 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="font-mono text-emerald-400 font-semibold">{selectedScript.name}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-xs text-slate-400">{selectedScript.description}</span>
                </div>
                <button
                  onClick={() => handleCopy(selectedScript.code, selectedScript.name)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all font-semibold active:scale-95"
                >
                  {copiedIndex === selectedScript.name ? (
                    <>
                      <Check className="w-4 h-4" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> Copy Code
                    </>
                  )}
                </button>
              </div>

              {/* Code Panel */}
              <div className="flex-1 p-6 overflow-y-auto font-mono text-xs leading-relaxed text-slate-300 bg-slate-950 select-text">
                <pre className="whitespace-pre">{selectedScript.code}</pre>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hierarchy' && (
          <div className="p-8 overflow-y-auto h-full max-h-[600px] lg:max-h-none space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Scene Hierarchy Tree Layout */}
              <div className="xl:col-span-2 bg-slate-950 p-6 rounded-xl border border-slate-800">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
                  <Layers className="w-5 h-5 text-emerald-400" /> Unity Scene Node Hierarchy
                </h3>
                <p className="text-slate-400 text-sm mb-6">
                  Recreate this exact structure in your Unity Hierarchy window to bind the game systems successfully.
                </p>

                <div className="font-mono text-sm text-slate-300 space-y-1.5 bg-slate-900/50 p-6 rounded-lg border border-slate-800/80 max-h-[400px] overflow-y-auto">
                  <div className="text-slate-500">▼ <span className="text-sky-400 font-semibold">[Scene_Root]</span> (e.g. CityRaceTrack)</div>
                  <div className="pl-6 text-slate-500">▼ <span className="text-yellow-400">Environment</span> (Static Mesh Track, Skybox, Lighting)</div>
                  <div className="pl-12 text-slate-400">├─ CityRoadMesh <span className="text-xs text-slate-500">(Tag: "Track", Mesh Collider)</span></div>
                  <div className="pl-12 text-slate-400">├─ Skyscrapers & Props <span className="text-xs text-slate-500">(Static obstacles, Colliders)</span></div>
                  <div className="pl-12 text-slate-400">└─ Directional Light <span className="text-xs text-slate-500">(Realtime, shadow casting)</span></div>
                  
                  <div className="pl-6 mt-2 text-slate-500">▼ <span className="text-orange-400">RaceManager</span> <span className="text-xs text-emerald-400">(Attach RaceManager.cs)</span></div>
                  <div className="pl-12 text-slate-500">▼ <span className="text-teal-400">Checkpoints</span> (Parent folder of race route landmarks)</div>
                  <div className="pl-18 text-slate-400">├─ Checkpoint_0 (Start/Finish) <span className="text-xs text-slate-500">(BoxCollider: trigger)</span></div>
                  <div className="pl-18 text-slate-400">├─ Checkpoint_1 <span className="text-xs text-slate-500">(BoxCollider: trigger)</span></div>
                  <div className="pl-18 text-slate-400">└─ Checkpoint_2 <span className="text-xs text-slate-500">(BoxCollider: trigger)</span></div>

                  <div className="pl-6 mt-2 text-slate-500">▼ <span className="text-pink-400">WaypointPath</span> (AI Track Routes)</div>
                  <div className="pl-12 text-slate-400">├─ Waypoint (1) <span className="text-xs text-slate-500">(Empty transform position marker)</span></div>
                  <div className="pl-12 text-slate-400">├─ Waypoint (2)</div>
                  <div className="pl-12 text-slate-400">└─ Waypoint (3) ... <span className="text-xs text-slate-500">(Loops back to Waypoint (1))</span></div>

                  <div className="pl-6 mt-2 text-slate-500">▼ <span className="text-emerald-400 font-semibold">Player_Car</span> <span className="text-xs text-slate-400">(Attach Rigidbody, CarController.cs, AudioSource)</span></div>
                  <div className="pl-12 text-slate-400">├─ Body_Mesh <span className="text-xs text-slate-500">(3D Graphics Model)</span></div>
                  <div className="pl-12 text-slate-500">▼ Colliders <span className="text-xs text-slate-500">(Container)</span></div>
                  <div className="pl-18 text-slate-400">├─ Front_Left_WheelCollider <span className="text-xs text-slate-500">(Wheel Collider)</span></div>
                  <div className="pl-18 text-slate-400">├─ Front_Right_WheelCollider <span className="text-xs text-slate-500">(Wheel Collider)</span></div>
                  <div className="pl-18 text-slate-400">├─ Rear_Left_WheelCollider <span className="text-xs text-slate-500">(Wheel Collider)</span></div>
                  <div className="pl-18 text-slate-400">└─ Rear_Right_WheelCollider <span className="text-xs text-slate-500">(Wheel Collider)</span></div>
                  <div className="pl-12 text-slate-500">▼ Wheel_Visuals <span className="text-xs text-slate-500">(Transforms synced by script)</span></div>
                  <div className="pl-18 text-slate-400">├─ FL_Wheel_Mesh</div>
                  <div className="pl-18 text-slate-400">├─ FR_Wheel_Mesh</div>
                  <div className="pl-18 text-slate-400">├─ RL_Wheel_Mesh</div>
                  <div className="pl-18 text-slate-400">└─ RR_Wheel_Mesh</div>

                  <div className="pl-6 mt-2 text-slate-500">▼ <span className="text-cyan-400 font-semibold">AI_Cars</span> (Container for AI opponents)</div>
                  <div className="pl-12 text-slate-500">▼ Opponent_1 <span className="text-xs text-slate-400">(Attach Rigidbody, AIController.cs, Mesh Colliders)</span></div>
                  <div className="pl-18 text-slate-400">├─ Body_Mesh / Wheel_Visuals</div>
                  <div className="pl-18 text-slate-400">└─ Wheel_Colliders</div>

                  <div className="pl-6 mt-2 text-slate-500">▼ <span className="text-purple-400 font-semibold">UI_Canvas</span> <span className="text-xs text-slate-400">(Attach UIManager.cs, Screen adapters)</span></div>
                  <div className="pl-12 text-slate-400">├─ HUD_Panel <span className="text-xs text-slate-500">(Speedometer, Lap, Timer, Nitro Image)</span></div>
                  <div className="pl-12 text-slate-400">├─ Countdown_Label <span className="text-xs text-slate-500">(Big text)</span></div>
                  <div className="pl-12 text-slate-400">├─ Pause_Menu_Panel <span className="text-xs text-slate-500">(Buttons: Resume, Restart, Menu)</span></div>
                  <div className="pl-12 text-slate-400">└─ Race_Over_Panel <span className="text-xs text-slate-500">(Final stats and coins rewards)</span></div>

                  <div className="pl-6 mt-2 text-slate-500">▼ <span className="text-indigo-400">Main_Camera</span> <span className="text-xs text-emerald-400">(Attach CameraController.cs, AudioListener)</span></div>
                </div>
              </div>

              {/* Tagging and Settings Metadata */}
              <div className="flex flex-col gap-6">
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-slate-100 flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-emerald-400" /> Required Tags
                  </h4>
                  <ul className="space-y-2 text-sm text-slate-400">
                    <li className="bg-slate-900/60 p-2.5 rounded border border-slate-800/60">
                      <strong className="text-emerald-400 font-mono">Player</strong>: Assign to <code className="text-emerald-300">Player_Car</code> root object so cameras and triggers can recognize it.
                    </li>
                    <li className="bg-slate-900/60 p-2.5 rounded border border-slate-800/60">
                      <strong className="text-orange-400 font-mono">Track</strong>: Assign to track colliders to tell AI cars they are driving on drivable routes.
                    </li>
                    <li className="bg-slate-900/60 p-2.5 rounded border border-slate-800/60">
                      <strong className="text-pink-400 font-mono">Checkpoint</strong>: Assign to Checkpoint Colliders to manage lap completions securely.
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-slate-100 flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-emerald-400" /> Rigidbody Physics
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    To prevent the cars from flipping on corners, configure the vehicle's Rigidbody in the Inspector with:
                  </p>
                  <ul className="space-y-1.5 text-xs text-slate-300 font-mono">
                    <li>• Mass: <span className="text-emerald-400">1500</span></li>
                    <li>• Drag: <span className="text-emerald-400">0.05</span></li>
                    <li>• Angular Drag: <span className="text-emerald-400">0.5</span></li>
                    <li>• Use Gravity: <span className="text-emerald-400">True</span></li>
                    <li>• Interpolation: <span className="text-emerald-400">Interpolate</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="p-8 overflow-y-auto h-full max-h-[600px] lg:max-h-none space-y-6 max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
              <Play className="w-5 h-5" /> Unity Project Implementation Guide
            </h3>
            <p className="text-slate-400 text-sm">
              Follow these simple steps to integrate our C# scripts into your own Unity project and get driving immediately.
            </p>

            <div className="space-y-4">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/20">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">Create a New Unity Project</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Open Unity Hub and create a new project using the <strong>3D (URP)</strong> template (Universal Render Pipeline). This ensures high-quality lighting, bloom, and reflections out of the box.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/20">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">Import/Create Assets</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Download free car assets and track models from the <strong>Unity Asset Store</strong>, or construct your racing tracks inside Unity using free packages like <strong>ProBuilder</strong>.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/20">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">Establish the Wheel Colliders</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Under your vehicle GameObject, add four WheelColliders positioned exactly where the wheels are. Create four matching 3D visual Wheel Meshes. Group and map them into the <code className="text-emerald-300">CarController.cs</code> fields in the Inspector.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/20">
                  4
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">Set Up Waypoints & Checkpoints</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Create a series of empty transforms along the race course in an ordered loop. Link them as the <code className="text-emerald-300">pathContainer</code> for your AI cars. Place Trigger BoxColliders at major points on the track and assign them to the <code className="text-emerald-300">checkpoints</code> list in the <code className="text-emerald-300">RaceManager.cs</code> inspector.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/20">
                  5
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">Bind UI and SFX Outputs</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Configure a Canvas with TextMeshPro fields for Speed, Laps, Position, and Timer. Link these elements to the <code className="text-emerald-300">UIManager.cs</code> references. Create AudioSources on your Camera or Player Car and link them to <code className="text-emerald-300">AudioManager.cs</code> to unlock active pitch-shifted engine sounds and drifting shrieks.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-800/40 p-5 rounded-xl flex gap-3 mt-4">
              <Lightbulb className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-emerald-300 text-sm">Pro Tip: Wheel Friction Tuning</h5>
                <p className="text-xs text-emerald-400/80 leading-relaxed mt-1">
                  If the car drifts too slide-heavy or flips over easily, modify the <strong>Forward/Sideways Friction</strong> curves of your Wheel Colliders in Unity. Setting the sideways stiffness to <code className="bg-emerald-950 px-1 py-0.5 rounded text-emerald-300">1.2 - 1.5</code> provides excellent responsive grip, while decreasing it to <code className="bg-emerald-950 px-1 py-0.5 rounded text-emerald-300">0.7 - 0.9</code> unlocks satisfying drift slinging!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
