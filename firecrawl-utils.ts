/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {ApiConfig} from './config';
import {fetchWithRetry} from './utils';

export interface ScrapeResult {
  success: boolean;
  data?: {
    markdown: string;
    metadata: {
      title: string;
      sourceURL: string;
    };
  };
  error?: string;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  // DANGER: SECURITY RISK
  // The API key is exposed on the client side.
  // This is not secure. In a production environment, this key should be
  // protected by a backend proxy. The client should make a request to your
  // own server, which then securely attaches the API key and calls the
  // Firecrawl API.
  //
  // For this example, the key is included for functionality, but it is
  // strongly recommended to replace this with a secure solution.
  const firecrawlApiKey = ApiConfig.FIRECRAWL;

  if (!firecrawlApiKey) {
    console.error('Firecrawl API key is not set.');
    return {
      success: false,
      error: 'A chave da API do Firecrawl não está configurada.',
    };
  }

  try {
    const response = await fetchWithRetry('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firecrawlApiKey}`,
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown'],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Falha na chamada da API do Firecrawl: ${
          errorData.error || response.statusText
        }`,
      );
    }

    const result = await response.json();
    if (result.success && result.data) {
      return result;
    } else {
      throw new Error(
        result.error ||
          'A API do Firecrawl retornou uma resposta malsucedida ou sem dados.',
      );
    }
  } catch (e) {
    console.error('Erro ao fazer scrap da URL:', e);
    return {success: false, error: (e as Error).message};
  }
}
