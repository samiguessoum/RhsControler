import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Download, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { importExportApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import type { ImportPreviewResult } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ImportType = 'clients' | 'contrats' | 'interventions' | 'employes';

export function ImportExportPage() {
  const { canDo } = useAuthStore();
  const [importType, setImportType] = useState<ImportType>('clients');
  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);

  const previewMutation = useMutation({
    mutationFn: () => importExportApi.preview(importType, content),
    onSuccess: (data) => {
      setPreview(data);
      toast.success('Prévisualisation générée');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la prévisualisation');
    },
  });

  const executeMutation = useMutation({
    mutationFn: () => importExportApi.execute(importType, content),
    onSuccess: (data) => {
      toast.success(data.message || 'Import réussi');
      setPreview(null);
      setContent('');
      setFileName(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l’import');
    },
  });

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setContent(reader.result as string);
      setFileName(file.name);
      setPreview(null);
    };
    reader.readAsText(file);
  };

  const previewRows = preview?.preview || [];
  const previewColumns = useMemo(() => {
    if (!previewRows.length) return [];
    return Object.keys(previewRows[0]).filter((key) => key !== '_clientId');
  }, [previewRows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import / Export</h1>
        <p className="text-muted-foreground">
          Importez vos données via CSV et exportez le planning
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canDo('exportData') ? (
              <>
                <Button asChild variant="outline" className="w-full">
                  <a href={importExportApi.exportClients()}>Exporter clients</a>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <a href={importExportApi.exportContrats()}>Exporter contrats</a>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <a href={importExportApi.exportInterventions()}>Exporter interventions</a>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <a href={importExportApi.exportEmployes()}>Exporter employés</a>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Vous n’avez pas l’autorisation d’exporter des données.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Modèles CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline" className="w-full">
              <a href={importExportApi.getTemplate('clients')}>Template clients</a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <a href={importExportApi.getTemplate('contrats')}>Template contrats</a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <a href={importExportApi.getTemplate('interventions')}>Template interventions</a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <a href={importExportApi.getTemplate('employes')}>Template employés</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canDo('importData') ? (
            <>
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <Select value={importType} onValueChange={(v) => setImportType(v as ImportType)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clients">Clients</SelectItem>
                    <SelectItem value="contrats">Contrats</SelectItem>
                    <SelectItem value="interventions">Interventions</SelectItem>
                    <SelectItem value="employes">Employés</SelectItem>
                  </SelectContent>
                </Select>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
                {fileName && <Badge variant="outline">{fileName}</Badge>}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => previewMutation.mutate()}
                  disabled={!content || previewMutation.isPending}
                >
                  Prévisualiser
                </Button>
                <Button
                  onClick={() => executeMutation.mutate()}
                  disabled={!content || executeMutation.isPending}
                >
                  Importer
                </Button>
              </div>

              {preview && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {preview.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">
                      {preview.success
                        ? 'Aucune erreur détectée'
                        : `${preview.errors.length} erreur(s) détectée(s)`}
                    </span>
                  </div>

                  {preview.errors.length > 0 && (
                    <div className="space-y-2 text-sm">
                      {preview.errors.map((err, idx) => (
                        <div key={`${err.row}-${idx}`} className="text-red-700">
                          Ligne {err.row} • {err.field} • {err.message}{err.value ? ` (${err.value})` : ''}
                        </div>
                      ))}
                    </div>
                  )}

                  {previewRows.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {previewColumns.map((col) => (
                            <TableHead key={col}>{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.slice(0, 10).map((row: any, idx) => (
                          <TableRow key={idx} className={!row._valid ? 'bg-red-50' : ''}>
                            {previewColumns.map((col) => (
                              <TableCell key={col}>
                                {String(row[col] ?? '')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Vous n’avez pas l’autorisation d’importer des données.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
