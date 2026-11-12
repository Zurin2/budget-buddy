'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/utils/supabase/client';
import { StickyNote, Pin, PinOff, Pencil, Trash2, Check, X } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import AlertMessage from '@/components/AlertMessage';
import { Card, CardContent, Button, Textarea } from '@/components/ui';
import ChatBot from '@/components/chat/ChatBot';
import { NOTES_BOT } from '@/components/chat/botConfigs';
import { useAuthUser, useLogout } from '@/lib/useUser';
import { fetchNotes } from '@/lib/data';
import { runNotesAction } from '@/lib/botActions';

const cls = (...parts) => parts.filter(Boolean).join(' ');

function NotesContent() {
  const user = useAuthUser();
  const logout = useLogout();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [alert, setAlert] = useState({ type: 'info', message: '' });

  const notesQuery = useQuery({
    queryKey: ['notes', user?.id],
    queryFn: fetchNotes,
    enabled: !!user,
  });
  const notes = notesQuery.data || [];
  const pinnedNotes = notes.filter((n) => n.pinned);
  const regularNotes = notes.filter((n) => !n.pinned);

  const onError = (error, fallback) =>
    setAlert({ type: 'error', message: error?.message ? `Error: ${error.message}` : fallback });

  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase()
        .from('notes')
        .insert({ content: draft.trim(), pinned: false });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (error) => onError(error, 'Error adding the note.'),
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }) => {
      const { error } = await getSupabase().from('notes').update({ pinned: !pinned }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
    onError: (error) => onError(error, 'Error updating the note.'),
  });

  const saveEdit = useMutation({
    mutationFn: async ({ id, content }) => {
      const { error } = await getSupabase().from('notes').update({ content }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (error) => onError(error, 'Error saving the note.'),
  });

  const deleteNote = useMutation({
    mutationFn: async (id) => {
      const { error } = await getSupabase().from('notes').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
    onError: (error) => onError(error, 'Error deleting the note.'),
  });

  const submitDraft = () => {
    if (!draft.trim()) return;
    addNote.mutate();
  };

  const onAction = (action) => runNotesAction(action, { notes, queryClient });

  const renderNote = (note, isPinned) => (
    <div
      key={note.id}
      className={cls(
        'rounded-xl border p-4',
        isPinned ? 'border-slate-200 border-l-4 border-l-amber-500 bg-amber-50' : 'border-slate-200 border-l-4 border-l-blue-500 bg-white'
      )}
    >
      {editingId === note.id ? (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-20 bg-white"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => saveEdit.mutate({ id: note.id, content: editContent.trim() })}
              disabled={!editContent.trim() || saveEdit.isPending}
            >
              <Check size={14} /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
              <X size={14} /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{note.content}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
            <span className="flex-1">{new Date(note.created_at).toLocaleString()}</span>
            <button
              onClick={() => togglePin.mutate({ id: note.id, pinned: note.pinned })}
              title={note.pinned ? 'Unpin' : 'Pin'}
              className="p-1.5 rounded-md hover:bg-black/5 text-amber-600"
            >
              {note.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
            <button
              onClick={() => {
                setEditingId(note.id);
                setEditContent(note.content);
              }}
              title="Edit"
              className="p-1.5 rounded-md hover:bg-black/5 text-slate-500"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => {
                if (window.confirm('Delete this note?')) deleteNote.mutate(note.id);
              }}
              title="Delete"
              className="p-1.5 rounded-md hover:bg-red-50 hover:text-red-600 text-slate-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <AppLayout user={user} onLogout={logout}>
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Notes</h1>
          <p className="mt-1 text-slate-600">Quick thoughts and reminders, pinned ones on top.</p>
        </div>

        {/* Add note */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitDraft();
              }}
              placeholder="Write a note... (Ctrl+Enter to save)"
              className="min-h-24"
            />
            <div className="flex justify-end">
              <Button onClick={submitDraft} disabled={!draft.trim() || addNote.isPending}>
                {addNote.isPending ? 'Saving...' : 'Add Note'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pinned */}
        {pinnedNotes.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">📌 Pinned</h2>
            {pinnedNotes.map((note) => renderNote(note, true))}
          </section>
        )}

        {/* Everything else */}
        <section className="space-y-3">
          {notes.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-300 p-10 text-center text-slate-500">
              <StickyNote size={32} className="mx-auto mb-3 text-slate-400" />
              <p className="font-medium">No notes yet</p>
              <p className="text-sm">Write your first note above.</p>
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Notes</h2>
              {regularNotes.length === 0
                ? <p className="text-sm text-slate-500">All notes are pinned.</p>
                : regularNotes.map((note) => renderNote(note, false))}
            </>
          )}
        </section>
      </div>

      <AlertMessage
        type={alert.type}
        message={alert.message}
        onClose={() => setAlert({ type: 'info', message: '' })}
      />

      <ChatBot
        {...NOTES_BOT}
        buildContext={() => ({
          notes: notes.map((n) => ({ id: n.id, content: n.content, pinned: n.pinned })),
        })}
        onAction={onAction}
      />
    </AppLayout>
  );
}

export default function NotesPage() {
  return (
    <ProtectedRoute>
      <NotesContent />
    </ProtectedRoute>
  );
}
