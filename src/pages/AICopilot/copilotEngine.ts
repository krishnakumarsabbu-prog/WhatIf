import { apiClient } from '@/api/client';

export interface CopilotMessage {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  timestamp: string;
}

export async function generateCopilotResponse(userInput: string): Promise<string> {
  const { data } = await apiClient.post('/copilot/chat', {
    message: userInput,
    history: [],
  });
  return data.reply ?? 'No response from copilot.';
}
