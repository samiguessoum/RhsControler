/**
 * Documentation OpenAPI/Swagger pour le module Facturation
 *
 * Pour utiliser cette documentation, installer swagger-ui-express et swagger-jsdoc:
 * npm install swagger-ui-express swagger-jsdoc
 * npm install -D @types/swagger-ui-express @types/swagger-jsdoc
 */

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'RHS Controler - API Facturation',
    version: '1.0.0',
    description: 'API de gestion de la facturation pour l\'ERP RHS Controler',
    contact: {
      name: 'Support',
      email: 'support@rhs.dz',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Serveur API',
    },
  ],
  tags: [
    { name: 'Commerce', description: 'Devis, Commandes et Factures clients' },
    { name: 'Factures Fournisseurs', description: 'Gestion des factures fournisseurs' },
    { name: 'Charges', description: 'Gestion des charges et dépenses' },
    { name: 'Paiements Divers', description: 'Encaissements et décaissements divers' },
    { name: 'Statistiques', description: 'Rapports et statistiques de facturation' },
    { name: 'Notifications', description: 'Système de notifications' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      // Schémas de base
      Facture: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ref: { type: 'string', example: 'FAC2024-00001' },
          clientId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['FACTURE', 'AVOIR', 'ACOMPTE'] },
          statut: { type: 'string', enum: ['BROUILLON', 'VALIDEE', 'EN_RETARD', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE'] },
          dateFacture: { type: 'string', format: 'date-time' },
          dateEcheance: { type: 'string', format: 'date-time' },
          totalHT: { type: 'number' },
          totalTVA: { type: 'number' },
          totalTTC: { type: 'number' },
          totalPaye: { type: 'number' },
          devise: { type: 'string', default: 'DZD' },
          lignes: { type: 'array', items: { $ref: '#/components/schemas/FactureLigne' } },
          paiements: { type: 'array', items: { $ref: '#/components/schemas/Paiement' } },
        },
      },
      FactureLigne: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          produitServiceId: { type: 'string', format: 'uuid' },
          libelle: { type: 'string' },
          quantite: { type: 'number' },
          unite: { type: 'string' },
          prixUnitaireHT: { type: 'number' },
          tauxTVA: { type: 'number' },
          remisePct: { type: 'number' },
          totalHT: { type: 'number' },
          totalTVA: { type: 'number' },
          totalTTC: { type: 'number' },
        },
      },
      Paiement: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          montant: { type: 'number' },
          datePaiement: { type: 'string', format: 'date-time' },
          reference: { type: 'string' },
          modePaiement: { $ref: '#/components/schemas/ModePaiement' },
          statut: { type: 'string', enum: ['RECU', 'ANNULE'] },
        },
      },
      ModePaiement: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string', example: 'VIR' },
          libelle: { type: 'string', example: 'Virement' },
        },
      },
      FactureFournisseur: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ref: { type: 'string', example: 'FF2024-00001' },
          refFournisseur: { type: 'string' },
          fournisseurId: { type: 'string', format: 'uuid' },
          statut: { type: 'string', enum: ['BROUILLON', 'VALIDEE', 'EN_RETARD', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE'] },
          dateFacture: { type: 'string', format: 'date-time' },
          dateEcheance: { type: 'string', format: 'date-time' },
          totalHT: { type: 'number' },
          totalTVA: { type: 'number' },
          totalTTC: { type: 'number' },
          totalPaye: { type: 'number' },
        },
      },
      Charge: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ref: { type: 'string', example: 'CHG2024-00001' },
          typeCharge: { type: 'string', enum: ['FOURNISSEUR', 'FISCALE', 'SOCIALE', 'DIVERSE'] },
          libelle: { type: 'string' },
          categorie: { type: 'string' },
          montantHT: { type: 'number' },
          tauxTVA: { type: 'number' },
          montantTTC: { type: 'number' },
          montantPaye: { type: 'number' },
          statut: { type: 'string', enum: ['A_PAYER', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE'] },
        },
      },
      PaiementDivers: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ref: { type: 'string', example: 'PD2024-00001' },
          libelle: { type: 'string' },
          typeOperation: { type: 'string', enum: ['ENCAISSEMENT', 'DECAISSEMENT'] },
          montant: { type: 'number' },
          categorie: { type: 'string' },
          datePaiement: { type: 'string', format: 'date-time' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'warning', 'error', 'success'] },
          read: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      StatsGlobal: {
        type: 'object',
        properties: {
          annee: { type: 'number' },
          facturesClients: {
            type: 'object',
            properties: {
              count: { type: 'number' },
              totalHT: { type: 'number' },
              totalTVA: { type: 'number' },
              totalTTC: { type: 'number' },
              totalPaye: { type: 'number' },
              resteAPayer: { type: 'number' },
            },
          },
          facturesFournisseurs: {
            type: 'object',
            properties: {
              count: { type: 'number' },
              totalHT: { type: 'number' },
              totalTTC: { type: 'number' },
              totalPaye: { type: 'number' },
            },
          },
          resume: {
            type: 'object',
            properties: {
              totalVentes: { type: 'number' },
              totalAchats: { type: 'number' },
              resultatBrut: { type: 'number' },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          total: { type: 'number' },
          totalPages: { type: 'number' },
        },
      },
      // Schémas d'entrée
      CreateFactureInput: {
        type: 'object',
        required: ['clientId', 'lignes'],
        properties: {
          clientId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['FACTURE', 'AVOIR', 'ACOMPTE'], default: 'FACTURE' },
          dateFacture: { type: 'string', format: 'date' },
          dateEcheance: { type: 'string', format: 'date' },
          remiseGlobalPct: { type: 'number' },
          remiseGlobalMontant: { type: 'number' },
          notes: { type: 'string' },
          conditions: { type: 'string' },
          lignes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['quantite', 'prixUnitaireHT'],
              properties: {
                produitServiceId: { type: 'string', format: 'uuid' },
                libelle: { type: 'string' },
                quantite: { type: 'number' },
                prixUnitaireHT: { type: 'number' },
                tauxTVA: { type: 'number', default: 19 },
                remisePct: { type: 'number' },
              },
            },
          },
        },
      },
      CreatePaiementInput: {
        type: 'object',
        required: ['factureId', 'montant'],
        properties: {
          factureId: { type: 'string', format: 'uuid' },
          montant: { type: 'number' },
          datePaiement: { type: 'string', format: 'date' },
          modePaiementId: { type: 'string', format: 'uuid' },
          reference: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // Commerce - Factures clients
    '/commerce/factures': {
      get: {
        tags: ['Commerce'],
        summary: 'Liste des factures clients',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'clientId', in: 'query', schema: { type: 'string' } },
          { name: 'statut', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'number', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'number', default: 50 } },
        ],
        responses: {
          200: {
            description: 'Liste des factures',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    factures: { type: 'array', items: { $ref: '#/components/schemas/Facture' } },
                    pagination: { $ref: '#/components/schemas/Pagination' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Commerce'],
        summary: 'Créer une facture client',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateFactureInput' },
            },
          },
        },
        responses: {
          201: {
            description: 'Facture créée',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    facture: { $ref: '#/components/schemas/Facture' },
                  },
                },
              },
            },
          },
          400: { description: 'Erreur de validation' },
          500: { description: 'Erreur serveur' },
        },
      },
    },
    '/commerce/factures/{id}': {
      get: {
        tags: ['Commerce'],
        summary: 'Détail d\'une facture',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Facture trouvée' },
          404: { description: 'Facture non trouvée' },
        },
      },
      put: {
        tags: ['Commerce'],
        summary: 'Modifier une facture',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Facture modifiée' },
          404: { description: 'Facture non trouvée' },
        },
      },
      delete: {
        tags: ['Commerce'],
        summary: 'Supprimer une facture',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Facture supprimée' },
          404: { description: 'Facture non trouvée' },
        },
      },
    },
    '/commerce/factures/{id}/pdf': {
      get: {
        tags: ['Commerce'],
        summary: 'Exporter une facture en PDF',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Fichier PDF',
            content: { 'application/pdf': {} },
          },
        },
      },
    },
    '/commerce/paiements': {
      post: {
        tags: ['Commerce'],
        summary: 'Enregistrer un paiement',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePaiementInput' },
            },
          },
        },
        responses: {
          201: { description: 'Paiement enregistré' },
          400: { description: 'Erreur de validation' },
          404: { description: 'Facture non trouvée' },
        },
      },
    },
    // Factures Fournisseurs
    '/factures-fournisseurs': {
      get: {
        tags: ['Factures Fournisseurs'],
        summary: 'Liste des factures fournisseurs',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'fournisseurId', in: 'query', schema: { type: 'string' } },
          { name: 'statut', in: 'query', schema: { type: 'string' } },
          { name: 'dateDebut', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateFin', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: { description: 'Liste des factures fournisseurs' },
        },
      },
      post: {
        tags: ['Factures Fournisseurs'],
        summary: 'Créer une facture fournisseur',
        responses: {
          201: { description: 'Facture créée' },
        },
      },
    },
    // Charges
    '/charges': {
      get: {
        tags: ['Charges'],
        summary: 'Liste des charges',
        parameters: [
          { name: 'typeCharge', in: 'query', schema: { type: 'string', enum: ['FOURNISSEUR', 'FISCALE', 'SOCIALE', 'DIVERSE'] } },
          { name: 'categorie', in: 'query', schema: { type: 'string' } },
          { name: 'statut', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Liste des charges' },
        },
      },
      post: {
        tags: ['Charges'],
        summary: 'Créer une charge',
        responses: {
          201: { description: 'Charge créée' },
        },
      },
    },
    // Paiements Divers
    '/paiements-divers': {
      get: {
        tags: ['Paiements Divers'],
        summary: 'Liste des paiements divers',
        parameters: [
          { name: 'typeOperation', in: 'query', schema: { type: 'string', enum: ['ENCAISSEMENT', 'DECAISSEMENT'] } },
          { name: 'categorie', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Liste des paiements divers' },
        },
      },
    },
    // Statistiques
    '/facturation/stats/global': {
      get: {
        tags: ['Statistiques'],
        summary: 'Statistiques globales de facturation',
        parameters: [
          { name: 'annee', in: 'query', schema: { type: 'number' } },
          { name: 'noCache', in: 'query', schema: { type: 'boolean' }, description: 'Désactiver le cache' },
        ],
        responses: {
          200: {
            description: 'Statistiques globales',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatsGlobal' },
              },
            },
          },
        },
      },
    },
    '/facturation/stats/tva': {
      get: {
        tags: ['Statistiques'],
        summary: 'Résumé TVA',
        parameters: [
          { name: 'annee', in: 'query', schema: { type: 'number' } },
          { name: 'trimestre', in: 'query', schema: { type: 'number', minimum: 1, maximum: 4 } },
          { name: 'mois', in: 'query', schema: { type: 'number', minimum: 1, maximum: 12 } },
        ],
        responses: {
          200: { description: 'Résumé TVA' },
        },
      },
    },
    '/facturation/stats/tresorerie': {
      get: {
        tags: ['Statistiques'],
        summary: 'Analyse de trésorerie',
        parameters: [
          { name: 'annee', in: 'query', schema: { type: 'number' } },
        ],
        responses: {
          200: { description: 'Données de trésorerie' },
        },
      },
    },
    '/facturation/stats/retards': {
      get: {
        tags: ['Statistiques'],
        summary: 'Factures en retard',
        responses: {
          200: { description: 'Liste des documents en retard' },
        },
      },
    },
    // Notifications
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Liste des notifications',
        parameters: [
          { name: 'unreadOnly', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          200: {
            description: 'Liste des notifications',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    notifications: { type: 'array', items: { $ref: '#/components/schemas/Notification' } },
                    unreadCount: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/notifications/{id}/read': {
      put: {
        tags: ['Notifications'],
        summary: 'Marquer une notification comme lue',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Notification marquée comme lue' },
          404: { description: 'Notification non trouvée' },
        },
      },
    },
    '/notifications/read-all': {
      put: {
        tags: ['Notifications'],
        summary: 'Marquer toutes les notifications comme lues',
        responses: {
          200: { description: 'Notifications marquées comme lues' },
        },
      },
    },
  },
};

export default swaggerDocument;
