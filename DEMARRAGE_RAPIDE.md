# 🚀 Démarrage Rapide - ContribApp

## ⚡ En 3 Étapes

### 1️⃣ Installer
```bash
npm install
```

### 2️⃣ Lancer
```bash
npm start
```

### 3️⃣ Se Connecter

Utilisez un de ces comptes de test :

| Rôle | Téléphone | PIN |
|------|-----------|-----|
| 👑 **Admin** | `+243970123456` | `123456` |
| 💰 **Trésorière** | `+243890234567` | `123456` |
| 👤 **Membre** | `+243810345678` | `123456` |

## ✨ C'est Tout !

L'application crée automatiquement :
- ✅ 7 utilisateurs de test
- ✅ 1 groupe avec code `DEV2026`
- ✅ Des contributions variées (payées, en attente, en retard)

## 🎯 Que Tester ?

### En tant qu'Admin
1. Voir le dashboard avec les statistiques
2. Gérer les membres du groupe
3. Envoyer des rappels de paiement
4. Voir la progression du groupe

### En tant que Trésorière
1. Voir tous les paiements
2. Valider les contributions
3. Exporter les rapports
4. Gérer les pénalités

### En tant que Membre
1. Voir son statut de paiement
2. Payer sa contribution (simulé)
3. Voir son historique
4. Consulter les échéances

## 📱 Comptes Disponibles

```
👑 ADMIN - Marie Kabila
   📞 +243970123456
   🔑 123456
   ✅ A déjà payé

💰 TRÉSORIÈRE - Grace Tshombe
   📞 +243890234567
   🔑 123456
   ✅ A déjà payé

👤 MEMBRE - Jean Mukendi
   📞 +243810345678
   🔑 123456
   ✅ A déjà payé

👤 MEMBRE - Sarah Mbuyi
   📞 +243900456789
   🔑 123456
   ⏳ En attente de paiement

👤 MEMBRE - Patrick Kalala
   📞 +243970567890
   🔑 123456
   ⚠️ En retard (avec pénalité)

👤 MEMBRE - Esther Nkulu
   📞 +243890678901
   🔑 123456
   ✅ A déjà payé

👤 MEMBRE - David Kasongo
   📞 +243810789012
   🔑 123456
   ⏳ En attente de paiement
```

## 🎮 Scénarios de Test

### Scénario 1 : Payer sa Contribution
1. Connectez-vous avec Sarah (`+243900456789`)
2. Cliquez sur "PAYER MAINTENANT"
3. Choisissez un opérateur
4. Confirmez le paiement
5. Attendez 2 secondes
6. Voyez le reçu !

### Scénario 2 : Gérer le Groupe
1. Connectez-vous avec Marie (Admin)
2. Voyez les statistiques
3. Envoyez des rappels
4. Gérez les membres

### Scénario 3 : Rejoindre un Groupe
1. Créez un nouveau compte
2. Entrez l'OTP (affiché dans la console)
3. Rejoignez avec le code `DEV2026`
4. Voyez votre contribution à payer

## 🔍 Où Trouver l'OTP ?

Lors de l'inscription, l'OTP est affiché dans la **console de développement** :

```
╔════════════════════════════════════╗
║  📱 OTP POUR +243970123456         ║
║  🔑 CODE : 123456                  ║
║  📋 CONTEXTE : register            ║
║  ⏱  Expire dans 2 minutes          ║
╚════════════════════════════════════╝
```

## 📊 Groupe de Test

**Nom** : Groupe de Développement  
**Code d'invitation** : `DEV2026`  
**Montant mensuel** : 50 000 CDF  
**Échéance** : 25 du mois  
**Pénalité** : 5 000 CDF (si en retard)

## 💡 Astuces

- 🔄 **Rafraîchir** : Tirez vers le bas pour actualiser
- 📱 **OTP** : Regardez la console pour le code
- 🎯 **Tester** : Essayez tous les rôles
- 🔐 **PIN** : Toujours `123456` pour les tests

## 🐛 Problème ?

### Pas de données au démarrage
➡️ Supprimez la base de données et relancez

### OTP introuvable
➡️ Regardez la console de développement

### Erreur de connexion
➡️ Vérifiez le format du téléphone (+243...)

## 📚 Documentation Complète

- **MODE_LOCAL.md** - Guide complet
- **FINAL_SUMMARY.md** - Résumé des changements
- **DATABASE_SCHEMA.md** - Schéma de la base
- **ARCHITECTURE.md** - Architecture de l'app

## 🎉 Amusez-vous bien !

L'application est prête à l'emploi. Toutes les fonctionnalités principales sont disponibles en mode local.

---

**Note** : Cette version fonctionne 100% en local sans backend. Les paiements sont simulés.
