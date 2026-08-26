// client/src/api/music.api.ts

import axios from 'axios';

export interface JamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  album_image: string;
  audio: string;
  duration: number; // seconds
}

/**
 * Search tracks on Jamendo.
 * @param query Search keyword
 * @param genre Optional genre filter
 * @returns List of tracks
 */
export async function searchJamendoTracks(query: string, genre?: string): Promise<JamendoTrack[]> {
  const clientId = import.meta.env.VITE_JAMENDO_CLIENT_ID as string;
  const params: Record<string, string> = {
    client_id: clientId,
    format: 'json',
    limit: '20',
    namesearch: query,
    audioformat: 'mp31', // mp3 format
  };
  if (genre) {
    params['tags'] = genre;
  }
  const url = 'https://api.jamendo.com/v3.0/tracks/';
  const resp = await axios.get(url, { params });
  const tracks = resp.data.results as JamendoTrack[];
  return tracks;
}
