// src/components/escort/RadarChart.tsx
import { useState, useEffect, useRef, useMemo } from 'react';

interface RadarData {
  label: string;
  value: number; // 0-100
  icon: string;
  color: string;
}

interface RadarChartProps {
  data: RadarData[];
  size?: number;
  animated?: boolean;
}

export default function RadarChart({ data, size = 320, animated = true }: RadarChartProps) {
  const [progress, setProgress] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isVisible = useRef(false);

  // Intersection Observer para animación de entrada
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible.current) {
          isVisible.current = true;
          if (animated) {
            // Animar el progreso de 0 a 1
            const duration = 1500;
            const startTime = performance.now();
            const animate = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const rawProgress = Math.min(elapsed / duration, 1);
              // easeOutElastic
              const eased = rawProgress === 0 ? 0 : rawProgress === 1 ? 1 : 
                Math.pow(2, -10 * rawProgress) * Math.sin((rawProgress * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
              setProgress(eased);
              if (rawProgress < 1) {
                requestAnimationFrame(animate);
              }
            };
            requestAnimationFrame(animate);
          } else {
            setProgress(1);
          }
        }
      },
      { threshold: 0.3 }
    );

    if (svgRef.current) {
      observer.observe(svgRef.current);
    }

    return () => observer.disconnect();
  }, [animated]);

  const center = size / 2;
  const radius = (size / 2) - 60; // Margen para labels
  const angleStep = (2 * Math.PI) / data.length;
  const startAngle = -Math.PI / 2; // Empezar arriba

  // Calcular puntos del polígono
  const getPoint = (index: number, value: number, maxRadius: number) => {
    const angle = startAngle + index * angleStep;
    const r = (value / 100) * maxRadius * progress;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Puntos actuales del área
  const areaPoints = data.map((d, i) => getPoint(i, d.value, radius));
  const areaPath = areaPoints.length > 0 
    ? `M ${areaPoints.map(p => `${p.x},${p.y}`).join(' L ')} Z`
    : '';

  // Puntos del borde exterior (100%)
  const outerPoints = data.map((_, i) => getPoint(i, 100, radius));

  // Niveles del grid (20%, 40%, 60%, 80%, 100%)
  const gridLevels = [20, 40, 60, 80, 100];

  // Calcular promedio general
  const promedio = useMemo(() => {
    const sum = data.reduce((acc, d) => acc + d.value, 0);
    return Math.round(sum / data.length);
  }, [data]);

  return (
    <div className="relative flex flex-col items-center">
      {/* SVG del radar */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          ref={svgRef}
          width={size}
          height={size}
          className="overflow-visible"
        >
          <defs>
            {/* Gradiente del área */}
            <radialGradient id="radarAreaGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(236, 72, 153, 0.3)" />
              <stop offset="50%" stopColor="rgba(139, 92, 246, 0.2)" />
              <stop offset="100%" stopColor="rgba(6, 182, 212, 0.1)" />
            </radialGradient>

            {/* Gradiente del borde */}
            <linearGradient id="radarStrokeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ec4899" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>

            {/* Glow filter */}
            <filter id="radarGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Glow para puntos */}
            <filter id="pointGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Fondo circular sutil */}
          <circle
            cx={center}
            cy={center}
            r={radius + 10}
            fill="rgba(255,255,255,0.02)"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth={1}
          />

          {/* Grid circular (niveles) */}
          {gridLevels.map((level) => {
            const r = (level / 100) * radius;
            return (
              <g key={level}>
                <circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                  strokeDasharray={level === 100 ? 'none' : '4,4'}
                />
                {/* Label del nivel */}
                <text
                  x={center + 5}
                  y={center - r + 12}
                  fill="rgba(255,255,255,0.15)"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {level}%
                </text>
              </g>
            );
          })}

          {/* Líneas del eje (spokes) */}
          {data.map((_, i) => {
            const endPoint = getPoint(i, 100, radius);
            return (
              <line
                key={`spoke-${i}`}
                x1={center}
                y1={center}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
            );
          })}

          {/* Área del radar (polígono relleno) */}
          {areaPath && (
            <>
              <path
                d={areaPath}
                fill="url(#radarAreaGradient)"
                stroke="none"
                className="transition-all duration-300"
              />
              <path
                d={areaPath}
                fill="none"
                stroke="url(#radarStrokeGradient)"
                strokeWidth={2.5}
                strokeLinejoin="round"
                filter="url(#radarGlow)"
                className="transition-all duration-300"
              />
            </>
          )}

          {/* Puntos en los vértices */}
          {areaPoints.map((point, i) => {
            const isHovered = hoveredIndex === i;
            const d = data[i];
            return (
              <g key={`point-${i}`}>
                {/* Halo del punto */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isHovered ? 12 : 8}
                  fill={d.color}
                  opacity={isHovered ? 0.15 : 0.1}
                  className="transition-all duration-300"
                />
                {/* Punto principal */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isHovered ? 6 : 4}
                  fill={d.color}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={2}
                  filter="url(#pointGlow)"
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
                {/* Valor flotante al hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={point.x - 25}
                      y={point.y - 28}
                      width={50}
                      height={20}
                      rx={6}
                      fill="rgba(0,0,0,0.8)"
                      stroke={d.color}
                      strokeWidth={1}
                    />
                    <text
                      x={point.x}
                      y={point.y - 14}
                      textAnchor="middle"
                      fill={d.color}
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {d.value}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Labels exteriores con iconos */}
          {data.map((d, i) => {
            const labelRadius = radius + 35;
            const angle = startAngle + i * angleStep;
            const x = center + labelRadius * Math.cos(angle);
            const y = center + labelRadius * Math.sin(angle);

            // Ajustar alineación según posición
            const isRight = Math.cos(angle) > 0.1;
            const isLeft = Math.cos(angle) < -0.1;
            const textAnchor = isRight ? 'start' : isLeft ? 'end' : 'middle';

            return (
              <g key={`label-${i}`}>
                {/* Línea conectora sutil */}
                <line
                  x1={getPoint(i, 100, radius).x}
                  y1={getPoint(i, 100, radius).y}
                  x2={x - (isRight ? 10 : isLeft ? -10 : 0)}
                  y2={y}
                  stroke={d.color}
                  strokeWidth={1}
                  opacity={0.3}
                  strokeDasharray="2,2"
                />
                <text
                  x={x}
                  y={y - 5}
                  textAnchor={textAnchor}
                  fill={d.color}
                  fontSize="11"
                  fontWeight="600"
                >
                  {d.label}
                </text>
                <text
                  x={x}
                  y={y + 10}
                  textAnchor={textAnchor}
                  fill="rgba(255,255,255,0.4)"
                  fontSize="10"
                >
                  {d.value}%
                </text>
              </g>
            );
          })}
        </svg>

        {/* Score central flotante */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div
              className="text-3xl font-black"
              style={{
                background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 15px rgba(236,72,153,0.4))',
              }}
            >
              {promedio}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Promedio</div>
          </div>
        </div>
      </div>

      {/* Leyenda inferior */}
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {data.map((d, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all duration-300 cursor-default ${
              hoveredIndex === i
                ? 'bg-white/10 scale-105'
                : 'bg-white/5 hover:bg-white/10'
            }`}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: d.color, boxShadow: `0 0 8px ${d.color}60` }}
            />
            <span className="text-gray-400">{d.label}</span>
            <span className="font-bold" style={{ color: d.color }}>{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}