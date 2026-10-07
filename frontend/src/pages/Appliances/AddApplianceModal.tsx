import React, { useState } from 'react';
import GlassModal from '../../components/glass/GlassModal';
import GlassButton from '../../components/glass/GlassButton';
import GlassInput from '../../components/glass/GlassInput';
import GlassSelect from '../../components/glass/GlassSelect';
import api from '../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { fetchApplianceCategories, fetchPzemDevices } from '../../services/api';
import { toast } from '../../components/ui/Toast';

interface AddApplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddApplianceModal: React.FC<AddApplianceModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    description: '',
    pzem_id: '',
    location: '',
    rated_voltage: 230,
    rated_power: 0,
    rated_current: 0,
    rated_frequency: 50
  });
  const categoriesQuery = useQuery({ queryKey: ['appliance-categories'], queryFn: async () => (await fetchApplianceCategories()).data, enabled: isOpen });
  const pzemQuery = useQuery({ queryKey: ['pzem-devices'], queryFn: async () => (await fetchPzemDevices()).data, enabled: isOpen });

  const updateForm = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const numeric = ['rated_voltage', 'rated_power', 'rated_current', 'rated_frequency'].includes(e.target.name);
    setFormData({ ...formData, [e.target.name]: numeric ? Number(e.target.value) : e.target.value });
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    try {
      await api.post('/appliances', formData);
      queryClient.invalidateQueries({ queryKey: ['appliances'] });
      onClose();
      setStep(1);
    } catch (error) {
      toast.error('Appliance was not saved. Check the category, meter assignment, and administrator access.');
    }
  };

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Add New Appliance" maxWidth="lg">
      <div className="mb-6 flex gap-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-cyan-500' : 'bg-white/10'}`} />
        ))}
      </div>

      <div className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Device Selection</h3>
            <p className="text-sm text-slate-400">Select the hardware device this appliance is connected to.</p>
            <GlassSelect
              name="pzem_id"
              label="PZEM Device"
              value={formData.pzem_id}
              onChange={updateForm}
              options={(pzemQuery.data || []).map(device => ({ value: device.id, label: `${device.id} (${device.status})` }))}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Product Identity</h3>
            <GlassInput name="name" label="Appliance Name" placeholder="e.g. Master Bedroom AC" value={formData.name} onChange={updateForm} required />
            <GlassSelect
              name="category"
              label="Category"
              value={formData.category}
              onChange={updateForm}
              options={(categoriesQuery.data || []).map(category => ({ value: category.name, label: category.name }))}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <GlassInput name="manufacturer" label="Manufacturer" value={formData.manufacturer} onChange={updateForm} />
              <GlassInput name="model" label="Model" value={formData.model} onChange={updateForm} />
            </div>
            <GlassInput name="serial_number" label="Serial number" value={formData.serial_number} onChange={updateForm} />
            <GlassInput name="location" label="Location" value={formData.location} onChange={updateForm} />
            <GlassInput name="description" label="Description" value={formData.description} onChange={updateForm} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Manufacturer Ratings</h3>
            <div className="grid grid-cols-2 gap-4">
              <GlassInput name="rated_voltage" label="Rated Voltage (V)" type="number" value={formData.rated_voltage} onChange={updateForm} required />
              <GlassInput name="rated_frequency" label="Rated Frequency (Hz)" type="number" value={formData.rated_frequency} onChange={updateForm} required />
              <GlassInput name="rated_power" label="Rated Power (W)" type="number" value={formData.rated_power} onChange={updateForm} required />
              <GlassInput name="rated_current" label="Rated Current (A)" type="number" value={formData.rated_current} onChange={updateForm} required />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Review Information</h3>
            <div className="bg-white/5 p-4 rounded-lg border border-white/10 text-sm space-y-2">
              <p><span className="text-slate-400">Name:</span> {formData.name}</p>
              <p><span className="text-slate-400">Category:</span> {formData.category}</p>
              <p><span className="text-slate-400">Device:</span> {formData.pzem_id}</p>
              <p><span className="text-slate-400">Rated Power:</span> {formData.rated_power} W</p>
            </div>
            <p className="text-xs text-amber-400">Click submit to register this appliance and begin telemetry collection.</p>
          </div>
        )}

        <div className="flex justify-between pt-4 mt-6 border-t border-white/10">
          <GlassButton variant="ghost" onClick={step === 1 ? onClose : handleBack}>
            {step === 1 ? 'Cancel' : 'Back'}
          </GlassButton>
          <GlassButton onClick={step === 4 ? handleSubmit : handleNext}>
            {step === 4 ? 'Submit Appliance' : 'Next Step'}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
};

export default AddApplianceModal;
