import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Inbox, RefreshCw, Archive, Trash2, Reply, Send,
  ChevronLeft, Paperclip, Check, MoreVertical,
  Mail, MailOpen, Loader2, Search, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { messerieApi, emailApi } from '@/services/api';
import type { EmailThread, EmailMessageItem, EmailProfileType } from '@/types';
import { cn } from '@/lib/utils';

const EMAIL_PROFILE_LABELS: Record<EmailProfileType, string> = {
  DEVIS: 'Devis',
  FACTURATION: 'Facturation',
  RAPPORT: 'Rapports',
  INTERVENTION: 'Interventions',
  COMMANDE_FOURNISSEUR: 'Commandes fournisseur',
};

const PROFILE_TYPE_COLORS: Record<EmailProfileType, string> = {
  DEVIS: 'bg-blue-100 text-blue-700',
  FACTURATION: 'bg-green-100 text-green-700',
  RAPPORT: 'bg-purple-100 text-purple-700',
  INTERVENTION: 'bg-orange-100 text-orange-700',
  COMMANDE_FOURNISSEUR: 'bg-yellow-100 text-yellow-700',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function ThreadListItem({ thread, isSelected, onClick }: {
  thread: EmailThread; isSelected: boolean; onClick: () => void;
}) {
  const lastMsg = thread.messages[thread.messages.length - 1];
  const hasUnread = thread.unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors',
        isSelected && 'bg-blue-50 border-l-2 border-l-blue-500',
        hasUnread && 'bg-white'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {hasUnread
            ? <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
            : <MailOpen className="h-4 w-4 text-gray-300 flex-shrink-0" />
          }
          <span className={cn('text-sm truncate', hasUnread ? 'font-semibold' : 'font-medium text-gray-700')}>
            {lastMsg ? (lastMsg.direction === 'INBOUND' ? (lastMsg.fromNom || lastMsg.fromEmail) : `Vous`) : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasUnread && (
            <Badge className="h-4.5 min-w-[18px] text-xs px-1.5 py-0">{thread.unreadCount}</Badge>
          )}
          <span className="text-xs text-muted-foreground">{formatDate(thread.lastMessageAt)}</span>
        </div>
      </div>
      <p className={cn('text-sm mt-0.5 truncate', hasUnread ? 'text-gray-900' : 'text-gray-600')}>
        {thread.subject}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <span className={cn('text-xs px-1.5 py-0.5 rounded', PROFILE_TYPE_COLORS[thread.profile.type])}>
          {thread.profile.nom}
        </span>
        {thread.devisId && <span className="text-xs text-muted-foreground">• Devis lié</span>}
        {thread.factureId && <span className="text-xs text-muted-foreground">• Facture liée</span>}
        {thread.commandeId && <span className="text-xs text-muted-foreground">• Commande liée</span>}
      </div>
    </button>
  );
}

