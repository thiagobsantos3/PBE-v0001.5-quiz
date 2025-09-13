import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { QuizSession, QuizResult } from '../types';
import { XP_PER_LEVEL, calculateLevel } from '../constants/gamification';
import { isSameDay, getUtcMidnight } from '../utils/dateUtils';
import { checkAndMarkAssignmentCompleted } from '../utils/assignmentUpdates';
import { calculateCurrentStudyStreak, calculateLongestStudyStreak } from '../utils/quizHelpers';

// Bonus XP for completing study assignments on time
const STUDY_SCHEDULE_BONUS_XP = 10;

interface QuizCompletionResult {
  success: boolean;
  error?: string;
  bonusXp?: number;
  suspicionStatus?: 'green' | 'amber' | 'red';
  suspicionScore?: number;
}

export function useQuizCompletionProcessor() {
  const { user, developerLog, refreshUser } = useAuth();
  const { showNotification } = useNotification();

  // Helper to calculate bonus XP for on-time assignment completion
  const calculateBonusXp = useCallback(async (session: QuizSession): Promise<number> => {
    if (!session.assignment_id) return 0;

    try {
      developerLog('📅 Checking for on-time completion bonus for assignment:', session.assignment_id);
      
      const { data: assignment, error: assignmentError } = await supabase
        .from('study_assignments')
        .select('date')
        .eq('id', session.assignment_id)
        .single();
      
      if (assignmentError || !assignment) {
        developerLog('⚠️ Could not fetch assignment date for bonus XP check:', assignmentError);
        return 0;
      }

      const assignmentDate = new Date(assignment.date);
      const completedDate = new Date(session.completed_at || new Date());
      
      if (isSameDay(assignmentDate, completedDate)) {
        developerLog('🎉 On-time completion bonus earned:', STUDY_SCHEDULE_BONUS_XP, 'XP');
        return STUDY_SCHEDULE_BONUS_XP;
      } else {
        developerLog('📅 Assignment completed on different day - no bonus XP');
        return 0;
      }
    } catch (error) {
      developerLog('💥 Error checking for bonus XP:', error);
      return 0;
    }
  }, [developerLog]);

  // Helper to update user stats with proper transaction handling
  const updateUserStats = useCallback(async (bonusXp: number): Promise<void> => {
    if (!user) return;

    try {
      // Get current user stats
      const { data: currentUserStats, error: statsError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (statsError) throw statsError;

      developerLog('📊 Current user stats from database:', currentUserStats);

      // Recalculate total XP from ALL completed quiz sessions to ensure accuracy
      const { data: allCompletedSessions, error: allSessionsError } = await supabase
        .from('quiz_sessions')
        .select('total_points')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (allSessionsError) throw allSessionsError;

      // Calculate total XP from all completed sessions plus bonus XP
      const totalXpFromAllSessions = (allCompletedSessions || []).reduce((sum, session) => {
        return sum + (Number(session.total_points) || 0);
      }, 0);

      const newTotalXp = totalXpFromAllSessions + bonusXp;
      
      developerLog('🔍 XP recalculation from all sessions:', {
        allCompletedSessionsCount: allCompletedSessions?.length || 0,
        totalXpFromAllSessions,
        bonusXp,
        finalNewTotalXp: newTotalXp,
        previousTotalXp: currentUserStats?.total_xp || 0
      });

      // Calculate new level
      const newCurrentLevel = calculateLevel(newTotalXp);

      // Recalculate study streak
      const { data: allCompletedSessionsForStreak, error: sessionsError } = await supabase
        .from('quiz_sessions')
        .select('completed_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      const currentStudyStreak = calculateCurrentStudyStreak(allCompletedSessionsForStreak || []);
      const trueHistoricalLongestStreak = calculateLongestStudyStreak(allCompletedSessionsForStreak || []);

      developerLog('📈 Streak calculation:', {
        currentStudyStreak,
        trueHistoricalLongestStreak,
        previousLongestStreak: currentUserStats?.longest_streak || 0
      });

      // Prepare stats to upsert
      const statsToUpsert = {
        user_id: user.id,
        total_xp: newTotalXp,
        current_level: newCurrentLevel,
        longest_streak: trueHistoricalLongestStreak,
        last_quiz_date: new Date().toISOString().split('T')[0],
      };

      developerLog('💾 About to upsert user stats:', statsToUpsert);

      // Update user stats
      const { error: upsertStatsError } = await supabase
        .from('user_stats')
        .upsert(statsToUpsert, { onConflict: 'user_id' });

      if (upsertStatsError) throw upsertStatsError;

      developerLog('✅ User stats successfully updated:', statsToUpsert);

    } catch (error) {
      developerLog('💥 Error updating user stats:', error);
      throw error;
    }
  }, [user, developerLog]);

  // Helper to check and unlock achievements
  const checkAchievements = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      // Get all achievements
      const { data: allAchievements, error: achievementsError } = await supabase
        .from('achievements')
        .select('*');

      if (achievementsError) throw achievementsError;

      // Get user's unlocked achievements
      const { data: userUnlockedAchievements, error: userAchievementsError } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', user.id);

      if (userAchievementsError) throw userAchievementsError;

      const unlockedAchievementIds = new Set(userUnlockedAchievements?.map(ua => ua.achievement_id) || []);

      // Check each achievement
      for (const achievement of allAchievements || []) {
        if (unlockedAchievementIds.has(achievement.id)) continue;

        let criteriaMet = false;

        switch (achievement.criteria_type) {
          case 'total_quizzes_completed':
            const { count: totalQuizzesCount, error: countError } = await supabase
              .from('quiz_sessions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'completed');

            if (countError) throw countError;
            criteriaMet = (totalQuizzesCount || 0) >= achievement.criteria_value;
            break;

          case 'total_points_earned':
            const { data: userStats, error: statsError } = await supabase
              .from('user_stats')
              .select('total_xp')
              .eq('user_id', user.id)
              .single();

            if (!statsError && userStats) {
              criteriaMet = userStats.total_xp >= achievement.criteria_value;
            }
            break;

          case 'longest_streak':
            const { data: streakStats, error: streakError } = await supabase
              .from('user_stats')
              .select('longest_streak')
              .eq('user_id', user.id)
              .single();

            if (!streakError && streakStats) {
              criteriaMet = streakStats.longest_streak >= achievement.criteria_value;
            }
            break;

          default:
            developerLog('⚠️ Unknown achievement criteria type:', achievement.criteria_type);
            break;
        }

        if (criteriaMet) {
          // Unlock achievement
          const { error: insertError } = await supabase
            .from('user_achievements')
            .insert({
              user_id: user.id,
              achievement_id: achievement.id,
              unlocked_at: new Date().toISOString()
            });

          if (insertError) {
            developerLog('❌ Error unlocking achievement:', insertError);
            continue;
          }

          developerLog('🏆 Achievement unlocked:', achievement.name);
          showNotification('achievement', achievement);
        }
      }
    } catch (error) {
      developerLog('💥 Error checking achievements:', error);
      // Don't throw here to avoid disrupting the main flow
    }
  }, [user, developerLog, showNotification]);

  // Helper to calculate suspicion metrics
  const calculateSuspicionMetrics = useCallback(async (sessionId: string): Promise<{
    suspicionStatus: 'green' | 'amber' | 'red';
    suspicionScore: number;
    suspiciousSummary: any;
  }> => {
    try {
      const { data: timeAgg, error: timeErr } = await supabase
        .from('quiz_question_logs')
        .select('time_spent, is_correct, show_answer_used, total_points_possible, question_id, answered_at, points_earned')
        .eq('quiz_session_id', sessionId);

      if (timeErr || !Array.isArray(timeAgg)) {
        developerLog('⚠️ Could not fetch question logs for suspicion analysis:', timeErr);
        return {
          suspicionStatus: 'green',
          suspicionScore: 0,
          suspiciousSummary: {}
        };
      }

      // Get quiz session to access questions array
      const { data: sessionData, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('questions')
        .eq('id', sessionId)
        .single();

      if (sessionError || !sessionData?.questions) {
        developerLog('⚠️ Could not fetch session questions for suspicion analysis:', sessionError);
        return {
          suspicionStatus: 'green',
          suspicionScore: 0,
          suspiciousSummary: {}
        };
      }

      // Create question lookup map
      const questionsArray: any[] = Array.isArray(sessionData.questions) ? sessionData.questions : [];
      const questionById = new Map<string, any>(questionsArray.map((q: any) => [q?.id, q]));
      
      const normalizeText = (s: any): string => typeof s === 'string' ? s : '';
      const countWords = (s: string): number => {
        const trimmed = s.trim();
        if (!trimmed) return 0;
        const parts = trimmed.split(/\s+/);
        return parts.filter(Boolean).length;
      };

      // Sort logs by answered_at when available to compute windows and streaks
      const logs = [...timeAgg].sort((a: any, b: any) => {
        const ta = a?.answered_at ? new Date(a.answered_at).getTime() : 0;
        const tb = b?.answered_at ? new Date(b.answered_at).getTime() : 0;
        return ta - tb;
      });

      const total = Math.max(1, logs.length);
      let countFastCorrect = 0;
      let countUltraFast = 0;
      let countZeroOne = 0;
      let countShowAnswerFast = 0;
      let countHighPointUltraFast = 0;
      let countWordyUltraFast = 0;
      let countTimeRatioLow = 0;

      let numFast2OrLess = 0;
      let numFast2OrLessCorrect = 0;

      // Points-weighted accumulators
      let totalPointsPossibleSum = 0;
      let ptsUltraFastSum = 0;
      let ptsTimeRatioLowSum = 0;

      // Totals for throughput and entropy
      let totalPointsEarnedSum = 0;
      let totalTimeSum = 0;
      let sumTimeSq = 0;
      let correctCount = 0;

      let maxConsecutiveFast2OrLess = 0;
      let currentStreakFast2OrLess = 0;

      // Sliding window checks
      const windowSize = 10;
      let flagWindowManyFast3OrLess = false;
      let flagWindowManyHighValueFast = false;

      const perLog: { time: number; correct: boolean; pts: number }[] = [];

      for (const r of logs as any[]) {
        const pts = Number(r?.total_points_possible) || 1;
        const time = Number(r?.time_spent) || 0;
        const correct = !!r?.is_correct;
        const showAns = !!r?.show_answer_used;
        const earned = Number(r?.points_earned) || (correct ? pts : 0);
        const qId = r?.question_id as string | undefined;
        const qMeta = qId ? questionById.get(qId) : undefined;
        const qText = normalizeText(qMeta?.question);
        const aText = normalizeText(qMeta?.answer);
        const qWords = countWords(qText);
        const aWords = countWords(aText);

        const tmin = Math.max(2, 2 * pts);
        // Stronger reading-time model: ~0.4s per word for question + answer
        const expected = tmin + 0.4 * (qWords + aWords);

        const fastCorrect = correct && time > 0 && time < tmin;
        const ultraFastCorrect = correct && time <= 2;
        const zeroOneCorrect = correct && time <= 1;
        const showAnswerFast = showAns && correct && time <= 2;
        const highPointUltraFast = correct && pts >= 4 && time <= 2;
        const severeHighPointUltraFast = correct && pts >= 6 && time <= 2;
        const wordyUltraFast = correct && (qWords + aWords) >= 14 && time <= 2;
        const timeRatioLow = correct && expected > 0 && (time / expected) <= 0.3;

        if (fastCorrect) countFastCorrect++;
        if (ultraFastCorrect) countUltraFast++;
        if (zeroOneCorrect) countZeroOne++;
        if (showAnswerFast) countShowAnswerFast++;
        if (highPointUltraFast) countHighPointUltraFast++;
        if (wordyUltraFast) countWordyUltraFast++;
        if (timeRatioLow) countTimeRatioLow++;

        // Points sums
        totalPointsPossibleSum += pts;
        if (ultraFastCorrect) ptsUltraFastSum += pts;
        if (timeRatioLow) ptsTimeRatioLowSum += pts;

        // Totals for throughput and entropy
        totalPointsEarnedSum += earned;
        totalTimeSum += time;
        sumTimeSq += time * time;
        if (correct) correctCount++;

        if (time <= 2) {
          numFast2OrLess++;
          if (correct) numFast2OrLessCorrect++;
          currentStreakFast2OrLess += 1;
        } else {
          currentStreakFast2OrLess = 0;
        }
        if (currentStreakFast2OrLess > maxConsecutiveFast2OrLess) {
          maxConsecutiveFast2OrLess = currentStreakFast2OrLess;
        }

        perLog.push({ time, correct, pts });
      }

      // Window scans for density patterns
      for (let i = 0; i < perLog.length; i++) {
        const j = Math.min(perLog.length, i + windowSize);
        const window = perLog.slice(i, j);
        if (window.length === 0) continue;
        const fast3OrLessCount = window.filter(x => x.time <= 3).length;
        if (fast3OrLessCount >= 8) {
          flagWindowManyFast3OrLess = true;
        }
        const highValueFastCount = window.filter(x => x.pts >= 6 && x.time <= 3).length;
        if (highValueFastCount >= 3) {
          flagWindowManyHighValueFast = true;
        }
        if (flagWindowManyFast3OrLess && flagWindowManyHighValueFast) break;
      }

      const fastCorrectRate = countFastCorrect / total;
      const ultraFastRate = countUltraFast / total;
      const zeroOneRate = countZeroOne / total;
      const showAnswerFastRate = countShowAnswerFast / total;
      const highPointUltraFastRate = countHighPointUltraFast / total;
      const severeHighPointUltraFastFlag = logs.some((r: any) => {
        const pts = Number(r?.total_points_possible) || 1;
        const time = Number(r?.time_spent) || 0;
        const correct = !!r?.is_correct;
        return correct && pts >= 6 && time <= 2;
      }) ? 1 : 0;
      const wordyUltraFastRate = countWordyUltraFast / total;
      const timeRatioLowRate = countTimeRatioLow / total;

      const fast2Share = numFast2OrLess / total;
      const fast2Accuracy = numFast2OrLess > 0 ? (numFast2OrLessCorrect / numFast2OrLess) : 0;
      const speedAccuracyFlag = (fast2Share >= 0.3 && fast2Accuracy >= 0.9) ? 1 : 0;

      const streakOrBlockFlag = (maxConsecutiveFast2OrLess >= 5 || flagWindowManyFast3OrLess || flagWindowManyHighValueFast) ? 1 : 0;

      // Points-weighted shares
      const pointsWeightedUltraFastShare = total > 0 && totalPointsPossibleSum > 0 ? (ptsUltraFastSum / totalPointsPossibleSum) : 0;
      const pointsWeightedTimeRatioLowShare = total > 0 && totalPointsPossibleSum > 0 ? (ptsTimeRatioLowSum / totalPointsPossibleSum) : 0;

      // Points-per-second throughput (overall and windowed)
      const overallPtsPerSec = totalTimeSum > 0 ? (totalPointsEarnedSum / totalTimeSum) : 0;
      let windowHighPpsFlag = 0;
      for (let i = 0; i < logs.length; i++) {
        const j = Math.min(logs.length, i + windowSize);
        let wPts = 0; let wTime = 0;
        for (let k = i; k < j; k++) {
          const rr: any = logs[k];
          const earned = Number(rr?.points_earned) || (rr?.is_correct ? (Number(rr?.total_points_possible) || 1) : 0);
          const t = Number(rr?.time_spent) || 0;
          wPts += earned; wTime += t;
        }
        if (wTime > 0 && (wPts / wTime) >= 1.0) { windowHighPpsFlag = 1; break; }
      }

      // Inter-question latency (submissions delta)
      let lowLatencyCount = 0; let trans = 0; let lowLatencyWindowFlag = 0;
      for (let i = 1; i < logs.length; i++) {
        const prev = logs[i-1]; const cur = logs[i];
        const tPrev = prev?.answered_at ? new Date(prev.answered_at).getTime() : 0;
        const tCur = cur?.answered_at ? new Date(cur.answered_at).getTime() : 0;
        if (tPrev > 0 && tCur > 0) {
          const dtSec = (tCur - tPrev) / 1000;
          trans++;
          if (dtSec <= 1) lowLatencyCount++;
        }
      }
      const lowLatencyRate = trans > 0 ? (lowLatencyCount / trans) : 0;
      // Windowed latency dense: 10 consecutive transitions with >=6 under 1s
      for (let i = 1; i + 10 <= logs.length; i++) {
        let cnt = 0;
        let considered = 0;
        for (let k = i; k < Math.min(logs.length, i + 10); k++) {
          const p = logs[k-1]; const c = logs[k];
          const tp = p?.answered_at ? new Date(p.answered_at).getTime() : 0;
          const tc = c?.answered_at ? new Date(c.answered_at).getTime() : 0;
          if (tp > 0 && tc > 0) {
            considered++;
            if (((tc - tp) / 1000) <= 1) cnt++;
          }
        }
        if (considered >= 8 && cnt >= 6) { lowLatencyWindowFlag = 1; break; }
      }

      // Timing entropy (coefficient of variation) and accuracy
      const meanTime = logs.length > 0 ? (totalTimeSum / logs.length) : 0;
      const variance = logs.length > 1 ? Math.max(0, (sumTimeSq / logs.length) - (meanTime * meanTime)) : 0;
      const stdDev = Math.sqrt(variance);
      const cv = meanTime > 0 ? (stdDev / meanTime) : 1;
      const accuracyRate = total > 0 ? (correctCount / total) : 0;
      const lowEntropyHighAccuracyFlag = (cv <= 0.25 && accuracyRate >= 0.9) ? 1 : 0;

      // Calculate final suspicion score
      let score = 0.30 * pointsWeightedUltraFastShare
                + 0.18 * pointsWeightedTimeRatioLowShare
                + 0.15 * timeRatioLowRate
                + 0.12 * wordyUltraFastRate
                + 0.04 * highPointUltraFastRate
                + 0.04 * severeHighPointUltraFastFlag
                + 0.02 * speedAccuracyFlag
                + 0.02 * streakOrBlockFlag
                + 0.09 * (overallPtsPerSec >= 0.8 ? 1 : 0)
                + 0.06 * windowHighPpsFlag
                + 0.04 * (lowLatencyRate >= 0.3 ? 1 : 0)
                + 0.04 * lowLatencyWindowFlag
                + 0.04 * lowEntropyHighAccuracyFlag;

      if (score > 1) score = 1;
      const status = score >= 0.25 ? 'red' : score >= 0.15 ? 'amber' : 'green';

      const summary = {
        fastCorrectRate: Number(fastCorrectRate.toFixed(3)),
        ultraFastRate: Number(ultraFastRate.toFixed(3)),
        zeroOneRate: Number(zeroOneRate.toFixed(3)),
        showAnswerFastRate: Number(showAnswerFastRate.toFixed(3)),
        highPointUltraFastRate: Number(highPointUltraFastRate.toFixed(3)),
        wordyUltraFastRate: Number(wordyUltraFastRate.toFixed(3)),
        timeRatioLowRate: Number(timeRatioLowRate.toFixed(3)),
        pointsWeightedUltraFastShare: Number(pointsWeightedUltraFastShare.toFixed(3)),
        pointsWeightedTimeRatioLowShare: Number(pointsWeightedTimeRatioLowShare.toFixed(3)),
        severeHighPointUltraFast: severeHighPointUltraFastFlag === 1,
        overallPtsPerSec: Number(overallPtsPerSec.toFixed(3)),
        windowHighPps: windowHighPpsFlag === 1,
        lowLatencyRate: Number(lowLatencyRate.toFixed(3)),
        lowLatencyWindowDense: lowLatencyWindowFlag === 1,
        timingCv: Number(cv.toFixed(3)),
        accuracyRate: Number(accuracyRate.toFixed(3)),
        fast2Share: Number(fast2Share.toFixed(3)),
        fast2Accuracy: Number(fast2Accuracy.toFixed(3)),
        maxConsecutiveFast2OrLess: maxConsecutiveFast2OrLess,
        windowFast3OrLessDense: flagWindowManyFast3OrLess,
        windowHighValueFastDense: flagWindowManyHighValueFast,
        totalQuestions: total
      };

      return {
        suspicionStatus: status,
        suspicionScore: Number(score.toFixed(3)),
        suspiciousSummary: summary
      };

    } catch (error) {
      developerLog('💥 Error calculating suspicion metrics:', error);
      return {
        suspicionStatus: 'green',
        suspicionScore: 0,
        suspiciousSummary: {}
      };
    }
  }, [developerLog]);

  // Main function to process quiz completion
  const processQuizCompletion = useCallback(async (session: QuizSession): Promise<QuizCompletionResult> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      developerLog('🎯 Processing quiz completion for session:', session.id);

      // Calculate bonus XP if applicable
      let bonusXp = 0;
      if (session.assignment_id) {
        bonusXp = await calculateBonusXp(session);
        
        if (bonusXp > 0) {
          // Show bonus XP notification
          showNotification('achievement', {
            id: 'bonus-xp',
            name: 'On-Time Completion Bonus!',
            description: `You earned ${STUDY_SCHEDULE_BONUS_XP} bonus XP for completing your study assignment on time!`,
            criteria_type: 'bonus_xp',
            criteria_value: STUDY_SCHEDULE_BONUS_XP,
            badge_icon_url: '/images/badges/perfect.png'
          });
        }
      }

      // Calculate suspicion metrics
      const suspicionMetrics = await calculateSuspicionMetrics(session.id);

      // Update quiz session with suspicion data and bonus XP
      const sessionUpdates: any = {
        suspicion_status: suspicionMetrics.suspicionStatus,
        suspicion_score: suspicionMetrics.suspicionScore,
        suspicious_summary: suspicionMetrics.suspiciousSummary,
      };

      if (bonusXp > 0) {
        sessionUpdates.bonus_xp = bonusXp;
      }

      const { error: suspicionUpdateError } = await supabase
        .from('quiz_sessions')
        .update(sessionUpdates)
        .eq('id', session.id);

      if (suspicionUpdateError) {
        developerLog('❌ Error updating session with suspicion data:', suspicionUpdateError);
        // Continue with other processing even if suspicion update fails
      }

      // Handle assignment completion
      if (session.assignment_id) {
        try {
          developerLog('📚 Marking assignment as completed:', session.assignment_id);
          await checkAndMarkAssignmentCompleted(session.assignment_id);
          developerLog('✅ Assignment marked as completed');
        } catch (error) {
          developerLog('❌ Failed to mark assignment as completed:', error);
          // Don't throw here to avoid disrupting the quiz completion flow
        }
      }

      // Update user stats (this will be handled by database triggers, but we refresh user data)
      try {
        // Defer refresh slightly and never throw here to avoid breaking confirmation view
        setTimeout(async () => {
          try {
            await refreshUser();
            developerLog('✅ Post-completion: user stats refreshed');
          } catch (e) {
            developerLog('⚠️ Post-completion: user stats refresh failed (non-blocking):', e);
          }
        }, 400);
        
        await checkAchievements();
        
      } catch (error) {
        developerLog('❌ Error in gamification updates:', error);
        // Log but don't throw to avoid breaking the main flow
      }

      developerLog('✅ Quiz completion processing completed successfully');

      return {
        success: true,
        bonusXp,
        suspicionStatus: suspicionMetrics.suspicionStatus,
        suspicionScore: suspicionMetrics.suspicionScore
      };

    } catch (error) {
      developerLog('💥 Error processing quiz completion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }, [user, developerLog, calculateBonusXp, calculateSuspicionMetrics, showNotification, refreshUser, checkAchievements]);

  return {
    processQuizCompletion
  };
}