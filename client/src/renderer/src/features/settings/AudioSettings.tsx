import React from 'react';
import { useMediaDevices } from '../../hooks/useMediaDevices';
import { useVoiceStore } from '../../stores/useVoiceStore';

export function AudioSettings(): React.ReactNode {
  const { audioInputs, audioOutputs, isLoading } = useMediaDevices();
  const selectedAudioInputId = useVoiceStore((s) => s.selectedAudioInputId);
  const selectedAudioOutputId = useVoiceStore((s) => s.selectedAudioOutputId);

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value || null;
    useVoiceStore.getState().setAudioInputDevice(value);
  };

  const handleOutputChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value || null;
    useVoiceStore.getState().setAudioOutputDevice(value);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Voice & Audio</h2>
        <p className="text-sm text-text-secondary">Loading audio devices...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Voice & Audio</h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="audio-input" className="block text-sm font-medium text-text-secondary mb-1">
            Input Device
          </label>
          <select
            id="audio-input"
            value={selectedAudioInputId ?? ''}
            onChange={handleInputChange}
            className="w-full bg-bg-secondary text-text-primary border border-border-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
          >
            <option value="">System Default</option>
            {audioInputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="audio-output" className="block text-sm font-medium text-text-secondary mb-1">
            Output Device
          </label>
          <select
            id="audio-output"
            value={selectedAudioOutputId ?? ''}
            onChange={handleOutputChange}
            className="w-full bg-bg-secondary text-text-primary border border-border-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
          >
            <option value="">System Default</option>
            {audioOutputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
