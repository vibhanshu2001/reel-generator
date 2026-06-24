import React, { useState, useEffect } from 'react';
import { 
  Film, Sparkles, AlertCircle, CheckCircle2, 
  Trash2, Cpu, FileText, Loader2, Music, 
  Award, Eye, RefreshCw, Layers
} from 'lucide-react';

interface Script {
  id: string;
  title: string;
  youtubeTitle?: string | null;
  youtubeDescription?: string | null;
  hook: string;
  body: string;
  cta: string;
  duration: number;
  score: number | null;
  feedback: string | null;
}

interface Scene {
  id: string;
  sequenceNumber: number;
  text: string;
  template: string;
  templateData: string;
  audioPath: string | null;
  duration: number | null;
}

interface Project {
  id: string;
  topic: string;
  status: string;
  error: string | null;
  videoPath: string | null;
  audioPath: string | null;
  voiceAccent?: string;
  createdAt: string;
  updatedAt: string;
  script?: Script | null;
  scenes?: Scene[];
  storyline?: string;
  viralPattern?: string | null;
  retentionScore?: number | null;
  retentionPlan?: any | null;
  retentionReport?: any | null;
  storyboard?: any | null;
  generationCost?: number | null;
  costBreakdown?: Record<string, number> | null;
  inputTokens?: number;
  outputTokens?: number;
  series?: any;
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [topicInput, setTopicInput] = useState('');

  // Topic suggestions
  const [suggestedTopics, setSuggestedTopics] = useState<any[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  
  // Series and Story Universe states
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [selectedVoiceAccent, setSelectedVoiceAccent] = useState<string>('en-IN');
  const [showCreateSeries, setShowCreateSeries] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newUniverseRules, setNewUniverseRules] = useState('');

