# Mettre Fluxia en ligne

Ce guide part d'un serveur vierge et aboutit à Fluxia accessible en HTTPS, avec emails, abonnements et sauvegardes.
Compter environ une heure la première fois.

## 1. Serveur et nom de domaine

- **Serveur** : un VPS Linux (Ubuntu 24.04 ou Debian 12) avec 2 vCPU, 4 Go de RAM et 40 Go de disque suffit pour démarrer.
  Hébergeurs français ou européens, pratiques pour le RGPD : OVHcloud, Scaleway, Hetzner, Infomaniak.
- **Nom de domaine** : créez un enregistrement DNS `A` (et `AAAA` en IPv6) pour `app.votre-domaine.fr` vers l'adresse IP du serveur.
- **Pare-feu** : ouvrez uniquement les ports 22 (SSH), 80 et 443.

## 2. Installation

```bash
# Sur le serveur
curl -fsSL https://get.docker.com | sh
git clone https://github.com/Marie-Pascale30/Fluxia.git /opt/fluxia
cd /opt/fluxia
cp .env.prod.example .env.prod
nano .env.prod          # DOMAIN, POSTGRES_PASSWORD, JWT_SECRET au minimum (voir ci-dessous)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Secrets à générer :

```bash
openssl rand -base64 32   # POSTGRES_PASSWORD
openssl rand -base64 48   # JWT_SECRET
```

Le certificat HTTPS est obtenu automatiquement (Let's Encrypt) dès que le DNS pointe vers le serveur.
Ouvrez `https://app.votre-domaine.fr/inscription` pour créer la première entreprise.

## 3. Emails (indispensable)

Sans SMTP, aucun email ne part : mots de passe oubliés, factures, confirmations clients ne sont que simulés.

1. Choisissez un service d'envoi transactionnel (Brevo, Mailjet, Postmark, Amazon SES, ou le SMTP de votre hébergeur).
2. Validez votre domaine chez ce service et publiez les enregistrements DNS **SPF**, **DKIM** et **DMARC** qu'il indique.
   Sans eux, vos emails finiront dans les indésirables.
3. Renseignez dans `.env.prod` :
   ```
   SMTP_URL=smtps://utilisateur:motdepasse@smtp.fournisseur.fr:465
   MAIL_FROM="Fluxia <notifications@votre-domaine.fr>"
   ```

Le nom affiché de l'expéditeur est celui de chaque entreprise, et les réponses de ses clients vont à l'email renseigné dans
ses Paramètres.

**Emails entrants** : chaque entreprise trouve dans ses Paramètres l'adresse du webhook à donner à son service de réception
(Postmark, Mailgun, SendGrid : fonction « inbound »).

## 4. Abonnements (Stripe)

