import { apiClient, useAuth } from '@/context/AuthContext';
import { MealPlannerApis } from '@/services/api';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Spinner from '../components/ui/Spinner';

export default function Mealplanner() {
  const { token } = useAuth();
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState(null); // last /query result
  const [allApprovals, setAllApprovals] = useState([]);
  const [profile, setProfile] = useState([]);
  const [plans, setPlans] = useState([]);
  const [resolvingId, setResolvingId] = useState(null); // per-row spinner
  const [selectedPlan, setSelectedPlan] = useState<null | String>(null);

  const fetchApprovals = () => {
    if (!token) return;
    apiClient(token)
      .get(MealPlannerApis.approval)
      .then((res) => setAllApprovals(res.data.result || []))
      .catch((err) => console.log('fetchApprovals', err));
  };
  const fetchprofile = () => {
    if (!token) return;
    apiClient(token)
      .get(MealPlannerApis.profile)
      .then((res) => {
        setProfile(res.data.result || []);
      })
      .catch((err) => console.log('fetchApprovals', err));
  };
  const fetchplans = () => {
    if (!token) return;
    apiClient(token)
      .get(MealPlannerApis.plans)
      .then((res) => {
        setPlans(res.data.result || []);
        setSelectedPlan(res.data.result > 0 ? res.data.result[0].id : null);
      })
      .catch((err) => console.log('fetchApprovals', err));
  };

  useEffect(() => {
    fetchApprovals();
    fetchprofile();
    fetchplans();
  }, [token]);

  const handleAsk = () => {
    if (!inputText.trim() || loading) return;
    setLoading(true);
    setError('');
    setResponse(null);

    apiClient(token)
      .post(MealPlannerApis.query, { text: inputText, plan_id: selectedPlan })
      .then((res) => {
        const data = res.data;
        setResponse(data);
        // If the graph paused for approval, a new pending row exists — refresh.
        if (data.status === 'needs_approval') {
          fetchApprovals();
        }
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Something went wrong. Try again.');
      })
      .finally(() => setLoading(false));
  };
  const updateprofile = () => {
    apiClient(token)
      .patch(MealPlannerApis.profile, {
        diet: '',
        protien_target: 100,
        display_name: '',
      })
      .then((res) => {
        const data = res.data;
        setResponse(data);
        // If the graph paused for approval, a new pending row exists — refresh.
        if (data.status === 'needs_approval') {
          fetchApprovals();
        }
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Something went wrong. Try again.');
      })
      .finally(() => setLoading(false));
  };

  const resolve = (item, decision) => {
    setResolvingId(item.id);
    setError('');
    apiClient(token)
      .post(MealPlannerApis.approval, { thread_id: item.thread_id, decision })
      .then(() => fetchApprovals()) // re-pull so status flips
      .catch((err) => {
        // backend 404s if the thread is gone (e.g. server restarted on MemorySaver)
        setError(
          err?.response?.data?.detail ||
            'Could not resolve this approval — the request may have expired.'
        );
      })
      .finally(() => setResolvingId(null));
  };

  const handleClear = () => {
    setInputText('');
    setResponse(null);
    setError('');
  };

  // Pull a readable plan out of the proposal payload, if present
  const proposal = response?.status === 'needs_approval' ? response.proposal : null;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <Text className="text-xl font-bold text-gray-900">Meal planner</Text>
        <Text className="mt-1 text-sm text-gray-500">Plan your meals</Text>
      </View>

      {profile.length > 0 && (
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <Text className="mb-3 text-sm font-semibold text-gray-900">Available Profiles</Text>
          {profile.map((it) => (
            <TouchableOpacity
              onPress={() => {
                setSelectedPlan(it.id);
              }}
              key={it.id}
              className={`mb-2 rounded-xl border-2 p-2 ${'border-gray-100'} pb-2`}>
              <View className="flex-1">
                <Text className="text-sm text-gray-800">Profile: {it.display_name}</Text>
              </View>

              <View className="flex-row items-center gap-x-2">
                <Text className="text-sm text-gray-800">Diet: {it.diet},</Text>
                <Text className="text-sm text-gray-800">protein target: {it.protein_target}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {plans.length > 0 && (
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <Text className="mb-3 text-sm font-semibold text-gray-900">Your diet plans</Text>
          {plans.map((it, ind) => (
            <TouchableOpacity
              onPress={() => {
                setSelectedPlan(it.id);
              }}
              key={it.id}
              className={`mb-2 rounded-xl border-2 p-2 ${selectedPlan == it.id ? 'border-blue-400' : 'border-gray-100'} pb-2`}>
              <View className="flex-1">
                <Text className="text-sm text-gray-800">Plan: {ind + 1}</Text>
              </View>

              <View className="flex-row items-center gap-x-2">
                <Text className="text-sm text-gray-800">Week Starts: {it.week_start},</Text>
                <Text className="text-sm text-gray-800">Status: {it.status}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        {/* Input card */}
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <TextInput
            className="text-sm leading-relaxed text-gray-800 outline-none"
            style={{ minHeight: 128, textAlignVertical: 'top' }}
            placeholder={
              plans.length == 0
                ? 'you dont have any diet weekly diet plan yet lets first create plans tell your plan start day '
                : 'e.g. plan my meals for next week, or add paneer bhurji to Tuesday dinner'
            }
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            value={inputText}
            onChangeText={setInputText}
          />
          <View className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-3">
            <Text className="text-xs text-gray-400">
              {inputText.length.toLocaleString()} characters
            </Text>
            <View className="flex-row gap-2">
              {inputText.length > 0 && (
                <TouchableOpacity
                  onPress={handleClear}
                  className="rounded-lg bg-gray-100 px-4 py-3"
                  activeOpacity={0.7}>
                  <Text className="text-sm text-gray-600">Clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleAsk}
                disabled={!inputText.trim() || loading}
                className={`rounded-lg px-5 py-3 ${loading ? 'bg-gray-400' : 'bg-violet-600'} ${!inputText.trim() && !loading ? 'opacity-50' : ''}`}
                activeOpacity={0.8}>
                {loading ? (
                  <View className="flex-row items-center gap-2">
                    <Spinner size="small" color="white" />
                    <Text className="text-base font-medium text-white">Working…</Text>
                  </View>
                ) : (
                  <Text className="text-base font-medium text-white">Ask</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Plain text result (log / query / research responses) */}
        {response && response.status === 'done' && (
          <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <Text className="text-sm text-gray-800">
              {typeof response.result === 'string'
                ? response.result
                : JSON.stringify(response.result, null, 2)}
            </Text>
          </View>
        )}

        {/* Inline proposal from the just-submitted plan request */}
        {proposal && (
          <View className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <Text className="mb-2 text-sm font-semibold text-violet-900">
              Proposed plan — week of {proposal.week_start}
            </Text>
            {(proposal.plan || []).map((slot, i) => (
              <Text key={i} className="text-xs text-violet-800">
                Day {slot.day_of_week} · {slot.meal_type} · {slot.recipe_name}
                {slot.protein_g ? ` · ${slot.protein_g}g` : ''}
              </Text>
            ))}
            <Text className="mt-2 text-xs text-violet-500">
              Find it in the pending list below to approve.
            </Text>
          </View>
        )}

        {/* Approval queue */}
        {allApprovals.length > 0 && (
          <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <Text className="mb-3 text-sm font-semibold text-gray-900">Pending approvals</Text>
            {allApprovals.map((it) => (
              <View
                key={it.id}
                className="mb-2 flex-row items-center justify-between border-b border-gray-100 pb-2">
                <View className="flex-1">
                  <Text className="text-sm text-gray-800">{it.action_type}</Text>
                  <Text className="text-xs text-gray-400">Status: {it.status}</Text>
                </View>
                {it.status === 'pending' ? (
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      disabled={resolvingId === it.id}
                      onPress={() => resolve(it, 'approved')}
                      className="rounded-lg bg-green-600 px-3 py-2"
                      activeOpacity={0.8}>
                      {resolvingId === it.id ? (
                        <Spinner size="small" color="white" />
                      ) : (
                        <Text className="text-xs font-medium text-white">Approve</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={resolvingId === it.id}
                      onPress={() => resolve(it, 'rejected')}
                      className="rounded-lg bg-gray-200 px-3 py-2"
                      activeOpacity={0.8}>
                      <Text className="text-xs font-medium text-gray-700">Reject</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text className="text-xs text-gray-400 capitalize">{it.status}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {error ? (
          <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
