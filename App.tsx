
import React, { useState, useCallback, useEffect } from 'react';
import WaterGame from './components/WaterGame';

const App: React.FC = () => {
  const [leftPressed, setLeftPressed] = useState(false);
  const [rightPressed, setRightPressed] = useState(false);

  const handleLeftDown = useCallback(() => setLeftPressed(true), []);
  const handleLeftUp = useCallback(() => setLeftPressed(false), []);
  const handleRightDown = useCallback(() => setRightPressed(true), []);
  const handleRightUp = useCallback(() => setRightPressed(false), []);

  // 实现水流频率的触觉反馈逻辑
  useEffect(() => {
    let vibrationInterval: number | null = null;
    const isAnyButtonPressed = leftPressed || rightPressed;

    if (isAnyButtonPressed && "vibrate" in navigator) {
      // 模拟高频水流震动：每 50ms 触发一次 15ms 的短促震动
      vibrationInterval = window.setInterval(() => {
        navigator.vibrate(15);
      }, 50);
    }

    return () => {
      if (vibrationInterval) {
        clearInterval(vibrationInterval);
      }
      if ("vibrate" in navigator) {
        navigator.vibrate(0); // 按钮释放后立即停止震动
      }
    };
  }, [leftPressed, rightPressed]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4 select-none">
      {/* Handheld Toy Body - 加入 shaking 类实现视觉反馈 */}
      <div 
        className={`relative bg-gradient-to-b from-blue-400 to-blue-600 p-6 rounded-[3rem] shadow-2xl border-8 border-blue-300 w-full max-w-[500px] flex flex-col items-center transition-all duration-75 
          ${(leftPressed || rightPressed) ? 'shaking scale-[1.002]' : ''}`}
      >
        
        {/* Game Title */}
        <div className="mb-4 text-white font-bold text-2xl tracking-widest drop-shadow-md">
          AQUA TOSS 3D
        </div>

        {/* 1:1 Aspect Ratio Tank Container */}
        <div className="relative aspect-square w-full bg-blue-100 rounded-2xl overflow-hidden border-4 border-blue-700/30 shadow-inner">
          <WaterGame 
            leftActive={leftPressed} 
            rightActive={rightPressed} 
          />
        </div>

        {/* Controls Section */}
        <div className="mt-8 flex justify-between w-full px-6 pb-4">
          {/* Left Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onMouseDown={handleLeftDown}
              onMouseUp={handleLeftUp}
              onMouseLeave={handleLeftUp}
              onTouchStart={(e) => { e.preventDefault(); handleLeftDown(); }}
              onTouchEnd={(e) => { e.preventDefault(); handleLeftUp(); }}
              className={`w-20 h-20 rounded-full bg-red-500 border-b-8 border-red-700 active:border-b-0 active:translate-y-2 transition-all shadow-lg flex items-center justify-center
                ${leftPressed ? 'bg-red-400 ring-4 ring-red-200/50' : ''}`}
            >
              <div className="w-12 h-12 rounded-full border-4 border-red-300 opacity-50" />
            </button>
            <span className="text-white font-bold text-xs uppercase tracking-wider opacity-80">Clockwise</span>
          </div>

          {/* Right Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onMouseDown={handleRightDown}
              onMouseUp={handleRightUp}
              onMouseLeave={handleRightUp}
              onTouchStart={(e) => { e.preventDefault(); handleRightDown(); }}
              onTouchEnd={(e) => { e.preventDefault(); handleRightUp(); }}
              className={`w-20 h-20 rounded-full bg-yellow-500 border-b-8 border-yellow-700 active:border-b-0 active:translate-y-2 transition-all shadow-lg flex items-center justify-center
                ${rightPressed ? 'bg-yellow-400 ring-4 ring-yellow-200/50' : ''}`}
            >
              <div className="w-12 h-12 rounded-full border-4 border-yellow-300 opacity-50" />
            </button>
            <span className="text-white font-bold text-xs uppercase tracking-wider opacity-80">Counter</span>
          </div>
        </div>

        {/* Speaker decoration */}
        <div className="mt-2 flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 bg-blue-800/30 rounded-full" />
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 text-slate-400 text-center max-w-md">
        <p className="font-semibold text-white mb-2 underline">How to Play</p>
        <p className="text-sm">Press the red and yellow buttons to create water currents. Guide all the rings onto the two needles!</p>
      </div>
    </div>
  );
};

export default App;
