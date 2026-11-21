#!/bin/sh
# Sauvegarde quotidienne (à BACKUP_HOUR h, heure du serveur) : base PostgreSQL (format custom, pg_restore)
# et fichiers déposés (photos, signatures, audio). Les sauvegardes de plus de BACKUP_KEEP_DAYS jours sont supprimées.
# Lancement manuel : docker compose -f docker-compose.prod.yml exec backup sh /backup.sh now
# Restauration des fichiers : … exec backup sh /backup.sh restore-files fichiers-AAAA-MM-JJ_HHMM.tar.gz
set -eu

run() {
    stamp=$(date +%Y-%m-%d_%H%M)
    pg_dump --format=custom --file="/backups/fluxia-$stamp.dump"
    tar -czf "/backups/fichiers-$stamp.tar.gz" -C /data .
    find /backups -type f \( -name 'fluxia-*.dump' -o -name 'fichiers-*.tar.gz' \) -mtime +"$BACKUP_KEEP_DAYS" -delete
    echo "$(date -Iseconds) sauvegarde $stamp terminée ($(du -sh /backups | cut -f1) au total)"
}

if [ "${1:-}" = "now" ]; then run; exit 0; fi
if [ "${1:-}" = "restore-files" ]; then
    archive="/backups/$(basename "${2:?archive à restaurer}")"
    [ -f "$archive" ] || { echo "Introuvable : $archive" >&2; exit 1; }
    tar -xzf "$archive" -C /data
    echo "Fichiers restaurés depuis $archive"
    exit 0
fi

echo "Sauvegardes quotidiennes à ${BACKUP_HOUR}h, conservées ${BACKUP_KEEP_DAYS} jours"
while true; do
    now=$(date +%s)
    next=$(date -d "$(date +%Y-%m-%d) $(printf %02d "$BACKUP_HOUR"):00" +%s)
    [ "$next" -le "$now" ] && next=$((next + 86400))
    sleep $((next - now))
    run || echo "$(date -Iseconds) ÉCHEC de la sauvegarde" >&2
done
