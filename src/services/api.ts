export const BASE_URL = __DEV__
  ? 'http://192.168.0.151:8000/api'
  : 'https://genai-back.vercel.app/api';

export const UserApis = {
  guest: '/user/guest',
  convertGuest: '/user/convert-guest',
  me: '/user/me',
  signup: '/user/signup',
  login: '/user/login',
  pushToken: '/user/me/expo-push-token',
};

export const RagApis = {
  getallFiles: '/rag/get-files',
  getallChats: '/chat',
  getallMessages: (id: string) => '/chat/'.concat(id, '/messages'),
};
export const LearningTrackerApis = {
  query: BASE_URL + '/learning/query',
  approvals: BASE_URL + '/learning/approvals',
  meals: (planId: string) => BASE_URL + 'learning/meal-slots/'.concat(planId),
  roadmaps: BASE_URL + '/learning/roadmaps',
};
export const LearningApis = {
  query: BASE_URL + '/learning/query',
  approvals: BASE_URL + '/learning/approvals',
  roadmaps: BASE_URL + '/learning/roadmaps',
  progress: BASE_URL + '/learning/progress',
  submitQuiz: BASE_URL + '/learning/submit-quiz',
  memory: BASE_URL + '/learning/memory',
  toggleTrigger: BASE_URL + '/learning/toggle-trigger',
  digests: BASE_URL + '/learning/digests',
};

// Meal Planner endpoints live in the self-contained feature module:
// src/features/meal-planner/mealPlannerApi.ts
