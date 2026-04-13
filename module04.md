
# ContribApp RDC — MODULE 04 : GESTION DU GROUPE [cite: 201]
## Fichier de Prompts pour l'IDE — v1.0

> **Contexte global du projet**
> ContribApp RDC est une application mobile React Native de gestion de contributions financières de groupe (tontine/mutuelles) en République Démocratique du Congo[cite: 2].
> Devise : CDF / USD | Opérateurs : Airtel Money, Orange Money, M-Pesa, MTN MoMo[cite: 338].
> Stack : React Native + Expo | Navigation : React Navigation v6 | État global : Zustand ou Redux Toolkit | API : Axios avec intercepteurs JWT[cite: 348, 349, 350].

> **Prérequis (Modules 01, 02 et 03 déjà terminés)**
> Composants globaux disponibles : `AppButton`, `AppInput`, `StatusBadge`, `ConfirmModal`, `ToastNotification`, `LoadingOverlay`, `OfflineBanner`[cite: 17, 18, 19, 21, 22, 23, 24].

---

## Table des matières

| Écran | Nom | Rôle | Priorité |
|-------|-----|------|----------|
| [SCR-013](#scr-013) | Configuration du Groupe | Admin | [cite_start]P0 - Critique [cite: 358] |
| [SCR-014](#scr-014) | Gestion des Membres | Admin | [cite_start]P1 - Important [cite: 358] |
| [SCR-015](#scr-015) | Invitations | Admin | [cite_start]P1 - Important [cite: 358] |
| [SCR-016](#scr-016) | Détails du Groupe | Tous | [cite_start]P1 - Important [cite: 358] |

---

## Composants partagés du Module 04

> Créer ces composants réutilisables **avant** de commencer les écrans.


Crée le composant React Native `SwipeableMemberRow` :
- Props :
  member { id, fullName, avatar, role, paymentStatus, phone, joinDate }
  onRemind (fonction)
  onEditRole (fonction)
  onSuspend (fonction)
- Rendu principal :
  → Ligne avec avatar rond (initiales si pas de photo).
  → Nom du membre en gras, date d'inscription en gris clair.
  [cite_start]→ Rôle affiché sous forme de badge discret (ex: Admin, Trésorière, Membre)[cite: 230].
  [cite_start]→ StatusBadge à droite indiquant le statut de paiement du mois en cours[cite: 230].
- Gestes (Swipe avec react-native-gesture-handler) :
  [cite_start]→ Swipe vers la droite : Révèle un bouton bleu "Envoyer rappel" (appelle onRemind)[cite: 231].
  → Swipe vers la gauche : Révèle deux boutons. [cite_start]Un bouton jaune "Modifier rôle" (appelle onEditRole) et un bouton rouge "Suspendre" (appelle onSuspend)[cite: 232].
- Fond blanc, séparateur fin entre chaque ligne.
```


Crée le composant React Native `SettingToggleRow` :
- Props : title (string), description (string, optionnel), value (boolean), onValueChange (fonction)
- Rendu :
  → Ligne avec titre en gras.
  → Description en dessous (texte gris plus petit) si fournie.
  → Switch natif à droite contrôlé par la prop `value`.
```

---

## SCR-013

### Configuration du Groupe

---

**Contexte de l'écran**
```text
[cite_start]Écran : SCR-013 — Configuration / Création du Groupe [cite: 203]
Fichier à créer : src/screens/group/GroupConfigScreen.tsx
[cite_start]Rôle autorisé : Admin uniquement[cite: 203, 221].
[cite_start]Navigation : Depuis le menu principal ou lors de la création initiale[cite: 203].
Objectif : Permettre à l'Admin de paramétrer les règles financières et d'adhésion du groupe.
```

---

**Prompt 1 — Structure et formulaire de base**

Crée l'écran `GroupConfigScreen` en React Native TypeScript.

STRUCTURE DE L'ÉCRAN :
- Header : Titre "Configuration du groupe". Bouton retour si modification, ou pas de bouton si création initiale.
- KeyboardAvoidingView avec ScrollView pour gérer le clavier.
- [cite_start]Afficher `OfflineBanner` si pas de connexion[cite: 343].

FORMULAIRE - SECTION 1 : Informations générales
- [cite_start]Photo de groupe : composant d'upload (image circulaire, icône appareil photo)[cite: 207].
- [cite_start]AppInput `Nom du groupe` : obligatoire, max 100 caractères[cite: 205].
- [cite_start]AppInput `Description` : optionnel, multiline, max 300 caractères[cite: 206].

FORMULAIRE - SECTION 2 : Règles Financières
- [cite_start]AppInput `Montant de contribution` : clavier numérique, obligatoire[cite: 208].
- [cite_start]Sélecteur `Devise` : Boutons segmentés (CDF / USD)[cite: 209].
- [cite_start]AppInput `Jour de l'échéance` : clavier numérique, de 1 à 28 (ex: 15)[cite: 210].
- AppInput `Pénalité de retard` : numérique. [cite_start]Préciser dans le placeholder (0 = pas de pénalité)[cite: 212].

FORMULAIRE - SECTION 3 : Paramètres et validation
- [cite_start]SettingToggleRow : "Approbation manuelle des nouveaux membres"[cite: 213].
- [cite_start]SettingToggleRow : "Contributions visibles par tous"[cite: 214].
- [cite_start]Bouton principal fixe en bas : "Sauvegarder la configuration"[cite: 215].
```

---

**Prompt 2 — Chargement, pré-remplissage et section Trésorière**
```text
Dans `GroupConfigScreen`, implémente la logique d'état et la gestion de la trésorière.

ÉTAT INITIAL (React Hook Form ou Zustand) :
- Appeler GET /api/v1/groups/:id au montage[cite: 219].
- Si les données existent (modification) : Pré-remplir le formulaire avec les valeurs actuelles[cite: 217]. Afficher un badge "Modification" si des champs sont modifiés mais non sauvegardés[cite: 217].
- Si pas de données : Formulaire vide avec infobulles d'aide[cite: 217].

SECTION TRÉSORIÈRE (Affichée sous les règles financières) :
- [cite_start]AppInput `Nom complet de la Trésorière` : obligatoire[cite: 211].
- [cite_start]AppInput `Numéro Mobile Money` : obligatoire[cite: 211].
- [cite_start]Composant `OperatorSelector` : Airtel / Orange / M-Pesa / MTN (obligatoire)[cite: 211].
- [cite_start]Règle métier : Un groupe ne peut avoir qu'une seule trésorière active[cite: 222].
```

---

**Prompt 3 — Soumission et Modals de confirmation**
```text
Dans `GroupConfigScreen`, implémente la logique de sauvegarde et les avertissements.

MODALS DE PRÉ-VALIDATION (ConfirmModal) :
1. Si l'Admin a modifié le `Montant` d'un groupe existant :
   [cite_start]→ Afficher : "Modifier le montant affectera tous les membres. Confirmer ?"[cite: 217].
2. Si l'Admin a modifié la `Trésorière` (Nom, Numéro ou Opérateur) :
   [cite_start]→ Afficher : "Les futurs paiements seront dirigés vers le nouveau compte. Les paiements existants ne sont pas affectés."[cite: 217].

APPELS API DE SAUVEGARDE :
- [cite_start]Si création : POST /api/v1/groups[cite: 219].
- [cite_start]Si modification : PUT /api/v1/groups/:id (Body: tous les champs)[cite: 219].
- [cite_start]Afficher `LoadingOverlay` pendant l'appel[cite: 21].
- [cite_start]Succès : `ToastNotification` vert et retour à l'écran précédent[cite: 24].
```

---

## SCR-014

### Gestion des Membres

---

**Contexte de l'écran**
```text
[cite_start]Écran : SCR-014 — Gestion des Membres [cite: 226]
Fichier à créer : src/screens/group/MemberManagementScreen.tsx
[cite_start]Rôle autorisé : Admin uniquement[cite: 226].
[cite_start]Navigation : Tab 4 "Groupe" -> "Membres" ou clic sur widget participants du SCR-005[cite: 109, 226].
Objectif : Gérer la liste des membres, leurs rôles et envoyer des rappels.
```

---

**Prompt 1 — En-tête, Recherche et Filtres**
```text
Crée l'écran `MemberManagementScreen` en React Native TypeScript.

EN-TÊTE :
- [cite_start]Barre de recherche (AppInput avec icône loupe) : recherche par nom ou numéro de téléphone[cite: 228].
- [cite_start]Compteur global affiché sous la barre : "X membres actifs / Y membres total"[cite: 234].
- [cite_start]Bouton FAB (flottant) '+' en bas à droite : "Inviter un membre" → Navigue vers SCR-015[cite: 233].

FILTRES HORIZONTAUX (ScrollView) :
- Chips sélectionnables : Tous | Actifs | En retard | [cite_start]Invitations en attente[cite: 229].
- Mettre en surbrillance le filtre actif.

CHARGEMENT DES DONNÉES :
- [cite_start]GET /api/v1/groups/:id/members[cite: 241].
- [cite_start]Retourne : liste des membres avec leur statut de paiement du mois[cite: 241].
- Implémenter le filtrage local sur la liste récupérée.
```

---

**Prompt 2 — Liste et Actions Swipe**
```text
Dans `MemberManagementScreen`, implémente la liste et les actions.

LISTE DES MEMBRES :
- Utiliser une `FlatList`.
- [cite_start]Rendre chaque élément avec le composant `SwipeableMemberRow`[cite: 230].

GESTION DES ACTIONS SWIPE :
1. onRemind (Swipe droite) :
   → Ouvre un BottomSheet ou ConfirmModal : "Envoyer un rappel à ce membre ?"
   [cite_start]→ Si oui : POST /api/v1/notifications/remind/:userId[cite: 241].
   [cite_start]→ Affiche `ToastNotification` de succès[cite: 24].

2. onEditRole (Swipe gauche) :
   [cite_start]→ Ouvre un BottomSheet avec les options de rôle : Membre, Trésorière, Auditeur[cite: 236].
   [cite_start]→ Si modifié : PUT /api/v1/groups/:id/members/:userId/role avec Body: { role: '...' }[cite: 241].

3. onSuspend (Swipe gauche) :
   [cite_start]→ Ouvre un BottomSheet avec actions de statut : Suspendre le membre (désactive accès) ou Retirer du groupe (supprime adhésion)[cite: 237, 238].
   [cite_start]→ Préciser dans l'UI que l'historique est conservé dans les deux cas[cite: 237, 238].
   → Appel API : PUT /api/v1/groups/:id/members/:userId/status avec Body: { status: 'suspended' | [cite_start]'removed' }[cite: 241].
```

---

## SCR-015

### Invitations

---

**Contexte de l'écran**
```text
[cite_start]Écran : SCR-015 — Inviter des Membres [cite: 243]
Fichier à créer : src/screens/group/InviteMembersScreen.tsx
[cite_start]Rôle autorisé : Admin uniquement[cite: 243].
[cite_start]Navigation : Depuis SCR-014 via le bouton '+'[cite: 233, 243].
Objectif : Générer des codes, QR codes et envoyer des invitations SMS.
```

---

**Prompt 1 — Layout et Génération de Code/QR**
```text
Crée l'écran `InviteMembersScreen` en React Native TypeScript.

CHARGEMENT INITIAL :
- [cite_start]GET /api/v1/groups/:id/invite-code[cite: 251].
- [cite_start]Récupère le code alphanumérique (ex: GRP-7K4M2X) et le lien[cite: 245].

[cite_start]SECTION 1 : Code d'invitation[cite: 245].
- Afficher le code en très grand, police monospace.
- Bouton "Copier le code" (utiliser l'API Clipboard de React Native).
- [cite_start]Bouton en dessous : "Régénérer le code" → Appelle POST /api/v1/groups/:id/regenerate-invite[cite: 249, 251]. [cite_start]Préciser via une alerte que cela invalide l'ancien code[cite: 249].

[cite_start]SECTION 2 : QR Code[cite: 246].
- [cite_start]Utiliser la librairie `react-native-qrcode-svg` pour générer le QR à partir du code[cite: 246, 355].
- [cite_start]Bouton "Télécharger l'image" pour sauvegarder le QR dans la galerie[cite: 246].
```

---

**Prompt 2 — Invitation SMS et Liste d'attente**
```text
Dans `InviteMembersScreen`, implémente la section d'envoi et de suivi.

[cite_start]SECTION 3 : Inviter par téléphone[cite: 247].
- AppInput "Numéro de téléphone" (format +243...).
- AppButton "Envoyer invitation SMS".
- [cite_start]Au clic : POST /api/v1/groups/:id/invite avec Body: { phone }[cite: 251].
- En cas de succès : Vider le champ et afficher un Toast vert.

[cite_start]SECTION 4 : Invitations en attente[cite: 248].
- [cite_start]Appeler GET /api/v1/groups/:id/pending-invitations[cite: 251].
- [cite_start]Afficher une petite FlatList des numéros invités qui n'ont pas encore accepté[cite: 248].
```

---

## SCR-016

### Détails du Groupe

---

**Contexte de l'écran**
```text
[cite_start]Écran : SCR-016 — Détails du groupe [cite: 8]
Fichier à créer : src/screens/group/GroupDetailsScreen.tsx
[cite_start]Rôle autorisé : Tous (Admin, Trésorière, Membre)[cite: 8].
[cite_start]Navigation : Tab 4 "Groupe"[cite: 13].
Objectif : Affichage en lecture seule des règles du groupe et des informations de la trésorière.
```

---

**Prompt 1 — Vue en lecture seule**
```text
Crée l'écran `GroupDetailsScreen` en React Native TypeScript.

CHARGEMENT :
- GET /api/v1/groups/:id pour récupérer les infos.

STRUCTURE (Vue en lecture seule) :
- En-tête : Photo du groupe, Nom du groupe, Description.
- Carte "Règles de contribution" :
  → Montant mensuel et devise.
  → Jour d'échéance.
  → Pénalité de retard (si applicable).
- Carte "Trésorerie" :
  → Nom de la trésorière.
  → Opérateur utilisé pour la réception.
  → (Masquer le numéro de téléphone complet pour les membres normaux, n'afficher que les 3 derniers chiffres pour des raisons de confidentialité).

Aucune action de modification n'est permise ici.
```

---

## Tests et validation du Module 04

```text
Après avoir implémenté les écrans (SCR-013, SCR-014, SCR-015, SCR-016), vérifiez les points suivants :

1. GESTION DES RÔLES :
   - Vérifier que l'Admin a accès à SCR-013, 014 et 015.
   - [cite_start]Vérifier que la Trésorière et le Membre sont redirigés uniquement vers SCR-016 lorsqu'ils cliquent sur l'onglet "Groupe"[cite: 8].

2. FORMULAIRE SCR-013 :
   - [cite_start]Vérifier l'apparition des Modals de confirmation lors de la modification du montant ou de la trésorière[cite: 217].

3. GESTES SCR-014 :
   - [cite_start]Vérifier que les actions swipe gauche et droite ouvrent les bons bottom sheets et ne se chevauchent pas[cite: 231, 232].

4. RÉGÉNÉRATION SCR-015 :
   - [cite_start]S'assurer que le bouton "Régénérer" met à jour immédiatement le texte du code ET le dessin du QR Code[cite: 249].
```

---

*ContribApp RDC — Prompts Module 04 Gestion du Groupe — v1.0 — Avril 2026*
```