/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Centralized configuration for third-party API keys.
 *
 * All API keys should be loaded from environment variables for security.
 * This file centralizes access to those variables.
 */
export const ApiConfig = {
  /**
   * The API key for the Firecrawl service.
   * This MUST be configured as an environment variable named FIRECRAWL_API_KEY.
   */
  FIRECRAWL: process.env.FIRECRAWL_API_KEY,
};
