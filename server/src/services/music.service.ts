import axios from 'axios';
import { env } from '../config/env.js';

export interface LicensedTrack {
  trackId: string;
  title: string;
  artistName: string;
  albumName?: string;
  durationSeconds: number;
  audioUrl: string;
  coverArtUrl?: string;
  license: {
    code: string; // e.g. 'CC-BY-4.0', 'CC-BY-SA-4.0'
    name: string;
    allowDerivatives: boolean;
    allowCommercial: boolean;
    attributionRequired: boolean;
  };
}

export interface NexaMusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  audioUrl: string;
  shareUrl?: string;
  duration: number;
  provider: 'jamendo' | 'spotify' | string;
}

export class MusicLicensingService {
  private readonly JAMENDO_BASE_URL = 'https://api.jamendo.com/v3.0';

  private developmentCatalog: LicensedTrack[] = [
    {
      trackId: 'jamendo-track-101',
      title: 'Neon Horizon (Ambient Synth)',
      artistName: 'Solar Flare',
      albumName: 'Digital Dawn',
      durationSeconds: 145,
      audioUrl: 'https://cdn.freemusicarchive.org/storage-freemusicarchive-org/tracks/7L2h1L8hWqg1w.mp3',
      coverArtUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
      license: {
        code: 'CC-BY-4.0',
        name: 'Creative Commons Attribution 4.0 International',
        allowDerivatives: true,
        allowCommercial: true,
        attributionRequired: true
      }
    },
    {
      trackId: 'jamendo-track-102',
      title: 'Midnight Groove',
      artistName: 'Luna Waves',
      albumName: 'Lo-Fi Chill',
      durationSeconds: 180,
      audioUrl: 'https://cdn.freemusicarchive.org/storage-freemusicarchive-org/tracks/8K1m3N9xP.mp3',
      coverArtUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
      license: {
        code: 'CC-BY-SA-4.0',
        name: 'Creative Commons Attribution-ShareAlike 4.0',
        allowDerivatives: true,
        allowCommercial: true,
        attributionRequired: true
      }
    }
  ];

  public searchLicensedCatalog(query?: string): LicensedTrack[] {
    if (!query || !query.trim()) {
      return this.developmentCatalog.filter((t) => t.license.allowDerivatives);
    }
    const q = query.toLowerCase().trim();
    return this.developmentCatalog.filter(
      (t) =>
        t.license.allowDerivatives &&
        (t.title.toLowerCase().includes(q) || t.artistName.toLowerCase().includes(q))
    );
  }

  public validateTrackForEditing(trackId: string, isCommercialDeployment = false): {
    allowed: boolean;
    reason?: string;
    track?: LicensedTrack;
  } {
    const track = this.developmentCatalog.find((t) => t.trackId === trackId);
    if (!track) {
      return { allowed: false, reason: 'Track unknown or missing from licensed catalog. Failed closed.' };
    }
    if (!track.license.allowDerivatives) return { allowed: false, reason: 'No-Derivatives' };
    if (isCommercialDeployment && !track.license.allowCommercial) return { allowed: false, reason: 'Non-Commercial only' };
    return { allowed: true, track };
  }

  // --- Real Jamendo Integration ---

  private transformJamendoTrack(track: any): NexaMusicTrack {
    return {
      id: track.id,
      title: track.name,
      artist: track.artist_name,
      album: track.album_name,
      artworkUrl: track.image || track.album_image,
      audioUrl: track.audio,
      shareUrl: track.shareurl,
      duration: track.duration,
      provider: 'jamendo'
    };
  }

  public async getTracks(params: { search?: string; tags?: string; id?: string; limit?: number }): Promise<NexaMusicTrack[]> {
    if (!env.JAMENDO_CLIENT_ID) {
      const error: any = new Error('Music provider is not configured. (JAMENDO_CLIENT_ID is missing)');
      error.code = 'MUSIC_PROVIDER_NOT_CONFIGURED';
      error.status = 503;
      throw error;
    }

    try {
      const response = await axios.get(`${this.JAMENDO_BASE_URL}/tracks/`, {
        params: {
          client_id: env.JAMENDO_CLIENT_ID,
          format: 'jsonpretty',
          limit: params.limit || 20,
          search: params.search || undefined,
          tags: params.tags || undefined,
          id: params.id || undefined,
          include: 'musicinfo'
        },
        timeout: 10000
      });

      if (response.data && response.data.results) {
        return response.data.results.map(this.transformJamendoTrack);
      }
      return [];
    } catch (error: any) {
      console.error('[MusicLicensingService] Jamendo API Error:', error.message);

      const apiError: any = new Error('Music provider is currently unavailable.');
      apiError.status = 502; // Bad Gateway

      if (error.code === 'ECONNABORTED') {
        apiError.code = 'MUSIC_PROVIDER_TIMEOUT';
        apiError.status = 504; // Gateway Timeout
      } else {
        apiError.code = 'MUSIC_PROVIDER_UNAVAILABLE';
      }

      throw apiError;
    }
  }
}

export const musicLicensingService = new MusicLicensingService();
