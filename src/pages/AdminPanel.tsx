import React, { useState, useEffect, useRef } from "react";
import { Plus, Building2, BookOpen, Loader2, Globe, ShieldCheck, Upload, FileText, Users, Mail, Phone, Flame, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import Papa from "papaparse";

interface Company {
  id: string;
  name: string;
}

interface UserDetail {
  username: string;
  email: string;
  mobile: string;
  streak: number;
  role: string;
}

export default function AdminPanel({ user }: { user: { token: string } }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New Company Form
  const [newCompanyName, setNewCompanyName] = useState("");
  const [addingCompany, setAddingCompany] = useState(false);

  // New Question Form
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [fetchingQuestions, setFetchingQuestions] = useState(false);
  const [questionTitle, setQuestionTitle] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [topic, setTopic] = useState("");
  const [leetcodeLink, setLeetcodeLink] = useState("");
  const [addingQuestion, setAddingQuestion] = useState(false);

  // CSV Import State
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);

  useEffect(() => {
    fetchCompanies();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchQuestions(selectedCompanyId);
    } else {
      setQuestions([]);
    }
  }, [selectedCompanyId]);

  const fetchQuestions = async (companyId: string) => {
    setFetchingQuestions(true);
    try {
      const res = await fetch(`/api/questions/${companyId}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) setQuestions(await res.json());
    } catch (error) {
      console.error(error);
    } finally {
      setFetchingQuestions(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/companies", {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) setCompanies(await res.json());
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) setUsers(await res.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingCompany(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}` 
        },
        body: JSON.stringify({ name: newCompanyName })
      });
      if (res.ok) {
        setNewCompanyName("");
        fetchCompanies();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAddingCompany(false);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!id) return;
    console.log(`[FRONTEND] Requested delete for company: ${id}`);
    if (!window.confirm("Are you sure? This will delete the company and ALL its questions permanently.")) {
      console.log("[FRONTEND] Delete cancelled by user");
      return;
    }
    
    try {
      console.log(`[FRONTEND] Sending DELETE request for /api/companies/${id}`);
      const res = await fetch(`/api/companies/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      if (res.ok) {
        console.log("[FRONTEND] Delete SUCCESS");
        fetchCompanies();
        if (selectedCompanyId === id) setSelectedCompanyId("");
      } else {
        const err = await res.json();
        console.error("[FRONTEND] Delete FAILED:", err);
        alert(err.error || "Failed to delete company");
      }
    } catch (error) {
      console.error("[FRONTEND] Network error during delete:", error);
      alert("Network error while deleting company");
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingQuestion(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}` 
        },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          title: questionTitle,
          difficulty,
          topic,
          leetcodeLink: leetcodeLink // Backend will handle empty link
        })
      });
      if (res.ok) {
        setQuestionTitle("");
        setTopic("");
        setLeetcodeLink("");
        fetchQuestions(selectedCompanyId); // Refresh list
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this question?")) return;
    
    try {
      const res = await fetch(`/api/questions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) {
        fetchQuestions(selectedCompanyId);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete question");
      }
    } catch (error) {
      console.error("Delete question error:", error);
      alert("Network error while deleting question");
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompanyId) return;

    setImporting(true);
    setImportResults(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let successCount = 0;
        let failCount = 0;

        for (const row of results.data as any) {
          try {
            // Requested Format: QuestionTitle, Difficulty, Topic, link
            const title = row.QuestionTitle?.trim() || row.title?.trim();
            const difficultyLevel = row.Difficulty?.trim() || row.difficulty?.trim() || "Medium";
            const topicName = row.Topic?.trim() || row.topic?.trim() || "General";
            const link = row.link?.trim() || row.leetcodeLink?.trim() || "";

            if (!title) {
              failCount++;
              continue;
            }

            const res = await fetch("/api/questions", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${user.token}` 
              },
              body: JSON.stringify({
                companyId: selectedCompanyId,
                title,
                difficulty: difficultyLevel,
                topic: topicName,
                leetcodeLink: link
              })
            });

            if (res.ok) successCount++;
            else failCount++;
          } catch (error) {
            failCount++;
          }
        }
        
        setImportResults({ success: successCount, failed: failCount });
        setImporting(false);
        fetchQuestions(selectedCompanyId); // Refresh question list
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <div className="p-8 bg-slate-900 text-white rounded-3xl shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="text-blue-500" /> Admin Command Center
          </h1>
          <p className="text-slate-400 mt-1">Manage companies and questions for all students.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left Column: Forms */}
        <div className="space-y-12">
          {/* Add Company Section */}
          <section className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-700">
              <Building2 className="text-blue-600" /> Manage Companies
            </h3>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <form onSubmit={handleAddCompany} className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="New Company Name"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button 
                  disabled={addingCompany}
                  className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {addingCompany ? <Loader2 className="animate-spin" /> : <><Plus size={20} /> Add</>}
                </button>
              </form>

              <div className="mt-8 space-y-3">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Existing Companies</p>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                  {companies.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group border border-transparent hover:border-red-100 transition-all">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700">{c.name}</span>
                        <span className="text-[9px] uppercase font-black text-slate-400">ID: {c.id.slice(0, 8)}</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCompany(c.id);
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Company"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* CSV Import Section */}
          <section className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-700">
              <Upload className="text-green-600" /> Bulk Import (CSV)
            </h3>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-6">
                <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-2">Required CSV Headers</p>
                <div className="flex flex-wrap gap-2">
                  {["QuestionTitle", "Difficulty", "Topic", "link"].map(h => (
                    <span key={h} className="bg-white px-2 py-1 rounded-md border border-blue-200 text-xs font-mono text-blue-700">{h}</span>
                  ))}
                </div>
                <p className="text-[10px] text-blue-500 mt-3 font-medium">
                  * Questions will be added to the company selected above.
                </p>
              </div>

              <div className="relative">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleCSVUpload}
                  ref={fileInputRef}
                  className="hidden"
                  id="csv-upload"
                  disabled={importing || !selectedCompanyId}
                />
                <label 
                  htmlFor="csv-upload"
                  className={cn(
                    "flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-3xl transition-all",
                    !selectedCompanyId ? "bg-slate-50 border-slate-100 cursor-not-allowed opacity-50" : 
                    importing ? "bg-slate-50 border-slate-200 cursor-not-allowed" : 
                    "border-slate-200 hover:bg-green-50 hover:border-green-300 cursor-pointer"
                  )}
                >
                  {importing ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-green-600" size={32} />
                      <span className="font-bold text-slate-600">Finding links & importing...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <FileText className={!selectedCompanyId ? "text-slate-200" : "text-slate-400"} size={32} />
                      <div>
                        {!selectedCompanyId ? (
                          <p className="font-bold text-slate-400">Select a Company First</p>
                        ) : (
                          <>
                            <p className="font-bold text-slate-700">Click to Upload CSV</p>
                            <p className="text-sm text-slate-500 mt-1">Links will be auto-generated</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </label>
              </div>

              {importResults && (
                <div className="mt-4 p-4 rounded-2xl flex items-center justify-around text-center bg-slate-50 border border-slate-100">
                  <div className="text-green-600">
                    <p className="text-2xl font-black">{importResults.success}</p>
                    <p className="text-[10px] font-bold uppercase">Imported</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>
                  <div className="text-red-500">
                    <p className="text-2xl font-black">{importResults.failed}</p>
                    <p className="text-[10px] font-bold uppercase">Skipped/Error</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Single Add Form */}
        <div className="space-y-12">
          <section className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-700">
              <BookOpen className="text-purple-600" /> Add New Question
            </h3>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-fit">
              <form onSubmit={handleAddQuestion} className="space-y-4">
                {/* ... existing fields ... */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Select Company</label>
                  <select 
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Choose a company...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Question Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Reverse a String"
                    value={questionTitle}
                    onChange={(e) => setQuestionTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Difficulty</label>
                    <select 
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Topic</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Arrays, Trees"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">
                    LeetCode URL <span className="text-slate-400 lowercase normal-case italic">(Optional - Auto-generated if empty)</span>
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="url" 
                      placeholder="https://leetcode.com/problems/..."
                      value={leetcodeLink}
                      onChange={(e) => setLeetcodeLink(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button 
                  disabled={addingQuestion}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
                >
                  {addingQuestion ? <Loader2 className="animate-spin" /> : <><Plus size={20} /> Deploy Question</>}
                </button>
              </form>
            </div>
          </section>

          {/* Manage Questions List */}
          <section className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-700">
              <FileText className="text-amber-600" /> Manage Questions
            </h3>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 min-h-[400px]">
              {!selectedCompanyId ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 mt-20">
                  <BookOpen size={48} className="opacity-20" />
                  <p className="font-bold">Select a company to manage questions</p>
                </div>
              ) : fetchingQuestions ? (
                <div className="flex justify-center mt-20">
                  <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">
                    Questions for {companies.find(c => c.id === selectedCompanyId)?.name}
                  </p>
                  <div className="space-y-2">
                    {questions.map(q => (
                      <div key={q.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group border border-transparent hover:border-red-100 transition-all">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-800">{q.title}</span>
                          <div className="flex gap-2">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                              q.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                              q.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>{q.difficulty}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase bg-white border border-slate-200 px-2 py-0.5 rounded-md">{q.topic}</span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuestion(q.id);
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Delete Question"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                    {questions.length === 0 && (
                      <div className="text-center py-20 text-slate-400 italic">No questions added for this company.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Users Section */}
      <section className="space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2 text-slate-700">
          <Users className="text-blue-600" /> Registered Students
        </h3>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">User</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">Contact Info</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Streak</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.filter(u => u.role !== 'admin').map((u) => (
                <tr key={u.username} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-6">
                    <p className="font-bold text-slate-800">{u.username}</p>
                    <p className="text-xs text-slate-400 font-mono">UID: {u.username.slice(0, 8)}</p>
                  </td>
                  <td className="p-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail size={14} className="text-slate-400" /> {u.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone size={14} className="text-slate-400" /> {u.mobile}
                      </div>
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-sm font-black">
                      <Flame size={14} /> {u.streak}
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase tracking-wider">
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.filter(u => u.role !== 'admin').length === 0 && (
            <div className="p-12 text-center text-slate-400 italic">No students registered yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

const cn = (...classes: string[]) => classes.filter(Boolean).join(" ");
