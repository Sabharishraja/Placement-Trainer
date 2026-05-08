import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Building2, CheckCircle, Clock, BookOpen, ChevronRight, Trophy, BarChart3, Lock } from "lucide-react";
import { motion } from "motion/react";

interface Stats {
  totalQuestions: number;
  solvedQuestions: number;
  revisionNeeded: number;
  remainingQuestions: number;
  streak: number;
}

interface Company {
  id: string;
  name: string;
}

export default function Dashboard({ user }: { user: { token: string } }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${user.token}` };
      
      const [statsRes, companiesRes] = await Promise.all([
        fetch("/api/stats", { headers }),
        fetch("/api/companies", { headers })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (companiesRes.ok) setCompanies(await companiesRes.json());
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.token]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  const completionRate = stats ? Math.round((stats.solvedQuestions / Math.max(stats.totalQuestions, 1)) * 100) : 0;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<BookOpen className="text-blue-600" />} 
          label="Total Questions" 
          value={stats?.totalQuestions || 0} 
          color="bg-blue-50"
        />
        <StatCard 
          icon={<CheckCircle className="text-green-600" />} 
          label="Solved" 
          value={stats?.solvedQuestions || 0} 
          color="bg-green-50"
        />
        <StatCard 
          icon={<Clock className="text-orange-600" />} 
          label="Revision Needed" 
          value={stats?.revisionNeeded || 0} 
          color="bg-orange-50"
        />
        <StatCard 
          icon={<Trophy className="text-amber-600" />} 
          label="Current Streak" 
          value={stats?.streak || 0} 
          color="bg-amber-50"
          suffix=" Days"
        />
      </div>

      {/* Main Progress Bar */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-8">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-full h-full" viewBox="0 0 36 36">
            <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path className="text-blue-600 transition-all duration-1000" strokeWidth="3" strokeDasharray={`${completionRate}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-bold text-xl">
            {completionRate}%
          </div>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-slate-800">Overall Progress</h3>
          <p className="text-slate-500 mt-1">Keep crushing the problems! You're doing great.</p>
        </div>
      </div>

      {/* Companies Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="text-slate-400" /> Company Modules
          </h3>
          <span className="text-sm text-slate-500 font-medium">{companies.length} companies listed</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company, index) => (
            <Link key={company.id} to={`/company/${company.id}`}>
              <motion.div
                whileHover={{ y: -5 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{company.name}</h4>
                      <p className="text-xs text-slate-500 font-medium">Practice Questions</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                </div>
              </motion.div>
            </Link>
          ))}
          {companies.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl italic">
              No companies added yet. Ask your admin to add some!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, suffix = "" }: { icon: React.ReactNode; label: string; value: number; color: string; suffix?: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500 mb-1">{label}</p>
        <p className="text-3xl font-black text-slate-900">{value}{suffix}</p>
      </div>
    </div>
  );
}
