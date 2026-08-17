import { PipelineVentes } from '@/components/PipelineVentes';

export default function SuiviVentesPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Suivi des ventes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivez l'avancement de chaque commande produit, de la vérification stock jusqu'au paiement.
        </p>
      </div>
      <PipelineVentes />
    </div>
  );
}
