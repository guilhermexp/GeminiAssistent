/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// =================================================================
// TYPE DEFINITIONS
// =================================================================
export interface SearchResult {
  uri: string;
  title: string;
}

export interface Analysis {
  id: string;
  title: string;
  source: string;
  summary: string;
  type:
    | 'youtube'
    | 'github'
    | 'spreadsheet'
    | 'file'
    | 'search'
    | 'url'
    | 'video'
    | 'workflow';
  persona: 'assistant' | 'analyst';
  previewData?: string;
}

export interface TimelineEvent {
  timestamp: string;
  message: string;
  type:
    | 'info'
    | 'success'
    | 'error'
    | 'record'
    | 'process'
    | 'connect'
    | 'disconnect'
    | 'history';
}

export interface ProcessingState {
  active: boolean;
  step: string;
  progress: number;
}

export interface AnalysisResult {
  summary: string;
  title: string;
  source: string;
  persona: Analysis['persona'];
  type: Analysis['type'];
  previewData?: string;
}

export interface AnalysisCallbacks {
  setProcessingState: (
    active: boolean,
    step?: string,
    progress?: number,
  ) => void;
  logEvent: (message: string, type: TimelineEvent['type']) => void;
}

export interface SavedSession {
  id: string;
  title: string;
  analyses: Analysis[];
  timelineEvents: TimelineEvent[];
  systemInstruction: string;
  searchResults: SearchResult[];
  activePersona: string | null;
}