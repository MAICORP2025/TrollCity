import React from 'react';

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

const Slider: React.FC<SliderProps> = ({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
}) => {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={`w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-800 ${className}`}
      style={{
        background: `linear-gradient(to right, #1e293b 0%, #1e293b ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`,
      }}
    />
  );
};

export default Slider;
