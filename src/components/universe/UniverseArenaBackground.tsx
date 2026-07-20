import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  phase: number;
  tint: "white" | "blue" | "violet";
};

type Dust = {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  alpha: number;
};

type ShootingStar = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  life: number;
  maxLife: number;
};

type Crater = {
  x: number;
  y: number;
  radius: number;
  depth: number;
};

function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export default function UniverseArenaBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const random = seededRandom(20260718);
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 1;
    let height = 1;
    let devicePixelRatio = 1;
    let animationFrame = 0;
    let isRunning = true;
    let nextShootingStarAt = 0;

    let stars: Star[] = [];
    let dust: Dust[] = [];
    let craters: Crater[] = [];
    const shootingStars: ShootingStar[] = [];

    function resizeCanvas() {
      const bounds = wrapper.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * devicePixelRatio);
      canvas.height = Math.floor(height * devicePixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

      buildScene();
    }

    function buildScene() {
      const area = width * height;
      const starCount = Math.min(1500, Math.max(600, Math.floor(area / 1500)));
      const dustCount = Math.min(180, Math.max(70, Math.floor(area / 12000)));

      stars = Array.from({ length: starCount }, () => {
        const tintRoll = random();
        return {
          x: random() * width,
          y: random() * height,
          radius: 0.25 + random() * 1.45,
          alpha: 0.22 + random() * 0.68,
          speed: 0.35 + random() * 1.5,
          phase: random() * Math.PI * 2,
          tint:
            tintRoll < 0.78
              ? "white"
              : tintRoll < 0.91
                ? "blue"
                : "violet",
        };
      });

      dust = Array.from({ length: dustCount }, () => ({
        x: random() * width,
        y: random() * height,
        radius: 0.35 + random() * 1.1,
        vx: (random() - 0.5) * 0.025,
        vy: -0.008 - random() * 0.018,
        alpha: 0.06 + random() * 0.18,
      }));

      craters = Array.from({ length: 46 }, () => {
        const angle = random() * Math.PI * 2;
        const distance = Math.sqrt(random()) * 0.82;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          radius: 0.018 + random() * 0.065,
          depth: 0.22 + random() * 0.48,
        };
      });
    }

    function drawBaseSpace() {
      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#070b20");
      gradient.addColorStop(0.48, "#10153a");
      gradient.addColorStop(1, "#082354");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }

    function drawNebula(time: number) {
      const layers = [
        {
          x: 0.16,
          y: 0.22,
          radius: 0.42,
          rgb: "99, 74, 210",
          alpha: 0.14,
          drift: 0.000025,
        },
        {
          x: 0.76,
          y: 0.26,
          radius: 0.36,
          rgb: "36, 139, 225",
          alpha: 0.12,
          drift: 0.000021,
        },
        {
          x: 0.52,
          y: 0.7,
          radius: 0.5,
          rgb: "32, 99, 190",
          alpha: 0.1,
          drift: 0.000018,
        },
      ];

      context.save();
      context.globalCompositeOperation = "screen";

      layers.forEach((layer, index) => {
        const x =
          layer.x * width + Math.sin(time * layer.drift + index) * width * 0.025;
        const y =
          layer.y * height +
          Math.cos(time * layer.drift * 0.8 + index) * height * 0.02;
        const radius = Math.max(width, height) * layer.radius;
        const pulse = 0.82 + Math.sin(time * 0.00008 + index) * 0.18;
        const nebula = context.createRadialGradient(x, y, 0, x, y, radius);

        nebula.addColorStop(
          0,
          `rgba(${layer.rgb}, ${layer.alpha * pulse})`,
        );
        nebula.addColorStop(
          0.5,
          `rgba(${layer.rgb}, ${layer.alpha * pulse * 0.34})`,
        );
        nebula.addColorStop(1, `rgba(${layer.rgb}, 0)`);

        context.fillStyle = nebula;
        context.fillRect(0, 0, width, height);
      });

      context.restore();
    }

    function drawStars(time: number) {
      context.save();

      for (const star of stars) {
        const twinkle =
          0.65 + Math.sin(time * 0.001 * star.speed + star.phase) * 0.35;
        context.globalAlpha = Math.max(0.08, star.alpha * twinkle);
        context.fillStyle =
          star.tint === "blue"
            ? "#b8dcff"
            : star.tint === "violet"
              ? "#dfc9ff"
              : "#ffffff";

        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fill();
      }

      context.restore();
    }

    function drawDust() {
      context.save();
      context.globalCompositeOperation = "screen";

      for (const particle of dust) {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -4) particle.x = width + 4;
        if (particle.x > width + 4) particle.x = -4;
        if (particle.y < -4) particle.y = height + 4;

        context.globalAlpha = particle.alpha;
        context.fillStyle = "#cfe9ff";
        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.radius,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      context.restore();
    }

    function drawMoon(time: number) {
      const responsiveRadius = Math.min(width, height) * 0.065;
      const radius = Math.max(34, Math.min(74, responsiveRadius));
      const centerX = width - radius - Math.max(28, width * 0.022);
      const centerY = Math.max(radius + 28, height * 0.15);
      const rotation = time * 0.000006;

      context.save();

      const outerGlow = context.createRadialGradient(
        centerX,
        centerY,
        radius * 0.7,
        centerX,
        centerY,
        radius * 1.65,
      );
      outerGlow.addColorStop(0, "rgba(196, 216, 255, 0.2)");
      outerGlow.addColorStop(0.52, "rgba(106, 145, 220, 0.08)");
      outerGlow.addColorStop(1, "rgba(80, 120, 210, 0)");
      context.fillStyle = outerGlow;
      context.beginPath();
      context.arc(centerX, centerY, radius * 1.65, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.clip();

      const surface = context.createRadialGradient(
        centerX - radius * 0.38,
        centerY - radius * 0.42,
        radius * 0.06,
        centerX,
        centerY,
        radius * 1.08,
      );
      surface.addColorStop(0, "#d9deea");
      surface.addColorStop(0.35, "#9da7b9");
      surface.addColorStop(0.72, "#5a6579");
      surface.addColorStop(1, "#1b2434");
      context.fillStyle = surface;
      context.fillRect(
        centerX - radius,
        centerY - radius,
        radius * 2,
        radius * 2,
      );

      context.save();
      context.translate(centerX, centerY);
      context.rotate(rotation);

      for (const crater of craters) {
        const craterX = crater.x * radius;
        const craterY = crater.y * radius;
        const craterRadius = crater.radius * radius;

        const craterGradient = context.createRadialGradient(
          craterX - craterRadius * 0.35,
          craterY - craterRadius * 0.35,
          craterRadius * 0.08,
          craterX,
          craterY,
          craterRadius,
        );
        craterGradient.addColorStop(0, "rgba(235, 239, 247, 0.34)");
        craterGradient.addColorStop(
          0.42,
          `rgba(72, 80, 96, ${0.28 + crater.depth * 0.42})`,
        );
        craterGradient.addColorStop(1, "rgba(25, 30, 42, 0.08)");

        context.fillStyle = craterGradient;
        context.beginPath();
        context.ellipse(
          craterX,
          craterY,
          craterRadius,
          craterRadius * 0.78,
          crater.x * 1.7,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      context.restore();

      const shadow = context.createLinearGradient(
        centerX - radius,
        centerY,
        centerX + radius,
        centerY,
      );
      shadow.addColorStop(0, "rgba(2, 7, 18, 0.7)");
      shadow.addColorStop(0.32, "rgba(3, 8, 20, 0.18)");
      shadow.addColorStop(0.72, "rgba(0, 0, 0, 0)");
      shadow.addColorStop(1, "rgba(255, 255, 255, 0.08)");
      context.fillStyle = shadow;
      context.fillRect(
        centerX - radius,
        centerY - radius,
        radius * 2,
        radius * 2,
      );

      context.restore();

      context.save();
      context.strokeStyle = "rgba(205, 225, 255, 0.25)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(centerX, centerY, radius + 0.5, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    function spawnShootingStar() {
      const startOnLeft = random() < 0.5;
      const speed = 5 + random() * 5;
      const direction = startOnLeft ? 1 : -1;

      shootingStars.push({
        x: startOnLeft ? -50 : width + 50,
        y: height * (0.08 + random() * 0.35),
        vx: direction * speed,
        vy: speed * (0.18 + random() * 0.14),
        length: 90 + random() * 110,
        life: 0,
        maxLife: 70 + random() * 45,
      });
    }

    function drawShootingStars() {
      context.save();
      context.globalCompositeOperation = "screen";

      for (let index = shootingStars.length - 1; index >= 0; index -= 1) {
        const star = shootingStars[index];
        star.x += star.vx;
        star.y += star.vy;
        star.life += 1;

        const fade = 1 - star.life / star.maxLife;
        if (
          fade <= 0 ||
          star.x < -250 ||
          star.x > width + 250 ||
          star.y > height + 180
        ) {
          shootingStars.splice(index, 1);
          continue;
        }

        const velocityLength = Math.hypot(star.vx, star.vy);
        const tailX = star.x - (star.vx / velocityLength) * star.length;
        const tailY = star.y - (star.vy / velocityLength) * star.length;
        const trail = context.createLinearGradient(
          star.x,
          star.y,
          tailX,
          tailY,
        );

        trail.addColorStop(0, `rgba(220, 240, 255, ${fade * 0.9})`);
        trail.addColorStop(1, "rgba(120, 185, 255, 0)");
        context.strokeStyle = trail;
        context.lineWidth = 1.7;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(star.x, star.y);
        context.lineTo(tailX, tailY);
        context.stroke();
      }

      context.restore();
    }

    function drawFrame(time: number) {
      if (!isRunning) return;

      drawBaseSpace();
      drawNebula(time);
      drawStars(time);
      drawDust();
      drawMoon(time);

      if (time > nextShootingStarAt && shootingStars.length < 1) {
        spawnShootingStar();
        nextShootingStarAt = time + 8000 + random() * 18000;
      }

      drawShootingStars();
      animationFrame = requestAnimationFrame(drawFrame);
    }

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(wrapper);
    resizeCanvas();

    if (prefersReducedMotion) {
      drawBaseSpace();
      drawNebula(0);
      drawStars(0);
      drawDust();
      drawMoon(0);
    } else {
      animationFrame = requestAnimationFrame(drawFrame);
    }

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_42%,rgba(2,7,24,0.12)_68%,rgba(2,6,20,0.42)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-[#071a3b]/55 via-[#0a2a61]/20 to-transparent" />
    </div>
  );
}