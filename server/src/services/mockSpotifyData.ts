export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string; height?: number; width?: number }>;
  };
  preview_url: string | null;
}

export const MOCK_SPOTIFY_CATALOG: SpotifyTrack[] = [
  {
    id: 'spotify-track-1',
    name: 'Blinding Lights',
    artists: [{ name: 'The Weeknd' }],
    album: {
      name: 'After Hours',
      images: [{ url: 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?auto=format&fit=crop&w=300&q=80' }]
    },
    preview_url: 'https://cdn.freemusicarchive.org/storage-freemusicarchive-org/tracks/7L2h1L8hWqg1w.mp3'
  },
  {
    id: 'spotify-track-2',
    name: 'Stay',
    artists: [{ name: 'The Kid LAROI' }, { name: 'Justin Bieber' }],
    album: {
      name: 'F*CK LOVE 3: OVER YOU',
      images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80' }]
    },
    preview_url: 'https://cdn.freemusicarchive.org/storage-freemusicarchive-org/tracks/8K1m3N9xP.mp3'
  },
  {
    id: 'spotify-track-3',
    name: 'As It Was',
    artists: [{ name: 'Harry Styles' }],
    album: {
      name: "Harry's House",
      images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80' }]
    },
    preview_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  },
  {
    id: 'spotify-track-4',
    name: 'Levitating',
    artists: [{ name: 'Dua Lipa' }],
    album: {
      name: 'Future Nostalgia',
      images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80' }]
    },
    preview_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
  }
];
