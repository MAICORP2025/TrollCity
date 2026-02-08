import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Trash2, Zap, LayoutList, MessageSquare, Activity, Monitor } from 'lucide-react';

// --- Types ---
type TestType = 'simple-list' | 'complex-chat' | 'state-updates';

interface PerformanceMetrics {
  fps: number;
  domNodes: number;
  jsHeapSize?: number; // In MB
}

// --- Components for Testing ---

// 1. Simple Item
const SimpleItem = ({ index }: { index: number }) => (
  <div className="p-2 border-b border-white/10 text-sm text-zinc-400">
    Simple Item #{index} - {Math.random().toString(36).substring(7)}
  </div>
);

// 2. Complex Chat Message
const ComplexChatMessage = ({ index }: { index: number }) => (
  <div className="flex gap-3 p-3 hover:bg-white/5 rounded-lg transition-colors group">
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs shadow-lg">
      U{index % 10}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-bold text-zinc-200 text-sm">User_{index}</span>
        <span className="text-[10px] text-zinc-500">{new Date().toLocaleTimeString()}</span>
      </div>
      <p className="text-zinc-300 text-sm leading-relaxed">
        This is a simulated chat message #{index} to test rendering performance. 
        It contains <span className="text-blue-400 font-medium">highlighted text</span> and some random content: {Math.random().toString(36).repeat(3)}.
      </p>
      <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="px-2 py-1 bg-white/10 rounded text-[10px] hover:bg-white/20">Reply</button>
        <button className="px-2 py-1 bg-white/10 rounded text-[10px] hover:bg-white/20">React</button>
      </div>
    </div>
  </div>
);

// 3. State Update Consumer
const StateConsumerItem = ({ index, globalValue }: { index: number; globalValue: number }) => (
  <div className="p-2 bg-zinc-900/50 border border-white/5 rounded flex justify-between items-center">
    <span className="text-xs text-zinc-500">Observer #{index}</span>
    <span className={`text-sm font-mono font-bold ${globalValue % 2 === 0 ? 'text-green-500' : 'text-red-500'}`}>
      {globalValue}
    </span>
  </div>
);

