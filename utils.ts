/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {Blob} from '@google/genai';

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // convert float32 -1 to 1 to int16 -32768 to 32767
    int16[i] = data[i] * 32768;
  }

  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const buffer = ctx.createBuffer(
    numChannels,
    data.length / 2 / numChannels,
    sampleRate,
  );

  const dataInt16 = new Int16Array(data.buffer);
  const l = dataInt16.length;
  const dataFloat32 = new Float32Array(l);
  for (let i = 0; i < l; i++) {
    dataFloat32[i] = dataInt16[i] / 32768.0;
  }
  // Extract interleaved channels
  if (numChannels === 1) {
    buffer.copyToChannel(dataFloat32, 0);
  } else {
    for (let i = 0; i < numChannels; i++) {
      const channel = dataFloat32.filter(
        (_, index) => index % numChannels === i,
      );
      buffer.copyToChannel(channel, i);
    }
  }

  return buffer;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
}

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = (error) => reject(error);
  });
}

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 3,
  backoff = 500,
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      // Retry only on 5xx server errors or network failures.
      if (response.status >= 500 && i < retries - 1) {
        // This will be caught and retried.
        throw new Error(`Server error: ${response.status}`);
      }
      // For success (2xx) or client errors (4xx), return immediately.
      return response;
    } catch (err) {
      if (i === retries - 1) {
        console.error(`Fetch failed after ${retries} attempts for ${url}:`, err);
        throw err;
      }
      // Exponential backoff: 500ms, 1000ms, 2000ms
      const delay = backoff * 2 ** i;
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  // This line is theoretically unreachable but required for TypeScript.
  throw new Error('Fetch failed after multiple retries.');
}

export {
  createBlob,
  decode,
  decodeAudioData,
  encode,
  fileToBase64,
  fileToArrayBuffer,
  fetchWithRetry,
};