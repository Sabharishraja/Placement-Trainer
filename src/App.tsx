/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, ShieldCheck, LogOut, Search, Filter, CheckCircle2, RotateCcw, Circle, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CompanyQuestions from "./pages/CompanyQuestions";
import AdminPanel from "./pages/AdminPanel";

// Utility function for conditional classes
const cn = (...classes: string[]) => classes.filter(Boolean).join(" ");

export default function App() {
  const [user, setUser] = useState<{ username: string; role: string; token: string } | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = (userData: { username: string; role: string; token: string }) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Routes>
          <Route path="/login" element={!user ? <Login onLogin={login} /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
          
          <Route
            path="/*"
            element={
              user ? (
                <AppLayout user={user} onLogout={logout}>
                  <Routes>
                    <Route path="/" element={<Dashboard user={user} />} />
                    <Route path="/company/:companyId" element={<CompanyQuestions user={user} />} />
                    {user.role === "admin" && <Route path="/admin" element={<AdminPanel user={user} />} />}
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </AppLayout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function AppLayout({ children, user, onLogout }: { children: ReactNode; user: { username: string; role: string }; onLogout: () => void }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-slate-900 text-white transition-all duration-300 ease-in-out flex flex-col",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <div className={cn("flex items-center gap-3 overflow-hidden", !isSidebarOpen && "justify-center")}>
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-lg">P</span>
            </div>
            {isSidebarOpen && <span className="font-bold text-lg tracking-tight whitespace-nowrap text-slate-100">Placement Trainer</span>}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" isOpen={isSidebarOpen} />
          {user.role === "admin" && (
            <SidebarLink to="/admin" icon={<ShieldCheck size={20} />} label="Admin Panel" isOpen={isSidebarOpen} />
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => { onLogout(); navigate("/login"); }}
            className="w-full flex items-center gap-3 p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="mt-4 w-full flex items-center justify-center p-2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10">
          <h2 className="text-lg font-semibold text-slate-800 capitalize">
            Welcome, {user.username} {user.role === "admin" && "(Admin)"}
          </h2>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wider">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function SidebarLink({ to, icon, label, isOpen }: { to: string; icon: ReactNode; label: string; isOpen: boolean }) {
  return (
    <Link 
      to={to} 
      className="flex items-center gap-3 p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
    >
      {icon}
      {isOpen && <span className="whitespace-nowrap font-medium text-sm">{label}</span>}
    </Link>
  );
}
