import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ExternalLink, CheckCircle, Clock, Circle, ArrowLeft, Search, Filter } from "lucide-react";
import { motion } from "motion/react";

interface Question {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
  leetcodeLink: string;
}

export default function CompanyQuestions({ user }: { user: { token: string } }) {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [solved, setSolved] = useState<string[]>([]);
  const [revision, setRevision] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("All");
  const [filterTopic, setFilterTopic] = useState("All");
  const [topics, setTopics] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${user.token}` };
        const [quesRes, progRes] = await Promise.all([
          fetch(`/api/questions/${companyId}`, { headers }),
          fetch("/api/user/progress", { headers })
        ]);

        if (quesRes.ok) {
          const quesData: Question[] = await quesRes.json();
          setQuestions(quesData);
          
          // Extract unique topics
          const uniqueTopics = Array.from(new Set(quesData.map(q => q.topic))).sort();
          setTopics(uniqueTopics);
        }
        if (progRes.ok) {
          const progData = await progRes.json();
          setSolved(progData.solvedQuestions);
          setRevision(progData.revisionNeeded);
        }
      } catch (error) {
        console.error("Fetch questions error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId, user.token]);

  const updateStatus = async (questionId: string, status: string) => {
    try {
      const res = await fetch("/api/user/progress", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}` 
        },
        body: JSON.stringify({ questionId, status })
      });

      if (res.ok) {
        // Optimistic update
        if (status === "solved") {
          setSolved(prev => [...prev.filter(id => id !== questionId), questionId]);
          setRevision(prev => prev.filter(id => id !== questionId));
        } else if (status === "revision") {
          setRevision(prev => [...prev.filter(id => id !== questionId), questionId]);
          setSolved(prev => prev.filter(id => id !== questionId));
        } else {
          setSolved(prev => prev.filter(id => id !== questionId));
          setRevision(prev => prev.filter(id => id !== questionId));
        }
      }
    } catch (error) {
      console.error("Update status error:", error);
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDifficulty = filterDifficulty === "All" || q.difficulty === filterDifficulty;
    const matchesTopic = filterTopic === "All" || q.topic === filterTopic;
    return matchesSearch && matchesDifficulty && matchesTopic;
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate("/")}
          className="p-2 hover:bg-white rounded-xl transition-colors shadow-sm cursor-pointer"
        >
          <ArrowLeft className="text-slate-600" />
        </button>
        <h1 className="text-3xl font-bold text-slate-800">Company Questions</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Topic Filter */}
        <div className="flex-1">
          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-600 appearance-none cursor-pointer"
          >
            <option value="All">All Topics</option>
            {topics.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          {["All", "Easy", "Medium", "Hard"].map(diff => (
            <button
              key={diff}
              onClick={() => setFilterDifficulty(diff)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                filterDifficulty === diff 
                ? "bg-blue-600 text-white" 
                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.map((q) => (
          <div 
            key={q.id}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  q.difficulty === 'Easy' ? 'bg-green-100 text-green-600' :
                  q.difficulty === 'Medium' ? 'bg-orange-100 text-orange-600' :
                  'bg-red-100 text-red-600'
                }`}>
                  {q.difficulty}
                </span>
                <span className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-50 rounded italic whitespace-nowrap">
                  {q.topic}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-800">{q.title}</h3>
            </div>

            <div className="flex items-center gap-3">
              <a 
                href={q.leetcodeLink} 
                target="_blank" 
                rel="no-referrer"
                className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2 text-sm font-bold px-4"
              >
                Solve on LeetCode <ExternalLink size={16} />
              </a>

              <select
                value={solved.includes(q.id) ? "solved" : revision.includes(q.id) ? "revision" : "reset"}
                onChange={(e) => updateStatus(q.id, e.target.value)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer ${
                  solved.includes(q.id) ? "bg-green-100 text-green-600" :
                  revision.includes(q.id) ? "bg-orange-100 text-orange-600" :
                  "bg-slate-100 text-slate-500"
                }`}
              >
                <option value="reset">Not Started</option>
                <option value="solved">Completed</option>
                <option value="revision">Revision Needed</option>
              </select>
            </div>
          </div>
        ))}
        {filteredQuestions.length === 0 && (
          <div className="py-20 text-center text-slate-400 italic font-medium bg-white rounded-3xl border border-slate-100">
            No questions found matching your filters.
          </div>
        )}
      </div>
    </div>
  );
}
