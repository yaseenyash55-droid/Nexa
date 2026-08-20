import { api } from './client.js';
import { getMediaUrl } from '../utils/media.js';

export interface MediaUploadResponse {
  assetId: string;
  publicUrl: string;
  mediaKind: string;
  mimeType: string;
  sizeBytes: number;
}

export type MediaKind = 'photo' | 'reel' | 'video' | 'story' | 'avatar' | 'chat';

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MiB (server photo limit)
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MiB (server reel/video limit)
const MAX_STORY_SIZE = 100 * 1024 * 1024; // 100 MiB
const MAX_AVATAR_SIZE = 10 * 1024 * 1024; // 10 MiB

export const mediaApi = {
  uploadFile: async (
    file: File,
    kind: MediaKind = 'photo',
    onProgress?: (percent: number) => void
  ): Promise<string> => {
    if (!file) {
      throw new Error('No file provided for upload.');
    }

    const isVideo = file.type.startsWith('video/') || kind === 'reel' || kind === 'video';
    let maxSize = MAX_IMAGE_SIZE;
    if (kind === 'avatar') maxSize = MAX_AVATAR_SIZE;
    else if (kind === 'story') maxSize = MAX_STORY_SIZE;
    else if (isVideo) maxSize = MAX_VIDEO_SIZE;

    if (file.size > maxSize) {
      const maxMb = Math.round(maxSize / (1024 * 1024));
      throw new Error(`File size exceeds maximum allowed limit of ${maxMb}MB.`);
    }

    // Build FormData and normalize kind
    const normalizedKind = kind === 'video' ? 'reel' : kind;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', normalizedKind);

    const res = await api.post<{ data: MediaUploadResponse }>('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      }
    });

    const rawUrl = res.data.data?.publicUrl || (res.data as any).publicUrl;
    const fullUrl = getMediaUrl(rawUrl);

    if (!fullUrl) {
      throw new Error('Failed to resolve public URL from backend.');
    }

    return fullUrl;
  }
};
