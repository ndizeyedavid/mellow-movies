/**
 * Demo streaming sources. Public HLS test streams (CORS-enabled,
 * multi-rendition so the quality selector has real levels to pick from).
 * In a production app these would be the CDN/manifest URLs of each title.
 */
export const STREAM_URLS = [
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_hevc/master.m3u8",
  "https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8",
  "https://cdn.bitmovin.com/content/assets/art-of-motion-dash-hls-progressive/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8",
];

export interface SubtitleTrack {
  label: string;
  lang: string;
  src: string;
}

/** Bundled subtitle tracks (served from /public) so the player always has
 * a subtitle menu even when the HLS manifest has no subtitle playlists. */
export const SUBTITLE_TRACKS: SubtitleTrack[] = [
  { label: "English", lang: "en", src: "/subtitles/en.vtt" },
  { label: "Français", lang: "fr", src: "/subtitles/fr.vtt" },
  { label: "Español", lang: "es", src: "/subtitles/es.vtt" },
  { label: "Deutsch", lang: "de", src: "/subtitles/de.vtt" },
];

/** Deterministic stream pick so each title/episode maps to a source. */
export const hlsUrlFor = (seed: number) =>
  STREAM_URLS[seed % STREAM_URLS.length];
