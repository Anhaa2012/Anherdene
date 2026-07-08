import React, { useEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  shape: 'circle' | 'square' | 'star';
  rotation: number;
  rotationSpeed: number;
  alpha: number;
  decay: number;
  gravity: number;
  drag: number;
}

interface ParticleExplosionProps {
  trigger: number; // Increment this value to trigger a new explosion
  accentColor?: string; // Optional custom color focus
}

export default function ParticleExplosion({ trigger, accentColor }: ParticleExplosionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const colors = [
    '#f59e0b', // Gold / Amber
    '#10b981', // Emerald
    '#06b6d4', // Cyan / Neon Blue
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#ef4444', // Crimson
    '#3b82f6', // Bright Blue
  ];

  // Helper to generate a particle
  const createParticle = (x: number, y: number, focusColor?: string): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 12; // Explosive velocity
    const color = focusColor && Math.random() > 0.4 ? focusColor : colors[Math.floor(Math.random() * colors.length)];
    const shapes: ('circle' | 'square' | 'star')[] = ['circle', 'square', 'star'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];

    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (2 + Math.random() * 4), // extra upward boost
      color,
      radius: 3 + Math.random() * 5,
      shape,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      alpha: 1.0,
      decay: 0.01 + Math.random() * 0.015,
      gravity: 0.22,
      drag: 0.97, // Air resistance
    };
  };

  useEffect(() => {
    if (trigger === 0) return;

    // Trigger explosion
    setIsActive(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Resize canvas to cover viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const centerX = canvas.width / 2;
    const centerY = canvas.height * 0.45; // slightly above center for cinematic focus

    // Spawn 140 particles for an opulent explosion
    const count = 140;
    const tempParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      tempParticles.push(createParticle(centerX, centerY, accentColor));
    }

    // Add extra high-energy sparks
    for (let i = 0; i < 40; i++) {
      const spark = createParticle(centerX, centerY, '#ffffff');
      spark.radius = 1.5 + Math.random() * 2;
      spark.vy *= 1.3;
      spark.vx *= 1.3;
      tempParticles.push(spark);
    }

    particlesRef.current = tempParticles;

    // Draw/Animate Loop
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear with slight trailing fade
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = false;
      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.alpha <= 0) continue;

        alive = true;

        // Apply physics
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.alpha -= p.decay;

        if (p.alpha > 0) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;

          // Drawing shapes
          if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
            ctx.fill();
          } else if (p.shape === 'square') {
            ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
          } else if (p.shape === 'star') {
            // Draw simple 5-point star
            ctx.beginPath();
            const spikes = 5;
            const outerRadius = p.radius;
            const innerRadius = p.radius / 2;
            let rot = (Math.PI / 2) * 3;
            let cx = 0;
            let cy = 0;
            const step = Math.PI / spikes;

            ctx.moveTo(0, -outerRadius);
            for (let s = 0; s < spikes; s++) {
              cx = Math.cos(rot) * outerRadius;
              cy = Math.sin(rot) * outerRadius;
              ctx.lineTo(cx, cy);
              rot += step;

              cx = Math.cos(rot) * innerRadius;
              cy = Math.sin(rot) * innerRadius;
              ctx.lineTo(cx, cy);
              rot += step;
            }
            ctx.lineTo(0, -outerRadius);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      }

      if (alive) {
        animationFrameRef.current = requestAnimationFrame(render);
      } else {
        setIsActive(false);
      }
    };

    render();

    // Resize listener to adapt canvas size
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [trigger, accentColor]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100] w-full h-full"
      style={{ mixBlendMode: 'screen' }}
      id="buy-car-explosion-canvas"
    />
  );
}
