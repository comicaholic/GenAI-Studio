// frontend/src/services/history.ts
import { api } from './api';
import { SavedEvaluation, SavedChat, EvaluationSelection, SavedAutomation } from '@/types/history';

export const historyService = {
  // Evaluations
  async getEvaluations(): Promise<SavedEvaluation[]> {
    const response = await api.get('/history/evals');
    return response.data.evaluations;
  },

  async getEvaluation(id: string): Promise<SavedEvaluation> {
    const response = await api.get(`/history/evals/${id}`);
    return response.data;
  },

  async saveEvaluation(evaluation: SavedEvaluation): Promise<void> {
    await api.post('/history/evals', evaluation);
  },

  async deleteEvaluation(id: string): Promise<void> {
    await api.delete(`/history/evals/${id}`);
  },

  // Chats
  async getChats(): Promise<SavedChat[]> {
    const response = await api.get('/history/chats');
    return response.data.chats;
  },

  async getChat(id: string): Promise<SavedChat> {
    const response = await api.get(`/history/chats/${id}`);
    return response.data;
  },

  async saveChat(chat: SavedChat): Promise<void> {
    await api.post('/history/chats', chat);
  },

  async updateChat(id: string, chat: SavedChat): Promise<void> {
    await api.put(`/history/chats/${id}`, chat);
  },

  async deleteChat(id: string): Promise<void> {
    await api.delete(`/history/chats/${id}`);
  },

  // Export functionality
  exportSelection(selection: EvaluationSelection): void {
    const blob = new Blob([JSON.stringify(selection, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation-selection-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Automations
  async getAutomations(): Promise<SavedAutomation[]> {
    const response = await api.get('/history/automations');
    return response.data.automations;
  },

  async getAutomation(id: string): Promise<SavedAutomation> {
    const response = await api.get(`/history/automations/${id}`);
    return response.data;
  },

  async saveAutomation(automation: SavedAutomation): Promise<void> {
    await api.post('/history/automations', automation);
  },

  async deleteAutomation(id: string): Promise<void> {
    await api.delete(`/history/automations/${id}`);
  },

  // Get aggregated automation results for home page
  async getAutomationAggregates(): Promise<SavedAutomation[]> {
    try {
      // Backend serves this at /api/automations/aggregates (no /history prefix)
      const response = await api.get('/automations/aggregates');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.warn('Failed to fetch automation aggregates:', error);
      return [];
    }
  },
};