  // Script editor states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editYoutubeTitle, setEditYoutubeTitle] = useState('');
  const [editYoutubeDescription, setEditYoutubeDescription] = useState('');
  const [editHook, setEditHook] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editCta, setEditCta] = useState('');
  const [editDuration, setEditDuration] = useState(30);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [changingAccent, setChangingAccent] = useState(false);

  // Fetch projects list
  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      console.error('Failed to fetch projects', e);
    }
  };

  // Fetch series list
  const fetchSeries = async () => {
    try {
      const res = await fetch('/api/projects/series');
      const data = await res.json();
      setSeriesList(data);
    } catch (e) {
      console.error('Failed to fetch series', e);
    }
  };

  // Fetch specific project details
  const fetchProjectDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      setSelectedProject(data);
      
      // Populate edit states
      if (data.script) {
        setEditTitle(data.script.title);
        setEditYoutubeTitle(data.script.youtubeTitle || data.script.title);
        setEditYoutubeDescription(data.script.youtubeDescription || '');
        setEditHook(data.script.hook);
        setEditBody(data.script.body);
        setEditCta(data.script.cta);
        setEditDuration(data.script.duration);
      }
    } catch (e) {
      console.error('Failed to fetch project details', e);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchSeries();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      // Connect to EventStream (SSE) for real-time updates
      const eventSource = new EventSource(`/api/projects/${selectedProjectId}/stream`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Project;
          setSelectedProject(data);
          
          // Sync changes directly back to the project list in the sidebar
          setProjects(prev => prev.map(p => 
            p.id === data.id 
              ? { 
                  ...p, 
                  status: data.status, 
                  inputTokens: data.inputTokens, 
                  outputTokens: data.outputTokens,
                  generationCost: data.generationCost,
                  retentionScore: data.retentionScore
                } 
              : p
          ));
        } catch (e) {
          console.error('Failed to parse event stream data', e);
        }
      };

      eventSource.onerror = (e) => {
        console.error('EventSource stream encountered an error. Reconnecting...', e);
      };

      return () => {
        eventSource.close();
      };
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId]);

  // Fetch LLM topic suggestions
  const handleSuggestTopics = async () => {
    setSuggestLoading(true);
    setSuggestError('');
    setSuggestedTopics([]);
    try {
      const res = await fetch('/api/projects/suggest-topics');
      if (!res.ok) throw new Error('Failed to fetch suggestions');
      const data = await res.json();
      setSuggestedTopics(data);
    } catch (e: any) {
      setSuggestError('Could not load suggestions. Check your API key.');
    } finally {
      setSuggestLoading(false);
    }
  };

  // Handle new project submission
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: topicInput,
          seriesId: selectedSeriesId || undefined,
          voiceAccent: selectedVoiceAccent
        })
      });
      const data = await res.json();
      setProjects(prev => [data, ...prev]);
      setSelectedProjectId(data.id);
      setTopicInput('');
      setSuggestedTopics([]);
    } catch (e) {
      console.error('Failed to create project', e);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle new series creation
  const handleCreateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeriesName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/projects/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSeriesName.trim(),
          universe: {
            name: `${newSeriesName} Universe`,
            premise: `Byte and Bug explore ${newSeriesName}.`,
            characters: ['Byte', 'Bug'],
            rules: newUniverseRules.split('\n').map(r => r.trim()).filter(Boolean),
            visualStyle: 'technical_2d_comic_animation',
            visualStyleDetails: 'Developer-focused technical comic aesthetic with architecture diagrams, terminal surfaces, APIs, queues, databases, servers, data packets, and clean comic motion.',
            continuityLevel: 'light'
          }
        })
      });
      const data = await res.json();
      setSeriesList(prev => [data, ...prev]);
      setSelectedSeriesId(data.id);
      setNewSeriesName('');
      setNewUniverseRules('');
      setShowCreateSeries(false);
    } catch (e) {
      console.error('Failed to create series', e);
    } finally {
      setLoading(false);
    }
  };

  // Handle script updates
  const handleUpdateScript = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      await fetch(`/api/projects/${selectedProject.id}/script`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          youtubeTitle: editYoutubeTitle,
          youtubeDescription: editYoutubeDescription,
          hook: editHook,
          body: editBody,
          cta: editCta,
          duration: Number(editDuration)
        })
      });
      setIsEditing(false);
      // Re-trigger details fetch
      fetchProjectDetails(selectedProject.id);
      fetchProjects();
    } catch (e) {
      console.error('Failed to update script', e);
    } finally {
      setLoading(false);
    }
  };

  // Trigger local video render
  const handleRenderVideo = async () => {
    if (!selectedProject) return;
    setRendering(true);
    try {
      await fetch(`/api/projects/${selectedProject.id}/render`, {
        method: 'POST'
      });
      fetchProjectDetails(selectedProject.id);
      fetchProjects();
    } catch (e) {
      console.error('Failed to trigger render', e);
    } finally {
      setRendering(false);
    }
  };

  // Retry / Resume pipeline generation
  const handleRetryGeneration = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      await fetch(`/api/projects/${selectedProject.id}/retry`, {
        method: 'POST'
      });
      fetchProjectDetails(selectedProject.id);
      fetchProjects();
    } catch (e) {
      console.error('Failed to retry generation', e);
    } finally {
      setLoading(false);
    }
  };

  // Toggle voice accent and regenerate audios
  const handleToggleVoiceAccent = async (newAccent: string) => {
    if (!selectedProject) return;
    setChangingAccent(true);
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/accent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ voiceAccent: newAccent })
      });
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Failed to change voice accent');
      }
      fetchProjectDetails(selectedProject.id);
      fetchProjects();
    } catch (e) {
      console.error('Failed to change voice accent', e);
    } finally {
      setChangingAccent(false);
    }
  };

  // Delete project
  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project? This deletes all raw scenes and local files.')) return;

    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== id));
      if (selectedProjectId === id) {
        setSelectedProjectId(null);
      }
    } catch (e) {
      console.error('Failed to delete project', e);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GENERATING_SCRIPT':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 700 }}>
            <Loader2 size={12} className="animate-spin" /> 🔍 Researching & Scripting
          </span>
        );
      case 'GENERATING_SCENES':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#c084fc', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 700 }}>
            <Loader2 size={12} className="animate-spin" /> 🎬 Structuring Storyboard
          </span>
        );
      case 'GENERATING_AUDIO':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 700 }}>
            <Loader2 size={12} className="animate-spin" /> 🗣 Synthesizing Voiceover
          </span>
        );
      case 'SCORING':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(236, 72, 153, 0.15)', border: '1px solid rgba(236, 72, 153, 0.3)', color: '#f472b6', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 700 }}>
            <Loader2 size={12} className="animate-spin" /> 🏅 Auditing Quality
          </span>
        );
      case 'RENDERING':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(0, 242, 254, 0.15)', border: '1px solid rgba(0, 242, 254, 0.3)', color: '#00f2fe', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 700 }}>
            <Loader2 size={12} className="animate-spin" /> ⚙ Rendering MP4
          </span>
        );
      case 'DRAFT':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#facc15', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 700 }}>
            📝 Draft Review
          </span>
        );
      case 'COMPLETED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 700 }}>
            ✅ Completed
          </span>
        );
      case 'FAILED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 700 }}>
            ❌ Failed
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#ffffff', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 700 }}>
            <Loader2 size={12} className="animate-spin" /> Generating
          </span>
        );
    }
  };

  return (
    <div className="dashboard-grid">
      {/* LEFT SIDEBAR: Project Control Panel */}
      <div 
        style={{ 
          borderRight: '1px solid rgba(255, 255, 255, 0.06)', 
          background: 'rgba(10, 12, 18, 0.95)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,242,254,0.3)' }}>
            <Film size={22} color="#030307" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>SHORTS FACTORY</h1>
            <span style={{ fontSize: '11px', color: '#8b949e', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700 }}>AI YouTube MVP</span>
          </div>
        </div>

        {/* Input Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
          {!showCreateSeries ? (
            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', color: '#8b949e', letterSpacing: '0.5px' }}>New Short Topic</h2>
                <button
                  type="button"
                  onClick={handleSuggestTopics}
                  disabled={suggestLoading || submitting}
                  style={{
                    background: suggestLoading
                      ? 'rgba(255,255,255,0.05)'
                      : 'linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(0,170,255,0.18) 100%)',
                    border: '1px solid rgba(168,85,247,0.4)',
                    borderRadius: '8px',
                    color: suggestLoading ? '#8b949e' : '#c084fc',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                    cursor: suggestLoading ? 'default' : 'pointer',
                    padding: '5px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                  }}
                  onMouseEnter={e => { if (!suggestLoading) (e.currentTarget as HTMLButtonElement).style.borderColor = '#a855f7'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(168,85,247,0.4)'; }}
                >
                  {suggestLoading
                    ? <><Loader2 size={11} className="animate-spin" /> Thinking...</>
                    : <>✨ Suggest Topics</>}
                </button>
              </div>

              <input
                type="text"
                className="glass-input"
                placeholder="e.g. Why Kafka is NOT a queue..."
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                disabled={submitting}
              />

              {/* Suggestion Shimmer while loading */}
              {suggestLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{
                      height: '62px',
                      borderRadius: '10px',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.4s infinite',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }} />
                  ))}
                </div>
              )}

              {/* Suggested Topic Cards */}
              {!suggestLoading && suggestedTopics.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontSize: '10px', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Suggestions — click to use</span>
                    <button
                      type="button"
                      onClick={handleSuggestTopics}
                      style={{ background: 'none', border: 'none', color: '#c084fc', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >↻ Refresh</button>
                  </div>
                  {suggestedTopics.map((t, i) => {
                    const categoryColors: Record<string, string> = {
                      'databases': '#f59e0b', 'networking': '#06b6d4', 'distributed-systems': '#8b5cf6',
                      'cloud': '#38bdf8', 'ai-ml': '#a855f7', 'devops': '#10b981',
                      'security': '#ef4444', 'web': '#f97316', 'os': '#64748b', 'algorithms': '#ec4899'
                    };
                    const patternEmoji: Record<string, string> = {
                      'myth_busting': '💥', 'hidden_truth': '🔍', 'battle': '⚔️',
                      'race': '🏁', 'countdown': '⏳', 'unexpected_twist': '🌀',
                      'survival_story': '🆘', 'mystery_box': '📦'
                    };
                    const catColor = categoryColors[t.category] || '#8b949e';
                    const emoji = patternEmoji[t.viralPattern] || '🎬';
                    const isSelected = topicInput === t.topic;

                    return (
                      <div
                        key={i}
                        onClick={() => setTopicInput(t.topic)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: isSelected
                            ? `1px solid ${catColor}`
                            : '1px solid rgba(255,255,255,0.06)',
                          background: isSelected
                            ? `linear-gradient(135deg, ${catColor}18 0%, ${catColor}08 100%)`
                            : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                          transition: 'all 0.18s',
                          animation: `fadeSlideIn 0.3s ease ${i * 0.06}s both`,
                          textAlign: 'left',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) {
                            (e.currentTarget as HTMLDivElement).style.background = `${catColor}10`;
                            (e.currentTarget as HTMLDivElement).style.borderColor = `${catColor}60`;
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) {
                            (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)';
                            (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: 1.3, flex: 1 }}>
                            {t.topic}
                          </span>
                          <span style={{
                            fontSize: '10px', fontWeight: 800, color: catColor,
                            background: `${catColor}18`, border: `1px solid ${catColor}40`,
                            padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                            textTransform: 'uppercase', letterSpacing: '0.3px'
                          }}>
                            {t.category}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px', fontStyle: 'italic', lineHeight: 1.4 }}>
                          {emoji} "{t.hook}"
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '5px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: '#8b949e', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                            {t.viralPattern.replace(/_/g, ' ')}
                          </span>
                          <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: 800 }}>
                            🎯 {t.retentionScore}% retention
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {suggestError && (
                <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 600 }}>{suggestError}</span>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: 700 }}>Story Series</span>
                <button
                  type="button"
                  onClick={() => setShowCreateSeries(true)}
                  style={{ background: 'none', border: 'none', color: '#00f2fe', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  + New Series
                </button>
              </div>
              
              <select
                className="glass-input"
                style={{ fontSize: '14px', padding: '10px 14px', cursor: 'pointer' }}
                value={selectedSeriesId}
                onChange={(e) => setSelectedSeriesId(e.target.value)}
                disabled={submitting}
              >
                <option value="">-- Select Series (Optional) --</option>
                {seriesList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.characterPair})</option>
                ))}
              </select>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: 700 }}>Voice Accent</span>
              </div>
              
              <select
                className="glass-input"
                style={{ fontSize: '14px', padding: '10px 14px', cursor: 'pointer' }}
                value={selectedVoiceAccent}
                onChange={(e) => setSelectedVoiceAccent(e.target.value)}
                disabled={submitting}
              >
                <option value="en-IN">Indian English (Prabhat/Neerja)</option>
                <option value="en-US">US English (Andrew/Emma)</option>
              </select>

              <button type="submit" className="btn-primary" style={{ marginTop: '8px' }} disabled={submitting || !topicInput.trim()}>
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Generate Story
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreateSeries} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0, 242, 254, 0.2)', backgroundColor: 'rgba(0, 242, 254, 0.02)', textAlign: 'left' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#00f2fe', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Create New Series</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#8b949e', fontWeight: 700 }}>Series Name</label>
                <input
                  type="text"
                  className="glass-input"
                  style={{ padding: '8px 12px', fontSize: '14px' }}
                  placeholder="e.g. Byte & Bug Learn Databases"
                  value={newSeriesName}
                  onChange={(e) => setNewSeriesName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#8b949e', fontWeight: 700 }}>Universe Rules (one per line)</label>
                <textarea
                  className="glass-input"
                  style={{ padding: '8px 12px', fontSize: '13px', minHeight: '80px', fontFamily: 'monospace' }}
                  placeholder="Byte is the expert&#10;Bug asks audience questions&#10;Technology is visualized as worlds"
                  value={newUniverseRules}
                  onChange={(e) => setNewUniverseRules(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px 14px', fontSize: '14px' }} disabled={loading}>
                  Save
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1, padding: '10px 14px', fontSize: '14px' }}
                  onClick={() => setShowCreateSeries(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Projects History List */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', color: '#8b949e', letterSpacing: '0.5px', marginBottom: '4px' }}>Draft History</h2>
          
          {projects.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed rgba(255, 255, 255, 0.08)', borderRadius: '16px', color: '#8b949e' }}>
              <FileText size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <p style={{ fontSize: '13px' }}>No drafts generated yet.</p>
            </div>
          ) : (
            projects.map((project) => {
              const isSelected = selectedProjectId === project.id;
              return (
                <div
                  key={project.id}
                  className="glass-card"
                  onClick={() => setSelectedProjectId(project.id)}
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    backgroundColor: isSelected ? 'rgba(0, 242, 254, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                    borderColor: isSelected ? '#00f2fe' : 'rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start', textAlign: 'left' }}>
                      {project.series && (
                        <span style={{ fontSize: '10px', color: '#00f2fe', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          📁 {project.series.name}
                        </span>
                      )}
                      <span style={{ fontWeight: 700, fontSize: '15px', color: '#ffffff', wordBreak: 'break-word' }}>
                        {project.topic}
                      </span>
                      {project.storyline && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', color: '#8b949e', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                            {project.storyline.replace('_', ' ')}
                          </span>
                          {project.retentionScore !== null && (
                            <span style={{ fontSize: '10px', color: '#39ff14', backgroundColor: 'rgba(57,255,20,0.08)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              🎯 {project.retentionScore}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '2px', transition: 'color 0.2s', flexShrink: 0 }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ff5f56'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#8b949e'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    {getStatusBadge(project.status)}
                    <span style={{ fontSize: '11px', color: '#8b949e' }}>
                      {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MAIN WORKSPACE: Details, Editor & Preview */}
      <div style={{ background: '#050508', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {selectedProject ? (
          <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
            
            {/* Project Header Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '24px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#00f2fe', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Active Workspace</span>
                <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px' }}>"{selectedProject.topic}"</h2>
                {(selectedProject.inputTokens !== undefined || selectedProject.outputTokens !== undefined) && (
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#8b949e', marginTop: '8px' }}>
                    <span>📥 Input Tokens: <strong style={{ color: '#ffffff' }}>{selectedProject.inputTokens?.toLocaleString() || 0}</strong></span>
                    <span>📤 Output Tokens: <strong style={{ color: '#ffffff' }}>{selectedProject.outputTokens?.toLocaleString() || 0}</strong></span>
                    <span>📊 Total: <strong style={{ color: '#00f2fe' }}>{((selectedProject.inputTokens || 0) + (selectedProject.outputTokens || 0)).toLocaleString()}</strong></span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {/* Voice Accent Selector */}
                {['DRAFT', 'COMPLETED', 'FAILED'].includes(selectedProject.status) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: 700 }}>Accent:</span>
                    <select
                      className="glass-input"
                      style={{ fontSize: '13px', padding: '6px 12px', cursor: 'pointer', margin: 0, width: 'auto', minWidth: '130px' }}
                      value={selectedProject.voiceAccent || 'en-IN'}
                      onChange={(e) => handleToggleVoiceAccent(e.target.value)}
                      disabled={loading || rendering || changingAccent}
                    >
                      <option value="en-IN">Indian English (en-IN)</option>
                      <option value="en-US">US English (en-US)</option>
                    </select>
                  </div>
                )}

                {selectedProject.status === 'FAILED' && (
                  <button 
                    onClick={handleRetryGeneration} 
                    className="btn-primary" 
                    style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #ef4444 100%)', boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}
                    disabled={loading}
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Retry Pipeline
                  </button>
                )}
                {selectedProject.status === 'DRAFT' && (
                  <button onClick={handleRenderVideo} className="btn-primary" disabled={rendering}>
                    <Cpu size={18} /> Render MP4
                  </button>
                )}
                {selectedProject.status === 'COMPLETED' && (
                  <button onClick={handleRenderVideo} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={16} /> Re-Render Video
                  </button>
                )}
                {getStatusBadge(selectedProject.status)}
              </div>
            </div>

            {/* Error Message banner */}
            {selectedProject.error && (
              <div style={{ display: 'flex', gap: '12px', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255, 95, 86, 0.3)', backgroundColor: 'rgba(255, 95, 86, 0.1)', color: '#ff5f56', textAlign: 'left' }}>
                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontWeight: 700 }}>Execution Failed</h4>
                  <p style={{ fontSize: '14px', marginTop: '4px', opacity: 0.9 }}>{selectedProject.error}</p>
                </div>
              </div>
            )}

            {/* Project Workspace Content Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
              
              {/* COL A: Script Editor & Quality Auditor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                
                {/* 1. Retention Director Report Panel */}
                {(selectedProject.retentionScore !== null || selectedProject.retentionPlan || selectedProject.retentionReport) && (
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Award size={20} color="#ffdf00" /> Retention Report
                      </h3>
                      {selectedProject.generationCost !== null && selectedProject.generationCost !== undefined && (
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#00f2fe' }}>
                          Cost: ${selectedProject.generationCost.toFixed(4)}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                      {/* Dynamic Dial */}
                      {selectedProject.retentionScore !== null && selectedProject.retentionScore !== undefined && (() => {
                        const radius = 32;
                        const circumference = 2 * Math.PI * radius;
                        const score = selectedProject.retentionScore || 0;
                        const strokeDashoffset = circumference - (score / 100) * circumference;
                        return (
                          <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="80" height="80" viewBox="0 0 80 80">
                              <circle
                                cx="40"
                                cy="40"
                                r={radius}
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth="5"
                                fill="transparent"
                              />
                              <circle
                                cx="40"
                                cy="40"
                                r={radius}
                                stroke={score >= 80 ? "#39ff14" : score >= 60 ? "#fbbf24" : "#ff5f56"}
                                strokeWidth="5"
                                fill="transparent"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                style={{
                                  transition: 'stroke-dashoffset 0.5s ease-in-out',
                                  transform: 'rotate(-90deg)',
                                  transformOrigin: '50% 50%'
                                }}
                              />
                            </svg>
                            <span style={{ position: 'absolute', fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                              {score}%
                            </span>
                          </div>
                        );
                      })()}

                      {/* Pattern & Storyline Badges */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {selectedProject.storyline && (
                            <span style={{ fontSize: '11px', color: '#00f2fe', backgroundColor: 'rgba(0, 242, 254, 0.1)', border: '1px solid rgba(0, 242, 254, 0.2)', padding: '4px 10px', borderRadius: '50px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              🎬 {selectedProject.storyline.replace('_', ' ')}
                            </span>
                          )}
                          {selectedProject.viralPattern && (
                            <span style={{ fontSize: '11px', color: '#c084fc', backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '4px 10px', borderRadius: '50px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              🔥 {selectedProject.viralPattern.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '12px', color: '#8b949e', margin: 0, lineHeight: '1.4' }}>
                          Retention Director automatically optimized storyline structures to maximize completion rates.
                        </p>
                      </div>
                    </div>

                    {/* Sub-scores breakdown from retentionReport */}
                    {selectedProject.retentionReport && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '10px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e' }}>
                          <span>Hook Strength:</span>
                          <strong style={{ color: '#ffffff' }}>{selectedProject.retentionReport.hookStrength}/20</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e' }}>
                          <span>Curiosity Loops:</span>
                          <strong style={{ color: '#ffffff' }}>{selectedProject.retentionReport.curiosityLoopsMatch}/20</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e' }}>
                          <span>Reveals Match:</span>
                          <strong style={{ color: '#ffffff' }}>{selectedProject.retentionReport.revealsMatch}/20</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e' }}>
                          <span>Pattern Interrupts:</span>
                          <strong style={{ color: '#ffffff' }}>{selectedProject.retentionReport.patternInterruptFrequency}/20</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e', gridColumn: 'span 2' }}>
                          <span>Visual Composition:</span>
                          <strong style={{ color: '#ffffff' }}>{selectedProject.retentionReport.visualComposition}/20</strong>
                        </div>
                      </div>
                    )}

                    {/* Structural Issues */}
                    {selectedProject.retentionReport && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase' }}>Structural Issues</span>
                        {selectedProject.retentionReport.issues && selectedProject.retentionReport.issues.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {selectedProject.retentionReport.issues.map((issue: string, idx: number) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff5f56', fontSize: '12px', background: 'rgba(255, 95, 86, 0.04)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255, 95, 86, 0.1)' }}>
                                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                                <span>{issue}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', fontSize: '12px', background: 'rgba(34, 197, 94, 0.04)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                            <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
                            <span>No structural issues detected. Ready to render!</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cost Breakdown */}
                    {selectedProject.costBreakdown && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase' }}>Cost Breakdown</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: '12px', color: '#8b949e' }}>
                          {Object.entries(selectedProject.costBreakdown).map(([stage, val]) => (
                            <div key={stage} style={{ display: 'flex', gap: '4px' }}>
                              <span style={{ textTransform: 'capitalize' }}>{stage}:</span>
                              <strong style={{ color: '#ffffff' }}>${Number(val).toFixed(4)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Script Panel Form */}
                <div className="glass-panel" style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} color="#00f2fe" /> Narration Script
                    </h3>
                    {selectedProject.status === 'DRAFT' && (
                      <button 
                        onClick={() => {
                          if (isEditing) {
                            handleUpdateScript();
                          } else {
                            setIsEditing(true);
                          }
                        }}
                        className="btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '14px', borderRadius: '8px' }}
                        disabled={loading}
                      >
                        {isEditing ? 'Save Changes' : 'Edit Script'}
                      </button>
                    )}
                  </div>

                  {selectedProject.script ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase' }}>Short Title</label>
                        {isEditing ? (
                          <input type="text" className="glass-input" style={{ width: '100%', marginTop: '6px', padding: '10px' }} value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                        ) : (
                          <p style={{ fontSize: '16px', fontWeight: 600, marginTop: '4px' }}>{selectedProject.script.title}</p>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#00f2fe', fontWeight: 700, textTransform: 'uppercase' }}>YouTube Title</label>
                        {isEditing ? (
                          <input type="text" className="glass-input" style={{ width: '100%', marginTop: '6px', padding: '10px' }} value={editYoutubeTitle} onChange={e => setEditYoutubeTitle(e.target.value)} />
                        ) : (
                          <p style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px', color: '#ffffff' }}>{selectedProject.script.youtubeTitle || selectedProject.script.title}</p>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#00f2fe', fontWeight: 700, textTransform: 'uppercase' }}>YouTube Description</label>
                        {isEditing ? (
                          <textarea rows={4} className="glass-input" style={{ width: '100%', marginTop: '6px', padding: '10px', fontSize: '14px', fontFamily: 'inherit' }} value={editYoutubeDescription} onChange={e => setEditYoutubeDescription(e.target.value)} />
                        ) : (
                          <p style={{ fontSize: '14px', marginTop: '4px', lineHeight: '1.55', color: '#c9d1d9', whiteSpace: 'pre-wrap' }}>{selectedProject.script.youtubeDescription || 'No YouTube description generated yet.'}</p>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#ffbd2e', fontWeight: 700, textTransform: 'uppercase' }}>Hook (First 2s)</label>
                        {isEditing ? (
                          <textarea rows={2} className="glass-input" style={{ width: '100%', marginTop: '6px', padding: '10px', fontSize: '14px', fontFamily: 'inherit' }} value={editHook} onChange={e => setEditHook(e.target.value)} />
                        ) : (
                          <p style={{ fontSize: '15px', color: '#ffbd2e', marginTop: '4px', lineHeight: '1.5' }}>"{selectedProject.script.hook}"</p>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase' }}>Body Content</label>
                        {isEditing ? (
                          <textarea rows={4} className="glass-input" style={{ width: '100%', marginTop: '6px', padding: '10px', fontSize: '14px', fontFamily: 'inherit' }} value={editBody} onChange={e => setEditBody(e.target.value)} />
                        ) : (
                          <p style={{ fontSize: '15px', marginTop: '4px', lineHeight: '1.6', opacity: 0.9 }}>{selectedProject.script.body}</p>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase' }}>Call To Action</label>
                        {isEditing ? (
                          <input type="text" className="glass-input" style={{ width: '100%', marginTop: '6px', padding: '10px' }} value={editCta} onChange={e => setEditCta(e.target.value)} />
                        ) : (
                          <p style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px', color: '#00f2fe' }}>{selectedProject.script.cta}</p>
                        )}
                      </div>
                      {isEditing && (
                        <div>
                          <label style={{ fontSize: '12px', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase' }}>Estimated Duration (sec)</label>
                          <input type="number" className="glass-input" style={{ width: '100%', marginTop: '6px', padding: '10px' }} value={editDuration} onChange={e => setEditDuration(Number(e.target.value))} />
                        </div>
                      )}
                      {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffbd2e', fontSize: '13px', marginTop: '8px' }}>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Updating script and regenerating scenes in background...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: '#8b949e', fontSize: '14px' }}>Generating script outline...</p>
                  )}
                </div>
              </div>

              {/* COL B: Video Render Preview & Scene Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                
                {/* 1. MP4 Player (Visible only when Render is completed) */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifySelf: 'center', width: '100%' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', marginBottom: '20px' }}>
                    <Eye size={18} color="#00f2fe" /> Output Video Preview
                  </h3>
                  
                  {selectedProject.status === 'COMPLETED' && selectedProject.videoPath ? (
                    <video 
                      src={selectedProject.videoPath}
                      controls
                      style={{
                        width: '320px',
                        height: '568px', // 9:16 vertical mockup size
                        backgroundColor: '#000000',
                        borderRadius: '16px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }}
                    />
                  ) : selectedProject.status === 'RENDERING' ? (
                    <div style={{ width: '320px', height: '568px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: '#8b949e' }}>
                      <Loader2 size={40} className="animate-spin" color="#00f2fe" />
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#ffffff', fontWeight: 600 }}>Compiling Remotion composition</p>
                        <p style={{ fontSize: '12px', marginTop: '4px' }}>FFmpeg rendering in progress...</p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ width: '320px', height: '568px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#8b949e', padding: '24px', textAlign: 'center' }}>
                      <Film size={32} style={{ opacity: 0.3 }} />
                      <div>
                        <p style={{ fontWeight: 600, color: '#ffffff' }}>No video rendered yet</p>
                        <p style={{ fontSize: '13px', marginTop: '4px' }}>Click "Render MP4" at the top to compile the project.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Scene Breakdown list */}
                <div className="glass-panel" style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                    <Layers size={18} color="#00f2fe" /> Storyboard Timeline
                  </h3>

                  {selectedProject.scenes && selectedProject.scenes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {selectedProject.scenes.map((scene) => (
                        <div 
                          key={scene.id}
                          style={{
                            padding: '16px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 800, backgroundColor: 'rgba(0, 242, 254, 0.1)', color: '#00f2fe', padding: '4px 8px', borderRadius: '4px' }}>
                              SCENE {scene.sequenceNumber}
                            </span>
                            <span style={{ fontSize: '13px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {scene.duration ? `${scene.duration.toFixed(2)}s` : 'Calculating duration'}
                            </span>
                          </div>
                          
                          <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#ffffff' }}>
                            "{scene.text}"
                          </p>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                            <span style={{ fontSize: '12px', color: '#ffdf00', fontWeight: 700, fontFamily: 'monospace' }}>
                              [{scene.template}]
                            </span>
                            {scene.audioPath && (
                              <button 
                                onClick={() => {
                                  const filename = scene.audioPath ? scene.audioPath.split('/').pop() : '';
                                  const audio = new Audio(`/audio/${filename}`);
                                  audio.play();
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'none',
                                  border: 'none',
                                  color: '#00f2fe',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  fontWeight: 700
                                }}
                              >
                                <Music size={12} /> Play Voice
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#8b949e', fontSize: '14px' }}>Drafting storyboard timeline...</p>
                  )}
                </div>

              </div>

            </div>
          </div>
        ) : (
          /* EMPTY STATE: Welcome Screen */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#8b949e' }}>
            <div style={{ width: '90px', height: '90px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(79, 172, 254, 0.15) 100%)', border: '1px solid rgba(0, 242, 254, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 10px 30px rgba(0,242,254,0.08)' }}>
              <Film size={44} color="#00f2fe" />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>Technical Shorts Workspace</h2>
            <p style={{ fontSize: '15px', maxWidth: '440px', marginTop: '10px', lineHeight: '1.6' }}>
              Create high-quality developer videos. Supply a topic on the left to research information, compile visual templates, and synthesize voice tracks.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '500px', width: '100%', marginTop: '36px' }}>
              <div className="glass-panel" style={{ padding: '20px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <CheckCircle2 size={20} color="#27c93f" />
                <h4 style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>Programmatic Visuals</h4>
                <p style={{ fontSize: '12px', lineHeight: '1.4' }}>Rendering React code view screens and system diagrams in high-definition 9:16.</p>
              </div>
              <div className="glass-panel" style={{ padding: '20px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <CheckCircle2 size={20} color="#27c93f" />
                <h4 style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>Free Quality Stack</h4>
                <p style={{ fontSize: '12px', lineHeight: '1.4' }}>Powered by Microsoft Neural Speech streams and Google Gemini's Auditor engines.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
