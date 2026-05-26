import React from 'react';

const EmptyState = ({ icon, title, description }) => {
  return (
    <div className="text-center py-12">
      <div className="mb-6 text-4xl">{icon}</div>
      <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
      <p className="text-slate-400 max-w-xl mx-auto">{description}</p>
    </div>
  );
};

export { EmptyState };