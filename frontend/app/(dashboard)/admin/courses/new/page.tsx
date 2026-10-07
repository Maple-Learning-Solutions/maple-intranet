"use client";
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle2, AlertCircle, Layout, Archive } from "lucide-react";
import { useSession } from "next-auth/react";

export default function NewCoursePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const userId = session?.user?.id;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [scormPackageId, setScormPackageId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [courseType, setCourseType] = useState<"NATIVE" | "SCORM">("NATIVE");
  const [scormFile, setScormFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category_id: 1, // Default category
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.endsWith('.zip')) {
        setScormFile(file);
        setScormPackageId(null);
        setUploadProgress(0);
      } else {
        alert("Please select a valid .zip SCORM package");
      }
    }
  };

  const handleUploadPackage = () => {
    if (!scormFile) return;
    setIsUploading(true);
    setUploadProgress(0);

    const scormData = new FormData();
    scormData.append("title", (formData.title || scormFile.name) + " SCORM");
    scormData.append("file", scormFile);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/learning-packages/upload`);
    
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        setScormPackageId(response.id);
      } else {
        let errorMsg = "Failed to upload package.";
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData.detail) errorMsg = errData.detail;
        } catch(e) {}
        alert(errorMsg);
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      alert("Network error while uploading package.");
    };

    xhr.send(scormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // Create Course Record
      const courseRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/learning/courses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers, // Include auth headers
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category_id: formData.category_id,
          learning_package_id: scormPackageId,
          course_type: courseType
        }),
      });

      if (!courseRes.ok) {
        throw new Error("Failed to create course");
      }
      
      const createdCourse = await courseRes.json();

      if (courseType === "NATIVE") {
        router.push(`/admin/courses/builder/${createdCourse.id}`);
      } else {
        router.push("/learning");
      }
    } catch (error: any) {
      console.error(error);
      alert(`Error saving course: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const isSubmitDisabled = isSaving || isUploading || !formData.title || (courseType === "SCORM" && !scormPackageId);

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-display-md font-heading tracking-tight text-ink">Course Builder</h1>
        <p className="mt-2 text-subtitle text-slate-500">Create a new learning module.</p>
      </div>

      <div className="bg-canvas border border-hairline rounded-xl shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* Course Type Selection */}
          <div className="space-y-4">
            <h3 className="text-heading-6 font-semibold text-ink border-b border-hairline pb-2">Course Type</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setCourseType("NATIVE")}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  courseType === "NATIVE"
                    ? "border-brand-green bg-brand-green/5 ring-1 ring-brand-green"
                    : "border-input bg-surface hover:bg-canvas"
                }`}
              >
                <div className={`p-3 rounded-full ${courseType === "NATIVE" ? "bg-brand-green/10 text-brand-green" : "bg-slate-100 text-slate-500"}`}>
                  <Layout className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <span className={`block font-medium ${courseType === "NATIVE" ? "text-brand-teal-deep" : "text-ink"}`}>Native LMS Course</span>
                  <span className="text-xs text-slate-500 mt-1 block">Create content directly in the browser</span>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setCourseType("SCORM")}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  courseType === "SCORM"
                    ? "border-brand-green bg-brand-green/5 ring-1 ring-brand-green"
                    : "border-input bg-surface hover:bg-canvas"
                }`}
              >
                <div className={`p-3 rounded-full ${courseType === "SCORM" ? "bg-brand-green/10 text-brand-green" : "bg-slate-100 text-slate-500"}`}>
                  <Archive className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <span className={`block font-medium ${courseType === "SCORM" ? "text-brand-teal-deep" : "text-ink"}`}>Upload SCORM Package</span>
                  <span className="text-xs text-slate-500 mt-1 block">Import an existing SCORM 1.2 zip file</span>
                </div>
              </button>
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-4 pt-4">
            <h3 className="text-heading-6 font-semibold text-ink border-b border-hairline pb-2">Basic Information</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Course Title <span className="text-red-500">*</span></label>
              <input 
                required
                type="text" 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-input bg-surface focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                placeholder="e.g. Code of Conduct 2026"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea 
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-input bg-surface focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none resize-none"
                placeholder="Course overview and objectives..."
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Category ID</label>
              <input 
                type="number"
                value={formData.category_id}
                onChange={(e) => setFormData({...formData, category_id: parseInt(e.target.value)})}
                className="w-full px-4 py-2 rounded-lg border border-input bg-surface focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
              />
            </div>
          </div>

          {/* SCORM Upload Section */}
          {courseType === "SCORM" && (
            <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <h3 className="text-heading-6 font-semibold text-ink border-b border-hairline pb-2">Interactive Content (SCORM)</h3>
              <p className="text-sm text-slate-500">Upload a SCORM 1.2 zip package. Our engine will securely extract and parse the manifest to identify the launch files.</p>
              
              <div className="border-2 border-dashed border-input rounded-xl p-8 text-center bg-surface hover:bg-canvas transition-colors">
                <input 
                  type="file" 
                  id="scorm-upload" 
                  className="hidden" 
                  accept=".zip"
                  onChange={handleFileChange}
                />
                <label htmlFor="scorm-upload" className="cursor-pointer flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="font-semibold text-brand-teal-deep hover:text-brand-green transition-colors">Click to select file</span>
                    <span className="text-slate-500 ml-1">or drag and drop</span>
                  </div>
                  <p className="text-xs text-slate-400">SCORM 1.2 .zip (Max 500MB)</p>
                </label>
                
                {scormFile && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-brand-teal/5 border border-brand-teal/20 rounded-lg text-left">
                      <FileText className="h-5 w-5 text-brand-teal" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-teal-deep truncate">{scormFile.name}</p>
                        <p className="text-xs text-slate-500">{(scormFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      {scormPackageId && <CheckCircle2 className="h-5 w-5 text-brand-green" />}
                    </div>

                    {!scormPackageId && (
                      <div className="flex flex-col items-center gap-3">
                        {isUploading ? (
                          <div className="w-full space-y-2">
                            <div className="flex justify-between text-sm text-slate-600 font-medium">
                              <span>Uploading...</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-brand-teal transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleUploadPackage}
                            className="px-4 py-2 bg-brand-teal text-white rounded-lg text-sm font-medium hover:bg-brand-teal-deep transition-colors"
                          >
                            Upload Package Now
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-accent-orange/10 border border-accent-orange/20 rounded-lg text-accent-orange-dark">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm"><strong>Security Notice:</strong> Uploaded packages are scanned for path traversal attempts and sandboxed upon extraction.</p>
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-hairline flex justify-end gap-4">
            <button 
              type="button" 
              onClick={() => router.back()}
              className="px-6 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitDisabled}
              className="px-6 py-2 rounded-lg text-sm font-medium bg-brand-teal-deep text-white hover:bg-brand-teal shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                courseType === "NATIVE" ? 'Create Native Course' : 'Save & Publish'
              )}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
}
