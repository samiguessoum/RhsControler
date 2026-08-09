/**
 * Credite un employe pour un mois donne s'il ne l'a pas deja ete.
 * Idempotent : verifie l'historique des mouvements avant de crediter.
 */
export declare function accruerEmployePourMois(employeId: string, annee: number, mois: number, auteurId?: string): Promise<boolean>;
/**
 * Rattrape tous les mois dus (depuis l'entree ou depuis janvier de l'annee en cours)
 * jusqu'au mois actuel pour un employe donne. Sans effet sur les mois deja credites.
 */
export declare function rattraperAccrualEmploye(employeId: string, dateEntree: Date | null, auteurId?: string): Promise<number>;
/**
 * Passe en revue tous les employes et credite les mois dus.
 * Concu pour etre appele automatiquement (au demarrage puis periodiquement).
 */
export declare function rattraperAccrualTousEmployes(): Promise<number>;
/**
 * Demarre la verification periodique d'acquisition de conges.
 * Une passe immediate au demarrage rattrape les mois manques pendant un arret,
 * puis une verification reguliere credite le nouveau mois des qu'il commence.
 */
export declare function startAccrualScheduler(): void;
//# sourceMappingURL=conges-accrual.service.d.ts.map