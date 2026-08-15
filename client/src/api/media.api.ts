import { api } from './client.js';
import { getMediaUrl } from '../utils/media.js';

export interface MediaUploadResponse {
  assetId: string;
  publicUrl: string;
  mediaKind: string;
}

const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB

export const mediaApi = {
  uploadFile: async (
    file: File,
    kind: 'photo' | 'reel' | 'video' | 'avatar' = 'photo',
    onProgress?: (percent: number) => void
  ): Promise<string> => {
    // 1. Validation
    if (!file) {
      throw new Error('No file provided for upload.');
    }

    const isVideo = file.type.startsWith('video/') || kind === 'reel' || kind === 'video';
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
      const maxMb = Math.round(maxSize / (1024 * 1024));
      throw new Error(`File size exceeds maximum allowed limit of ${maxMb}MB.`);
    }

    // 2. Build FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);

    // 3. Post with progress handler
    const res = await api.post('/media/upload', formData, {
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

    const rawUrl = res.data.data?.publicUrl || res.data.data?.url || res.data.publicUrl;
    const fullUrl = getMediaUrl(rawUrl);

    if (!fullUrl) {
      throw new Error('Failed to resolve public URL from backend.');
    }

    return fullUrl;
  }
};
