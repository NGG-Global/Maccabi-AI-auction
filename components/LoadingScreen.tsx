'use client'

import { useEffect, useRef } from 'react'

interface Props {
  accent?: string
}

export default function LoadingScreen({ accent = '#36b8f5' }: Props) {
  const particlesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = particlesRef.current
    if (!layer) return
    const palette = [accent, '#0f2f8c', '#6b76ec', '#73d9f0']
    const N = 16
    for (let i = 0; i < N; i++) {
      const p = document.createElement('span')
      p.className = 'splash-pixel'
      const size = 3 + Math.random() * 7
      p.style.width = size + 'px'
      p.style.height = size + 'px'
      p.style.left = (-6 + Math.random() * 34) + '%'
      p.style.top = (16 + Math.random() * 64) + '%'
      p.style.background = palette[Math.floor(Math.random() * palette.length)]
      p.style.setProperty('--pdur', (1.8 + Math.random() * 1.8).toFixed(2) + 's')
      p.style.animationDelay = (Math.random() * 2.4).toFixed(2) + 's'
      layer.appendChild(p)
    }
    return () => { layer.innerHTML = '' }
  }, [accent])

  return (
    <>
      <style>{`
        .splash-stage {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          z-index: 9999;
        }
        .splash-splash {
          --speed: 1;
          --accent: ${accent};
          --navy: #0f2f8c;
          --bg1: #ffffff;
          --bg2: #e6f0ff;
          --halo: rgba(70,150,255,.30);
          --grid: rgba(30,60,149,.045);
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          isolation: isolate;
          overflow: hidden;
        }
        .splash-splash::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(125% 120% at 50% 44%, var(--bg1), var(--bg2));
          z-index: 0;
        }
        .splash-splash::after {
          content: "";
          position: absolute;
          inset: -10%;
          background:
            repeating-linear-gradient(0deg,  var(--grid) 0 1px, transparent 1px 46px),
            repeating-linear-gradient(90deg, var(--grid) 0 1px, transparent 1px 46px);
          -webkit-mask: radial-gradient(75% 70% at 50% 45%, #000 30%, transparent 78%);
                  mask: radial-gradient(75% 70% at 50% 45%, #000 30%, transparent 78%);
          animation: splash-gridDrift calc(26s / var(--speed)) linear infinite;
          z-index: 0;
          opacity: .9;
        }
        @keyframes splash-gridDrift { to { transform: translate(46px, 46px); } }

        .splash-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: .22;
          z-index: 0;
          mix-blend-mode: screen;
        }
        .splash-orb-a {
          width: 46vmin; height: 46vmin; left: 8%; top: 14%;
          background: radial-gradient(circle, var(--accent), transparent 70%);
          animation: splash-orbA calc(16s / var(--speed)) ease-in-out infinite;
        }
        .splash-orb-b {
          width: 40vmin; height: 40vmin; right: 6%; bottom: 12%;
          background: radial-gradient(circle, #6b76ec, transparent 70%);
          animation: splash-orbB calc(20s / var(--speed)) ease-in-out infinite;
        }
        @keyframes splash-orbA { 50% { transform: translate(6%, 8%) scale(1.12); } }
        @keyframes splash-orbB { 50% { transform: translate(-7%, -6%) scale(1.1); } }

        .splash-center {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .splash-cluster {
          position: relative;
          z-index: 2;
          width: min(80vw, 470px);
          display: grid;
          place-items: center;
          animation: splash-breathe calc(3.4s / var(--speed)) ease-in-out infinite;
        }
        @keyframes splash-breathe {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.025); }
        }
        .splash-halo {
          position: absolute;
          left: 50%; top: 50%;
          width: 150%; aspect-ratio: 1.7 / 1;
          transform: translate(-50%, -50%);
          background: radial-gradient(ellipse at center, var(--halo), transparent 68%);
          filter: blur(6px);
          z-index: -1;
          animation: splash-haloPulse calc(3.4s / var(--speed)) ease-in-out infinite;
        }
        @keyframes splash-haloPulse {
          0%, 100% { opacity: .72; transform: translate(-50%,-50%) scale(1); }
          50%       { opacity: 1;   transform: translate(-50%,-50%) scale(1.06); }
        }
        .splash-logoWrap {
          position: relative;
          width: 100%;
          /* was sized by the 470x244 logo that used to sit here */
          aspect-ratio: 470 / 244;
          line-height: 0;
        }
        .splash-shine {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .splash-shine::before {
          content: "";
          position: absolute;
          top: -20%; bottom: -20%;
          width: 36%;
          left: -45%;
          background: linear-gradient(105deg,
            transparent 0%,
            rgba(255,255,255,.05) 30%,
            rgba(255,255,255,.92) 50%,
            rgba(180,230,255,.55) 62%,
            transparent 100%);
          filter: blur(1px);
          transform: skewX(-12deg);
          animation: splash-sweep calc(2.7s / var(--speed)) cubic-bezier(.45,.05,.3,1) infinite;
        }
        @keyframes splash-sweep {
          0%   { left: -55%; }
          55%  { left: 120%; }
          100% { left: 120%; }
        }
        .splash-orbit {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          overflow: visible;
        }
        .splash-orbit svg {
          position: absolute;
          inset: 0;
          width: 100%; height: 100%;
          overflow: visible;
        }
        .splash-spark {
          filter: drop-shadow(0 0 5px var(--accent)) drop-shadow(0 0 10px var(--accent));
        }
        .splash-progress {
          position: relative;
          z-index: 2;
          margin-top: clamp(20px, 4.5vh, 46px);
          height: 24px;
          display: grid;
          place-items: center;
        }
        .splash-pline {
          width: min(42vw, 220px);
          height: 4px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--accent) 22%, transparent);
          overflow: hidden;
          position: relative;
        }
        .splash-pline::before {
          content: "";
          position: absolute;
          top: 0; bottom: 0;
          width: 42%;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, var(--accent) 30%, #bfe9ff 55%, var(--accent) 75%, transparent);
          box-shadow: 0 0 10px var(--accent);
          animation: splash-track calc(1.9s / var(--speed)) cubic-bezier(.65,0,.35,1) infinite;
        }
        @keyframes splash-track {
          0%   { left: -45%; }
          100% { left: 103%; }
        }
        .splash-particles {
          position: absolute;
          z-index: 3;
          left: 0; top: 0;
          width: 42%;
          height: 100%;
          pointer-events: none;
        }
        .splash-pixel {
          position: absolute;
          border-radius: 1.5px;
          opacity: 0;
          animation-name: splash-stream;
          animation-timing-function: cubic-bezier(.3,.5,.3,1);
          animation-iteration-count: infinite;
          animation-duration: var(--pdur, 2s);
        }
        @keyframes splash-stream {
          0%   { opacity: 0; transform: translate(-26px, 14px) scale(.35) rotate(0deg); }
          22%  { opacity: 1; }
          70%  { opacity: .9; }
          100% { opacity: 0; transform: translate(30px, -12px) scale(1) rotate(35deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-shine::before, .splash-pline::before,
          .splash-pixel, .splash-cluster, .splash-halo,
          .splash-orb-a, .splash-orb-b, .splash-spark { animation: none !important; }
          .splash-pixel { opacity: .8; }
        }
      `}</style>

      <div className="splash-stage">
        <div className="splash-splash">
          <div className="splash-orb splash-orb-a" />
          <div className="splash-orb splash-orb-b" />

          <div className="splash-center">
            <div className="splash-cluster">
              <div className="splash-halo" />
              <div className="splash-logoWrap">
                <div className="splash-shine" />
                <div className="splash-particles" ref={particlesRef} />
                <div className="splash-orbit">
                  <svg viewBox="0 0 1000 520" preserveAspectRatio="none">
                    <path id="splash-orbitPath" d="M 150 360 C 320 150, 720 70, 940 250" fill="none" stroke="none" />
                    <g className="splash-spark">
                      <circle r="6" fill="#eaf7ff">
                        <animateMotion dur="2.7s" repeatCount="indefinite" rotate="auto"
                          keyPoints="0;1;1" keyTimes="0;0.6;1" calcMode="spline"
                          keySplines="0.45 0.05 0.3 1; 0 0 1 1">
                          <mpath href="#splash-orbitPath" />
                        </animateMotion>
                      </circle>
                      <circle r="11" fill="#eaf7ff" opacity="0.28">
                        <animateMotion dur="2.7s" repeatCount="indefinite" rotate="auto"
                          keyPoints="0;1;1" keyTimes="0;0.6;1" calcMode="spline"
                          keySplines="0.45 0.05 0.3 1; 0 0 1 1">
                          <mpath href="#splash-orbitPath" />
                        </animateMotion>
                      </circle>
                    </g>
                  </svg>
                </div>
              </div>
            </div>

            <div className="splash-progress">
              <div className="splash-pline" />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
