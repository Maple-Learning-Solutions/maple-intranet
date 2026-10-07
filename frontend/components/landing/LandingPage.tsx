"use client";
/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, @next/next/no-img-element, @typescript-eslint/no-explicit-any */

import { useState, useEffect } from "react";
import {
  ArrowRight, HeartPulse, CalendarDays, Stethoscope,
  FileBox, User, Building, Heart, GraduationCap,
  BookOpen, Folder, BriefcaseMedical, CheckCircle2,
  Search, MapPin, SearchCode, Megaphone, ThumbsUp, Smile,
  HelpCircle, BarChart, Mail, CreditCard, Star, Target, Rocket
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AITrendingNews } from "@/components/home/AITrendingNews";
import { useSession } from "next-auth/react";
import { Smartphone, CheckSquare, FileText, PlayCircle, Activity, Layout, ChevronUp, Loader2 } from "lucide-react";
import { DockNav, type DockNavItem } from "@/components/ui/dock-nav";
import AuroraBackground from "@/components/ui/aurora-background";
import { OurVerticals } from "@/components/landing/OurVerticals";
import { KudosFeed } from "@/components/kudos/KudosFeed";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RecentEventsCarousel } from "@/components/landing/RecentEventsCarousel";

const HeroCarousel = () => {
  const images = [
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=2000&q=80",
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=2000&q=80",
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=2000&q=80",
    "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=2000&q=80"
  ];
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(c => (c + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 z-0">
      {images.map((src, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${i === current ? 'opacity-100' : 'opacity-0'}`}
        >
          <img src={src} alt="Hero background" className="w-full h-full object-cover" />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a2530]/90 via-[#1a2530]/50 to-[#1f2937]/90" />
    </div>
  );
};

const CalendarWidget = dynamic(() => import("@/components/CalendarWidget"), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-canvas animate-pulse rounded-xl" />
});

const DEFAULT_DOCK_ITEMS: DockNavItem[] = [

  {
    label: "MapleBot",
    iconSrc: "/2.webp",
    alt: "MapleBot app icon",
    href: "https://maplebot.maplelearningsolutions.com/",
    target: "_blank",
  },  
  {
    label: "Documents",
    iconSrc: "/3.webp",
    alt: "Documents app icon",
    href: "/documents",
  },
  {
    label: "Confluence",
    iconSrc: "/4.webp",
    alt: "Loom app icon",
  },
  {
    label: "Courses",
    iconSrc: "/5.webp",
    alt: "Courses app icon",
    href: "/learning",
  },
  {
    label: "Trello",
    iconSrc: "/6.webp",
    alt: "Trello app icon",
    href: "https://trello.com/",
    target: "_blank",
  },
  {
    label: "Calendar",
    iconSrc: "/7.webp",
    alt: "Calendar app icon",
    href: "https://calendar.google.com/calendar",
    target: "_blank",
  },
  {
    label: "GMail",
    iconSrc: "/8.webp",
    alt: "Gmail app icon",
    href: "https://mail.google.com/mail/",
    target: "_blank",
  }
];

export const CONFLUENCE_URLS = {
  "Web & Sales": "https://renuka23062002.atlassian.net/wiki/x/nwAR", // TODO: Add actual Web & Sales Confluence URL here
  "Digital Marketing": "https://marketing-team-maple.atlassian.net/wiki/spaces/DM/overview", // TODO: Add actual Digital Marketing Confluence URL here
  "eLearning": "#", // TODO: Add actual eLearning Confluence URL here
  "HR": "#", // TODO: Add actual HR Confluence URL here
};

interface LandingPageProps {
  isPublic?: boolean;
  isLoggedIn?: boolean;
}

export function LandingPage({ isPublic, isLoggedIn }: LandingPageProps) {
  const { data: session, status } = useSession();
  const user = session?.user;
  const isLoaded = status !== "loading";
  const token = session?.accessToken;
  const userId = session?.user?.id;
  
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isConfluenceModalOpen, setIsConfluenceModalOpen] = useState(false);

  const dockItems = DEFAULT_DOCK_ITEMS.map(item => {
    if (item.label === "Confluence") {
      return {
        ...item,
        onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          setIsConfluenceModalOpen(true);
        }
      };
    }
    return item;
  });

  useEffect(() => {
    const checkStatus = async () => {
      if (!user) return;
      setUserToken(token || null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${apiUrl}/api/v1/auth/google/status?user_id=${user.id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setIsGoogleConnected(data.is_connected);
        }
      } catch (err) {
        console.error("Failed to check google status", err);
      }
    };
    checkStatus();
  }, [user, token]);

  const handleConnectGoogle = () => {
    if (!user) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    window.location.href = `${apiUrl}/api/v1/auth/google/login?user_id=${user.id}`;
  };

  const [kudosData, setKudosData] = useState<any[]>([]);
  const [kudosLoading, setKudosLoading] = useState(true);

  useEffect(() => {
    const fetchKudos = async () => {
      try {
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/kudos/?limit=3`, {
          headers
        });
        if (res.ok) {
          const data = await res.json();
          setKudosData(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setKudosLoading(false);
      }
    };
    fetchKudos();
  }, [token]);
  const firstName = user?.name?.split(' ')[0] || "Guest";

  const [directoryStaff, setDirectoryStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
    const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const RESOURCE_TABS: Record<string, string> = {
    ONBOARDING: "Onboarding",
    TEAMS_DEPARTMENTS: "Teams & Departments",
    ANNOUNCEMENTS_UPDATES: "Announcements & Updates",
    SOPS: "SOPs",
    WORKFLOWS: "Workflows"
  };
  
  const [activeResourceTab, setActiveResourceTab] = useState("ONBOARDING");

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/documents`);
        const data = await res.json();
        setDocuments(data || []);
      } catch (err) {
        console.error("Failed to fetch documents", err);
      } finally {
        setLoadingDocs(false);
      }
    };
    fetchDocs();
  }, []);

  const topResourcesContent = documents
    .filter(doc => (doc.category?.name || "UNCATEGORIZED_OFFICIAL") === activeResourceTab)
    .slice(0, 4);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/employees`);
        const data = await res.json();
        setDirectoryStaff(data || []);
      } catch (err) {
        console.error("Failed to load employees", err);
      } finally {
        setLoadingStaff(false);
      }
    };
    fetchEmployees();
  }, []);

  const resources = [
    { name: "Benefits", icon: HeartPulse, href: "/documents" },
    { name: "Payroll", icon: FileBox, href: "/documents" },
    { name: "Time Off", icon: CalendarDays, href: "/documents" },
    { name: "Policies & Procedures", icon: BookOpen, href: "/documents" },
    { name: "Learning & Training", icon: GraduationCap, href: "/learning" },
    { name: "IT Help Desk", icon: SearchCode, href: "/documents" },
    { name: "Forms & Resources", icon: Folder, href: "/documents" },
    { name: "Health & Wellness", icon: Heart, href: "/documents" },
    { name: "Employee Directory", icon: User, href: "/employees" },
  ];

  const heroLinks = [
    { name: "Helpdesk", icon: SearchCode, color: "bg-green-600" },
    { name: "Directory", icon: User, color: "bg-slate-600" },
    { name: "Expenses", icon: CalendarDays, color: "bg-slate-500" },
    { name: "Reports", icon: BarChart, color: "bg-yellow-500" },
    { name: "Newsletter", icon: Mail, color: "bg-slate-500" },
    { name: "Benefits", icon: HeartPulse, color: "bg-red-400" },
    { name: "FAQs", icon: HelpCircle, color: "bg-orange-500" },
    { name: "Training", icon: Star, color: "bg-green-500" },
  ];

  const staff = [
    { name: "Luis Ponce", role: "Customer Success", dept: "Customer Success", location: "Vancouver", phone: "650-414-3605", email: "luis@maple.com", img: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop" },
    { name: "Mariam Black", role: "Accounting Manager", dept: "Operations", location: "Not available", phone: "650-414-3605", email: "mblack@maple.com", img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop" },
    { name: "John Smith", role: "Support", dept: "Support", location: "Not available", phone: "650-414-3605", email: "js@maple.com", img: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=150&auto=format&fit=crop" },
    { name: "Sabina Saatgareeva", role: "Product Marketing Manager", dept: "Marketing", location: "HQ", phone: "650-414-3605", email: "sabina@maple.com", img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=150&auto=format&fit=crop" },
  ];

  const recentEvents = [
    {
      title: "Global Summit",
      date: "2026",
      desc: "Our team representing Maple at the Global Summit.",
      img: "/gisec.png",
    },
    {
      title: "4th Anniversary",
      date: "July 24, 2026",
      desc: "Celebrating four years of growth, innovation, and teamwork at Maple.",
      img: "/4thyear.jpg",
    },
    {
      title: "Independence Day",
      date: "Aug 15, 2026",
      desc: "Annual company Independence day celebrations.",
      img: "/independance.jpg",
    },
    {
      title: "Onam",
      date: "Aug 2026",
      desc: "Celebrating Onam at the office.",
      img: "/onam.jpeg",
    },
    {
      title: "Ganesh Chaturthi",
      date: "Sep 2026",
      desc: "Ganesh Chaturthi celebrations.",
      img: "/Ganeshchethurthi.jpeg",
    }
  ];

  return (
    <div className="bg-slate-50 min-h-screen font-sans">

      {/* HERO SECTION */}
      <section className="relative h-[650px] flex items-center justify-center text-white overflow-hidden z-0">
        <HeroCarousel />
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center mt-20">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white mb-6 drop-shadow-md">
            Welcome to Maple<br/>Learning Solutions!
          </h1>
          <p className="text-lg md:text-xl text-slate-200 mb-10 max-w-3xl mx-auto leading-relaxed drop-shadow-sm">
            Stay connected with company news, upcoming events, helpful resources, and everything you need for a day.
          </p>
          <div className="flex justify-center mb-8">
            <Link href="/learning" data-tour="hero-primary-cta" className="px-8 py-3 bg-[#00dc82] text-black font-semibold rounded-full shadow-lg hover:bg-white transition-colors">
              Start Learning
            </Link>
          </div>
        </div>

        {/* Floating Bottom Widget */}
        <div data-tour="dock" className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-max max-w-[95%] hidden md:block">
          <DockNav items={dockItems} className="bg-[#2c3e50]/80 backdrop-blur-md border border-white/10 rounded-full p-2 shadow-2xl" />
        </div>
      </section>

      

      {/* MAIN GRID: NEWS & RESOURCES */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-10 mb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* Left Column: News */}
          <div className="lg:col-span-8 space-y-8">
            <div className="flex items-center gap-4 border-b-2 border-slate-200 pb-2">
              <div className="w-1.5 h-8 bg-brand-green rounded-full"></div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">News & Updates</h2>
            </div>

            {/* The actual AI Trending News Widget */}
            <div className="mt-6">
              <AITrendingNews />
            </div>

            {/* Calendar Widget */}
            <div className="mt-8">
              <div className="flex items-center gap-4 border-b-2 border-slate-200 pb-2 mb-6">
                <div className="w-1.5 h-8 bg-brand-green rounded-full"></div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Company Calendar</h2>
              </div>
              {user && (
                <button
                  onClick={handleConnectGoogle}
                  disabled={isGoogleConnected}
                  className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-md shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 font-medium text-sm whitespace-nowrap mb-6 -mt-2"
                >
                  {isGoogleConnected ? (
                    <>
                      <div className="w-2 h-2 bg-brand-green rounded-full"></div>
                      Google Workspace Connected
                    </>
                  ) : (
                    <>
                      <CalendarDays className="w-4 h-4 text-slate-500" />
                      Connect Google Workspace
                    </>
                  )}
                </button>
              )}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-[400px] overflow-auto">
                <CalendarWidget isGoogleConnected={isGoogleConnected} userToken={userToken} />
              </div>
            </div>
          </div>

          {/* Right Column: Resources */}
          <div className="lg:col-span-4 flex flex-col h-full space-y-8">
            <div>
              <div className="flex items-center gap-4 border-b-2 border-slate-200 pb-2">
                <div className="w-1.5 h-8 bg-brand-green rounded-full"></div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Resources</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 mt-8">
                {resources.map((res, i) => (
                  <Link href={res.href} suppressHydrationWarning key={i} className="flex flex-col items-center justify-center p-4 bg-slate-800 text-white rounded-xl hover:bg-brand-green hover:text-black transition-all duration-200 shadow-sm group">
                    <res.icon className="h-8 w-8 mb-3 opacity-80 group-hover:opacity-100" />
                    <span className="text-xs font-semibold text-center leading-tight">{res.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Announcements Widget */}
            <div className="flex flex-col flex-1">
              <div className="flex items-center gap-4 border-b-2 border-slate-200 pb-2 mb-6">
                <div className="w-1.5 h-8 bg-brand-green rounded-full"></div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Announcements</h2>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 overflow-y-auto space-y-4 min-h-[300px]">
                {/* Company Announcements */}
                <div className="p-4 bg-brand-green/10 rounded-lg border border-brand-green/20">
                  <span className="text-xs font-bold text-brand-green uppercase tracking-wide">Important</span>
                  <h3 className="font-bold text-slate-900 mt-1 mb-2">Hubstaff Tracking Requirements</h3>
                  <p className="text-sm text-slate-600">Logging into Hubstaff is mandatory for measuring productivity. Please ensure your tracked start and end times cover a full 8-hour shift and maintain at least a 60% activity level.</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">Action Required</span>
                  <h3 className="font-bold text-slate-900 mt-1 mb-2">Daily Maple Bot Updates</h3>
                  <p className="text-sm text-slate-600">Morning check-ins via Maple Bot are mandatory and must include clear TODO items. At EOD, update your activities to 'Completed' or 'WIP' according to their status, providing reasons for any incomplete tasks.</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Notice</span>
                  <h3 className="font-bold text-slate-900 mt-1 mb-2">Leave Applications & Handovers</h3>
                  <p className="text-sm text-slate-600">When requesting leave, ensure proper communication via email. You must also ensure your pending tasks are finished and dependencies are closed to maintain a seamless workflow in your absence.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
{/* ABOUT US SECTION */}
      <AuroraBackground className="py-24 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 text-left">
            <div className="inline-block px-3 py-1 mb-4 rounded-full bg-brand-green/20 border border-brand-green/30 text-brand-green text-sm font-semibold tracking-wide uppercase">
              Who We Are
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
              About Us
            </h2>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              At Maple Learning Solutions, we are dedicated to transforming the way organizations 
              approach learning and development. Our comprehensive intranet platform connects 
              your team with essential resources, company news, and seamless communication tools 
              to foster a culture of continuous growth and collaboration.
            </p>
            <button suppressHydrationWarning className="bg-brand-green text-black px-8 py-3 rounded-full font-semibold hover:bg-white hover:text-black transition-all duration-300 shadow-lg shadow-brand-green/20">
              Know More
            </button>
          </div>
          <div className="flex-1 flex justify-center md:justify-end h-full">
            <div className="relative w-full max-w-[550px] aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <div className="absolute inset-0 bg-brand-green/10 z-10 mix-blend-overlay"></div>
              <img 
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80" 
                alt="Our team collaborating" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* VISION & MISSION CARDS */}
        <div className="max-w-7xl mx-auto mt-24 grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Vision Card */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 lg:p-10 hover:bg-white/10 transition-colors duration-300 group">
            <div className="w-14 h-14 bg-brand-green/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Target className="w-7 h-7 text-brand-green" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Our Vision</h3>
            <p className="text-slate-300 leading-relaxed">
              To empower businesses worldwide 
              with innovative and customized eLearning 
              solutions that help achieve business objectives and drive overall growth.
            </p>
          </div>

          {/* Mission Card */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 lg:p-10 hover:bg-white/10 transition-colors duration-300 group">
            <div className="w-14 h-14 bg-brand-green/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Rocket className="w-7 h-7 text-brand-green" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Our Mission</h3>
            <p className="text-slate-300 leading-relaxed">
              Leverage industry-proven layouts specifically 
              designed to enhance visitor interaction and 
              significantly increase click-through rates.
            </p>
          </div>
        </div>
      

      {/* TOP RESOURCES SECTION */}
      
      <section className="py-16 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col items-center justify-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Top Resources</h2>
            <div className="w-16 h-1 bg-brand-green rounded-full"></div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 border-b border-white/10 mb-8 pb-4">
            {Object.entries(RESOURCE_TABS).map(([key, label]) => (
              <button suppressHydrationWarning
                key={key}
                onClick={() => setActiveResourceTab(key)}
                className={`px-2 py-2 text-sm font-semibold transition-colors ${activeResourceTab === key ? 'text-white border-b-2 border-white' : 'text-slate-400 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {loadingDocs ? (
              <div className="col-span-full py-12 flex justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin text-brand-green mr-2" /> Loading documents...</div>
            ) : topResourcesContent.length === 0 ? (
              <div className="col-span-full py-12 flex justify-center text-slate-400">No documents found in this category.</div>
            ) : topResourcesContent.map((resource, i) => (
              <Link key={i} href={`/documents?subcategory=${activeResourceTab}`} className="bg-[#37474f] rounded-lg overflow-hidden hover:bg-[#455a64] transition-colors border border-white/5 flex flex-col h-full shadow-lg group">
                <div className="h-32 overflow-hidden bg-slate-800 flex items-center justify-center relative">
                  {resource.thumbnail_url ? (
                    <img src={resource.thumbnail_url} alt={resource.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <FileText className="h-12 w-12 text-slate-500 opacity-50" />
                  )}
                </div>
                <div className="p-5 flex-1">
                  <h3 className="font-bold text-lg mb-3 text-white group-hover:text-brand-green transition-colors">{resource.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed line-clamp-4">{resource.description || "No description provided."}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      </AuroraBackground>

      {/* OUR VERTICALS SECTION */}
      <OurVerticals />

      {/* RECENT EVENTS GALLERY */}
      <RecentEventsCarousel events={recentEvents} />

      {/* STAFF DIRECTORY SECTION */}
      <section className="bg-white border-y border-slate-200 py-16 mb-16 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col items-center justify-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight uppercase mb-4">Staff Directory</h2>
            <div className="w-24 h-1.5 bg-brand-green rounded-full"></div>
          </div>

          {/* Search & Filters */}
          <div className="max-w-4xl mx-auto space-y-4 mb-10">
            <div className="relative">
              <input
                suppressHydrationWarning
                type="text"
                placeholder="Search employees..."
                className="w-full bg-slate-100 border border-slate-200 rounded-full py-4 pl-6 pr-12 focus:outline-none focus:ring-2 focus:ring-brand-green focus:bg-white transition-all"
              />
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            </div>
            <div className="flex gap-4">
              <select suppressHydrationWarning className="bg-slate-800 text-white rounded-full px-6 py-2.5 text-sm font-medium focus:outline-none appearance-none cursor-pointer hover:bg-slate-700">
                <option>Location</option>
                <option>Vancouver</option>
                <option>HQ</option>
              </select>
              <select suppressHydrationWarning className="bg-slate-800 text-white rounded-full px-6 py-2.5 text-sm font-medium focus:outline-none appearance-none cursor-pointer hover:bg-slate-700">
                <option>Department</option>
                <option>Marketing</option>
                <option>Operations</option>
              </select>
            </div>
          </div>

          {/* Staff Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {loadingStaff ? (
              <div className="col-span-full py-12 text-center text-slate-500">Loading directory...</div>
            ) : directoryStaff.slice(0, 4).map((emp, i) => {
              const name = `${emp.user?.first_name || ""} ${emp.user?.last_name || ""}`.trim() || "Unknown";
              const role = emp.designation || "Employee";
              const dept = emp.department?.name || "No Department";
              const location = emp.location || "Headquarters";
              const img = emp.user?.profile_image_url || `https://ui-avatars.com/api/?name=${emp.user?.first_name}+${emp.user?.last_name}&background=random`;

              return (
                <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-green to-blue-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                  <div className="flex items-center gap-4 mb-6">
                    {img ? (
                      <img src={img} alt={name} className="w-14 h-14 rounded-full object-cover shadow-sm border border-slate-100" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-slate-800 text-brand-green flex items-center justify-center font-bold text-xl">
                        {name.split(" ").map((n: string) => n[0]).join("")}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-slate-900 line-clamp-1">{name}</h4>
                      <p className="text-xs font-medium text-slate-500 line-clamp-1">{role}</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                      <Building className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="block text-slate-400">Department</span>
                        <span className="font-medium text-slate-700 line-clamp-1">{dept}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="block text-slate-400">Office Location</span>
                        <span className="font-medium text-slate-700 line-clamp-1">{location}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SHOUT-OUTS & QUICK POLL */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 mb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Shout-outs */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-4 border-b-2 border-slate-200 pb-2 mb-6">
              <div className="w-1.5 h-8 bg-brand-green rounded-full"></div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Shout-Outs</h2>
            </div>

            <KudosFeed kudos={kudosData} isLoading={kudosLoading} />

            <div className="mt-6 flex justify-between items-center">
              <Link href="/kudos" suppressHydrationWarning className="bg-slate-900 text-white px-6 py-2 rounded-full text-sm font-semibold hover:bg-brand-green hover:text-slate-900 transition-colors inline-block">
                Give Praise
              </Link>
            </div>
          </div>

          {/* Quick Poll */}
          <div>
            <div className="flex items-center gap-4 border-b-2 border-slate-200 pb-2 mb-6">
              <div className="w-1.5 h-8 bg-brand-green rounded-full"></div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Quick Poll</h2>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-800 p-4 text-right">
                <span className="text-xs font-medium text-slate-300">0 votes • 3 days left</span>
              </div>
              <div className="p-6">
                <h4 className="font-bold text-slate-900 mb-6">How satisfied are you with our intranet?</h4>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input suppressHydrationWarning type="radio" name="poll" className="w-4 h-4 text-brand-green border-slate-300 focus:ring-brand-green" />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">😍 Very satisfied</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input suppressHydrationWarning type="radio" name="poll" className="w-4 h-4 text-brand-green border-slate-300 focus:ring-brand-green" />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">😊 Satisfied</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input suppressHydrationWarning type="radio" name="poll" className="w-4 h-4 text-brand-green border-slate-300 focus:ring-brand-green" />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">😐 Neutral</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input suppressHydrationWarning type="radio" name="poll" className="w-4 h-4 text-brand-green border-slate-300 focus:ring-brand-green" />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">😠 Dissatisfied</span>
                  </label>
                </div>
                <div className="mt-8 flex justify-end">
                  <button suppressHydrationWarning className="bg-slate-900 text-white px-8 py-2 rounded-full text-sm font-semibold hover:bg-brand-green hover:text-slate-900 transition-colors">
                    Vote
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black text-slate-400 py-8 border-t border-brand-green/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between">
          <div className="text-sm mb-4 md:mb-0">
            &copy; 2026 Maple Learning Solutions
          </div>
          <div className="text-sm">
            Intranet contact: <a href="mailto:support@maple.com" className="text-brand-green hover:underline">support@maple.com</a>
          </div>
        </div>
      </footer>
      {/* Confluence Department Selector Modal */}
      <Dialog open={isConfluenceModalOpen} onOpenChange={setIsConfluenceModalOpen}>
        <DialogContent className="sm:max-w-md border-hairline bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-ink">Select Your Department</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            {Object.entries(CONFLUENCE_URLS).map(([dept, url]) => (
              <a
                key={dept}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsConfluenceModalOpen(false)}
                className="flex items-center justify-between px-4 py-3 bg-surface hover:bg-slate-100 border border-hairline rounded-lg transition-colors group"
              >
                <span className="font-medium text-ink group-hover:text-brand-teal">{dept}</span>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-teal" />
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
