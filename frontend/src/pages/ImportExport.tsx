import { useMemo, useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Upload, Download, FileText, CheckCircle, AlertTriangle,
  Users, ClipboardList, Calendar, Briefcase, FileDown,
  ArrowRight, X, RotateCcw, CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { importExportApi } from '@/services/api';
import api from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import type { ImportPreviewResult } from '@/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type ImportType = 'clients' | 'contrats' | 'interventions' | 'employes';

// ─── Helper : téléchargement authentifié ───────────────────────────────────
async function downloadBlob(url: string, filename: string) {
  try {
    const { data } = await (api as any).get(url, { responseType: 'blob' });
    const objectUrl = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(objectUrl);
  } catch {
    toast.error('Erreur lors du téléchargement');
  }
}

// ─── Config des types d'import/export ─────────────────────────────────────
const IMPORT_TYPES: {
  value: ImportType;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  description: string;
  templateFile: string;
}[] = [
  {
    value: 'clients',
    label: 'Clients / Tiers',
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    description: 'Entreprises, contacts, sites, informations légales',
    templateFile: 'template_clients.csv',
  },
  {
    value: 'contrats',
    label: 'Contrats',
    icon: ClipboardList,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    description: 'Contrats, prestations, fréquences, dates',
    templateFile: 'template_contrats.csv',
  },
  {
    value: 'interventions',
    label: 'Interventions',
    icon: Calendar,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    description: 'Opérations planifiées, statuts, affectations',
    templateFile: 'template_interventions.csv',
  },
  {
    value: 'employes',
    label: 'Employés',
    icon: Briefcase,
    color: 'text-green-600',
    bg: 'bg-green-50',
    description: 'Techniciens, chauffeurs, postes, coordonnées',
    templateFile: 'template_employes.csv',
  },
];

const EXPORT_ITEMS = [
  { key: 'clients', label: 'Clients & Tiers', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', getUrl: () => importExportApi.exportClients(), filename: 'clients.csv' },
  { key: 'contrats', label: 'Contrats', icon: ClipboardList, color: 'text-violet-600', bg: 'bg-violet-50', getUrl: () => importExportApi.exportContrats(), filename: 'contrats.csv' },
  { key: 'interventions', label: 'Interventions', icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50', getUrl: () => importExportApi.exportInterventions(), filename: 'interventions.csv' },
  { key: 'employes', label: 'Employés', icon: Briefcase, color: 'text-green-600', bg: 'bg-green-50', getUrl: () => importExportApi.exportEmployes(), filename: 'employes.csv' },
  { key: 'calendar', label: 'Planning (ICS)', icon: CalendarDays, color: 'text-rose-600', bg: 'bg-rose-50', getUrl: () => importExportApi.exportGoogleCalendar(), filename: 'planning.ics' },
];

// ─── Étapes de l'import ───────────────────────────────────────────────────
type Step = 'select' | 'upload' | 'preview' | 'done';

export function ImportExportPage() {
  const { canDo } = useAuthStore();

  // Export state
  const [loadingExport, setLoadingExport] = useState<string | null>(null);

  // Import state
  const [step, setStep] = useState<Step>('select');
  const [importType, setImportType] = useState<ImportType>('clients');
  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const selectedType = IMPORT_TYPES.find((t) => t.value === importType)!;

  // ── Export handler ──────────────────────────────────────────────────────
  const handleExport = async (key: string, getUrl: () => string, filename: string) => {
    setLoadingExport(key);
    await downloadBlob(getUrl(), filename);
    setLoadingExport(null);
  };

  // ── Template handler ────────────────────────────────────────────────────
  const handleTemplate = async (type: ImportType, filename: string) => {
    await downloadBlob(`/api/import/templates/${type}`, filename);
  };

  // ── File reading ────────────────────────────────────────────────────────
  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setContent(reader.result as string);
      setFileName(file.name);
      setPreview(null);
      setStep('upload');
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) readFile(file);
    else toast.error('Fichier CSV uniquement');
  }, [readFile]);

  // ── Preview mutation ────────────────────────────────────────────────────
  const previewMutation = useMutation({
    mutationFn: () => importExportApi.preview(importType, content),
    onSuccess: (data) => {
      setPreview(data);
      setStep('preview');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la prévisualisation');
    },
  });

  // ── Execute mutation ────────────────────────────────────────────────────
  const executeMutation = useMutation({
    mutationFn: () => importExportApi.execute(importType, content),
    onSuccess: (data) => {
      toast.success(data.message || 'Import réussi');
      setStep('done');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'import');
    },
  });

  const resetImport = () => {
    setStep('select');
    setContent('');
    setFileName(null);
    setPreview(null);
  };

  const previewRows = preview?.preview || [];
  const previewColumns = useMemo(() => {
    if (!previewRows.length) return [];
    return Object.keys(previewRows[0]).filter((k) => k !== '_clientId' && k !== '_valid');
  }, [previewRows]);

  const hasErrors = (preview?.errors?.length ?? 0) > 0;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import / Export</h1>
        <p className="text-muted-foreground mt-1">Importez vos données via CSV et exportez pour vos sauvegardes ou outils externes</p>
      </div>

      {/* ── EXPORT ─────────────────────────────────────────────────────── */}
      {canDo('exportData') && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Download className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold text-lg">Exporter des données</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {EXPORT_ITEMS.map((item) => {
              const Icon = item.icon;
              const isLoading = loadingExport === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleExport(item.key, item.getUrl, item.filename)}
                  disabled={isLoading}
                  className="group flex flex-col items-center gap-2 p-4 rounded-xl border bg-white hover:border-gray-300 hover:shadow-sm transition-all disabled:opacity-60 text-center"
                >
                  <div className={cn('p-2.5 rounded-lg', item.bg)}>
                    <Icon className={cn('h-5 w-5', item.color)} />
                  </div>
                  <span className="text-sm font-medium leading-tight">{item.label}</span>
                  <span className={cn('text-xs font-semibold', item.color)}>
                    {isLoading ? 'Export...' : 'Télécharger'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── IMPORT ─────────────────────────────────────────────────────── */}
      {canDo('importData') && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold text-lg">Importer des données</h2>
          </div>

          <div className="rounded-2xl border bg-white overflow-hidden">

            {/* Stepper */}
            <div className="border-b px-6 py-4 bg-gray-50">
              <div className="flex items-center gap-2 text-sm">
                {(['select', 'upload', 'preview', 'done'] as Step[]).map((s, i, arr) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                      step === s ? 'bg-primary text-white' :
                      ['select', 'upload', 'preview', 'done'].indexOf(step) > i ? 'bg-green-500 text-white' :
                      'bg-gray-200 text-gray-500'
                    )}>
                      {['select', 'upload', 'preview', 'done'].indexOf(step) > i ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <span className={cn('hidden sm:block', step === s ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                      {['Type', 'Fichier', 'Vérification', 'Terminé'][i]}
                    </span>
                    {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-gray-300 mx-1" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6">

              {/* STEP 1 : Choisir le type */}
              {(step === 'select' || step === 'upload') && (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">Type de données</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {IMPORT_TYPES.map((t) => {
                        const Icon = t.icon;
                        return (
                          <button
                            key={t.value}
                            onClick={() => { setImportType(t.value); setStep('select'); setContent(''); setFileName(null); setPreview(null); }}
                            className={cn(
                              'flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all',
                              importType === t.value
                                ? 'border-primary bg-primary/5'
                                : 'border-transparent bg-gray-50 hover:bg-gray-100'
                            )}
                          >
                            <div className={cn('p-2 rounded-lg', t.bg)}>
                              <Icon className={cn('h-4 w-4', t.color)} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{t.label}</p>
                              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{t.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Modèle CSV */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2 text-sm text-amber-800">
                      <FileDown className="h-4 w-4 shrink-0" />
                      <span>Téléchargez le modèle CSV pour <strong>{selectedType.label}</strong> avant d'importer</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0 ml-3"
                      onClick={() => handleTemplate(importType, selectedType.templateFile)}
                    >
                      Modèle CSV
                    </Button>
                  </div>

                  {/* Drop zone */}
                  <div>
                    <p className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">Fichier CSV</p>
                    <label
                      className={cn(
                        'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors',
                        dragOver ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
                      />
                      <div className={cn('p-3 rounded-full', dragOver ? 'bg-primary/10' : 'bg-gray-100')}>
                        <Upload className={cn('h-6 w-6', dragOver ? 'text-primary' : 'text-gray-400')} />
                      </div>
                      {fileName ? (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-700">{fileName}</span>
                          <button onClick={(e) => { e.preventDefault(); resetImport(); }} className="text-gray-400 hover:text-red-500">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium">Glissez votre fichier CSV ici</p>
                          <p className="text-xs text-muted-foreground">ou cliquez pour parcourir</p>
                        </>
                      )}
                    </label>
                  </div>

                  {/* Actions */}
                  {content && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={resetImport}>
                        <RotateCcw className="h-4 w-4 mr-1.5" /> Recommencer
                      </Button>
                      <Button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
                        {previewMutation.isPending ? 'Analyse...' : 'Vérifier le fichier'}
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3 : Prévisualisation */}
              {step === 'preview' && preview && (
                <div className="space-y-5">
                  {/* Résumé validation */}
                  <div className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border',
                    hasErrors ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                  )}>
                    {hasErrors ? (
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className={cn('font-semibold text-sm', hasErrors ? 'text-red-800' : 'text-green-800')}>
                        {hasErrors
                          ? `${preview.errors.length} erreur(s) détectée(s) — corrigez le CSV avant d'importer`
                          : `Fichier valide — ${previewRows.length} ligne(s) prête(s) à importer`}
                      </p>
                      {hasErrors && (
                        <ul className="mt-2 space-y-1">
                          {preview.errors.slice(0, 8).map((err, i) => (
                            <li key={i} className="text-xs text-red-700 flex items-center gap-1.5">
                              <span className="font-mono bg-red-100 px-1 rounded">L.{err.row}</span>
                              <span className="font-medium">{err.field}</span>
                              <span>— {err.message}</span>
                              {err.value && <span className="text-red-500">({err.value})</span>}
                            </li>
                          ))}
                          {preview.errors.length > 8 && (
                            <li className="text-xs text-red-600 font-medium">… et {preview.errors.length - 8} autre(s) erreur(s)</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Tableau de prévisualisation */}
                  {previewRows.length > 0 && (
                    <div className="rounded-lg border overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2.5 border-b flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">
                          Aperçu — {Math.min(previewRows.length, 10)} première(s) ligne(s)
                        </p>
                        <Badge variant="outline">{selectedType.label}</Badge>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              {previewColumns.map((col) => (
                                <TableHead key={col} className="text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                                  {col}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewRows.slice(0, 10).map((row: any, idx) => (
                              <TableRow key={idx} className={!row._valid ? 'bg-red-50' : ''}>
                                {previewColumns.map((col) => (
                                  <TableCell key={col} className="text-sm max-w-[200px] truncate">
                                    {String(row[col] ?? '')}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-between gap-2">
                    <Button variant="outline" onClick={resetImport}>
                      <RotateCcw className="h-4 w-4 mr-1.5" /> Recommencer
                    </Button>
                    <Button
                      onClick={() => executeMutation.mutate()}
                      disabled={hasErrors || executeMutation.isPending}
                      className={hasErrors ? 'opacity-50' : ''}
                    >
                      {executeMutation.isPending ? 'Import en cours...' : `Confirmer l'import`}
                      <CheckCircle className="h-4 w-4 ml-1.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 4 : Terminé */}
              {step === 'done' && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="p-4 rounded-full bg-green-100">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">Import réussi !</p>
                    <p className="text-sm text-muted-foreground mt-1">Les données ont été importées avec succès.</p>
                  </div>
                  <Button onClick={resetImport} variant="outline">
                    <RotateCcw className="h-4 w-4 mr-1.5" /> Nouvel import
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {!canDo('exportData') && !canDo('importData') && (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Accès restreint</p>
          <p className="text-sm">Vous n'avez pas les droits nécessaires pour importer ou exporter des données.</p>
        </div>
      )}
    </div>
  );
}
