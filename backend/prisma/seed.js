"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const date_fns_1 = require("date-fns");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding database...');
    // ============ USERS ============
    console.log('Creating users...');
    const passwordHash = await bcryptjs_1.default.hash('password123', 12);
    const direction = await prisma.user.upsert({
        where: { email: 'direction@rhs.dz' },
        update: {},
        create: {
            email: 'direction@rhs.dz',
            password: passwordHash,
            nom: 'KHELIFI',
            prenom: 'Rayan',
            tel: '+213 555 000001',
            role: 'DIRECTION',
        },
    });
    const planning = await prisma.user.upsert({
        where: { email: 'planning@rhs.dz' },
        update: {},
        create: {
            email: 'planning@rhs.dz',
            password: passwordHash,
            nom: 'BENALI',
            prenom: 'Sarah',
            tel: '+213 555 000002',
            role: 'PLANNING',
        },
    });
    const equipe = await prisma.user.upsert({
        where: { email: 'equipe@rhs.dz' },
        update: {},
        create: {
            email: 'equipe@rhs.dz',
            password: passwordHash,
            nom: 'HADJ',
            prenom: 'Karim',
            tel: '+213 555 000003',
            role: 'EQUIPE',
        },
    });
    const lecture = await prisma.user.upsert({
        where: { email: 'lecture@rhs.dz' },
        update: {},
        create: {
            email: 'lecture@rhs.dz',
            password: passwordHash,
            nom: 'MEZIANE',
            prenom: 'Amina',
            tel: '+213 555 000004',
            role: 'LECTURE',
        },
    });
    console.log(`Created ${4} users`);
    // ============ PRESTATIONS ============
    console.log('Creating prestations...');
    const prestationsData = [
        { nom: 'Dératisation', ordre: 1 },
        { nom: 'Désinsectisation', ordre: 2 },
        { nom: '3D (Dératisation + Désinsectisation + Désinfection)', ordre: 3 },
        { nom: 'Dépigeonnage', ordre: 4 },
        { nom: 'Lutte anti-chat', ordre: 5 },
        { nom: 'Désinfection', ordre: 6 },
        { nom: 'Traitement anti-termites', ordre: 7 },
        { nom: 'Fumigation', ordre: 8 },
    ];
    for (const prestation of prestationsData) {
        await prisma.prestation.upsert({
            where: { nom: prestation.nom },
            update: { ordre: prestation.ordre },
            create: prestation,
        });
    }
    console.log(`Created ${prestationsData.length} prestations`);
    // ============ CLIENTS ============
    console.log('Creating clients...');
    const clients = await Promise.all([
        prisma.client.create({
            data: {
                nomEntreprise: 'SARL Laiterie du Sahel',
                secteur: 'Agroalimentaire',
                siegeNom: 'Siège Alger',
                siegeAdresse: 'Rue Principale, Alger',
                siegeTel: '+213 555 123000',
                siegeEmail: 'siege@laiterie-sahel.dz',
                siegeNotes: 'Siège principal',
                siegeRC: 'RC123',
                siegeNIF: 'NIF123',
                siegeAI: 'AI123',
                siegeNIS: 'NIS123',
                siegeTIN: 'TIN123',
            },
        }),
        prisma.client.create({
            data: {
                nomEntreprise: 'EURL Pharmacie Centrale',
                secteur: 'Pharmaceutique',
                siegeNom: 'Siège Centre',
                siegeAdresse: 'Boulevard Central, Alger',
                siegeTel: '+213 555 234000',
                siegeEmail: 'siege@pharmacie-centrale.dz',
                siegeRC: 'RC234',
                siegeNIF: 'NIF234',
                siegeAI: 'AI234',
                siegeNIS: 'NIS234',
                siegeTIN: 'TIN234',
            },
        }),
        prisma.client.create({
            data: {
                nomEntreprise: 'Hôtel El Djazair',
                secteur: 'Hôtellerie',
                siegeNom: 'Siège Hôtel',
                siegeAdresse: '24 Avenue Souidani Boudjemaa, Alger',
                siegeTel: '+213 555 345000',
                siegeEmail: 'siege@hotel-eldjazair.dz',
                siegeNotes: 'Siège administratif',
                siegeRC: 'RC345',
                siegeNIF: 'NIF345',
                siegeAI: 'AI345',
                siegeNIS: 'NIS345',
                siegeTIN: 'TIN345',
            },
        }),
        prisma.client.create({
            data: {
                nomEntreprise: 'Restaurant Le Gourmet',
                secteur: 'Restauration',
                siegeNom: 'Siège Restaurant',
                siegeAdresse: 'Port de Sidi Fredj',
                siegeTel: '+213 555 456000',
                siegeRC: 'RC456',
                siegeNIF: 'NIF456',
                siegeAI: 'AI456',
                siegeNIS: 'NIS456',
                siegeTIN: 'TIN456',
            },
        }),
        prisma.client.create({
            data: {
                nomEntreprise: 'Clinique El Hayat',
                secteur: 'Santé',
                siegeNom: 'Siège Clinique',
                siegeAdresse: 'Boulevard Krim Belkacem, Alger',
                siegeTel: '+213 555 567000',
                siegeEmail: 'siege@clinique-elhayat.dz',
                siegeNotes: 'Normes strictes - Produits certifiés',
                siegeRC: 'RC567',
                siegeNIF: 'NIF567',
                siegeAI: 'AI567',
                siegeNIS: 'NIS567',
                siegeTIN: 'TIN567',
            },
        }),
    ]);
    console.log(`Created ${clients.length} clients`);
    // ============ SITES ============
    console.log('Creating sites...');
    const sites = await Promise.all([
        prisma.site.create({
            data: {
                clientId: clients[0].id,
                nom: 'Site 1',
                adresse: 'Zone Industrielle Oued Smar, Lot 45',
                contactNom: 'Ahmed BENALI',
                contactFonction: 'Directeur Qualité',
                tel: '+213 555 123456',
                email: 'qualite@laiterie-sahel.dz',
                notes: 'Client prioritaire - Contrat annuel',
            },
        }),
        prisma.site.create({
            data: {
                clientId: clients[1].id,
                nom: 'Site 1',
                adresse: 'Rue Didouche Mourad, Alger Centre',
                contactNom: 'Fatima ZEROUAL',
                contactFonction: 'Pharmacienne',
                tel: '+213 555 234567',
                email: 'contact@pharmacie-centrale.dz',
            },
        }),
        prisma.site.create({
            data: {
                clientId: clients[2].id,
                nom: 'Site 1',
                adresse: '24 Avenue Souidani Boudjemaa, Alger',
                contactNom: 'Mohamed KACI',
                contactFonction: 'Directeur Technique',
                tel: '+213 555 345678',
                email: 'm.kaci@hotel-eldjazair.dz',
                notes: 'Intervention de nuit uniquement',
            },
        }),
        prisma.site.create({
            data: {
                clientId: clients[3].id,
                nom: 'Site 1',
                adresse: 'Port de Sidi Fredj',
                contactNom: 'Karim SLIMANI',
                contactFonction: 'Gérant',
                tel: '+213 555 456789',
            },
        }),
        prisma.site.create({
            data: {
                clientId: clients[4].id,
                nom: 'Site 1',
                adresse: 'Boulevard Krim Belkacem, Alger',
                contactNom: 'Dr. Samira BOUDIAF',
                contactFonction: 'Directrice',
                tel: '+213 555 567890',
                email: 'direction@clinique-elhayat.dz',
                notes: 'Normes strictes - Produits certifiés',
            },
        }),
    ]);
    console.log(`Created ${sites.length} sites`);
    // ============ SIEGE CONTACTS ============
    console.log('Creating siege contacts...');
    const siegeContacts = await Promise.all([
        prisma.siegeContact.create({
            data: {
                clientId: clients[0].id,
                nom: 'Ahmed BENALI',
                fonction: 'Directeur Qualité',
                tel: '+213 555 123001',
                email: 'ahmed@laiterie-sahel.dz',
            },
        }),
        prisma.siegeContact.create({
            data: {
                clientId: clients[1].id,
                nom: 'Fatima ZEROUAL',
                fonction: 'Pharmacienne',
                tel: '+213 555 234001',
                email: 'fatima@pharmacie-centrale.dz',
            },
        }),
        prisma.siegeContact.create({
            data: {
                clientId: clients[2].id,
                nom: 'Mohamed KACI',
                fonction: 'Directeur Technique',
                tel: '+213 555 345001',
                email: 'm.kaci@hotel-eldjazair.dz',
            },
        }),
        prisma.siegeContact.create({
            data: {
                clientId: clients[3].id,
                nom: 'Karim SLIMANI',
                fonction: 'Gérant',
                tel: '+213 555 456001',
                email: 'karim@restaurant-gourmet.dz',
            },
        }),
        prisma.siegeContact.create({
            data: {
                clientId: clients[4].id,
                nom: 'Dr. Samira BOUDIAF',
                fonction: 'Directrice',
                tel: '+213 555 567001',
                email: 'samira@clinique-elhayat.dz',
            },
        }),
    ]);
    console.log(`Created ${siegeContacts.length} siege contacts`);
    // ============ CONTRATS ============
    console.log('Creating contrats...');
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31);
    const contrats = await Promise.all([
        // Contrat annuel avec opérations mensuelles et contrôles trimestriels
        prisma.contrat.create({
            data: {
                clientId: clients[0].id,
                type: 'ANNUEL',
                dateDebut: startOfYear,
                dateFin: endOfYear,
                reconductionAuto: true,
                prestations: ['Dératisation', 'Désinsectisation'],
                frequenceOperations: 'MENSUELLE',
                frequenceControle: 'TRIMESTRIELLE',
                premiereDateOperation: (0, date_fns_1.addDays)(startOfYear, 14),
                premiereDateControle: (0, date_fns_1.addMonths)(startOfYear, 3),
                responsablePlanningId: planning.id,
                statut: 'ACTIF',
                autoCreerProchaine: true,
                notes: 'Contrat premium',
            },
        }),
        // Contrat annuel simple
        prisma.contrat.create({
            data: {
                clientId: clients[1].id,
                type: 'ANNUEL',
                dateDebut: startOfYear,
                dateFin: endOfYear,
                prestations: ['Désinsectisation', 'Désinfection'],
                frequenceOperations: 'TRIMESTRIELLE',
                premiereDateOperation: (0, date_fns_1.addDays)(startOfYear, 7),
                responsablePlanningId: planning.id,
                statut: 'ACTIF',
            },
        }),
        // Contrat avec 3D
        prisma.contrat.create({
            data: {
                clientId: clients[2].id,
                type: 'ANNUEL',
                dateDebut: startOfYear,
                dateFin: endOfYear,
                reconductionAuto: true,
                prestations: ['3D (Dératisation + Désinsectisation + Désinfection)'],
                frequenceOperations: 'MENSUELLE',
                frequenceControle: 'SEMESTRIELLE',
                premiereDateOperation: (0, date_fns_1.addDays)(startOfYear, 10),
                premiereDateControle: (0, date_fns_1.addMonths)(startOfYear, 6),
                statut: 'ACTIF',
                notes: 'Interventions de nuit (après 22h)',
            },
        }),
        // Contrat ponctuel
        prisma.contrat.create({
            data: {
                clientId: clients[3].id,
                type: 'PONCTUEL',
                dateDebut: today,
                prestations: ['Dératisation'],
                premiereDateOperation: (0, date_fns_1.addDays)(today, 3),
                statut: 'ACTIF',
            },
        }),
        // Contrat suspendu
        prisma.contrat.create({
            data: {
                clientId: clients[4].id,
                type: 'ANNUEL',
                dateDebut: (0, date_fns_1.addMonths)(startOfYear, -12),
                dateFin: (0, date_fns_1.addMonths)(startOfYear, -1),
                prestations: ['Désinsectisation', 'Désinfection'],
                frequenceOperations: 'MENSUELLE',
                statut: 'TERMINE',
                notes: 'Contrat terminé - en attente de renouvellement',
            },
        }),
    ]);
    console.log(`Created ${contrats.length} contrats`);
    // ============ INTERVENTIONS ============
    console.log('Creating interventions...');
    const interventions = [];
    // Interventions pour le contrat 1 (Laiterie du Sahel)
    for (let i = 0; i < 6; i++) {
        const date = (0, date_fns_1.addMonths)(startOfYear, i);
        const isRealized = date < today;
        // Opérations mensuelles
        for (const prestation of ['Dératisation', 'Désinsectisation']) {
            interventions.push(prisma.intervention.create({
                data: {
                    contratId: contrats[0].id,
                    clientId: clients[0].id,
                    type: 'OPERATION',
                    prestation,
                    datePrevue: (0, date_fns_1.addDays)(date, 14),
                    heurePrevue: '09:00',
                    duree: 60,
                    statut: isRealized ? 'REALISEE' : (i === 5 ? 'A_PLANIFIER' : 'PLANIFIEE'),
                    responsable: 'Équipe Nord',
                    createdById: planning.id,
                    notesTerrain: isRealized ? 'Intervention effectuée sans incident' : null,
                },
            }));
        }
        // Contrôles trimestriels
        if (i % 3 === 2) {
            interventions.push(prisma.intervention.create({
                data: {
                    contratId: contrats[0].id,
                    clientId: clients[0].id,
                    type: 'CONTROLE',
                    datePrevue: (0, date_fns_1.addDays)((0, date_fns_1.addMonths)(startOfYear, i + 1), 15),
                    heurePrevue: '14:00',
                    duree: 30,
                    statut: (0, date_fns_1.addMonths)(startOfYear, i + 1) < today ? 'REALISEE' : 'PLANIFIEE',
                    responsable: 'Direction',
                    createdById: direction.id,
                },
            }));
        }
    }
    // Interventions pour le contrat 2 (Pharmacie)
    interventions.push(prisma.intervention.create({
        data: {
            contratId: contrats[1].id,
            clientId: clients[1].id,
            type: 'OPERATION',
            prestation: 'Désinsectisation',
            datePrevue: (0, date_fns_1.addDays)(today, -5),
            statut: 'REALISEE',
            createdById: planning.id,
        },
    }), prisma.intervention.create({
        data: {
            contratId: contrats[1].id,
            clientId: clients[1].id,
            type: 'OPERATION',
            prestation: 'Désinfection',
            datePrevue: (0, date_fns_1.addDays)(today, 2),
            heurePrevue: '08:00',
            statut: 'PLANIFIEE',
            createdById: planning.id,
        },
    }));
    // Intervention en retard (pour test)
    interventions.push(prisma.intervention.create({
        data: {
            contratId: contrats[2].id,
            clientId: clients[2].id,
            type: 'OPERATION',
            prestation: '3D (Dératisation + Désinsectisation + Désinfection)',
            datePrevue: (0, date_fns_1.addDays)(today, -3),
            heurePrevue: '22:00',
            statut: 'PLANIFIEE', // Volontairement en retard
            notesTerrain: 'À reporter - client indisponible',
            createdById: planning.id,
        },
    }));
    // Intervention ponctuelle
    interventions.push(prisma.intervention.create({
        data: {
            contratId: contrats[3].id,
            clientId: clients[3].id,
            type: 'OPERATION',
            prestation: 'Dératisation',
            datePrevue: (0, date_fns_1.addDays)(today, 3),
            heurePrevue: '10:00',
            duree: 90,
            statut: 'A_PLANIFIER',
            notesTerrain: 'Demande urgente suite à signalement',
            createdById: equipe.id,
        },
    }));
    await Promise.all(interventions);
    console.log(`Created ${interventions.length} interventions`);
    console.log('✅ Seeding completed!');
    console.log('\n📋 Comptes de test:');
    console.log('   Direction: direction@rhs.dz / password123');
    console.log('   Planning:  planning@rhs.dz / password123');
    console.log('   Équipe:    equipe@rhs.dz / password123');
    console.log('   Lecture:   lecture@rhs.dz / password123');
}
main()
    .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map