export function SpliceIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`splice-icon-container ${className}`}>
      <style>{`
        @keyframes square1Move {
          0% {
            transform: translate(0, 0) skewX(-20deg);
          }
          25% {
            transform: translate(15px, 0) skewX(-20deg);
          }
          50% {
            transform: translate(15px, 11px) skewX(-20deg);
          }
          75% {
            transform: translate(0, 11px) skewX(-20deg);
          }
          100% {
            transform: translate(0, 0) skewX(-20deg);
          }
        }

        @keyframes square2Move {
          0% {
            transform: translate(0, 0) skewX(-20deg);
          }
          25% {
            transform: translate(0, 11px) skewX(-20deg);
          }
          50% {
            transform: translate(-15px, 11px) skewX(-20deg);
          }
          75% {
            transform: translate(-15px, 0) skewX(-20deg);
          }
          100% {
            transform: translate(0, 0) skewX(-20deg);
          }
        }

        @keyframes square3Move {
          0% {
            transform: translate(0, 0) skewX(-20deg);
          }
          25% {
            transform: translate(0, -11px) skewX(-20deg);
          }
          50% {
            transform: translate(15px, -11px) skewX(-20deg);
          }
          75% {
            transform: translate(15px, 0) skewX(-20deg);
          }
          100% {
            transform: translate(0, 0) skewX(-20deg);
          }
        }

        @keyframes square4Move {
          0% {
            transform: translate(0, 0) skewX(-20deg);
          }
          25% {
            transform: translate(-15px, 0) skewX(-20deg);
          }
          50% {
            transform: translate(-15px, -11px) skewX(-20deg);
          }
          75% {
            transform: translate(0, -11px) skewX(-20deg);
          }
          100% {
            transform: translate(0, 0) skewX(-20deg);
          }
        }

        .splice-icon-container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .splice-icon {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .splice-icon-grid {
          display: grid;
          grid-template-columns: repeat(2, 12px);
          grid-template-rows: repeat(2, 8px);
          gap: 3px;
          position: relative;
        }

        .splice-icon .square {
          width: 12px;
          height: 8px;
          background: currentColor;
        }

        /* Top-left square: right → bottom-right → down → bottom-left → left → top-left */
        .splice-icon .square:nth-child(1) {
          opacity: 1;
          animation: square1Move 6s ease-in-out infinite;
          animation-play-state: paused;
        }

        /* Top-right square: down → bottom-right → left → bottom-left → up → top-right */
        .splice-icon .square:nth-child(2) {
          opacity: 0.8;
          animation: square2Move 6s ease-in-out infinite;
          animation-play-state: paused;
        }

        /* Bottom-left square: up → top-left → right → top-right → down → bottom-left */
        .splice-icon .square:nth-child(3) {
          opacity: 0.6;
          animation: square3Move 6s ease-in-out infinite;
          animation-play-state: paused;
        }

        /* Bottom-right square: left → bottom-left → up → top-left → right → bottom-right */
        .splice-icon .square:nth-child(4) {
          opacity: 0.9;
          animation: square4Move 6s ease-in-out infinite;
          animation-play-state: paused;
        }

        .splice-icon-container:hover .square {
          animation-play-state: running;
        }

        .group:hover .splice-icon-container .square {
          animation-play-state: running;
        }
      `}</style>
      <div className="splice-icon">
        <div className="splice-icon-grid">
          <div className="square" />
          <div className="square" />
          <div className="square" />
          <div className="square" />
        </div>
      </div>
    </div>
  )
}
