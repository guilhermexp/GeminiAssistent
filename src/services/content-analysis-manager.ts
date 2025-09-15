/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '@google/genai';
import {AnalysisService} from './analysis-service';
import {generateCompositeSystemInstruction} from '../utils/system-instruction-builder';
import type {Analysis, AnalysisCallbacks} from '../types/types';

/**
 * Manages the business logic of analyzing content and preparing the results
 * for the main application component.
 */
export class ContentAnalysisManager {
  private analysisService: AnalysisService;

  constructor(client: GoogleGenAI) {
    this.analysisService = new AnalysisService(client);
  }

  /**
   * Processes a new analysis request.
   * @param urlOrTopic The URL or topic to analyze.
   * @param file The file to analyze, if any.
   * @param currentAnalyses The existing list of analyses.
   * @param callbacks Callbacks for updating UI state during processing.
   * @returns A promise that resolves with the updated analysis list, the new
   * system instruction, and the newly created analysis object.
   */
  public async handleAnalysisRequest(
    urlOrTopic: string,
    file: File | null,
    analysisMode: 'default' | 'vibecode' | 'workflow',
    currentAnalyses: Analysis[],
    activePersona: string | null,
    callbacks: AnalysisCallbacks,
  ): Promise<{
    newAnalyses: Analysis[];
    newSystemInstruction: string;
    newAnalysis: Analysis;
  }> {
    const result = await this.analysisService.analyze(
      urlOrTopic,
      file,
      analysisMode,
      callbacks,
    );

    callbacks.setProcessingState(
      true,
      'Análise recebida. Configurando assistente...',
      95,
    );

    const newAnalysis: Analysis = {
      id: Date.now().toString(),
      title: result.title,
      source: result.source,
      summary: result.summary,
      type: result.type,
      persona: result.persona,
      previewData: result.previewData,
      tags: result.tags,
    };

    const newAnalyses = [...currentAnalyses, newAnalysis];
    const newSystemInstruction = generateCompositeSystemInstruction(
      newAnalyses,
      activePersona,
    );

    return {newAnalyses, newSystemInstruction, newAnalysis};
  }
}