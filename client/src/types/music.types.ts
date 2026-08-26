export interface JamendoTrack {
  id: string;
  name: string;
  duration: number;
  artist_id: string;
  artist_name: string;
  album_name?: string;
  album_id?: string;
  album_image?: string;
  image?: string;
  audio: string;
  audiodownload?: string;
  shareurl?: string;
  license_ccurl?: string;
}

export interface JamendoApiResponse {
  headers: {
    status: string;
    code: number;
    error_message?: string;
    results_count: number;
  };
  results: JamendoTrack[];
}
