import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Briefcase, Shield, User, Award, CheckCircle, AlertTriangle, XCircle, 
  ChevronRight, RefreshCw, BarChart2, PlusCircle, ArrowLeft, Download,
  Settings, LogOut, Check, HelpCircle, FileText, TrendingUp, Users, Cpu, FileDown
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TARGET_ROLES = [
  'Backend Developer',
  'Full Stack Developer',
  'AI/ML Engineer',
  'Data Analyst',
  'Java Developer',
  'MERN Stack Developer'
];

const DIFFICULTY_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function App() {
  // Authentication State
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'CANDIDATE' });

  // Navigation State
  const [view, setView] = useState(token ? 'dashboard' : 'login'); // 'login' | 'dashboard' | 'setup' | 'session' | 'report' | 'admin'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Candidate Data State
  const [interviews, setInterviews] = useState([]);
  const [activeInterview, setActiveInterview] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [crossQuestionsAddedMsg, setCrossQuestionsAddedMsg] = useState(false);
  const [activeReport, setActiveReport] = useState(null);

  // Admin Data State
  const [adminAnalytics, setAdminAnalytics] = useState(null);
  const [adminReports, setAdminReports] = useState([]);
  const [adminFilterRole, setAdminFilterRole] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminSort, setAdminSort] = useState('score-desc');

  // Interview Setup Form
  const [setupForm, setSetupForm] = useState({
    targetRole: 'Backend Developer',
    difficulty: 'Intermediate',
    skills: 'Node.js, Express, PostgreSQL, JWT',
    experienceLevel: 'Mid-level (3-5 years)',
    projectTitle: 'E-commerce Microservices',
    projectDescription: 'A secure backend system featuring order management, payment integration, database locking, caching with Redis, and custom authentication gateway.',
    techStack: 'Node.js, Express, PostgreSQL, Redis, Docker'
  });

  // Set Axios headers on token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Load Dashboard Interviews
  useEffect(() => {
    if (token && view === 'dashboard') {
      fetchInterviews();
    }
  }, [token, view]);

  // Load Admin Data
  useEffect(() => {
    if (token && user?.role === 'ADMIN' && view === 'admin') {
      fetchAdminData();
    }
  }, [token, user, view]);

  const fetchInterviews = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/interviews/my`);
      setInterviews(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load interviews.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      const [analyticsRes, reportsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/analytics`),
        axios.get(`${API_URL}/api/admin/reports`)
      ]);
      setAdminAnalytics(analyticsRes.data);
      setAdminReports(reportsRes.data);
    } catch (err) {
      setError('Failed to fetch administrative records.');
    } finally {
      setLoading(false);
    }
  };

  // Auth Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = authTab === 'login' ? 'login' : 'register';
      const body = authTab === 'login' 
        ? { email: authForm.email, password: authForm.password }
        : authForm;
        
      const res = await axios.post(`${API_URL}/api/auth/${endpoint}`, body);
      const { token, user: userData } = res.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setToken(token);
      setUser(userData);
      
      setView(userData.role === 'ADMIN' ? 'admin' : 'dashboard');
      setAuthForm({ name: '', email: '', password: '', role: 'CANDIDATE' });
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setView('login');
  };

  // Interview Setup Handlers
  const handleCreateInterview = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const createRes = await axios.post(`${API_URL}/api/interviews/create`, setupForm);
      const interview = createRes.data;
      
      const questionsRes = await axios.post(`${API_URL}/api/interviews/${interview.id}/generate-questions`);
      
      setActiveInterview({
        ...interview,
        questions: questionsRes.data,
        answers: []
      });
      
      setCurrentQuestionIndex(0);
      setAnswerText('');
      setView('session');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start interview setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleResumeInterview = async (interviewId) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/interviews/${interviewId}`);
      const data = res.data;
      
      let questions = data.questions || [];
      if (questions.length === 0) {
        const qRes = await axios.post(`${API_URL}/api/interviews/${interviewId}/generate-questions`);
        questions = qRes.data;
      }
      
      setActiveInterview({
        ...data,
        questions
      });
      
      const unansweredIndex = data.answers ? data.answers.length : 0;
      setCurrentQuestionIndex(unansweredIndex >= questions.length ? questions.length - 1 : unansweredIndex);
      setAnswerText('');
      setView('session');
    } catch (err) {
      setError('Could not load session details.');
    } finally {
      setLoading(false);
    }
  };

  // Answer Submission Handlers
  const handleSubmitAnswer = async () => {
    if (!answerText.trim()) {
      setError('Please provide an answer response.');
      return;
    }
    setError('');
    setIsSubmittingAnswer(true);
    setCrossQuestionsAddedMsg(false);
    
    const question = activeInterview.questions[currentQuestionIndex];
    try {
      const res = await axios.post(`${API_URL}/api/interviews/${activeInterview.id}/submit-answer`, {
        questionId: question.id,
        answerText
      });
      
      const { answer, crossQuestionsAdded, newQuestions } = res.data;
      
      const updatedAnswers = [...(activeInterview.answers || []), answer];
      let updatedQuestions = [...(activeInterview.questions || [])];
      
      if (crossQuestionsAdded && newQuestions.length > 0) {
        updatedQuestions = [...updatedQuestions, ...newQuestions];
        setCrossQuestionsAddedMsg(true);
      }
      
      setActiveInterview({
        ...activeInterview,
        questions: updatedQuestions,
        answers: updatedAnswers
      });
      
      setAnswerText('');
      
      if (currentQuestionIndex + 1 < updatedQuestions.length) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit candidate response.');
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const handleFinalizeReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/api/interviews/${activeInterview.id}/final-report`);
      setActiveReport(res.data);
      setView('report');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to compile final evaluation report.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (interviewId) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/interviews/${interviewId}/report`);
      setActiveReport(res.data);
      setView('report');
    } catch (err) {
      setError('Failed to fetch the compiled evaluation report.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = (interviewId) => {
    window.open(`${API_URL}/api/interviews/${interviewId}/download-report?token=${token}`, '_blank');
  };

  const handleAdminViewReport = async (report) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/admin/reports/${report.id}`);
      setActiveReport(res.data);
      setView('report');
    } catch (err) {
      setError('Failed to load candidate detailed report.');
    } finally {
      setLoading(false);
    }
  };

  // Recommendations Badge Styling
  const getRecommendationBadge = (rec) => {
    const base = "px-3 py-1 text-xs font-bold rounded-full inline-flex items-center gap-1.5 ";
    if (rec === 'Strongly Recommended') {
      return <span className={base + "bg-emerald-50 text-emerald-700 border border-emerald-200"}><CheckCircle size={13}/> Strongly Recommended</span>;
    }
    if (rec === 'Recommended') {
      return <span className={base + "bg-emerald-50/50 text-emerald-600 border border-emerald-100"}><CheckCircle size={13}/> Recommended</span>;
    }
    if (rec === 'Needs Improvement') {
      return <span className={base + "bg-amber-50 text-amber-700 border border-amber-200"}><AlertTriangle size={13}/> Needs Improvement</span>;
    }
    return <span className={base + "bg-rose-50 text-rose-700 border border-rose-200"}><XCircle size={13}/> Not Recommended Yet</span>;
  };

  const getScoreColor = (score) => {
    const val = score * 10;
    if (val >= 80) return 'text-emerald-600';
    if (val >= 65) return 'text-emerald-500';
    if (val >= 50) return 'text-amber-600';
    return 'text-rose-600';
  };

  const filteredReports = adminReports.filter(r => {
    const roleMatches = !adminFilterRole || r.interview.targetRole === adminFilterRole;
    const nameMatches = !adminSearch || r.interview.user.name.toLowerCase().includes(adminSearch.toLowerCase()) || r.interview.user.email.toLowerCase().includes(adminSearch.toLowerCase());
    return roleMatches && nameMatches;
  }).sort((a, b) => {
    if (adminSort === 'score-desc') return b.overallScore - a.overallScore;
    if (adminSort === 'score-asc') return a.overallScore - b.overallScore;
    if (adminSort === 'date-desc') return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  return (
    <div className="min-h-screen flex flex-col font-sans antialiased text-slate-700 bg-slate-50/30">
      {/* Background Soft Linear Gradient */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,_var(--tw-gradient-stops))] from-slate-50 via-white to-slate-100 -z-10" />

      {/* TOP HEADER */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => token ? setView(user?.role === 'ADMIN' ? 'admin' : 'dashboard') : setView('login')}>
            <div className="p-2 bg-gradient-to-tr from-emerald-500 to-indigo-600 rounded-lg shadow-sm">
              <Cpu size={20} className="text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-indigo-600">
                InterviewMind AI
              </span>
              <span className="text-[9px] block text-slate-400 tracking-widest uppercase font-semibold">Evaluation Engine</span>
            </div>
          </div>

          {token && (
            <div className="flex items-center gap-4">
              {user?.role === 'ADMIN' && view !== 'admin' && (
                <button 
                  onClick={() => setView('admin')}
                  className="text-xs bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition text-slate-700 font-medium"
                >
                  <Shield size={13} className="text-emerald-500"/> Admin Center
                </button>
              )}
              {user?.role === 'ADMIN' && view === 'admin' && (
                <button 
                  onClick={() => setView('dashboard')}
                  className="text-xs bg-indigo-50 border border-indigo-200 hover:bg-indigo-100/50 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition text-indigo-700 font-medium"
                >
                  <User size={13}/> Candidate View
                </button>
              )}
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-800">{user?.name}</p>
                <p className="text-[10px] text-slate-400 italic font-medium">{user?.role}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Error Callout */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-start gap-3 text-sm shadow-sm">
            <XCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Error encountered: </span>
              {error}
            </div>
          </div>
        )}

        {/* --- VIEW 1: AUTHENTICATION --- */}
        {view === 'login' && (
          <div className="max-w-md mx-auto my-12 bg-white border border-slate-200 p-8 rounded-2xl shadow-md">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-slate-800">Welcome to InterviewMind</h2>
              <p className="text-sm text-slate-500 mt-2">AI-powered deep mock technical assessments</p>
            </div>

            <div className="flex gap-2 border-b border-slate-100 pb-4 mb-6">
              <button 
                className={`flex-1 py-1.5 text-center text-sm font-semibold rounded-md transition ${authTab === 'login' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' : 'text-slate-500 hover:text-slate-800'}`}
                onClick={() => setAuthTab('login')}
              >
                Sign In
              </button>
              <button 
                className={`flex-1 py-1.5 text-center text-sm font-semibold rounded-md transition ${authTab === 'register' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' : 'text-slate-500 hover:text-slate-800'}`}
                onClick={() => setAuthTab('register')}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authTab === 'register' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-800 placeholder-slate-400"
                    placeholder="John Doe"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-800 placeholder-slate-400"
                  placeholder="name@company.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
                <input 
                  type="password" 
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-800 placeholder-slate-450"
                  placeholder="••••••••"
                />
              </div>

              {authTab === 'register' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Registration Role</label>
                  <select 
                    value={authForm.role}
                    onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-700"
                  >
                    <option value="CANDIDATE">Candidate / Developer</option>
                    <option value="ADMIN">Recruiter / Admin</option>
                  </select>
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-2.5 rounded-lg text-sm shadow-sm flex items-center justify-center gap-2 transition"
              >
                {loading ? <RefreshCw size={15} className="animate-spin"/> : null}
                {authTab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          </div>
        )}

        {/* --- VIEW 2: CANDIDATE DASHBOARD --- */}
        {view === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-800">Candidate Dashboard</h1>
                <p className="text-sm text-slate-550 mt-1">Initialize technical assessments and view detailed score cards.</p>
              </div>
              <button 
                onClick={() => setView('setup')}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-lg text-sm shadow-sm flex items-center gap-2 transition"
              >
                <PlusCircle size={16}/> Start New Interview
              </button>
            </div>

            {loading && interviews.length === 0 ? (
              <div className="flex flex-col items-center py-20 gap-3 text-slate-400">
                <RefreshCw size={36} className="animate-spin text-emerald-500" />
                <p className="text-sm">Fetching your interview records...</p>
              </div>
            ) : interviews.length === 0 ? (
              <div className="text-center py-16 bg-white border border-slate-200 rounded-xl max-w-2xl mx-auto p-8 shadow-sm">
                <Award size={48} className="mx-auto text-slate-350 mb-4" />
                <h3 className="text-lg font-bold text-slate-700">No Interview Records Found</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                  You haven't completed any technical assessments yet. Click the button above to set up your first interview session.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {interviews.map((item) => (
                  <div 
                    key={item.id}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition group hover:-translate-y-0.5"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-750 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {item.difficulty}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${item.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-amber-50 text-amber-700 border border-amber-150'}`}>
                          {item.status}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-lg text-slate-800 group-hover:text-slate-900 transition line-clamp-1">{item.targetRole}</h3>
                      <p className="text-xs text-slate-500 mt-1">Project: <span className="text-slate-700 font-medium">{item.projectTitle}</span></p>
                      
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Overall Score</p>
                          {item.overallScore !== null ? (
                            <p className={`text-xl font-black mt-0.5 ${getScoreColor(item.overallScore)}`}>
                              {(item.overallScore * 10).toFixed(1)}%
                            </p>
                          ) : (
                            <p className="text-sm font-semibold text-slate-400 mt-0.5">Not Compiled</p>
                          )}
                        </div>
                        {item.status === 'COMPLETED' && (
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Recommendation</p>
                            <p className="text-xs font-bold text-slate-650 mt-1 italic">{item.recommendation}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex gap-2">
                      {item.status === 'COMPLETED' ? (
                        <>
                          <button 
                            onClick={() => handleViewReport(item.id)}
                            className="flex-1 text-xs bg-slate-50 border border-slate-200 hover:bg-slate-100 py-2 rounded-md font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition"
                          >
                            <FileText size={13}/> View Report
                          </button>
                          <button 
                            onClick={() => handleDownloadPDF(item.id)}
                            className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-md transition"
                            title="Download PDF Report"
                          >
                            <FileDown size={14}/>
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => handleResumeInterview(item.id)}
                          className="w-full text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100/50 py-2 rounded-md font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          <RefreshCw size={13}/> Resume Session <ChevronRight size={13}/>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VIEW 3: INTERVIEW SETUP FORM --- */}
        {view === 'setup' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
              <button 
                onClick={() => setView('dashboard')}
                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-md text-slate-500 transition"
              >
                <ArrowLeft size={16}/>
              </button>
              <div>
                <h1 className="text-2xl font-black text-slate-800">Setup Evaluation Session</h1>
                <p className="text-xs text-slate-500">Provide role requirements and project detail to customize questions.</p>
              </div>
            </div>

            <form onSubmit={handleCreateInterview} className="space-y-6 bg-white border border-slate-200 p-6 sm:p-8 rounded-xl shadow-sm">
              {/* Target Role & Difficulty */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Target Developer Role</label>
                  <select 
                    value={setupForm.targetRole}
                    onChange={(e) => setSetupForm({ ...setupForm, targetRole: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-700"
                  >
                    {TARGET_ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Difficulty Profile</label>
                  <select 
                    value={setupForm.difficulty}
                    onChange={(e) => setSetupForm({ ...setupForm, difficulty: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-700"
                  >
                    {DIFFICULTY_LEVELS.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Experience Level & Skills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Experience Level</label>
                  <select 
                    value={setupForm.experienceLevel}
                    onChange={(e) => setSetupForm({ ...setupForm, experienceLevel: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-700"
                  >
                    <option value="Junior (1-2 years)">Junior Developer (1-2 years)</option>
                    <option value="Mid-level (3-5 years)">Mid-level Developer (3-5 years)</option>
                    <option value="Senior (5+ years)">Senior Developer / Lead (5+ years)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Your Core Skills (Comma-separated)</label>
                  <input 
                    type="text" 
                    required
                    value={setupForm.skills}
                    onChange={(e) => setSetupForm({ ...setupForm, skills: e.target.value })}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-800 placeholder-slate-400"
                    placeholder="Python, Django, PostgreSQL, Docker"
                  />
                </div>
              </div>

              {/* Project Card */}
              <div className="border border-slate-200 bg-slate-50/50 p-5 rounded-lg space-y-4">
                <h3 className="font-extrabold text-sm text-indigo-650 flex items-center gap-1.5">
                  <Briefcase size={15}/> Project-Based Challenge Customizer
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Highlight Project Title</label>
                    <input 
                      type="text" 
                      required
                      value={setupForm.projectTitle}
                      onChange={(e) => setSetupForm({ ...setupForm, projectTitle: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-800 placeholder-slate-400"
                      placeholder="e.g. Realtime Analytics Portal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Project Tech Stack</label>
                    <input 
                      type="text" 
                      required
                      value={setupForm.techStack}
                      onChange={(e) => setSetupForm({ ...setupForm, techStack: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-800 placeholder-slate-400"
                      placeholder="e.g. Next.js, FastAPI, PostgreSQL, Redis"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Brief Project Description (Architecture & Challenges)</label>
                  <textarea 
                    rows="3"
                    required
                    value={setupForm.projectDescription}
                    onChange={(e) => setSetupForm({ ...setupForm, projectDescription: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-800 placeholder-slate-400"
                    placeholder="Explain what the project did and any key scaling/security tasks you solved..."
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold py-3 rounded-lg text-sm shadow-sm flex items-center justify-center gap-2 transition"
              >
                {loading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin"/> Initializing AI service & generating interview questions...
                  </>
                ) : 'Generate Questions & Start Interview Session'}
              </button>
            </form>
          </div>
        )}

        {/* --- VIEW 4: ACTIVE INTERVIEW SESSION (WIZARD) --- */}
        {view === 'session' && activeInterview && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header / Tracker */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Active Assessment</p>
                <h2 className="text-lg font-black text-slate-850 line-clamp-1">{activeInterview.targetRole}</h2>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-650 bg-slate-50 px-3 py-1 rounded-md border border-slate-200">
                  Question {currentQuestionIndex + 1} of {activeInterview.questions.length}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / activeInterview.questions.length) * 100}%` }}
              />
            </div>

            {/* Notification alert for cross question trigger */}
            {crossQuestionsAddedMsg && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg flex items-start gap-3 text-sm shadow-sm">
                <Cpu size={18} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Follow-up drill triggered! </span>
                  Based on your project answer, the interviewer has dynamically generated 2 follow-up cross-questions and added them to your queue.
                </div>
              </div>
            )}

            {/* Question Display Card */}
            {currentQuestionIndex < activeInterview.questions.length ? (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-250">
                      {activeInterview.questions[currentQuestionIndex].questionType} QUESTION
                    </span>
                    {activeInterview.questions[currentQuestionIndex].questionType === 'PROJECT' && (
                      <span className="text-[9px] font-bold text-slate-400 italic">Project probe</span>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-800 leading-relaxed">
                    {activeInterview.questions[currentQuestionIndex].questionText}
                  </h3>
                </div>

                {/* Candidate Input */}
                <div className="space-y-3">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">Your Technical Response</label>
                  
                  {activeInterview.answers && activeInterview.answers.find(a => a.questionId === activeInterview.questions[currentQuestionIndex].id) ? (
                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-lg text-slate-450 italic">
                      You have already submitted an answer to this question.
                    </div>
                  ) : (
                    <>
                      <textarea
                        rows="7"
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        disabled={isSubmittingAnswer}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-slate-800 placeholder-slate-400 leading-relaxed font-mono"
                        placeholder="Provide your complete solution, explaining design choices, trade-offs, and details..."
                      />
                      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                        <span>Min recommended length: 30 words</span>
                        <span>Character count: {answerText.length}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Button Tray */}
                <div className="flex justify-end pt-4">
                  {/* If answer is not yet submitted */}
                  {!(activeInterview.answers && activeInterview.answers.find(a => a.questionId === activeInterview.questions[currentQuestionIndex].id)) && (
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={isSubmittingAnswer || !answerText.trim()}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold px-6 py-2.5 rounded-lg text-sm shadow-sm transition flex items-center gap-2"
                    >
                      {isSubmittingAnswer ? (
                        <>
                          <RefreshCw size={14} className="animate-spin"/> Evaluating Answer...
                        </>
                      ) : (
                        <>
                          Submit Response <ChevronRight size={15}/>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {/* Finish Session Card */}
            {activeInterview.answers && activeInterview.answers.length === activeInterview.questions.length && (
              <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-md text-center space-y-5 max-w-lg mx-auto">
                <Award size={48} className="text-emerald-500 mx-auto" />
                <h3 className="text-xl font-bold text-slate-800">All Questions Addressed</h3>
                <p className="text-sm text-slate-500">
                  You have answered all standard and project-based cross questions. The AI evaluator is ready to compute your final report card and study roadmap.
                </p>
                <button
                  onClick={handleFinalizeReport}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-indigo-600 text-white font-extrabold py-3 rounded-lg text-sm shadow-sm transition flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw size={15} className="animate-spin"/> : null}
                  Compile final report & learning roadmap
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- VIEW 5: DETAILED INTERVIEW REPORT --- */}
        {view === 'report' && activeReport && (
          <div className="space-y-8">
            {/* Header Title & Downloader */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setView(user?.role === 'ADMIN' ? 'admin' : 'dashboard')}
                  className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-md text-slate-500 transition"
                >
                  <ArrowLeft size={16}/>
                </button>
                <div>
                  <h1 className="text-2xl font-black text-slate-800">Interview Evaluation Report</h1>
                  <p className="text-xs text-slate-500">Candidate: <span className="text-slate-700 font-bold">{activeReport.interview.user.name}</span> | Target: <span className="text-slate-700 font-bold">{activeReport.interview.targetRole}</span></p>
                </div>
              </div>
              <button 
                onClick={() => handleDownloadPDF(activeReport.interviewId)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-lg text-sm shadow-sm flex items-center gap-2 transition"
              >
                <Download size={15}/> Download PDF Report
              </button>
            </div>

            {/* Top Stats Deck */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Overall Recommendation Score */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-center items-center text-center shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-450">Final Decision</h3>
                <div className="my-4">
                  {getRecommendationBadge(activeReport.recommendation)}
                </div>
                
                <div className="relative flex items-center justify-center w-36 h-36 mt-2">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="72" cy="72" r="60" className="text-slate-100" strokeWidth="10" stroke="currentColor" fill="transparent" />
                    <circle cx="72" cy="72" r="60" className="text-emerald-500 transition-all duration-300" strokeWidth="10" strokeDasharray={377} strokeDashoffset={377 - (377 * (activeReport.overallScore * 10)) / 100} strokeLinecap="round" stroke="currentColor" fill="transparent" />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-black text-slate-800">{(activeReport.overallScore * 10).toFixed(0)}%</span>
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold mt-0.5">Overall</span>
                  </div>
                </div>
              </div>

              {/* Aggregates Dashboard */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2 shadow-sm space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-450 border-b border-slate-100 pb-2">Skills Performance Breakdown</h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-center">
                    <p className="text-[10px] text-slate-450 uppercase tracking-widest font-extrabold">Technical</p>
                    <p className={`text-2xl font-black mt-1 ${getScoreColor(activeReport.technicalAverage)}`}>
                      {(activeReport.technicalAverage * 10).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-center">
                    <p className="text-[10px] text-slate-450 uppercase tracking-widest font-extrabold">Completeness</p>
                    <p className={`text-2xl font-black mt-1 ${getScoreColor(activeReport.completenessAverage)}`}>
                      {(activeReport.completenessAverage * 10).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-center">
                    <p className="text-[10px] text-slate-450 uppercase tracking-widest font-extrabold">Clarity</p>
                    <p className={`text-2xl font-black mt-1 ${getScoreColor(activeReport.clarityAverage)}`}>
                      {(activeReport.clarityAverage * 10).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-center">
                    <p className="text-[10px] text-slate-450 uppercase tracking-widest font-extrabold">Project Knowl.</p>
                    <p className={`text-2xl font-black mt-1 ${getScoreColor(activeReport.projectKnowledgeScore)}`}>
                      {(activeReport.projectKnowledgeScore * 10).toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-500 space-y-1">
                  <span className="font-extrabold uppercase text-slate-700 text-[10px] block mb-1">Score Formula Weights:</span>
                  <p>• Technical accuracy: <span className="text-slate-700 font-semibold">35%</span> | Completeness: <span className="text-slate-700 font-semibold">25%</span></p>
                  <p>• Communication Clarity: <span className="text-slate-700 font-semibold">15%</span> | Cosine Semantic Similarity: <span className="text-slate-700 font-semibold">15%</span></p>
                  <p>• Evaluated Confidence: <span className="text-slate-700 font-semibold">10%</span></p>
                </div>
              </div>
            </div>

            {/* Strengths & Weaknesses Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-emerald-600 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
                  <CheckCircle size={15}/> Key Architectural Strengths
                </h3>
                <ul className="space-y-2 text-sm text-slate-650">
                  {activeReport.strengths.map((str, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-rose-600 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
                  <AlertTriangle size={15}/> Vulnerable Gaps & Weaknesses
                </h3>
                <ul className="space-y-2 text-sm text-slate-650">
                  {activeReport.weaknesses.map((weak, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="text-rose-500 mt-0.5">•</span>
                      <span>{weak}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Skill Gaps & Actionable Roadmap */}
            <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-6 shadow-sm">
              <h3 className="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2.5">
                Skill Gap Detection & Actionable Roadmap
              </h3>

              {/* Missing Skills Tags */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Detected Skill Shortfalls</p>
                <div className="flex flex-wrap gap-2">
                  {activeReport.missingSkills.map((skill, idx) => (
                    <span key={idx} className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-2.5 py-1 rounded-md font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Roadmap timeline */}
              <div className="space-y-3 pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Personalized Learning Roadmap</p>
                <div className="space-y-4">
                  {activeReport.roadmap.map((step, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-600">
                          {idx + 1}
                        </div>
                        {idx + 1 < activeReport.roadmap.length && (
                          <div className="w-0.5 bg-slate-200 flex-1 my-1" />
                        )}
                      </div>
                      <div className="text-sm text-slate-650 pb-2 mt-0.5">
                        {step}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Question by Question Detail Panel */}
            <div className="space-y-4">
              <h3 className="font-black text-xl text-slate-800 border-b border-slate-250 pb-2">
                Detailed Question Review
              </h3>

              <div className="space-y-6">
                {activeReport.interview.questions.map((q, idx) => {
                  const ans = activeReport.interview.answers.find(a => a.questionId === q.id);
                  const ansStrengths = ans ? JSON.parse(ans.strengths) : [];
                  const ansWeaknesses = ans ? JSON.parse(ans.weaknesses) : [];
                  
                  return (
                    <div key={q.id} className="bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-sm">
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700">
                          {q.questionType} Q{idx + 1}
                        </span>
                        {ans && (
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Score: {ans.finalAnswerScore}/10
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-base text-slate-850">{q.questionText}</h4>
                      
                      {ans ? (
                        <div className="space-y-4 pt-2 border-t border-slate-100">
                          <div>
                            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Submitted Response:</p>
                            <p className="text-xs text-slate-650 font-mono bg-slate-50 p-3 rounded-lg border border-slate-200 mt-1 line-clamp-4 hover:line-clamp-none cursor-pointer">
                              "{ans.answerText}"
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1">
                              <p className="font-bold text-emerald-600">Response Strengths</p>
                              {ansStrengths.map((s, i) => <p key={i} className="text-slate-600">• {s}</p>)}
                            </div>
                            <div className="space-y-1">
                              <p className="font-bold text-rose-600">Improvement Gaps</p>
                              {ansWeaknesses.map((w, i) => <p key={i} className="text-slate-600">• {w}</p>)}
                            </div>
                          </div>

                          <div className="text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
                            <p className="font-extrabold text-slate-500 uppercase text-[9px] tracking-wider">AI feedback</p>
                            <p className="text-slate-600 leading-relaxed">{ans.feedback}</p>
                          </div>

                          <div className="text-xs bg-emerald-50/30 p-3.5 rounded-lg border border-emerald-100 space-y-1.5">
                            <p className="font-extrabold text-emerald-600 uppercase text-[9px] tracking-wider">Ideal Reference Guide</p>
                            <p className="text-emerald-700 leading-relaxed font-sans">{ans.improvedAnswer}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm font-semibold text-rose-600 italic">This question was skipped or not answered.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 6: ADMIN REPORTS DASHBOARD --- */}
        {view === 'admin' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-800 flex items-center gap-2">
                  <Shield className="text-emerald-500"/> Recruitment Admin Center
                </h1>
                <p className="text-sm text-slate-500 mt-1">Examine candidates' scorecards, average metrics, and cohort roadmaps.</p>
              </div>
            </div>

            {/* Analytics Summary Bar */}
            {adminAnalytics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4 shadow-sm">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Users size={20}/>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Registered Candidates</p>
                    <p className="text-2xl font-black text-slate-800 mt-0.5">{adminAnalytics.summary.registeredCandidates}</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4 shadow-sm">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                    <FileText size={20}/>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Completed Sessions</p>
                    <p className="text-2xl font-black text-slate-800 mt-0.5">{adminAnalytics.summary.completedInterviews}</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4 shadow-sm">
                  <div className="p-3 bg-indigo-55/10 text-indigo-650 rounded-lg">
                    <TrendingUp size={20}/>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Cohort Average Score</p>
                    <p className="text-2xl font-black text-emerald-600 mt-0.5">{adminAnalytics.averages.overallScore}%</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4 shadow-sm">
                  <div className="p-3 bg-indigo-55/10 text-indigo-650 rounded-lg">
                    <Briefcase size={20}/>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Project Knowledge Avg</p>
                    <p className="text-2xl font-black text-slate-800 mt-0.5">{adminAnalytics.averages.projectKnowledge}%</p>
                  </div>
                </div>
              </div>
            )}

            {/* Filter controls */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
              <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                <input 
                  type="text" 
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 w-full sm:w-60 focus:outline-none focus:border-indigo-500"
                  placeholder="Search by name or email..."
                />
                
                <select
                  value={adminFilterRole}
                  onChange={(e) => setAdminFilterRole(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3.5 py-1.5 text-xs text-slate-500 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">All Target Roles</option>
                  {TARGET_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>

              <select
                value={adminSort}
                onChange={(e) => setAdminSort(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3.5 py-1.5 text-xs text-slate-500 focus:outline-none focus:border-indigo-500 w-full md:w-auto"
              >
                <option value="score-desc">Sort by Score: High to Low</option>
                <option value="score-asc">Sort by Score: Low to High</option>
                <option value="date-desc">Sort by Date: Newest First</option>
                <option value="date-asc">Sort by Date: Oldest First</option>
              </select>
            </div>

            {/* Reports List Table */}
            {loading && adminReports.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-slate-400">
                <RefreshCw size={24} className="animate-spin text-indigo-400" />
                <p className="text-xs mt-2">Loading administrative lists...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-16 bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
                <FileText size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-650 font-semibold">No Matching Reports Found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search terms.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="p-4">Candidate Details</th>
                        <th className="p-4">Target Role & Project</th>
                        <th className="p-4 text-center">Score</th>
                        <th className="p-4">Recommendation</th>
                        <th className="p-4">Interview Date</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredReports.map((report) => (
                        <tr key={report.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-4">
                            <p className="font-bold text-slate-800 text-sm">{report.interview.user.name}</p>
                            <p className="text-slate-450 mt-0.5">{report.interview.user.email}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-slate-700">{report.interview.targetRole}</p>
                            <p className="text-slate-450 mt-0.5 italic text-[11px] line-clamp-1">{report.interview.projectTitle}</p>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`text-base font-black ${getScoreColor(report.overallScore)}`}>
                              {(report.overallScore * 10).toFixed(0)}%
                            </span>
                          </td>
                          <td className="p-4">
                            {getRecommendationBadge(report.recommendation)}
                          </td>
                          <td className="p-4 text-slate-500">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => handleAdminViewReport(report)}
                                className="text-[10px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded transition"
                              >
                                View Detailed Report
                              </button>
                              <button 
                                onClick={() => handleDownloadPDF(report.interviewId)}
                                className="p-1.5 bg-slate-50 hover:bg-rose-50 border border-slate-200 text-slate-500 hover:text-rose-600 rounded transition"
                                title="Download PDF"
                              >
                                <Download size={12}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8 text-center text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p>© 2026 InterviewMind AI. All rights reserved.</p>
          <p className="text-[10px] text-slate-400">Built as an advanced AI assessment monorepo featuring FastAPI, scikit-learn, and Node.js express.</p>
        </div>
      </footer>
    </div>
  );
}
