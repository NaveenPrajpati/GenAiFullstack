export const BASE_URL = __DEV__
  ? 'http://192.168.0.151:8000/api'
  : 'https://aiengineer.duckdns.org/api';

export const UserApis = {
  guest: '/user/guest',
  convertGuest: '/user/convert-guest',
  me: '/user/me',
  signup: '/user/signup',
  login: '/user/login',
  logout: '/user/logout',
  refresh: '/users/refresh',
  forgotPassword: '/user/forgot-password',
  resetPassword: '/user/reset-password',
  verifyEmail: '/user/verify-email',
  resendVerification: '/user/resend-verification',
  pushToken: '/user/me/expo-push-token',
};

export const RagApis = {
  ingestFile: '/rag/ingest',
  getallFiles: '/rag/get-files',
  deleteFile: (id: string) => '/rag/ingest/'.concat(id),
  getallChats: '/chat',
  getallMessages: (id: string) => '/chat/'.concat(id, '/messages'),
  deleteChat: (id: string) => '/chat/'.concat(id),
};
// Learning Tracker endpoints live in the feature module: see
// `@/features/learning/learningApi`.
