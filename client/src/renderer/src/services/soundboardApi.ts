import { apiRequest, apiGet } from './apiClient';
import type { SoundResponse } from 'discord-clone-shared';

export async function fetchSounds(): Promise<{ data: SoundResponse[]; count: number }> {
  return apiGet<{ data: SoundResponse[]; count: number }>('/api/soundboard', true);
}

export async function requestUploadUrl(data: {
  fileName: string;
  contentType: string;
  fileSize: number;
  durationMs: number;
}): Promise<{ uploadUrl: string; s3Key: string; soundId: string }> {
  return apiRequest<{ uploadUrl: string; s3Key: string; soundId: string }>(
    '/api/soundboard/upload-url',
    { method: 'POST', body: JSON.stringify(data) },
  );
}

export async function uploadToS3(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status}`);
  }
}

export async function getDownloadUrl(soundId: string): Promise<string> {
  const result = await apiGet<{ downloadUrl: string }>(`/api/soundboard/${soundId}/download-url`);
  return result.downloadUrl;
}

export async function deleteSound(soundId: string): Promise<void> {
  await apiRequest<void>(`/api/soundboard/${soundId}`, { method: 'DELETE' });
}