export default function FrontendLimitsTest() {
  // State
  const [items, setItems] = useState<number[]>([]);
  const [testType, setTestType] = useState<TestType>('simple-list');
  const [isRunning, setIsRunning] = useState(false);
  const [autoAddInterval, setAutoAddInterval] = useState(100); // ms
  const [globalValue, setGlobalValue] = useState(0); // For state update test
  
  // Metrics
  const [metrics, setMetrics] = useState<PerformanceMetrics>({ fps: 0, domNodes: 0 });
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const requestRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Performance Loop ---
  useEffect(() => {
    const animate = (time: number) => {
      frameCount.current++;
      
      if (time - lastTime.current >= 1000) {
        // Calculate FPS
        const fps = frameCount.current;
        frameCount.current = 0;
        lastTime.current = time;

        // Get Memory (Chrome only)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const memory = (performance as any).memory;
        const jsHeapSize = memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : undefined;

        setMetrics({
          fps,
          domNodes: document.getElementsByTagName('*').length,
          jsHeapSize
        });
      }
      
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // --- Auto Add Loop ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning) {
      interval = setInterval(() => {
        if (testType === 'state-updates') {
          setGlobalValue(v => v + 1);
        } else {
          addItems(10); // Add 10 items per interval
        }
      }, autoAddInterval);
    }
    
    return () => clearInterval(interval);
  }, [isRunning, testType, autoAddInterval]);

  // --- Actions ---
  const addItems = (count: number) => {
    setItems(prev => {
      const newItems = Array.from({ length: count }, (_, i) => prev.length + i);
      return [...prev, ...newItems];
    });
  };

  const clearItems = () => {
    setItems([]);
    setGlobalValue(0);
  };

  const toggleTest = () => setIsRunning(!isRunning);

  // --- Render ---
  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      
      {/* Sidebar Controls */}
      <div className="w-80 bg-zinc-900 border-r border-white/10 flex flex-col z-10">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="text-red-500" />
            Stress Test
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Frontend Performance Analysis</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-8">
          
          {/* Test Type Selection */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Test Scenario</h3>
            <div className="space-y-2">
              <button 
                onClick={() => setTestType('simple-list')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${testType === 'simple-list' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-zinc-800 border-transparent hover:bg-zinc-800/80 text-zinc-400'}`}
              >
                <LayoutList size={18} />
                <div className="text-left">
                  <div className="text-sm font-bold">Simple List</div>
                  <div className="text-[10px] opacity-70">Raw DOM rendering limit</div>
                </div>
              </button>

              <button 
                onClick={() => setTestType('complex-chat')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${testType === 'complex-chat' ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-zinc-800 border-transparent hover:bg-zinc-800/80 text-zinc-400'}`}
              >
                <MessageSquare size={18} />
                <div className="text-left">
                  <div className="text-sm font-bold">Complex Chat</div>
                  <div className="text-[10px] opacity-70">Deep component trees</div>
                </div>
              </button>

              <button 
                onClick={() => setTestType('state-updates')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${testType === 'state-updates' ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-zinc-800 border-transparent hover:bg-zinc-800/80 text-zinc-400'}`}
              >
                <Zap size={18} />
                <div className="text-left">
                  <div className="text-sm font-bold">State Broadcast</div>
                  <div className="text-[10px] opacity-70">React Reconciliation cost</div>
                </div>
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Controls</h3>
            
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addItems(100)} className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded text-xs font-medium border border-white/5 transition-colors">
                +100 Items
              </button>
              <button onClick={() => addItems(1000)} className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded text-xs font-medium border border-white/5 transition-colors">
                +1,000 Items
              </button>
              <button onClick={() => addItems(5000)} className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded text-xs font-medium border border-white/5 transition-colors col-span-2">
                +5,000 Items (Heavy)
              </button>
            </div>

            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-zinc-400">Auto-add Interval:</span>
                <select 
                  value={autoAddInterval} 
                  onChange={(e) => setAutoAddInterval(Number(e.target.value))}
                  className="bg-black border border-white/20 rounded text-xs p-1 text-white"
                >
                  <option value={16}>16ms (60fps)</option>
                  <option value={100}>100ms</option>
                  <option value={500}>500ms</option>
                  <option value={1000}>1s</option>
                </select>
              </div>

              <button 
                onClick={toggleTest}
                className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${isRunning ? 'bg-red-500/20 text-red-500 border border-red-500' : 'bg-green-500 text-black hover:bg-green-400'}`}
              >
                {isRunning ? <><Pause size={16} /> Stop Auto-Test</> : <><Play size={16} /> Start Auto-Test</>}
              </button>
            </div>
          </div>

          <button 
            onClick={clearItems}
            className="w-full py-2 bg-zinc-800 hover:bg-red-900/30 hover:text-red-400 text-zinc-400 rounded border border-white/5 text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 size={14} /> Clear All Data
          </button>

        </div>

        {/* Metrics Footer */}
        <div className="p-4 bg-zinc-950 border-t border-white/10 text-xs font-mono space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-500">FPS:</span>
            <span className={`${metrics.fps < 30 ? 'text-red-500' : 'text-green-500'}`}>{metrics.fps}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">DOM Nodes:</span>
            <span className="text-white">{metrics.domNodes.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">JS Heap:</span>
            <span className="text-white">{metrics.jsHeapSize ? `${metrics.jsHeapSize} MB` : 'N/A'}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-white/5 mt-2">
            <span className="text-zinc-500">Item Count:</span>
            <span className="text-amber-500 font-bold">{items.length.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col bg-zinc-900/50 relative">
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur px-4 py-2 rounded-full border border-white/10 text-xs text-zinc-400 z-20 flex items-center gap-2">
           <Monitor size={14} /> Viewport
        </div>

        <div 
          ref={containerRef}
          className="flex-1 overflow-y-auto p-4 content-start"
        >
           {/* Render Test Content */}
           {testType === 'simple-list' && (
             <div className="space-y-0">
               {items.map((item) => <SimpleItem key={item} index={item} />)}
             </div>
           )}

           {testType === 'complex-chat' && (
             <div className="max-w-3xl mx-auto space-y-2">
               {items.map((item) => <ComplexChatMessage key={item} index={item} />)}
             </div>
           )}

           {testType === 'state-updates' && (
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
               {items.map((item) => <StateConsumerItem key={item} index={item} globalValue={globalValue} />)}
             </div>
           )}

           {items.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                <Activity size={48} className="mb-4 opacity-20" />
                <p>No items rendered.</p>
                <p className="text-sm opacity-50">Select a test scenario and add items.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
