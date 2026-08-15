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

export class MusicLicensingService {
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
    },
    {
      trackId: 'jamendo-track-restricted-nd',
      title: 'Restricted Audio (No-Derivatives)',
      artistName: 'Acoustic Sound',
      durationSeconds: 120,
      audioUrl: 'https://example.com/restricted-nd.mp3',
      license: {
        code: 'CC-BY-ND-4.0',
        name: 'Creative Commons Attribution-NoDerivatives 4.0',
        allowDerivatives: false,
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

    if (!track.license.allowDerivatives) {
      return {
        allowed: false,
        reason: `Track license (${track.license.code}) strictly prohibits audiovisual derivatives/editing (No-Derivatives).`
      };
    }

    if (isCommercialDeployment && !track.license.allowCommercial) {
      return {
        allowed: false,
        reason: `Track license (${track.license.code}) prohibits commercial usage.`
      };
    }

    return { allowed: true, track };
  }
}

export const musicLicensingService = new MusicLicensingService();
