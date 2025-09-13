import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Plan, PlanSettings, PlanPrice } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface UsePlanSettingsResult {
  plans: Plan[];
  planSettings: PlanSettings[];
  loading: boolean;
  error: string | null;
  fetchPlanData: () => Promise<void>;
}

export function usePlanSettings(): UsePlanSettingsResult {
  const { developerLog } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planSettings, setPlanSettings] = useState<PlanSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlanData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      developerLog('📊 Fetching plan data from Supabase...');

      // Fetch plans
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select('*')
        .order('name', { ascending: true }); // Order by name as 'price' is no longer a direct column

      if (plansError) {
        console.error('❌ Error fetching plans:', plansError);
        throw plansError;
      }

      // Fetch plan settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('plan_settings')
        .select('plan_id, max_team_members, max_questions_custom_quiz, question_tier_access, allow_quick_start_quiz, allow_create_own_quiz, allow_study_schedule_quiz, allow_analytics_access, allow_mock_test_creation, allow_test_assignments, created_at, updated_at');

      if (settingsError) {
        console.error('❌ Error fetching plan settings:', settingsError);
        throw settingsError;
      }

      // NEW: Fetch plan prices
      const { data: pricesData, error: pricesError } = await supabase
        .from('plan_prices')
        .select('*');

      if (pricesError) {
        console.error('❌ Error fetching plan prices:', pricesError);
        throw pricesError;
      }

      // Map prices to their respective plans
      const plansWithPrices: Plan[] = (plansData || []).map(plan => {
        const planPrices = (pricesData || []) as PlanPrice[]; // Cast to PlanPrice[]
        const filteredPrices = planPrices.filter(price => price.plan_id === plan.id);
        return {
          ...plan,
          prices: filteredPrices,
        };
      });

      developerLog('✅ Plans fetched successfully:', plansWithPrices.length, 'plans');
      developerLog('DEBUG: plansWithPrices before setting state:', JSON.stringify(plansWithPrices, null, 2));
      developerLog('DEBUG: Raw prices data from DB:', JSON.stringify(pricesData, null, 2));
      setPlans(plansWithPrices);

      developerLog('✅ Plan settings fetched successfully:', settingsData?.length || 0, 'settings');
      setPlanSettings(settingsData || []);

    } catch (err) {
      console.error('💥 Error fetching plan data:', err);
      setError('Failed to load plan data.');
    } finally {
      setLoading(false);
    }
  }, [developerLog]);

  useEffect(() => {
    fetchPlanData();
  }, [fetchPlanData]);

  return { plans, planSettings, loading, error, fetchPlanData };
}
