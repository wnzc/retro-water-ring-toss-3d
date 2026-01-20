
import React, { useState, useCallback, useEffect } from 'react';
import WaterGame from './components/WaterGame';

const App: React.FC = () => {
  const [leftPressed, setLeftPressed] = useState(false);
  const [rightPressed, setRightPressed] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const handleLeftDown = useCallback(() => setLeftPressed(true), []);
  const handleLeftUp = useCallback(() => setLeftPressed(false), []);
  const handleRightDown = useCallback(() => setRightPressed(true), []);
  const handleRightUp = useCallback(() => setRightPressed(false), []);

  const handleReset = useCallback(() => {
    setGameWon(false);
    setGameKey(prev => prev + 1);
  }, []);

  const handleWin = useCallback(() => {
    setGameWon(true);
  }, []);

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
        navigator.vibrate(0); 
      }
    };
  }, [leftPressed, rightPressed]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4 select-none overflow-hidden">
      {/* Handheld Toy Body */}
      <div 
        className={`relative bg-gradient-to-b from-blue-400 to-blue-600 p-6 rounded-[3rem] shadow-2xl border-8 border-blue-300 w-full max-w-[500px] flex flex-col items-center transition-all duration-75 
          ${(leftPressed || rightPressed) ? 'shaking scale-[1.002]' : ''}`}
      >
        
        {/* Game Title */}
        <div className="mb-4 text-white font-bold text-3xl tracking-widest drop-shadow-md">
          水压套圈
        </div>

        {/* 1:1 Aspect Ratio Tank Container */}
        <div className="relative aspect-square w-full bg-blue-100 rounded-2xl overflow-hidden border-4 border-blue-700/30 shadow-inner">
          <WaterGame 
            key={gameKey}
            leftActive={leftPressed} 
            rightActive={rightPressed} 
            onWin={handleWin}
          />

          {/* Success Overlay */}
          {gameWon && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
              <div className="bg-white p-8 rounded-3xl shadow-2xl text-center transform scale-110 animate-bounce">
                <h2 className="text-4xl font-black text-blue-600 mb-4">恭喜成功!</h2>
                <p className="text-slate-600 mb-6">你已经套中了所有的圈圈！</p>
                <button 
                  onClick={handleReset}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform active:scale-95"
                >
                  再玩一次
                </button>
              </div>
            </div>
          )}
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
            <span className="text-white font-bold text-sm tracking-wider opacity-80">喷气</span>
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
            <span className="text-white font-bold text-sm tracking-wider opacity-80">喷气</span>
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
        <p className="font-semibold text-white mb-2 underline">游戏玩法</p>
        <p className="text-sm">点击红色或黄色按钮产生水流。控制小圈圈，让它们全部套入两根针中！</p>
      </div>
    </div>
  );
};

export default App;
