"use client";
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @next/next/no-img-element, @next/next/no-location-assign-relative-destination */

import { useState, useEffect } from "react";
import { PlayCircle, Clock, Search, ChevronRight, CheckCircle2 } from "lucide-react";
import { useSession } from "next-auth/react";

export default function LearningCatalogPage() {
  const categories = [
    { name: "Database & Security", tagClass: "bg-accent-purple text-on-dark" },
    { name: "Search", tagClass: "bg-accent-orange text-on-dark" },
    { name: "Cloud", tagClass: "bg-brand-teal text-on-dark" },
    { name: "General Training", tagClass: "bg-brand-green text-on-dark" }
  ];

  const { data: session } = useSession();
  const userId = session?.user?.id;
  const token = session?.accessToken;
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const url = new URL(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/learning/courses`);
        if (userId) {
            url.searchParams.append("user_id", userId);
        }
        const res = await fetch(url.toString());
        const data = await res.json();
        setCourses(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (userId !== undefined) {
        fetchCourses();
    }
  }, [userId]);

  const [filter, setFilter] = useState("all");

  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.title?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    const status = c.status?.toLowerCase();
    if (filter === "completed" && status !== "completed") return false;
    if (filter === "in_progress" && status !== "in_progress" && status !== "incomplete" && (c.progress_percent > 0 && c.progress_percent < 100)) return false;
    if (filter === "in_progress" && c.progress_percent === 0) return false;
    if (filter === "in_progress" && status === "completed") return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-display-lg font-heading tracking-tight text-ink">Learning Hub</h1>
          <p className="mt-2 text-subtitle text-slate-500">Master new skills and complete your required training modules.</p>
        </div>
        
        {/* Large Search Pill from MongoDB University style */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-14 w-full rounded-md border border-hairline-strong bg-canvas pl-12 pr-4 text-base outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all shadow-sm"
            suppressHydrationWarning
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button 
          suppressHydrationWarning
          className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium ${filter === "all" ? "bg-ink text-on-dark" : "border border-hairline text-slate-600 hover:bg-surface-soft"}`} 
          onClick={() => setFilter("all")}
        >
          All Courses
        </button>
        <button 
          suppressHydrationWarning
          className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium ${filter === "in_progress" ? "bg-ink text-on-dark" : "border border-hairline text-slate-600 hover:bg-surface-soft"}`} 
          onClick={() => setFilter("in_progress")}
        >
          In Progress
        </button>
        <button 
          suppressHydrationWarning
          className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium ${filter === "completed" ? "bg-ink text-on-dark" : "border border-hairline text-slate-600 hover:bg-surface-soft"}`} 
          onClick={() => setFilter("completed")}
        >
          Completed
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500">Loading courses...</div>
        ) : filteredCourses.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500">No courses found.</div>
        ) : filteredCourses.map((course) => {
          const progress = course.progress_percent || 0;
          const isStarted = progress > 0;
          const isCompleted = progress >= 100;

          return (
          <div key={course.id} className="bg-canvas rounded-lg border border-hairline overflow-hidden hover:shadow-subtle transition-shadow group flex flex-col">
            {/* Thumbnail Image */}
            <div className="w-full h-40 bg-slate-100 relative overflow-hidden">
              {course.thumbnail_url ? (
                <img 
                  src={course.thumbnail_url.startsWith('http') ? course.thumbnail_url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${course.thumbnail_url}`} 
                  alt={course.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <PlayCircle className="w-12 h-12 opacity-50" />
                </div>
              )}
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <div className="mb-4">
                <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase rounded-sm bg-brand-teal text-on-dark`}>
                  {course.category?.name || "General"}
                </span>
              </div>
              
              <h3 className="text-heading-5 font-semibold text-ink mb-2 group-hover:text-brand-green-dark transition-colors">
                {course.title}
              </h3>
              <p className="text-body-sm text-slate-600 mb-6 flex-1">
                {course.description ? course.description.replace(/<[^>]+>/g, '') : "No description provided."}
              </p>
              
              <div className="flex items-center gap-4 text-sm text-slate-500 mt-auto">
                <div className="flex items-center">
                  <Clock className="mr-1.5 h-4 w-4" />
                  Self-paced
                </div>
                <div className="flex items-center">
                  <PlayCircle className="mr-1.5 h-4 w-4" />
                  Online
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            {isStarted && (
              <div className="w-full bg-slate-100 h-1.5">
                <div 
                  className="bg-brand-green h-1.5 transition-all duration-500" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <div className="bg-surface-soft p-4 border-t border-hairline flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${isCompleted ? 'text-brand-green-dark flex items-center gap-1' : 'text-slate-500'}`}>
                  {isCompleted ? <><CheckCircle2 className="w-4 h-4" /> Completed</> : isStarted ? `${progress}% Complete` : "Not Started"}
                </span>
                
                {!isCompleted && (
                  <a href={`/learning/${course.id}`} className="flex items-center text-sm font-semibold text-brand-green-dark hover:underline group-hover:translate-x-1 transition-transform">
                    {isStarted ? "Resume" : "Get Started"} <ChevronRight className="ml-1 h-4 w-4" />
                  </a>
                )}
              </div>
              
              {isCompleted && (
                <div className="flex items-center gap-2 pt-2 border-t border-hairline">
                  <a 
                    href={`/learning/${course.id}?mode=review`} 
                    className="flex-1 flex justify-center items-center py-2 bg-canvas border border-input rounded-md text-sm font-medium text-slate-700 hover:bg-surface transition-colors"
                  >
                    Review
                  </a>
                  <button 
                    suppressHydrationWarning
                    onClick={() => {
                      if(confirm("Are you sure you want to restart this course? A new attempt will be created.")) {
                        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/learning/courses/${course.id}/restart`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ user_id: userId })
                        }).then(() => {
                          window.location.href = `/learning/${course.id}`;
                        });
                      }
                    }}
                    className="flex-1 flex justify-center items-center py-2 bg-brand-green text-white rounded-md text-sm font-medium hover:bg-brand-teal-deep transition-colors"
                  >
                    Restart
                  </button>
                </div>
              )}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}
