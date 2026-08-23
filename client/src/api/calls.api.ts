import { api } from './client.js';
import { ApiResponse } from '../types/index.js';

export interface IceConfiguration {
  enabled: boolean;
  iceServers: RTCIceServer[];
  reason?: string;
}

export const callsApi = {
  async getIceConfiguration(): Promise<IceConfiguration> {
    const response = await api.get<ApiResponse<IceConfiguration>>('/calls/ice-config');
    return response.data.data;
  }
};
