"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { Plus, Trash2, Video, Image as ImageIcon, Type, Link as LinkIcon, HelpCircle, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Block Editor Components
import TipTapEditor from "./blocks/TipTapEditor";
import VideoBlockEditor from "./blocks/VideoBlockEditor";
import ImageBlockEditor from "./blocks/ImageBlockEditor";
import EmbedBlockEditor from "./blocks/EmbedBlockEditor";
import QuizBlockEditor from "./blocks/QuizBlockEditor";
import AssessmentBlockEditor from "./blocks/AssessmentBlockEditor";
import HtmlViewerBlockEditor from "./blocks/HtmlViewerBlockEditor";

export default function LessonBuilder({ lesson, onUpdate }: { lesson: any, onUpdate: () => void }) {
  const [addingBlockType, setAddingBlockType] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = lesson.content_blocks.findIndex((b: any) => b.id === active.id);
      const newIndex = lesson.content_blocks.findIndex((b: any) => b.id === over.id);
      
      const newBlocks = arrayMove(lesson.content_blocks, oldIndex, newIndex);
      
      // Update locally first for snappiness, then save to API
      // In a real app we'd dispatch an optimistic update here
      
      try {
        // We'd ideally have a bulk update endpoint, but for now update one by one or 
        // implement a reorder endpoint in the API
        
        // For simplicity right now we'll just alert that reordering needs backend support
        // since we didn't add a bulk reorder endpoint yet.
        console.log("Reordered", newBlocks);
      } catch(e) {
        console.error(e);
      }
    }
  };

  const addBlock = async (type: string) => {
    try {
      const defaultMetadata = type === "VIDEO" ? { provider: "YOUTUBE", url: "" } : {};
      const defaultContent = type === "TEXT" ? "<p>Start typing...</p>" : "";
      
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/native-courses/lessons/${lesson.id}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          content: defaultContent,
          sort_order: lesson.content_blocks.length,
          metadata_json: defaultMetadata
        })
      });
      setAddingBlockType(null);
      onUpdate();
    } catch(e) {
      console.error(e);
    }
  };

  const deleteBlock = async (blockId: number) => {
    if (!confirm("Delete this content block?")) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/native-courses/content/${blockId}`, {
        method: "DELETE"
      });
      onUpdate();
    } catch(e) {
      console.error(e);
    }
  };

  const updateBlock = async (blockId: number, data: any) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/native-courses/content/${blockId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      // We don't always call onUpdate here to prevent losing focus during typing
    } catch(e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-hairline bg-surface">
        <div>
          <h2 className="text-2xl font-heading font-semibold text-ink">{lesson.title}</h2>
          <p className="text-slate-500 mt-1">Add and reorder content blocks below.</p>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setAddingBlockType(addingBlockType ? null : 'menu')}
            className="px-4 py-2 bg-brand-green text-white rounded-lg font-medium hover:bg-brand-teal-deep transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Content
          </button>
          
          {addingBlockType === 'menu' && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-hairline rounded-xl shadow-lg p-2 z-50 flex flex-col gap-1">
              <button onClick={() => addBlock("TEXT")} className="flex items-center gap-3 px-3 py-2 hover:bg-brand-green rounded-lg text-sm text-left hover:cursor-pointer">
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-md"><Type className="w-4 h-4" /></div>
                <div><div className="font-medium">Rich Text</div><div className="text-xs text-slate-500">Add formatted text</div></div>
              </button>
              <button onClick={() => addBlock("VIDEO")} className="flex items-center gap-3 px-3 py-2 hover:bg-brand-green rounded-lg text-sm text-left hover:cursor-pointer">
                <div className="p-1.5 bg-red-100 text-red-600 rounded-md"><Video className="w-4 h-4" /></div>
                <div><div className="font-medium">Video</div><div className="text-xs text-slate-500">YouTube or Vimeo</div></div>
              </button>
              <button onClick={() => addBlock("IMAGE")} className="flex items-center gap-3 px-3 py-2 hover:bg-brand-green rounded-lg text-sm text-left hover:cursor-pointer">
                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-md"><ImageIcon className="w-4 h-4" /></div>
                <div><div className="font-medium">Image</div><div className="text-xs text-slate-500">Upload an image</div></div>
              </button>
              <button onClick={() => addBlock("EMBED")} className="flex items-center gap-3 px-3 py-2 hover:bg-brand-green rounded-lg text-sm text-left hover:cursor-pointer">
                <div className="p-1.5 bg-orange-100 text-orange-600 rounded-md"><LinkIcon className="w-4 h-4" /></div>
                <div><div className="font-medium">Embed</div><div className="text-xs text-slate-500">Embed a URL</div></div>
              </button>
              <button onClick={() => addBlock("QUIZ")} className="flex items-center gap-3 px-3 py-2 hover:bg-brand-green rounded-lg text-sm text-left hover:cursor-pointer">
                <div className="p-1.5 bg-green-100 text-green-600 rounded-md"><HelpCircle className="w-4 h-4" /></div>
                <div><div className="font-medium">Quiz</div><div className="text-xs text-slate-500">Add a quick quiz</div></div>
              </button>
              <button onClick={() => addBlock("ASSESSMENT")} className="flex items-center gap-3 px-3 py-2 hover:bg-brand-green rounded-lg text-sm text-left hover:cursor-pointer">
                <div className="p-1.5 bg-teal-100 text-teal-600 rounded-md"><HelpCircle className="w-4 h-4" /></div>
                <div><div className="font-medium">Assessment</div><div className="text-xs text-slate-500">Standalone Assessment</div></div>
              </button>
              <button onClick={() => addBlock("HTML_VIEWER")} className="flex items-center gap-3 px-3 py-2 hover:bg-brand-green rounded-lg text-sm text-left hover:cursor-pointer">
                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md"><LinkIcon className="w-4 h-4" /></div>
                <div><div className="font-medium">HTML Viewer</div><div className="text-xs text-slate-500">Full-width HTML link</div></div>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Content Blocks Area */}
      <div className="flex-1 overflow-y-auto p-8 bg-canvas">
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
          
          {lesson.content_blocks.length === 0 ? (
            <div className="text-center p-12 border-2 border-dashed border-input rounded-xl bg-surface">
              <p className="text-slate-500 mb-4">This lesson is empty.</p>
              <button onClick={() => setAddingBlockType('menu')} className="px-4 py-2 border border-brand-green text-brand-green rounded-lg font-medium hover:bg-brand-green/10 transition-colors">
                Add First Content Block
              </button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={lesson.content_blocks.map((b:any) => b.id)} strategy={verticalListSortingStrategy}>
                {lesson.content_blocks.map((block: any) => (
                  <SortableBlock key={block.id} id={block.id} block={block} onDelete={() => deleteBlock(block.id)} onUpdate={(data) => updateBlock(block.id, data)} />
                ))}
              </SortableContext>
            </DndContext>
          )}
          
        </div>
      </div>
    </div>
  );
}

function SortableBlock({ id, block, onDelete, onUpdate }: { id: number, block: any, onDelete: () => void, onUpdate: (data: any) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const renderBlockEditor = () => {
    switch (block.type) {
      case "TEXT": return <TipTapEditor block={block} onUpdate={onUpdate} />;
      case "VIDEO": return <VideoBlockEditor block={block} onUpdate={onUpdate} />;
      case "IMAGE": return <ImageBlockEditor block={block} onUpdate={onUpdate} />;
      case "EMBED": return <EmbedBlockEditor block={block} onUpdate={onUpdate} />;
      case "QUIZ": return <QuizBlockEditor block={block} onUpdate={onUpdate} />;
      case "ASSESSMENT": return <AssessmentBlockEditor block={block} onUpdate={onUpdate} />;
      case "HTML_VIEWER": return <HtmlViewerBlockEditor block={block} onUpdate={onUpdate} />;
      default: return <div className="p-4 bg-red-50 text-red-500">Unknown block type: {block.type}</div>;
    }
  };

  const getBlockIcon = () => {
    switch (block.type) {
      case "TEXT": return <Type className="w-4 h-4 text-slate-400" />;
      case "VIDEO": return <Video className="w-4 h-4 text-slate-400" />;
      case "IMAGE": return <ImageIcon className="w-4 h-4 text-slate-400" />;
      case "EMBED": return <LinkIcon className="w-4 h-4 text-slate-400" />;
      case "QUIZ": return <HelpCircle className="w-4 h-4 text-slate-400" />;
      case "ASSESSMENT": return <HelpCircle className="w-4 h-4 text-slate-400" />;
      case "HTML_VIEWER": return <LinkIcon className="w-4 h-4 text-slate-400" />;
      default: return null;
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-surface rounded-xl border border-hairline shadow-sm overflow-hidden group">
      {/* Block Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-hairline bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="p-1 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing rounded">
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-600">
            {getBlockIcon()} {block.type}
          </div>
        </div>
        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      {/* Block Content */}
      <div className="p-1">
        {renderBlockEditor()}
      </div>
    </div>
  );
}