1. Créez un compte sur stripe.com et activez-le (informations de l'entreprise, compte bancaire).
2. **Produit** : dans Catalogue de produits, créez « Fluxia » avec un prix récurrent (ex. 49 € HT / mois). Notez l'identifiant `price_…`.
3. **Portail client** : dans Paramètres › Facturation › Portail client, activez la mise à jour du moyen de paiement, l'historique
   des factures et la résiliation.
4. **Webhook** : dans Développeurs › Webhooks, ajoutez le point de terminaison `https://app.votre-domaine.fr/api/billing/webhook`
   avec les événements `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` et
   `customer.subscription.deleted`. Notez le secret de signature `whsec_…`.
5. **TVA** : activez Stripe Tax ou configurez vos taux de TVA, pour que les factures d'abonnement émises par Stripe soient conformes.
6. Renseignez `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` et `STRIPE_WEBHOOK_SECRET` dans `.env.prod`, puis redémarrez :
   `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d`.

Testez d'abord avec les clés de test (`sk_test_…`) et la carte `4242 4242 4242 4242`.

Les nouvelles entreprises démarrent avec un essai gratuit (`TRIAL_DAYS`, 14 jours par défaut). Ensuite, sans abonnement,
leur espace passe en lecture seule.

## 5. Facture électronique

Les factures émises par les entreprises utilisatrices sont produites au format **Factur-X, profil EN 16931** : un PDF/A-3
qui porte le XML structuré. Le XML seul est téléchargeable depuis chaque facture.

La réforme impose de **recevoir** des factures électroniques depuis septembre 2026 et d'en **émettre** à partir de septembre
2027 pour les PME, via une **plateforme agréée** (PA, ex-PDP). Fluxia produit des fichiers conformes au format, mais
**ne transmet pas encore** les factures à une plateforme : il faut choisir une plateforme partenaire et brancher son API,
ou que chaque entreprise y dépose ses factures. Chaque entreprise doit renseigner son SIRET, et son n° de TVA le cas
échéant (page Paramètres), ainsi que ceux de ses clients professionnels.

Pour vérifier un fichier : téléchargez le PDF d'une facture émise et passez-le au validateur
[Mustang](https://www.mustangproject.org/) (`java -jar Mustang-CLI.jar --action validate --source facture.pdf`) ou à
un service de validation en ligne Factur-X.

## 6. IA, SMS, transcription (facultatifs)

| Fonction | Variables |
|---|---|
| Analyse et rédaction par Claude | `ANTHROPIC_API_KEY` |
| SMS aux clients et techniciens | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| Transcription des comptes rendus audio | `TRANSCRIPTION_URL`, `TRANSCRIPTION_API_KEY` |

Pensez à mentionner ces prestataires dans la politique de confidentialité.

## 7. Pages légales

Renseignez les variables `LEGAL_*` de `.env.prod` : exploitant, adresse, immatriculation, contact, hébergeur.
Elles alimentent `/conditions` et `/confidentialite`. **Ces pages sont des modèles : faites-les relire par un juriste**,
et ajoutez vos conditions commerciales (prix, durée, résiliation) et l'accord de sous-traitance RGPD (article 28) proposé
à vos clients.

## 8. Sauvegardes et restauration

Le service `backup` sauvegarde chaque nuit (à `BACKUP_HOUR` h) la base et les fichiers déposés dans `BACKUP_DIR`
(`./backups` par défaut), et conserve `BACKUP_KEEP_DAYS` jours (14 par défaut).

- **Copiez ces sauvegardes hors du serveur** (stockage objet, autre serveur, `rclone` ou `restic`). Une sauvegarde restée
  sur le même disque ne protège pas d'une panne du serveur.
- Sauvegarde immédiate : `docker compose -f docker-compose.prod.yml --env-file .env.prod exec backup sh /backup.sh now`
- Restauration :
  ```bash
  C="docker compose -f docker-compose.prod.yml --env-file .env.prod"
  $C stop api web
  $C exec -T db pg_restore --clean --if-exists -U fluxia -d fluxia < backups/fluxia-AAAA-MM-JJ_HHMM.dump
  $C exec backup sh /backup.sh restore-files fichiers-AAAA-MM-JJ_HHMM.tar.gz
  $C start api web
  ```
- Faites un essai de restauration sur un serveur de test avant d'en avoir besoin.

## 9. Mises à jour

```bash
cd /opt/fluxia
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Les migrations de base de données s'appliquent automatiquement au démarrage de l'API. Faites une sauvegarde immédiate avant
toute mise à jour importante.

## 10. Surveillance

- **Disponibilité** : configurez une sonde externe (UptimeRobot, Better Stack…) sur `https://app.votre-domaine.fr/login`.
- **Journaux** : `docker compose -f docker-compose.prod.yml logs -f api web`. Leur taille est limitée automatiquement.
- **Envois en échec** : chaque entreprise les voit dans la page Envois et peut les relancer.
- **Erreurs** : pour être alerté des erreurs applicatives, branchez un service comme Sentry (non intégré à ce jour).
