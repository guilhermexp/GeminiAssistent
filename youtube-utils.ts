/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {fetchWithRetry} from './utils';

// Function to extract YouTube video ID
export const getYouTubeVideoId = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    if (
      (parsedUrl.hostname === 'www.youtube.com' ||
        parsedUrl.hostname === 'youtube.com') &&
      parsedUrl.searchParams.has('v')
    ) {
      const videoId = parsedUrl.searchParams.get('v');
      if (videoId && videoId.length === 11) return videoId;
    }
    if (parsedUrl.hostname === 'youtu.be') {
      const videoId = parsedUrl.pathname.slice(1);
      if (videoId && videoId.length === 11) return videoId;
    }
    if (parsedUrl.pathname.startsWith('/embed/')) {
      const videoId = parsedUrl.pathname.substring(7);
      if (videoId && videoId.length === 11) return videoId;
    }
  } catch (e) {
    // Fallback for non-URL strings
  }
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

// Helper function to validate a YouTube video URL
export async function validateYoutubeUrl(
  url: string,
): Promise<{isValid: boolean; error?: string}> {
  if (!getYouTubeVideoId(url)) {
    return {isValid: false, error: 'Formato de URL do YouTube inválido.'};
  }
  // Further validation by checking if oEmbed works
  try {
    await getYouTubeVideoTitle(url);
    return {isValid: true};
  } catch (e) {
    return {isValid: false, error: (e as Error).message};
  }
}

// Helper function to extract YouTube video ID and create embed URL
export function getYoutubeEmbedUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
  }
  return null;
}

export async function getYouTubeVideoTitle(url: string): Promise<string> {
  const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    url,
  )}&format=json`;

  try {
    // This endpoint has CORS enabled, so it can be called from the browser.
    const response = await fetchWithRetry(oEmbedUrl);
    if (response.status === 404) {
      throw new Error(
        'Vídeo não encontrado. Pode ser privado ou ter sido excluído.',
      );
    }
    if (!response.ok) {
      throw new Error('Não foi possível buscar detalhes do vídeo no YouTube.');
    }
    const data = await response.json();
    if (data && data.title) {
      return String(data.title);
    } else {
      throw new Error(
        'Não foi possível extrair o título da resposta do YouTube.',
      );
    }
  } catch (e) {
    console.error('Failed to fetch YouTube title:', e);
    throw new Error(
      'Ocorreu um erro ao buscar as informações do vídeo. Verifique o console.',
    );
  }
}

// Simple URL validator
export const isValidUrl = (string: string): boolean => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};
