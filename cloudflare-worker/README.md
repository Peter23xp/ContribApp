# Cloudflare Worker — ContribApp RDC

Ce Worker gère :
1. La génération d'URLs pré-signées pour l'upload vers R2
2. La vérification du token Firebase JWT avant chaque upload
3. La suppression de fichiers R2

## Déploiement
- Utiliser Wrangler CLI : `npm install -g wrangler`
- `wrangler deploy`

## Variables d'environnement (Cloudflare Dashboard)
- FIREBASE_PROJECT_ID
- R2_BUCKET (binding R2)
- ALLOWED_ORIGINS (domaines autorisés)
