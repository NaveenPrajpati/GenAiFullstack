import { Platform } from 'react-native';

export const BASE_URL =
  Platform.OS == 'web' ? 'http://127.0.0.1:8000/api' : 'http://192.168.0.151:8000/api';

export const RagApis = {
  getallFiles: '/rag/get-files',
  getallChats: '/chat',
  getallMessages: (id: string) => '/chat/'.concat(id, '/messages'),
};
