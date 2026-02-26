import { useState, useEffect, useCallback } from 'react';

interface UseMediaDevicesResult {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  isLoading: boolean;
}

function addFallbackLabels(devices: MediaDeviceInfo[]): MediaDeviceInfo[] {
  let inputCount = 0;
  let outputCount = 0;
  return devices.map((device) => {
    if (device.label) return device;
    if (device.kind === 'audioinput') {
      inputCount++;
      return { ...device, label: `Microphone ${inputCount}` } as MediaDeviceInfo;
    }
    if (device.kind === 'audiooutput') {
      outputCount++;
      return { ...device, label: `Speaker ${outputCount}` } as MediaDeviceInfo;
    }
    return device;
  });
}

export function useMediaDevices(): UseMediaDevicesResult {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const withLabels = addFallbackLabels(devices);
      setAudioInputs(withLabels.filter((d) => d.kind === 'audioinput'));
      setAudioOutputs(withLabels.filter((d) => d.kind === 'audiooutput'));
    } catch {
      // Device enumeration failed — return empty lists
      setAudioInputs([]);
      setAudioOutputs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    enumerateDevices();

    const handler = (): void => {
      enumerateDevices();
    };
    navigator.mediaDevices.addEventListener('devicechange', handler);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handler);
    };
  }, [enumerateDevices]);

  return { audioInputs, audioOutputs, isLoading };
}
