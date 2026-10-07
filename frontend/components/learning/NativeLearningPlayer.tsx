"use client";
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import { useState, useEffect } from "react";
import { CheckCircle2, ChevronRight, ChevronLeft, Menu, FileText, PlayCircle, ChevronDown, Lock, ClipboardCheck, ArrowLeft, ArrowRight, Layout } from "lucide-react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import AssessmentPlayer from './AssessmentPlayer';
import Player from 'next-video/player';
import { PencilLoader } from "@/components/ui/loader-1";

import { useRouter } from "next/navigation";

export default function NativeLearningPlayer({ 
  courseId, 
  userId,
  isSidebarCollapsed = false,
  setIsSidebarCollapsed
}: { 
  courseId: number; 
  userId?: string;
  isSidebarCollapsed?: boolean;
  setIsSidebarCollapsed?: (val: boolean) => void;
}) {
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState("overview");
  
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [courseRes, progressRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/native-courses/courses/${courseId}/hierarchy`),
          userId ? fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/native-courses/courses/${courseId}/progress?user_id=${userId}`) : Promise.resolve(null)
        ]);
        
        if (courseRes.ok) {
          const data = await courseRes.json();
          setCourse(data);
          
          if (progressRes && progressRes.ok) {
            const progressData = await progressRes.json();
            setCompletedLessonIds(progressData.completed_lesson_ids || []);
            if (progressData.status === "COMPLETED") {
              setCourseCompleted(true);
            }
          }

          // Select first lesson by default and expand modules
          if (data.modules?.length > 0) {
            const initialExpanded: Record<number, boolean> = {};
            data.modules.forEach((m: any) => initialExpanded[m.id] = true);
            setExpandedModules(initialExpanded);
            
            if (data.modules[0].lessons?.length > 0) {
              setActiveLessonId(data.modules[0].lessons[0].id);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [courseId, userId]);

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading course content...</div>;
  }

  if (!course) {
    return <div className="p-12 text-center text-red-500">Failed to load course.</div>;
  }

  const allLessons = course.modules.flatMap((m: any) => m.lessons);
  const activeLessonIndex = allLessons.findIndex((l: any) => l.id === activeLessonId);
  const activeLesson = allLessons[activeLessonIndex];
  const activeModuleIndex = course.modules.findIndex((m: any) => m.lessons.some((l: any) => l.id === activeLessonId));
  
  const toggleModule = (id: number) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getLessonIcon = (lesson: any) => {
    const type = lesson.content_blocks?.[0]?.type;
    if (type === "VIDEO") return <PlayCircle className="w-4 h-4 flex-shrink-0" />;
    if (type === "QUIZ" || type === "ASSESSMENT") return <ClipboardCheck className="w-4 h-4 flex-shrink-0" />;
    return <FileText className="w-4 h-4 flex-shrink-0" />;
  };
  
  const getLessonTypeLabel = (lesson: any) => {
    const type = lesson.content_blocks?.[0]?.type;
    if (type === "VIDEO") return "Video";
    if (type === "QUIZ") return "Quiz";
    if (type === "ASSESSMENT") return "Assessment";
    return "Reading";
  };
  
  const handleContinue = async () => {
    if (!userId || !activeLessonId) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/native-courses/courses/${courseId}/lessons/${activeLessonId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCompletedLessonIds(data.completed_lesson_ids || []);
        
        if (data.status === "COMPLETED") {
          setCourseCompleted(true);
        } else if (activeLessonIndex < allLessons.length - 1) {
          // Advance to next lesson
          setActiveLessonId(allLessons[activeLessonIndex + 1].id);
        } else {
          // If we reached the end but it's not completed? Just in case, mark as done
          setCourseCompleted(true);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (courseCompleted) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-surface">
        <div className="max-w-md p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto text-brand-green">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-heading font-bold text-ink">Course Completed!</h2>
          <p className="text-slate-500">Congratulations! You have successfully completed all lessons in this course.</p>
          <button 
            onClick={() => router.push("/learning")}
            className="w-full py-3 bg-brand-green hover:bg-brand-teal-deep text-white rounded-lg font-medium transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-surface">
      
      {/* Sidebar */}
      <div className={`${isSidebarCollapsed ? 'w-16' : 'w-72'} border-r border-hairline bg-canvas flex flex-col h-full flex-shrink-0 transition-all duration-300 z-10`}>
        <div className="p-4 border-b border-hairline bg-surface flex flex-col justify-center min-h-[64px]">
          {!isSidebarCollapsed ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Course Content</h3>
                {setIsSidebarCollapsed && (
                  <button onClick={() => setIsSidebarCollapsed(true)} className="p-1 text-slate-400 hover:text-ink rounded-md transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
              </div>
              <h4 className="font-semibold text-ink text-sm leading-tight truncate">{course.title}</h4>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              {setIsSidebarCollapsed && (
                <button onClick={() => setIsSidebarCollapsed(false)} className="p-2 text-slate-400 hover:text-ink rounded-md transition-colors bg-surface-soft hover:bg-slate-200">
                  <Menu className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {course.modules.map((module: any, mIdx: number) => {
            const isExpanded = expandedModules[module.id];
            
            return (
              <div key={module.id} className="border-b border-hairline last:border-b-0">
                {!isSidebarCollapsed ? (
                  <button 
                    onClick={() => toggleModule(module.id)}
                    className="w-full flex items-center justify-between p-4 bg-surface hover:bg-surface-soft transition-colors text-left"
                  >
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Module {mIdx + 1}
                      </h4>
                      <p className="text-sm font-semibold text-ink">{module.title}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <div className="w-full flex items-center justify-center py-4 border-b border-hairline bg-surface" title={`Module ${mIdx + 1}: ${module.title}`}>
                    <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded flex items-center justify-center text-xs font-bold shadow-sm">
                      M{mIdx + 1}
                    </div>
                  </div>
                )}
                
                {(!isSidebarCollapsed ? isExpanded : true) && (
                  <div className={`${isSidebarCollapsed ? 'space-y-1 py-2' : 'bg-canvas py-1'}`}>
                    {module.lessons.map((lesson: any) => {
                      const isActive = activeLessonId === lesson.id;
                      const isCompleted = completedLessonIds.includes(lesson.id);
                      
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => setActiveLessonId(lesson.id)}
                          title={isSidebarCollapsed ? lesson.title : undefined}
                          className={`w-full flex items-start text-left transition-colors relative ${
                            isSidebarCollapsed ? 'justify-center p-2' : 'px-4 py-3'
                          } ${
                            isActive 
                              ? "bg-brand-green/5 text-ink" 
                              : "text-slate-600 hover:bg-surface-soft"
                          }`}
                        >
                          {isActive && !isSidebarCollapsed && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-green" />
                          )}
                          
                          <div className={`flex items-start gap-3 w-full ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                            <div className={`mt-0.5 flex-shrink-0 ${isCompleted ? 'text-brand-green' : isActive ? 'text-ink' : 'text-slate-400'}`}>
                              {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : getLessonIcon(lesson)}
                            </div>
                            
                            {!isSidebarCollapsed && (
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm leading-snug truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                  {lesson.title}
                                </p>
                                <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500">
                                  <span>{getLessonTypeLabel(lesson)}</span>
                                  {/* Dummy duration since it's not strictly on model */}
                                  <span>· 5 min</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-canvas overflow-y-auto relative">
        {isSubmitting && (
          <div className="absolute inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <PencilLoader className="w-32 h-32" />
            <p className="mt-8 font-medium text-slate-500 animate-pulse">Loading next lesson...</p>
          </div>
        )}
        
        {activeLesson ? (
          (() => {
            const hasHtmlViewer = activeLesson.content_blocks?.some((b: any) => b.type === "HTML_VIEWER");
            if (hasHtmlViewer) {
              return (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <div className="flex-1 w-full h-full relative overflow-hidden bg-white">
                    {activeLesson.content_blocks.map((block: any) => (
                      <ContentBlockRenderer key={block.id} block={block} courseId={courseId} />
                    ))}
                  </div>
                  <div className="p-4 md:p-6 border-t border-hairline bg-surface flex items-center justify-between shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-heading font-bold text-ink truncate pr-4">{activeLesson.title}</h2>
                    </div>
                    <button 
                      disabled={isSubmitting || completedLessonIds.includes(activeLesson.id)}
                      className={`px-6 py-2.5 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 flex-shrink-0 ${
                        completedLessonIds.includes(activeLesson.id) 
                          ? "bg-brand-green/10 text-brand-green border border-brand-green/20" 
                          : "bg-brand-green hover:bg-brand-teal-deep text-white shadow-sm"
                      }`}
                      onClick={handleContinue}
                    >
                      {completedLessonIds.includes(activeLesson.id) ? (
                        <><CheckCircle2 className="w-5 h-5" /> Completed</>
                      ) : "Mark as Complete"} 
                    </button>
                  </div>
                </div>
              );
            }
            return (
          <div className="flex-1 flex flex-col">
            
            {/* Main scrollable area */}
            <div className="flex-1 max-w-[1200px] w-full mx-auto p-6 md:p-8">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                <span>Module {activeModuleIndex + 1}</span>
                <span className="text-slate-300">/</span>
                <span className="text-brand-green">Lesson {activeLessonIndex + 1}</span>
              </div>
              
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-ink mb-2">{activeLesson.title}</h1>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-8">
                <span>{getLessonTypeLabel(activeLesson)}</span>
                <span>·</span>
                <span>5 min</span>
              </div>
              
              <div className="space-y-6">
                {activeLesson.content_blocks?.length > 0 ? (
                  activeLesson.content_blocks.map((block: any) => (
                    <ContentBlockRenderer key={block.id} block={block} courseId={courseId} />
                  ))
                ) : (
                  <div className="p-12 text-center bg-surface border border-hairline rounded-xl text-slate-500">
                    This lesson has no content.
                  </div>
                )}
              </div>
              
              {/* Below Video / Content Section */}
              <div className="mt-8 flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-hairline pb-8">
                <div className="flex-1">
                  <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
                    {/* Assuming we might have a description on lesson, else fallback */}
                    Please review the material above to complete this lesson. Pay close attention to key concepts and practical applications discussed.
                  </p>
                </div>
                
                <div className="flex-shrink-0">
                  <button 
                    disabled={isSubmitting || completedLessonIds.includes(activeLesson.id)}
                    className={`px-6 py-3 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 min-w-[200px] ${
                      completedLessonIds.includes(activeLesson.id) 
                        ? "bg-brand-green/10 text-brand-green border border-brand-green/20" 
                        : "bg-brand-green hover:bg-brand-teal-deep text-white shadow-sm"
                    }`}
                    onClick={handleContinue}
                  >
                    {completedLessonIds.includes(activeLesson.id) ? (
                      <><CheckCircle2 className="w-5 h-5" /> Completed</>
                    ) : "Mark as Complete"} 
                  </button>
                </div>
              </div>

              {/* Lesson Tabs */}
              <div className="mt-8">
                <div className="flex items-center gap-8 border-b border-hairline px-2">
                  <button 
                    onClick={() => setActiveTab("overview")}
                    className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === "overview" ? "text-ink" : "text-slate-500 hover:text-ink"}`}
                  >
                    Overview
                    {activeTab === "overview" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green rounded-t-full" />}
                  </button>
                  <button 
                    onClick={() => setActiveTab("resources")}
                    className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === "resources" ? "text-ink" : "text-slate-500 hover:text-ink"}`}
                  >
                    Resources
                    {activeTab === "resources" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green rounded-t-full" />}
                  </button>
                </div>
                
                <div className="py-6">
                  {activeTab === "overview" && (
                    <div className="prose prose-sm max-w-none text-slate-600">
                      <p>This lesson is part of the <strong>{course.title}</strong> course curriculum. Make sure to complete the required assessments (if any) and mark this lesson as complete to progress forward.</p>
                    </div>
                  )}
                  {activeTab === "resources" && (
                    <div className="text-sm text-slate-500 italic p-4 bg-surface rounded-lg border border-hairline">
                      No additional resources provided for this lesson.
                    </div>
                  )}
                </div>
              </div>
            </div>
            

            
          </div>
            );
          })()
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
            <div className="w-16 h-16 bg-surface-soft rounded-full flex items-center justify-center border border-hairline">
              <Layout className="w-8 h-8 text-slate-400" />
            </div>
            <p className="font-medium text-ink">Select a lesson to begin</p>
          </div>
        )}
      </div>
      
    </div>
  );
}

// ----------------------------------------------------------------------
// Content Block Renderer
// ----------------------------------------------------------------------

function ContentBlockRenderer({ block, courseId }: { block: any, courseId?: number }) {
  const metadata = block.metadata_json || {};
  
  switch (block.type) {
    case "TEXT":
      return <ReadOnlyTipTap content={block.content} />;
      
    case "VIDEO":
      if (metadata.provider === "MP4" && metadata.url) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        return (
          <div className="w-full bg-black rounded-xl overflow-hidden shadow-md mx-auto max-w-5xl border border-hairline-strong">
            <div className="relative w-full aspect-video flex justify-center">
              <Player src={`${baseUrl}${metadata.url}`} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        );
      }
      
      const extractYoutubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
      };
      const videoId = metadata.url ? extractYoutubeId(metadata.url) : null;
      
      if (!videoId) return null;
      return (
        <div className="w-full bg-black rounded-xl overflow-hidden shadow-md mx-auto max-w-5xl border border-hairline-strong">
          <div className="relative w-full aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0`}
              className="absolute inset-0 w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      );
      
    case "IMAGE":
      if (!metadata.url) return null;
      return (
        <div className="my-6 rounded-xl overflow-hidden border border-hairline flex justify-center bg-canvas p-4 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={metadata.url} 
            alt={metadata.alt || ""} 
            className="max-h-[500px] object-contain rounded-lg"
          />
        </div>
      );
      
    case "EMBED":
      if (!metadata.url) return null;
      return (
        <a 
          href={metadata.url} 
          target="_blank" 
          rel="noreferrer"
          className="block p-4 border border-hairline rounded-xl hover:border-brand-green hover:shadow-md transition-all bg-surface group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-green/10 text-brand-green rounded-lg group-hover:bg-brand-green group-hover:text-white transition-colors">
              <PlayCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-ink group-hover:text-brand-green transition-colors">{metadata.title || "External Resource"}</h4>
              <p className="text-xs text-slate-500 mt-1 truncate max-w-lg">{metadata.url}</p>
            </div>
          </div>
        </a>
      );
      
    case "QUIZ":
      return (
        <div className="p-6 border border-brand-teal/20 bg-brand-teal/5 rounded-xl space-y-4">
          <h4 className="font-semibold text-brand-teal-deep text-lg">{metadata.question}</h4>
          <div className="space-y-2">
            {metadata.options?.map((opt: any) => (
              <label key={opt.id} className="flex items-center gap-3 p-3 rounded-lg border border-hairline bg-surface hover:bg-canvas cursor-pointer transition-colors">
                <input type="radio" name={`quiz-${block.id}`} className="w-4 h-4 text-brand-teal focus:ring-brand-teal" />
                <span className="text-sm text-ink">{opt.text}</span>
              </label>
            ))}
          </div>
        </div>
      );
      
    case "ASSESSMENT":
      if (!metadata.assessment_id) return null;
      return (
        <AssessmentPlayer 
          assessmentId={metadata.assessment_id} 
          courseId={courseId!}
          onComplete={(passed) => {
            // Optional: Auto-trigger continue or show a message
          }}
        />
      );
      
    case "HTML_VIEWER":
      if (!metadata.url) return null;
      return (
        <iframe 
          src={metadata.url} 
          className="w-full h-full border-0 absolute inset-0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen
        />
      );

    default:
      return null;
  }
}

// ----------------------------------------------------------------------
// ReadOnly TipTap Editor
// ----------------------------------------------------------------------

function ReadOnlyTipTap({ content }: { content: string }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content,
    editable: false,
  });

  if (!editor) return null;

  return (
    <div className="prose prose-slate prose-lg max-w-none prose-p:my-4 prose-headings:font-heading prose-headings:text-ink prose-a:text-brand-green">
      <EditorContent editor={editor} />
    </div>
  );
}
