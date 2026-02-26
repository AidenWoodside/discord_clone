import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMediaDevices } from './useMediaDevices';

const mockEnumerateDevices = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      mediaDevices: {
        enumerateDevices: mockEnumerateDevices,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      },
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeDevice(kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: '', toJSON: () => ({}) };
}

describe('useMediaDevices', () => {
  it('returns audio input and output device lists', async () => {
    mockEnumerateDevices.mockResolvedValue([
      makeDevice('audioinput', 'mic-1', 'Built-in Microphone'),
      makeDevice('audiooutput', 'spk-1', 'Built-in Speaker'),
      makeDevice('videoinput', 'cam-1', 'Camera'),
    ]);

    const { result } = renderHook(() => useMediaDevices());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.audioInputs).toHaveLength(1);
    expect(result.current.audioInputs[0].deviceId).toBe('mic-1');
    expect(result.current.audioOutputs).toHaveLength(1);
    expect(result.current.audioOutputs[0].deviceId).toBe('spk-1');
  });

  it('updates device list on devicechange event', async () => {
    mockEnumerateDevices.mockResolvedValueOnce([
      makeDevice('audioinput', 'mic-1', 'Mic 1'),
    ]);

    const { result } = renderHook(() => useMediaDevices());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.audioInputs).toHaveLength(1);

    // Simulate devicechange
    const handler = mockAddEventListener.mock.calls.find(
      (call) => call[0] === 'devicechange',
    )?.[1];
    expect(handler).toBeDefined();

    mockEnumerateDevices.mockResolvedValueOnce([
      makeDevice('audioinput', 'mic-1', 'Mic 1'),
      makeDevice('audioinput', 'mic-2', 'Mic 2'),
    ]);

    await act(async () => {
      handler();
    });

    await waitFor(() => {
      expect(result.current.audioInputs).toHaveLength(2);
    });
  });

  it('handles empty labels with fallback labels', async () => {
    mockEnumerateDevices.mockResolvedValue([
      makeDevice('audioinput', 'mic-1', ''),
      makeDevice('audioinput', 'mic-2', ''),
      makeDevice('audiooutput', 'spk-1', ''),
    ]);

    const { result } = renderHook(() => useMediaDevices());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.audioInputs[0].label).toBe('Microphone 1');
    expect(result.current.audioInputs[1].label).toBe('Microphone 2');
    expect(result.current.audioOutputs[0].label).toBe('Speaker 1');
  });

  it('cleanup removes event listener', () => {
    mockEnumerateDevices.mockResolvedValue([]);

    const { unmount } = renderHook(() => useMediaDevices());

    unmount();

    expect(mockRemoveEventListener).toHaveBeenCalledWith('devicechange', expect.any(Function));
  });

  it('handles enumerateDevices failure gracefully', async () => {
    mockEnumerateDevices.mockRejectedValue(new Error('Permission denied'));

    const { result } = renderHook(() => useMediaDevices());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.audioInputs).toEqual([]);
    expect(result.current.audioOutputs).toEqual([]);
  });
});
