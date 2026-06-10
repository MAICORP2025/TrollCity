import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getCourseBySlug, getCourseDiscussions, getDiscussionReplies, createDiscussion, getCourseAnnouncements } from '@/services/academyService';
import type { AcademyCourse, AcademyDiscussion, AcademyAnnouncement } from '@/types/academy';
import {
  ChevronLeft, MessageSquare, Send, Pin, Lock, Bell, Users,
  Loader2, Plus,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function CommunicationCenterPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuthStore();
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [discussions, setDiscussions] = useState<AcademyDiscussion[]>([]);
  const [announcements, setAnnouncements] = useState<AcademyAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'announcements' | 'discussions'>('announcements');
  const [showNewDiscussion, setShowNewDiscussion] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [expandedDiscussion, setExpandedDiscussion] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, AcademyDiscussion[]>>({});
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) return;
      try {
        const courseData = await getCourseBySlug(slug);
        if (!courseData) { navigate('/academy/courses'); return; }
        setCourse(courseData);

        const [discussionsData, announcementsData] = await Promise.all([
          getCourseDiscussions(courseData.id),
          getCourseAnnouncements(courseData.id),
        ]);
        setDiscussions(discussionsData);
        setAnnouncements(announcementsData);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [slug]);

  const handleCreateDiscussion = async () => {
    if (!newTitle.trim() || !newContent.trim()) { toast.error('Title and content required'); return; }
    if (!course || !user?.id) return;
    setPosting(true);
    try {
      await createDiscussion({ course_id: course.id, author_id: user.id, title: newTitle, content: newContent });
      toast.success('Discussion posted!');
      setNewTitle('');
      setNewContent('');
      setShowNewDiscussion(false);
      const discussionsData = await getCourseDiscussions(course.id);
      setDiscussions(discussionsData);
    } catch (err: any) { toast.error(err.message || 'Failed to post'); }
    finally { setPosting(false); }
  };

  const handleExpandDiscussion = async (discussionId: string) => {
    if (expandedDiscussion === discussionId) { setExpandedDiscussion(null); return; }
    setExpandedDiscussion(discussionId);
    if (!replies[discussionId]) {
      const repliesData = await getDiscussionReplies(discussionId);
      setReplies(prev => ({ ...prev, [discussionId]: repliesData }));
    }
  };

  const handleReply = async (discussionId: string) => {
    const content = replyContent[discussionId];
    if (!content?.trim()) return;
    if (!course || !user?.id) return;
    try {
      await createDiscussion({ course_id: course.id, author_id: user.id, title: 'Reply', content, parent_id: discussionId });
      setReplyContent(prev => ({ ...prev, [discussionId]: '' }));
      const repliesData = await getDiscussionReplies(discussionId);
      setReplies(prev => ({ ...prev, [discussionId]: repliesData }));
      toast.success('Reply posted!');
    } catch (err: any) { toast.error('Failed to reply'); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" /></div>;
  if (!course) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <button onClick={() => navigate(`/academy/course/${slug}`)} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Course
      </button>

      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
            <MessageSquare className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{course.name}</h1>
            <p className="text-xs text-slate-400">Communication Center</p>
          </div>
        </div>
      </section>

      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button onClick={() => setActiveTab('announcements')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeTab === 'announcements' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-white'}`}>
          <Bell className="h-3.5 w-3.5" /> Announcements ({announcements.length})
        </button>
        <button onClick={() => setActiveTab('discussions')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeTab === 'discussions' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-white'}`}>
          <MessageSquare className="h-3.5 w-3.5" /> Discussions ({discussions.length})
        </button>
      </div>

      {activeTab === 'announcements' && (
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className={`${glass} rounded-2xl p-8 text-center`}><Bell className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-3 text-sm text-slate-400">No announcements yet.</p></div>
          ) : announcements.map(a => (
            <div key={a.id} className={`${glass} rounded-2xl p-4 ${a.is_pinned ? 'border-amber-400/20' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {a.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-400" />}
                  <h3 className="text-sm font-bold text-white">{a.title}</h3>
                </div>
                <span className="text-[9px] text-slate-500">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
              <p className="mt-2 text-xs text-slate-300 whitespace-pre-wrap">{a.content}</p>
              <p className="mt-2 text-[9px] text-slate-500">— {a.author_name || 'Teacher'}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'discussions' && (
        <div className="space-y-3">
          <button onClick={() => setShowNewDiscussion(!showNewDiscussion)}
            className="flex items-center gap-1 rounded-lg bg-blue-500/20 px-3 py-1.5 text-[10px] font-bold text-blue-300 hover:bg-blue-500/30">
            <Plus className="h-3 w-3" /> New Discussion
          </button>

          {showNewDiscussion && (
            <div className={`${glass} rounded-2xl p-4 space-y-3`}>
              <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Discussion title..."
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none focus:border-blue-400/50" />
              <textarea rows={3} value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="What's on your mind?"
                className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none focus:border-blue-400/50" />
              <div className="flex gap-2">
                <button onClick={handleCreateDiscussion} disabled={posting}
                  className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">
                  {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Post
                </button>
                <button onClick={() => setShowNewDiscussion(false)} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold text-slate-400">Cancel</button>
              </div>
            </div>
          )}

          {discussions.length === 0 ? (
            <div className={`${glass} rounded-2xl p-8 text-center`}><MessageSquare className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-3 text-sm text-slate-400">No discussions yet. Start one!</p></div>
          ) : discussions.map(d => (
            <div key={d.id} className={`${glass} rounded-2xl p-4`}>
              <button onClick={() => handleExpandDiscussion(d.id)} className="w-full text-left">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {d.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-400" />}
                    {d.is_locked && <Lock className="h-3.5 w-3.5 text-red-400" />}
                    <h3 className="text-sm font-bold text-white">{d.title}</h3>
                  </div>
                  <span className="text-[9px] text-slate-500">{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">{d.content}</p>
                <p className="mt-1 text-[9px] text-slate-500">by {d.author_name || 'Student'}</p>
              </button>

              {expandedDiscussion === d.id && (
                <div className="mt-3 border-t border-white/5 pt-3 space-y-2">
                  {replies[d.id]?.map(reply => (
                    <div key={reply.id} className="rounded-lg bg-white/[0.03] p-3">
                      <p className="text-xs text-slate-300 whitespace-pre-wrap">{reply.content}</p>
                      <p className="mt-1 text-[9px] text-slate-500">— {reply.author_name || 'Student'} • {new Date(reply.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                  {!d.is_locked && (
                    <div className="flex gap-2">
                      <input type="text" value={replyContent[d.id] || ''} onChange={e => setReplyContent(prev => ({ ...prev, [d.id]: e.target.value }))}
                        placeholder="Write a reply..."
                        className="flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white outline-none" />
                      <button onClick={() => handleReply(d.id)} className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-[10px] font-bold text-blue-300">
                        <Send className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
