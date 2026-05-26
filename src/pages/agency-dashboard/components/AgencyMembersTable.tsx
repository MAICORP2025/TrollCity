import React from 'react';

const AgencyMembersTable = ({ agencyId, userRole }) => {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-cyan-400 mb-4">Agency Members</h3>
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
        <p className="text-slate-400">Member list loading...</p>
      </div>
    </div>
  );
};

export default AgencyMembersTable;