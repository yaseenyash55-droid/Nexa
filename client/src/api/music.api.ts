import { api } from './client.js';
import { NexaMusicTrack } from '../types/music.types.js';

/**
 * Fetch tracks from backend.
 * @param query Optional search keyword
 * @param genre Optional genre filter
 * @returns List of NexaMusicTrack
 */
export async function searchJamendoTracks(query?: string, genre?: string): Promise<NexaMusicTrack[]> {
  const params: Record<string, string> = {};
  let endpoint = '/music/tracks';

  if (query) {
    endpoint = '/music/search';
    params.q = query;
  } else if (genre) {
    endpoint = `/music/genres/${encodeURIComponent(genre)}`;
  }

  const resp = await api.get(endpoint, { params });
  return resp.data.data as NexaMusicTrack[];
}

export async function getTrackById(trackId: string): Promise<NexaMusicTrack> {
  const resp = await api.get(`/music/tracks/${encodeURIComponent(trackId)}`);
  return resp.data.data as NexaMusicTrack;
}
