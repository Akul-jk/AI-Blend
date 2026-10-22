import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchAppliances } from '../../services/api';
import GlassPanel from '../../components/glass/GlassPanel';
import StatusBadge from '../../components/glass/StatusBadge';
import GlassButton from '../../components/glass/GlassButton';
import GlassInput from '../../components/glass/GlassInput';
import SectionHeader from '../../components/glass/SectionHeader';
import LoadingState from '../../components/glass/LoadingState';
import AddApplianceModal from './AddApplianceModal';
import { Search, Plus, Filter, Zap } from 'lucide-react';
import type { ApplianceWithDetails } from '../../types';

const AppliancesView: React.FC = () => {
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data: appliances = [], isLoading } = useQuery<ApplianceWithDetails[]>({
    queryKey: ['appliances'],
    queryFn: () => fetchAppliances().then(res => res.data as any as ApplianceWithDetails[]),
  });

  if (isLoading) return <LoadingState text="Loading appliances..." />;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Appliances"
        subtitle="Manage and monitor your connected appliances"
        action={
          <GlassButton icon={<Plus size={18} />} onClick={() => setIsAddModalOpen(true)}>
            ADD APPLIANCE
          </GlassButton>
        }
      />

      <GlassPanel className="p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <GlassInput
            placeholder="Search appliances..."
            leftIcon={<Search size={18} />}
          />
        </div>
        <div className="flex gap-4">
           <GlassButton variant="secondary" icon={<Filter size={18} />}>Filter</GlassButton>
        </div>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {appliances.map(app => (
          <GlassPanel
            key={app.id}
            hover
            className="cursor-pointer"
            onClick={() => navigate(`/appliances/${app.id}`)}
          >
            <div className="flex justify-between items-start mb-4">
               <div>
                 <h3 className="text-lg font-bold text-white">{app.name}</h3>
                 <p className="text-sm text-slate-400">{app.manufacturer} {app.model}</p>
                 {app.latest_telemetry?.source && <p className="mt-1 text-xs text-amber-200">{app.latest_telemetry.source === 'simulation' ? 'Synthetic simulator data' : 'Hardware telemetry'}</p>}
               </div>
               <StatusBadge status={app.latest_telemetry && Date.now() - new Date(app.latest_telemetry.timestamp).getTime() < 60000 ? 'online' : 'offline'} label={app.latest_telemetry && Date.now() - new Date(app.latest_telemetry.timestamp).getTime() < 60000 ? 'TELEMETRY ACTIVE' : 'NO RECENT TELEMETRY'} />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <p className="text-xs text-slate-400 mb-1">Current Power</p>
                <p className="text-xl font-semibold text-cyan-400">{app.latest_telemetry?.power || 0} W</p>
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <p className="text-xs text-slate-400 mb-1">Today's Energy</p>
                <p className="text-xl font-semibold text-violet-400">{app.energy_today || 0} kWh</p>
              </div>
            </div>
          </GlassPanel>
        ))}
        {appliances.length === 0 && (
          <div className="col-span-full">
            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
              <Zap className="mx-auto h-12 w-12 text-slate-400 mb-3" />
              <h3 className="text-lg font-medium text-white mb-1">No appliances found</h3>
              <p className="text-slate-400 mb-4">Get started by adding your first appliance.</p>
              <GlassButton icon={<Plus size={18} />} onClick={() => setIsAddModalOpen(true)}>
                ADD APPLIANCE
              </GlassButton>
            </div>
          </div>
        )}
      </div>

      <AddApplianceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};

export default AppliancesView;
