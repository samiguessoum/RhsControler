import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Building2,
  MapPin,
  MoreVertical,
  FileText,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { clientsApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import type { Client, CreateClientInput, CreateSiteContactInput, SiteInput, SiegeContactInput } from '@/types';

export function ClientsPage() {
  const queryClient = useQueryClient();
  const { canDo } = useAuthStore();

  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteClientTarget, setDeleteClientTarget] = useState<Client | null>(null);
  const [siteSearch, setSiteSearch] = useState('');
  const [openSiteIndexes, setOpenSiteIndexes] = useState<Set<number>>(new Set());
  const [pendingClient, setPendingClient] = useState<CreateClientInput | null>(null);
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => clientsApi.list({ search: search || undefined, actif: true, limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client créé');
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateClientInput> }) =>
      clientsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client mis à jour');
      setEditingClient(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-active'] });
      queryClient.invalidateQueries({ queryKey: ['contrats'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Client supprimé');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const clients = data?.clients || [];

  const ClientForm = ({ client, isEdit }: { client?: Client; isEdit: boolean }) => {
    const defaultSites: SiteInput[] = client?.sites?.length
      ? client.sites.map((s) => ({
          nom: s.nom,
          adresse: s.adresse,
          tel: s.tel,
          email: s.email,
          notes: s.notes,
          contacts: s.contacts?.length
            ? s.contacts.map((c) => ({
                nom: c.nom,
                prenom: c.prenom,
                fonction: c.fonction,
                tel: c.tel,
                telMobile: c.telMobile,
                email: c.email,
                notes: c.notes,
                estPrincipal: c.estPrincipal,
              }))
            : [{ nom: '', fonction: '', tel: '', email: '' }],
        }))
      : [{ nom: '', adresse: '', tel: '', email: '', notes: '', contacts: [{ nom: '', fonction: '', tel: '', email: '' }] }];

    const [sites, setSites] = useState<SiteInput[]>(defaultSites);
    const defaultSiegeContacts: SiegeContactInput[] = client?.siegeContacts?.length
      ? client.siegeContacts.map((c) => ({
          nom: c.nom,
          fonction: c.fonction,
          tel: c.tel,
          email: c.email,
        }))
      : [{ nom: '', fonction: '', tel: '', email: '' }];
    const [siegeContacts, setSiegeContacts] = useState<SiegeContactInput[]>(defaultSiegeContacts);

    const updateSite = (index: number, field: keyof SiteInput, value: string) => {
      setSites((prev) => prev.map((site, i) => (i === index ? { ...site, [field]: value } : site)));
    };

    const removeSite = (index: number) => {
      setSites((prev) => prev.filter((_, i) => i !== index));
    };

    const addSite = () => {
      setSites((prev) => [
        { nom: '', adresse: '', tel: '', email: '', notes: '', contacts: [{ nom: '', fonction: '', tel: '', email: '' }] },
        ...prev,
      ]);
    };

    const updateSiteContact = (
      siteIndex: number,
      contactIndex: number,
      field: keyof CreateSiteContactInput,
      value: string
    ) => {
      setSites((prev) =>
        prev.map((site, i) => {
          if (i !== siteIndex) return site;
          const contacts = site.contacts ? [...site.contacts] : [];
          contacts[contactIndex] = { ...contacts[contactIndex], [field]: value };
          return { ...site, contacts };
        })
      );
    };

    const addSiteContact = (siteIndex: number) => {
      setSites((prev) =>
        prev.map((site, i) => {
          if (i !== siteIndex) return site;
          const contacts = site.contacts ? [...site.contacts] : [];
          return { ...site, contacts: [{ nom: '', fonction: '', tel: '', email: '' }, ...contacts] };
        })
      );
    };

    const removeSiteContact = (siteIndex: number, contactIndex: number) => {
      setSites((prev) =>
        prev.map((site, i) => {
          if (i !== siteIndex) return site;
          const contacts = (site.contacts || []).filter((_, cIndex) => cIndex !== contactIndex);
          return { ...site, contacts };
        })
      );
    };

    const updateSiegeContact = (index: number, field: keyof SiegeContactInput, value: string) => {
      setSiegeContacts((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
    };

    const removeSiegeContact = (index: number) => {
      setSiegeContacts((prev) => prev.filter((_, i) => i !== index));
    };

    const addSiegeContact = () => {
      setSiegeContacts((prev) => [{ nom: '', fonction: '', tel: '', email: '' }, ...prev]);
    };

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const filteredSites = sites
            .map((s) => {
              const contacts = (s.contacts || [])
                .map((c) => ({
                  ...c,
                  nom: c.nom.trim(),
                  prenom: c.prenom?.trim(),
                  fonction: c.fonction?.trim(),
                  tel: c.tel?.trim(),
                  telMobile: c.telMobile?.trim(),
                  email: c.email?.trim(),
                  notes: c.notes?.trim(),
                }))
                .filter((c) => c.nom || c.prenom || c.fonction || c.tel || c.telMobile || c.email || c.notes);

              return {
                ...s,
                nom: s.nom.trim(),
                contacts: contacts.length ? contacts : [],
              };
            })
            .filter((s) => s.nom.length > 0);

          if (filteredSites.length === 0) {
            toast.error('Ajoutez au moins un site');
            return;
          }
          const filteredContacts = siegeContacts
            .map((c) => ({
              ...c,
              nom: c.nom.trim(),
              fonction: c.fonction.trim(),
              tel: c.tel.trim(),
              email: c.email.trim(),
            }))
            .filter((c) => c.nom || c.fonction || c.tel || c.email);

          const clientData: CreateClientInput = {
            nomEntreprise: formData.get('nomEntreprise') as string,
            secteur: (formData.get('secteur') as string) || undefined,
            siegeNom: formData.get('siegeNom') as string,
            siegeAdresse: (formData.get('siegeAdresse') as string) || undefined,
            siegeNotes: (formData.get('siegeNotes') as string) || undefined,
            siegeRC: (formData.get('siegeRC') as string) || undefined,
            siegeNIF: (formData.get('siegeNIF') as string) || undefined,
            siegeAI: (formData.get('siegeAI') as string) || undefined,
            siegeNIS: (formData.get('siegeNIS') as string) || undefined,
            siegeTIN: (formData.get('siegeTIN') as string) || undefined,
            siegeContacts: filteredContacts.length ? filteredContacts : [],
            sites: filteredSites,
          };

          if (isEdit && editingClient) {
            updateMutation.mutate({ id: editingClient.id, data: clientData });
          } else {
            setPendingClient(clientData);
            setConfirmCreateOpen(true);
          }
        }}
        className="space-y-4"
      >
      <div className="space-y-2">
        <Label htmlFor="nomEntreprise">Nom de l'entreprise *</Label>
        <Input
          id="nomEntreprise"
          name="nomEntreprise"
          defaultValue={client?.nomEntreprise}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="secteur">Secteur d'activité</Label>
        <Input
          id="secteur"
          name="secteur"
          defaultValue={client?.secteur}
          placeholder="Ex: Agroalimentaire"
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Siège (adresse principale)</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="siegeNom">Nom du siège *</Label>
            <Input
              id="siegeNom"
              name="siegeNom"
              defaultValue={client?.siegeNom}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siegeAdresse">Adresse du siège</Label>
            <Input
              id="siegeAdresse"
              name="siegeAdresse"
              defaultValue={client?.siegeAdresse}
            />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Contacts siège</Label>
            <Button type="button" variant="outline" size="sm" onClick={addSiegeContact}>
              + Ajouter contact
            </Button>
          </div>
          <div className="space-y-3">
            {siegeContacts.map((contact, index) => (
              <div key={index} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Contact {index + 1}</p>
                  {siegeContacts.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeSiegeContact(index)}>
                      Supprimer
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom</Label>
                    <Input
                      value={contact.nom}
                      onChange={(e) => updateSiegeContact(index, 'nom', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fonction</Label>
                    <Input
                      value={contact.fonction}
                      onChange={(e) => updateSiegeContact(index, 'fonction', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Téléphone</Label>
                    <Input
                      value={contact.tel}
                      onChange={(e) => updateSiegeContact(index, 'tel', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={contact.email}
                      onChange={(e) => updateSiegeContact(index, 'email', e.target.value)}
                      type="email"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="siegeRC">RC</Label>
            <Input
              id="siegeRC"
              name="siegeRC"
              defaultValue={client?.siegeRC}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siegeNIF">NIF</Label>
            <Input
              id="siegeNIF"
              name="siegeNIF"
              defaultValue={client?.siegeNIF}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="siegeAI">AI</Label>
            <Input
              id="siegeAI"
              name="siegeAI"
              defaultValue={client?.siegeAI}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siegeNIS">NIS</Label>
            <Input
              id="siegeNIS"
              name="siegeNIS"
              defaultValue={client?.siegeNIS}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siegeTIN">TIN</Label>
            <Input
              id="siegeTIN"
              name="siegeTIN"
              defaultValue={client?.siegeTIN}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="siegeNotes">Notes</Label>
          <Textarea
            id="siegeNotes"
            name="siegeNotes"
            defaultValue={client?.siegeNotes}
            rows={2}
          />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Sites</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSite}>
            + Ajouter un site
          </Button>
        </div>

        <div className="space-y-4">
          {sites.map((site, index) => (
            <div key={index} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Site {index + 1}</p>
                {sites.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeSite(index)}>
                    Supprimer
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du site *</Label>
                  <Input
                    value={site.nom}
                    onChange={(e) => updateSite(index, 'nom', e.target.value)}
                    placeholder="Ex: Usine Oued Smar"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Input
                    value={site.adresse || ''}
                    onChange={(e) => updateSite(index, 'adresse', e.target.value)}
                    placeholder="Adresse du site"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={site.tel || ''}
                    onChange={(e) => updateSite(index, 'tel', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={site.email || ''}
                    onChange={(e) => updateSite(index, 'email', e.target.value)}
                    type="email"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Contacts du site</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => addSiteContact(index)}>
                    + Ajouter contact
                  </Button>
                </div>
                <div className="space-y-3">
                  {(site.contacts || []).map((contact, contactIndex) => (
                    <div key={contactIndex} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Contact {contactIndex + 1}</p>
                        {(site.contacts || []).length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSiteContact(index, contactIndex)}
                          >
                            Supprimer
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nom</Label>
                          <Input
                            value={contact.nom}
                            onChange={(e) => updateSiteContact(index, contactIndex, 'nom', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Fonction</Label>
                          <Input
                            value={contact.fonction || ''}
                            onChange={(e) => updateSiteContact(index, contactIndex, 'fonction', e.target.value)}
                            placeholder="Ex: Directeur Qualité"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Téléphone</Label>
                          <Input
                            value={contact.tel || ''}
                            onChange={(e) => updateSiteContact(index, contactIndex, 'tel', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            value={contact.email || ''}
                            onChange={(e) => updateSiteContact(index, contactIndex, 'email', e.target.value)}
                            type="email"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={site.notes || ''}
                  onChange={(e) => updateSite(index, 'notes', e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => isEdit ? setEditingClient(null) : setIsCreateOpen(false)}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {isEdit ? 'Mettre à jour' : 'Créer'}
        </Button>
      </DialogFooter>
    </form>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">
            Gestion de la base clients
          </p>
        </div>
        {canDo('createClient') && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau client
          </Button>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Chargement...
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {search ? 'Aucun client trouvé' : 'Aucun client enregistré'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Card
              key={client.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedClient(client)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{client.nomEntreprise}</CardTitle>
                      {client.secteur && (
                        <p className="text-sm text-muted-foreground">{client.secteur}</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      {canDo('editClient') && (
                        <DropdownMenuItem onClick={() => setEditingClient(client)}>
                          Modifier
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link to={`/contrats?clientId=${client.id}`}>
                          Voir les contrats
                        </Link>
                      </DropdownMenuItem>
                      {canDo('deleteClient') && (
                        <DropdownMenuItem onClick={() => setDeleteClientTarget(client)}>
                          Supprimer
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {client.siegeAdresse && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{client.siegeAdresse}</span>
                    </div>
                  )}
                  {client.sites && client.sites.length > 1 && (
                    <div className="text-xs text-muted-foreground">
                      {client.sites.length} sites
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Badge variant="outline" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    {client._count?.contrats || 0} contrat(s)
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {client._count?.interventions || 0} intervention(s)
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau client à votre base de données
            </DialogDescription>
          </DialogHeader>
          <ClientForm isEdit={false} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Modifier le client</DialogTitle>
            <DialogDescription>
              Modifiez les informations du client
            </DialogDescription>
          </DialogHeader>
          {editingClient && <ClientForm client={editingClient} isEdit={true} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Détails du client</DialogTitle>
            <DialogDescription>
              Informations et sites associés
            </DialogDescription>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{selectedClient.nomEntreprise}</h2>
                {selectedClient.secteur && (
                  <p className="text-sm text-muted-foreground">{selectedClient.secteur}</p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Siège</h3>
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="font-medium">{selectedClient.siegeNom}</p>
                  {selectedClient.siegeAdresse && (
                    <p className="text-sm text-muted-foreground">{selectedClient.siegeAdresse}</p>
                  )}
                  {selectedClient.siegeContacts && selectedClient.siegeContacts.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {selectedClient.siegeContacts.length} contact(s)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedClient.siegeContacts.map((c) => (
                          <div key={c.id} className="rounded-lg border bg-muted/30 p-3">
                            <p className="text-sm font-semibold">{c.nom}</p>
                            <p className="text-xs text-muted-foreground">{c.fonction}</p>
                            <div className="mt-2 space-y-1 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Téléphone</span>
                                <span>{c.tel}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Email</span>
                                <span className="truncate">{c.email}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    {selectedClient.siegeRC && (
                      <div><span className="text-muted-foreground">RC:</span> {selectedClient.siegeRC}</div>
                    )}
                    {selectedClient.siegeNIF && (
                      <div><span className="text-muted-foreground">NIF:</span> {selectedClient.siegeNIF}</div>
                    )}
                    {selectedClient.siegeAI && (
                      <div><span className="text-muted-foreground">AI:</span> {selectedClient.siegeAI}</div>
                    )}
                    {selectedClient.siegeNIS && (
                      <div><span className="text-muted-foreground">NIS:</span> {selectedClient.siegeNIS}</div>
                    )}
                    {selectedClient.siegeTIN && (
                      <div><span className="text-muted-foreground">TIN:</span> {selectedClient.siegeTIN}</div>
                    )}
                  </div>
                  {selectedClient.siegeNotes && (
                    <p className="text-sm text-muted-foreground">{selectedClient.siegeNotes}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="siteSearch">Rechercher un site</Label>
                <Input
                  id="siteSearch"
                  placeholder="Nom du site, contact, téléphone, email..."
                  value={siteSearch}
                  onChange={(e) => setSiteSearch(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Sites</h3>
                {selectedClient.sites && selectedClient.sites.length > 0 ? (
                  <div className="space-y-3">
                    {selectedClient.sites
                      .filter((site) => {
                        if (!siteSearch.trim()) return true;
                        const q = siteSearch.toLowerCase();
                        const contactHaystack = (site.contacts || [])
                          .map((contact) => [
                            contact.nom,
                            contact.fonction,
                            contact.tel,
                            contact.email,
                          ]
                            .filter(Boolean)
                            .join(' '))
                          .join(' ');
                        const haystack = [
                          site.nom,
                          site.adresse,
                          site.tel,
                          site.email,
                          site.notes,
                          contactHaystack,
                        ]
                          .filter(Boolean)
                          .join(' ')
                          .toLowerCase();
                        return haystack.includes(q);
                      })
                      .map((site, index) => {
                        const isOpen = openSiteIndexes.has(index);
                        return (
                          <div key={site.id || index} className="rounded-lg border">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenSiteIndexes((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(index)) {
                                    next.delete(index);
                                  } else {
                                    next.add(index);
                                  }
                                  return next;
                                })
                              }
                              className="w-full text-left p-3 flex items-center justify-between"
                            >
                              <div>
                                <p className="font-medium">{site.nom}</p>
                                {site.adresse && (
                                  <p className="text-sm text-muted-foreground">{site.adresse}</p>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {isOpen ? 'Masquer' : 'Voir'}
                              </span>
                            </button>
                            {isOpen && (
                              <div className="px-3 pb-3 space-y-1">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  {site.tel && (
                                    <div><span className="text-muted-foreground">Téléphone:</span> {site.tel}</div>
                                  )}
                                  {site.email && (
                                    <div><span className="text-muted-foreground">Email:</span> {site.email}</div>
                                  )}
                                </div>
                                {site.contacts && site.contacts.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    <p className="text-xs text-muted-foreground">
                                      {site.contacts.length} contact(s) site
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {site.contacts.map((contact) => (
                                        <div key={contact.id} className="rounded-lg border bg-muted/30 p-3">
                                          <p className="text-sm font-semibold">{contact.nom}</p>
                                          {contact.fonction && (
                                            <p className="text-xs text-muted-foreground">{contact.fonction}</p>
                                          )}
                                          <div className="mt-2 space-y-1 text-sm">
                                            {contact.tel && (
                                              <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Téléphone</span>
                                                <span>{contact.tel}</span>
                                              </div>
                                            )}
                                            {contact.email && (
                                              <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Email</span>
                                                <span className="truncate">{contact.email}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {site.notes && (
                                  <p className="text-sm text-muted-foreground">{site.notes}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun site renseigné</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteClientTarget} onOpenChange={(open) => !open && setDeleteClientTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive et supprime le client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteClientTarget(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteClientTarget) deleteMutation.mutate(deleteClientTarget.id);
                setDeleteClientTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCreateOpen} onOpenChange={setConfirmCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la création</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous créer ce client ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmCreateOpen(false)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingClient) createMutation.mutate(pendingClient);
                setPendingClient(null);
                setConfirmCreateOpen(false);
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
