"use client";
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, react/no-unescaped-entities */

import { useState, useEffect } from "react";
import { BookOpen, Calendar as CalendarIcon, FileText, ArrowRight, PlayCircle, Clock } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { AITrendingNews } from "@/components/home/AITrendingNews";

export default function EmployeeDashboardPage() {
  const upcomingEvents = [
    { id: 1, title: "Company All-Hands Q3", time: "Tomorrow, 10:00 AM", type: "MEETING" },
    { id: 2, title: "Security Compliance Training", time: "Friday, 2:00 PM", type: "TRAINING" }
  ];

  const { data: session } = useSession();
  const userId = session?.user?.id;
  const token = session?.accessToken;
  const [continueLearning, setContinueLearning] = useState<any[]>([]);
  const [importantDocs, setImportantDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const fetchCourses = async () => {
      try {
        const url = new URL(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/learning/courses`);
        url.searchParams.append("user_id", userId);
        const res = await fetch(url.toString());
        const data = await res.json();
        
        // Filter for in-progress courses
        const inProgress = data.filter((c: any) => 
          c.status !== "completed" && c.status !== "passed" && c.progress_percent > 0
        ).slice(0, 3);
        
        setContinueLearning(inProgress);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCourses();
  }, [userId]);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/documents`);
        const data = await res.json();
        // Take the 4 most recently updated documents
        const sorted = (data || []).sort((a: any, b: any) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ).slice(0, 4);
        setImportantDocs(sorted);
      } catch (err) {
        console.error('Failed to fetch documents', err);
      } finally {
        setDocsLoading(false);
      }
    };
    fetchDocs();
  }, []);

  return (
    <div className="space-y-10 pb-12">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-teal-deep to-brand-teal rounded-2xl p-8 shadow-sm flex items-center justify-between overflow-hidden relative">
        <div className="relative z-10">
          <h1 className="text-display-lg font-heading font-semibold text-white tracking-tight">
            Good morning, {session?.user?.name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="mt-2 text-white/80 text-lg">
            Welcome to Maple Intranet. Here's your overview for today.
          </p>
        </div>
        <div className="hidden md:block absolute right-0 top-0 h-full w-1/3 bg-brand-green/20" style={{ clipPath: 'polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%)' }}></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Main Column */}
        <div className="xl:col-span-2 space-y-8">
          
          <AITrendingNews />

          
          {/* Continue Learning */}
          <section className="bg-canvas rounded-xl border border-hairline p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-heading-5 font-semibold text-ink flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-brand-teal" />
                Continue Learning
              </h2>
              <Link href="/learning" className="text-sm font-medium text-brand-green-dark hover:text-brand-green transition-colors flex items-center gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            
            <div className="space-y-4">
              {continueLearning.map(course => (
                <div key={course.id} className="p-4 rounded-lg border border-hairline hover:border-brand-teal/30 bg-surface flex items-center justify-between transition-colors group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-brand-teal/10 flex items-center justify-center">
                      <PlayCircle className="h-5 w-5 text-brand-teal" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-ink text-sm group-hover:text-brand-teal transition-colors">{course.title}</h4>
                      <div className="flex items-center gap-4 mt-1">
                        <div className="w-32 h-1.5 bg-canvas rounded-full overflow-hidden">
                          <div className="h-full bg-brand-green rounded-full" style={{ width: `${course.progress}%` }}></div>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">{course.progress}%</span>
                      </div>
                    </div>
                  </div>
                  <button className="text-sm font-medium text-brand-teal bg-brand-teal/10 px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Important Documents */}
          <section className="bg-canvas rounded-xl border border-hairline p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-heading-5 font-semibold text-ink flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent-purple" />
                Important Documents
              </h2>
              <Link href="/documents" className="text-sm font-medium text-brand-green-dark hover:text-brand-green transition-colors flex items-center gap-1">
                Browse Library <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {docsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="p-5 rounded-lg bg-surface border border-hairline animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : importantDocs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No documents available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {importantDocs.map((doc: any) => {
                  const mainCat = doc.category?.main_category || "OFFICIAL";
                  const subCat = doc.category?.name;
                  const catHref = subCat
                    ? `/documents?category=${mainCat}&subcategory=${subCat}`
                    : `/documents?category=${mainCat}`;
                  const updatedAt = doc.updated_at
                    ? new Date(doc.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : null;
                  return (
                    <Link
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className="p-5 rounded-lg bg-surface border border-hairline hover:border-accent-purple/30 transition-colors group flex flex-col gap-1"
                    >
                      <h4 className="font-semibold text-ink group-hover:text-accent-purple transition-colors line-clamp-1">
                        {doc.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        {subCat && (
                          <span
                            onClick={(e) => { e.preventDefault(); window.location.href = catHref; }}
                            className="text-xs font-medium text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded-full hover:bg-accent-purple/20 transition-colors"
                          >
                            {subCat.replace(/_/g, " ").replace(/\bUNCATEGORIZED \w+/i, "General")}
                          </span>
                        )}
                        {updatedAt && (
                          <p className="text-xs text-slate-400">Updated {updatedAt}</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

        </div>

        {/* Side Column */}
        <div className="space-y-8">
          
          {/* Upcoming Events */}
          <section className="bg-canvas rounded-xl border border-hairline p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-heading-5 font-semibold text-ink flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-accent-orange" />
                Upcoming Events
              </h2>
            </div>
            
            <div className="space-y-4">
              {upcomingEvents.map(event => (
                <div key={event.id} className="relative pl-4 border-l-2 border-brand-green">
                  <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-brand-green ring-4 ring-canvas"></div>
                  <h4 className="font-semibold text-ink text-sm">{event.title}</h4>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs">
                    <Clock className="h-3.5 w-3.5" />
                    {event.time}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="bg-canvas rounded-xl border border-hairline p-6 shadow-sm">
             <h2 className="text-heading-5 font-semibold text-ink mb-4">Quick Links</h2>
             <div className="space-y-2">
               <Link href="/documents" className="flex items-center justify-between p-3 rounded-lg hover:bg-surface transition-colors text-sm font-medium text-slate-700">
                 Find a Policy
                 <ArrowRight className="h-4 w-4 text-slate-400" />
               </Link>
               <Link href="/employees" className="flex items-center justify-between p-3 rounded-lg hover:bg-surface transition-colors text-sm font-medium text-slate-700">
                 Employee Directory
                 <ArrowRight className="h-4 w-4 text-slate-400" />
               </Link>
               <Link href="/ai" className="flex items-center justify-between p-3 rounded-lg hover:bg-surface transition-colors text-sm font-medium text-slate-700">
                 Ask AI Assistant
                 <ArrowRight className="h-4 w-4 text-slate-400" />
               </Link>
             </div>
          </section>

        </div>
      </div>
    </div>
  );
}
