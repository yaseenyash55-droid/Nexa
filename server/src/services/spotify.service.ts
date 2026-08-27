import axios from 'axios';
import { MOCK_SPOTIFY_CATALOG, SpotifyTrack } from './mockSpotifyData.js';
import { logger } from '../utils/logger.js';

class SpotifyService {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  private getCredentials() {
    return {
      clientId: process.env.SPOTIFY_CLIENT_ID || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || ''
    };
  }

  private async getAccessToken(): Promise<string | null> {
    const { clientId, clientSecret } = this.getCredentials();
    if (!clientId || !clientSecret) {
      return null; // Fallback to mock catalog
    }

    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
      return this.accessToken;
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed to fetch Spotify access token. Falling back to mock catalog.');
      return null;
    }
  }

  public async searchTracks(query: string): Promise<SpotifyTrack[]> {
    const token = await this.getAccessToken();
    if (!token) {
      // Degrade gracefully: search mock catalog
      const q = query.toLowerCase().trim();
      if (!q) return MOCK_SPOTIFY_CATALOG;
      return MOCK_SPOTIFY_CATALOG.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.artists.some((a) => a.name.toLowerCase().includes(q))
      );
    }

    try {
      const response = await axios.get('https://api.spotify.com/v1/search', {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: query || 'Top Hits', type: 'track', limit: 20 }
      });

      const tracks = response.data.tracks?.items || [];
      return tracks.map((t: any) => ({
        id: t.id,
        name: t.name,
        artists: t.artists.map((a: any) => ({ name: a.name })),
        album: {
          name: t.album.name,
          images: t.album.images.map((img: any) => ({ url: img.url }))
        },
        preview_url: t.preview_url
      }));
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Spotify Search API failed. Falling back to mock search.');
      // Fallback
      return MOCK_SPOTIFY_CATALOG.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.artists.some((a) => a.name.toLowerCase().includes(query.toLowerCase()))
      );
    }
  }

  public async getTrackDetails(trackId: string): Promise<SpotifyTrack | null> {
    // If it's a mock track ID, fetch directly from mock catalog
    if (trackId.startsWith('spotify-track-')) {
      return MOCK_SPOTIFY_CATALOG.find((t) => t.id === trackId) || null;
    }

    const token = await this.getAccessToken();
    if (!token) {
      return MOCK_SPOTIFY_CATALOG.find((t) => t.id === trackId) || null;
    }

    try {
      const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const t = response.data;
      return {
        id: t.id,
        name: t.name,
        artists: t.artists.map((a: any) => ({ name: a.name })),
        album: {
          name: t.album.name,
          images: t.album.images.map((img: any) => ({ url: img.url }))
        },
        preview_url: t.preview_url
      };
    } catch (err: any) {
      logger.warn({ err: err.message, trackId }, 'Spotify Get Track Details failed. Checking mock database.');
      return MOCK_SPOTIFY_CATALOG.find((t) => t.id === trackId) || null;
    }
  }
}

export const spotifyService = new SpotifyService();
