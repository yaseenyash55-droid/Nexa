export interface MediaValidationResult {
  isValid: boolean;
  error?: string;
  mediaType?: 'image' | 'video';
  fileSizeFormatted?: string;
}

const MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska', 'video/avi'];

export function validateMediaFile(file: File): MediaValidationResult {
  const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  if (ALLOWED_IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/')) {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return {
        isValid: false,
        error: `Image size exceeds the 50MB limit (Selected: ${formatSize(file.size)})`,
        mediaType: 'image',
        fileSizeFormatted: formatSize(file.size)
      };
    }
    return { isValid: true, mediaType: 'image', fileSizeFormatted: formatSize(file.size) };
  }

  if (ALLOWED_VIDEO_TYPES.includes(file.type) || file.type.startsWith('video/')) {
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      return {
        isValid: false,
        error: `Video clip size exceeds the 500MB limit (Selected: ${formatSize(file.size)})`,
        mediaType: 'video',
        fileSizeFormatted: formatSize(file.size)
      };
    }
    return { isValid: true, mediaType: 'video', fileSizeFormatted: formatSize(file.size) };
  }

  return {
    isValid: false,
    error: 'Unsupported media file type. Supported formats: JPEG, PNG, WEBP, GIF, MP4, WEBM.'
  };
}

export function readMediaAsDataUrl(
  file: File, 
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const validation = validateMediaFile(file);
    if (!validation.isValid) {
      reject(new Error(validation.error || 'Invalid media file'));
      return;
    }

    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    };

    reader.onloadend = () => {
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      reject(new Error('Failed to process media file'));
    };

    reader.readAsDataURL(file);
  });
}
