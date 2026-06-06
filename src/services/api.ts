import { Platform } from 'react-native';

export const BASE_URL =
  Platform.OS == 'web' ? 'http://127.0.0.1:8000/api' : 'http://192.168.0.151:8000/api';

export const UserApis = {
  guest: '/user/guest',
  convertGuest: '/user/convert-guest',
  me: '/user/me',
  signup: '/user/signup',
  login: '/user/login',
};

export const RagApis = {
  getallFiles: '/rag/get-files',
  getallChats: '/chat',
  getallMessages: (id: string) => '/chat/'.concat(id, '/messages'),
};
export const MealPlannerApis = {
  query: BASE_URL + '/meal-planner/query',
  approval: BASE_URL + '/meal-planner/approve',
  profile: BASE_URL + '/meal-planner/profile',
  plans: BASE_URL + '/meal-planner/plans',
  getallChats: '/chat',
  getallMessages: (id: string) => '/chat/'.concat(id, '/messages'),
};
