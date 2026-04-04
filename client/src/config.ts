import type { DailyConnectionEndpoint } from '@pipecat-ai/daily-transport';
import type { APIRequest } from '@pipecat-ai/client-js';

export type TransportType = 'daily' | 'smallwebrtc';

export const AVAILABLE_TRANSPORTS: TransportType[] = ['daily', 'smallwebrtc'];

export const TRANSPORT_LABELS: Record<TransportType, string> = {
  daily: 'Daily',
  smallwebrtc: 'SmallWebRTC',
};

export const DEFAULT_TRANSPORT: TransportType =
  (import.meta.env.VITE_TRANSPORT as TransportType) || 'smallwebrtc';

export const botBaseUrl =
  import.meta.env.VITE_BOT_BASE_URL || 'http://localhost:7860';

const botStartUrl = `${botBaseUrl}/start`;

if (!import.meta.env.VITE_BOT_START_URL) {
  console.warn(
    'VITE_BOT_START_URL not configured, using default: http://localhost:7860/start',
  );
}

const dailyConfig: DailyConnectionEndpoint = {
  endpoint: botStartUrl,
  requestData: {
    createDailyRoom: true,
    dailyRoomProperties: { start_video_off: true },
    transport: 'daily',
  },
};

const smallWebRTCConfig: APIRequest = {
  endpoint: botStartUrl,
  requestData: {
    createDailyRoom: false,
    enableDefaultIceServers: true,
    transport: 'webrtc',
  },
};

export const TRANSPORT_CONFIG: Record<
  TransportType,
  DailyConnectionEndpoint | APIRequest
> = {
  daily: dailyConfig,
  smallwebrtc: smallWebRTCConfig,
};
