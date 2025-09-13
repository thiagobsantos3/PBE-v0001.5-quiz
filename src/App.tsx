import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { QuestionProvider } from './contexts/QuestionContext';
import { QuizSessionProvider } from './contexts/QuizSessionContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login'; 
import { Signup } from './pages/Signup';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { QuickStartQuiz } from './pages/QuickStartQuiz';
import { CreateOwnQuiz } from './pages/CreateOwnQuiz';
import { StudyScheduleQuiz } from './pages/StudyScheduleQuiz'; // Keep this import
import { Schedule } from './pages/Schedule';
import { TeamScheduleOverview } from './pages/TeamScheduleOverview';
import { Leaderboard } from './pages/Leaderboard';
import { Team } from './pages/Team';
import { Achievements } from './pages/Achievements';
import { Analytics } from './pages/Analytics'; 
import Billing from './pages/Billing';
import { Settings } from './pages/Settings';
import { SettingsSimple } from './pages/SettingsSimple';
import { Invitations } from './pages/Invitations';
import { InvitationAccept } from './pages/InvitationAccept';
import { BillingSuccess } from './pages/billing/Success';
import { AdminPanel } from './pages/admin/AdminPanel';
import { UserManagement } from './pages/admin/UserManagement';
import { QuestionManagement } from './pages/admin/QuestionManagement';
import { AchievementManagement } from './pages/admin/AchievementManagement';
import { PlanManagement } from './pages/admin/PlanManagement';
import { TestAssignmentManagement } from './pages/admin/TestAssignmentManagement';
import { TestAssignmentDetails } from './pages/admin/TestAssignmentDetails';
import { TestAssignments } from './pages/TestAssignments';
import { QuizCenter } from './pages/Quiz';
import { QuizRunner } from './components/quiz/QuizRunner';
import { TestAssignmentQuiz } from './pages/TestAssignmentQuiz';
import { MockTestCreation } from './pages/MockTestCreation';
import { TestRunner } from './pages/TestRunner';
import { TestReviewScreen } from './pages/TestReviewScreen';
import { TestChallengeReview } from './pages/admin/TestChallengeReview';
import { AnnouncementManagement } from './pages/admin/AnnouncementManagement';
import { AnnouncementsView } from './pages/AnnouncementsView';

function App() {
  return (
    <AuthProvider>
      <QuestionProvider>
        <NotificationProvider>
          <QuizSessionProvider>
              <Router>
                <div className="min-h-screen bg-gray-50">
                  <Routes>
                    {/* Root: redirect to dashboard or login */}
                    <Route path="/" element={<HomeRedirect />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/invitation/:token" element={<InvitationAccept />} />
                    
                    {/* Protected routes with single Layout wrapper */}
                    <Route path="/*" element={
                      <ProtectedRoute>
                        <Layout>
                          <Routes>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/quiz" element={<QuizCenter />} />
                            <Route path="/schedule" element={<Schedule />} />
                            <Route path="/leaderboard" element={<Leaderboard />} />
                            <Route path="/team" element={<Team />} />
                            <Route path="/achievements" element={<Achievements />} />
                            <Route path="/analytics" element={<Analytics />} />
                            <Route path="/billing" element={<Billing />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/settings-simple" element={<SettingsSimple />} />
                            <Route path="/announcements" element={<AnnouncementsView />} />
                            <Route path="/billing/success" element={<BillingSuccess />} />
                            
                            {/* Admin routes */}
                            <Route path="/admin" element={
                              <ProtectedRoute requireAdmin>
                                <AdminPanel />
                              </ProtectedRoute>
                            } />
                            <Route path="/admin/users" element={
                              <ProtectedRoute requireAdmin>
                                <UserManagement />
                              </ProtectedRoute>
                            } />
                            <Route path="/admin/questions" element={
                              <ProtectedRoute requireAdmin>
                                <QuestionManagement />
                              </ProtectedRoute>
                            } />
                            <Route path="/admin/achievements" element={
                              <ProtectedRoute requireAdmin>
                                <AchievementManagement />
                              </ProtectedRoute>
                            } />
                            <Route path="/admin/plans" element={
                              <ProtectedRoute requireAdmin>
                                <PlanManagement />
                              </ProtectedRoute>
                            } />
                            <Route path="/admin/test-assessments" element={
                              <ProtectedRoute allowedTeamRoles={['owner', 'admin']}>
                                <TestAssignmentManagement />
                              </ProtectedRoute>
                            } />
                            <Route path="/admin/test-assessments/:assignmentId" element={
                              <ProtectedRoute allowedTeamRoles={['owner', 'admin']}>
                                <TestAssignmentDetails />
                              </ProtectedRoute>
                            } />
                            <Route path="/admin/test-challenges" element={
                              <ProtectedRoute allowedTeamRoles={['owner', 'admin']}>
                                <TestChallengeReview />
                              </ProtectedRoute>
                            } />
                            <Route path="/admin/announcements" element={
                              <ProtectedRoute allowedTeamRoles={['owner', 'admin']}>
                                <AnnouncementManagement />
                              </ProtectedRoute>
                            } />
                          </Routes>
                        </Layout>
                      </ProtectedRoute>
                    } />
                    
                    {/* Special routes that need their own layout or no layout */}
                    <Route path="/invitations" element={
                      <ProtectedRoute>
                        <Invitations />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/schedule/team-overview" element={
                      <ProtectedRoute>
                        <TeamScheduleOverview />
                      </ProtectedRoute>
                    } />
                    
                    {/* Quiz routes that manage their own layout */}
                    <Route path="/quiz/quick-start" element={
                      <ProtectedRoute>
                        <QuickStartQuiz />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/quiz/create-own" element={
                      <ProtectedRoute>
                        <CreateOwnQuiz />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/quiz/mock-test-creation" element={
                      <ProtectedRoute>
                        <MockTestCreation />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/quiz/study-assignment/:assignmentId" element={
                      <ProtectedRoute>
                        <StudyScheduleQuiz />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/quiz/test-assignments" element={
                      <ProtectedRoute>
                        <TestAssignments />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/quiz/test-assignment/:testAssignmentId" element={
                      <ProtectedRoute>
                        <TestAssignmentQuiz />
                      </ProtectedRoute>
                    } />
                    
                    {/* Quiz Runner Routes (manage their own layout) */}
                    <Route path="/quiz/runner/:quizSessionId" element={
                      <ProtectedRoute>
                        <QuizRunner />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/quiz/test-runner/:quizSessionId" element={
                      <ProtectedRoute>
                        <TestRunner />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/quiz/test-review/:quizSessionId" element={
                      <ProtectedRoute>
                        <TestReviewScreen />
                      </ProtectedRoute>
                    } />
                  </Routes>
                </div>
              </Router>
          </QuizSessionProvider>
        </NotificationProvider>
      </QuestionProvider>
    </AuthProvider>
  );
}

export default App;

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}