import React from 'react';

type AgencyApplicationsTableProps = {
  agencyId?: string;
  userRole?: string;
};

export const AgencyApplicationsTable: React.FC<AgencyApplicationsTableProps> = ({
  agencyId,
  userRole,
}) => {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-cyan-400 mb-4">
        Agency Applications
      </h3>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
        <p className="text-slate-400">Applications list loading...</p>
      </div>
    </div>
  );
};

export default AgencyApplicationsTable;