function MessageBubble({ msg, profileEmail }: { msg: EmailMessageItem; profileEmail: string }) {
  const isOutbound = msg.direction === 'OUTBOUND';
  const backendBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

  return (
    <div className={cn('flex flex-col gap-1 max-w-[80%]', isOutbound ? 'ml-auto items-end' : 'items-start')}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        {isOutbound
          ? <span>{msg.sentBy ? `${msg.sentBy.prenom} ${msg.sentBy.nom}` : 'Vous'} → {msg.toEmail}</span>
          : <span>{msg.fromNom ? `${msg.fromNom} <${msg.fromEmail}>` : msg.fromEmail}</span>
        }
        <span>{formatDate(msg.createdAt)}</span>
        {msg.readAt && isOutbound && <Check className="h-3 w-3 text-green-500" />}
      </div>
      <div className={cn(
        'rounded-2xl px-4 py-3 text-sm shadow-sm',
        isOutbound ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border rounded-tl-sm text-gray-800'
      )}>
        {msg.bodyHtml ? (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
          />
        ) : (
          <p className="whitespace-pre-wrap">{msg.bodyText || '(Message vide)'}</p>
        )}
      </div>
      {msg.attachments?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {msg.attachments.map((att) => (
            <a
              key={att.id}
              href={`${backendBase}/${att.path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded border"
            >
              <Paperclip className="h-3 w-3" />
              {att.filename}
              {att.size && <span className="text-muted-foreground">({Math.round(att.size / 1024)}ko)</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadView({ threadId, onBack }: { threadId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [replyBody, setReplyBody] = useState('');
  const [replyCc, setReplyCc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread, isLoading } = useQuery<EmailThread>({
    queryKey: ['messagerie-thread', threadId],
    queryFn: () => messerieApi.getThread(threadId),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (thread) {
      qc.invalidateQueries({ queryKey: ['messagerie-unread'] });
      qc.invalidateQueries({ queryKey: ['messagerie-threads'] });
    }
  }, [thread?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages?.length]);

  const replyMutation = useMutation({
    mutationFn: () => messerieApi.reply(threadId, { body: replyBody, cc: replyCc || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messagerie-thread', threadId] });
      qc.invalidateQueries({ queryKey: ['messagerie-threads'] });
      setReplyBody('');
      setReplyCc('');
      setShowReply(false);
      toast.success('Réponse envoyée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de l\'envoi'),
  });

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => messerieApi.updateThread(threadId, { archived }),
    onSuccess: (_, archived) => {
      qc.invalidateQueries({ queryKey: ['messagerie-threads'] });
      toast.success(archived ? 'Thread archivé' : 'Thread restauré');
      onBack();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => messerieApi.deleteThread(threadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messagerie-threads'] });
      qc.invalidateQueries({ queryKey: ['messagerie-unread'] });
      toast.success('Thread supprimé');
      onBack();
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!thread) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{thread.subject}</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn('px-1.5 py-0.5 rounded', PROFILE_TYPE_COLORS[thread.profile.type])}>
              {thread.profile.nom}
            </span>
            <span>{thread.messages.length} message{thread.messages.length > 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline" size="sm"
            onClick={() => setShowReply(!showReply)}
            className="flex items-center gap-1.5"
          >
            <Reply className="h-4 w-4" />
            Répondre
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => archiveMutation.mutate(!thread.archived)}>
                <Archive className="h-4 w-4 mr-2" />
                {thread.archived ? 'Désarchiver' : 'Archiver'}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => { if (confirm('Supprimer ce thread ?')) deleteMutation.mutate(); }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {thread.messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} profileEmail={thread.profile.emailFrom} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      {showReply && (
        <div className="border-t bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Répondre via {thread.profile.emailFrom}
            </span>
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={() => setShowCc(!showCc)}
            >
              {showCc ? '— CC' : '+ CC'}
            </button>
          </div>
          {showCc && (
            <Input
              placeholder="cc@exemple.com"
              value={replyCc}
              onChange={(e) => setReplyCc(e.target.value)}
            />
          )}
          <Textarea
            placeholder="Votre réponse..."
            rows={5}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            className="resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowReply(false)}>Annuler</Button>
            <Button
              size="sm"
              onClick={() => replyMutation.mutate()}
              disabled={!replyBody.trim() || replyMutation.isPending}
            >
              {replyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Envoyer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessageriePage() {
  const qc = useQueryClient();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: profilesData } = useQuery({
    queryKey: ['email-profiles'],
    queryFn: () => emailApi.listProfiles(),
  });

  const { data: threadsData, isLoading } = useQuery({
    queryKey: ['messagerie-threads', filterType, showArchived],
    queryFn: () => messerieApi.listThreads({
      profileType: filterType !== 'all' ? filterType : undefined,
      archived: showArchived,
      limit: 100,
    }),
    refetchInterval: 60000,
  });

  const threads = (threadsData?.threads || []) as EmailThread[];
  const profiles = profilesData || [];

  const filteredThreads = threads.filter((t) => {
    if (!search) return true;
    return (
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.messages.some((m) =>
        m.fromEmail.toLowerCase().includes(search.toLowerCase()) ||
        m.fromNom?.toLowerCase().includes(search.toLowerCase())
      )
    );
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await messerieApi.sync();
      qc.invalidateQueries({ queryKey: ['messagerie-threads'] });
      qc.invalidateQueries({ queryKey: ['messagerie-unread'] });
      toast.success(`Synchronisation terminée${res.newMessages ? ` — ${res.newMessages} nouveau(x)` : ''}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur de synchronisation');
    } finally {
      setIsSyncing(false);
    }
  };

  const showPane = selectedThreadId !== null;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Thread list — hidden on mobile when thread open */}
      <div className={cn(
        'flex flex-col border-r bg-white',
        'w-full md:w-80 lg:w-96 flex-shrink-0',
        showPane && 'hidden md:flex'
      )}>
        {/* Toolbar */}
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold flex items-center gap-2">
              <Inbox className="h-5 w-5 text-blue-600" />
              Messagerie
            </h1>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="icon" title="Synchroniser"
                onClick={handleSync} disabled={isSyncing}
              >
                <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
              </Button>
              <Button
                variant={showArchived ? 'secondary' : 'ghost'}
                size="icon" title="Voir archivés"
                onClick={() => { setShowArchived(!showArchived); setSelectedThreadId(null); }}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {profiles.length > 0 && (
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tous les profils" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les profils</SelectItem>
                {(profiles as any[]).map((p) => (
                  <SelectItem key={p.id} value={p.type}>
                    {p.nom} — {p.emailFrom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Inbox className="h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm text-muted-foreground">
                {showArchived ? 'Aucun thread archivé' : 'Aucun email reçu'}
              </p>
              {!showArchived && (
                <p className="text-xs text-muted-foreground mt-1">
                  Configurez l'IMAP dans Paramètres → Email puis synchronisez
                </p>
              )}
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <ThreadListItem
                key={thread.id}
                thread={thread}
                isSelected={selectedThreadId === thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
              />
            ))
          )}
        </div>

        {/* Footer stats */}
        <div className="p-3 border-t text-xs text-muted-foreground">
          {filteredThreads.length} thread{filteredThreads.length !== 1 ? 's' : ''}
          {' · '}
          {filteredThreads.filter(t => t.unreadCount > 0).length} non lu{filteredThreads.filter(t => t.unreadCount > 0).length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Thread view */}
      <div className={cn(
        'flex-1 flex flex-col overflow-hidden',
        !showPane && 'hidden md:flex'
      )}>
        {selectedThreadId ? (
          <ThreadView
            key={selectedThreadId}
            threadId={selectedThreadId}
            onBack={() => setSelectedThreadId(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <Inbox className="h-12 w-12 text-gray-200" />
            <p className="text-muted-foreground text-sm">Sélectionnez un thread pour le lire</p>
          </div>
        )}
      </div>
    </div>
  );
}
