-- Update tool: align local DB schema/behavior with production (MariaDB 10.6.21)
-- Date: 2026-05-12
--
-- Objectif:
-- - Reproduire le comportement prod observé (MariaDB 10.6.21):
--   - DB defaults: latin1 / latin1_swedish_ci
--   - Table RemoveBgJobs: DEFAULT CHARSET utf8mb4 / utf8mb4_unicode_ci
--   - Column RemoveBgJobs.replicate_payload: LONGTEXT utf8mb4_bin + CHECK (json_valid(...))
--
-- IMPORTANT:
-- - Ce script est "non destructif" (pas de DROP), mais il modifie des types/charset.
-- - Sur une base volumineuse, `CONVERT TO CHARACTER SET` peut être coûteux (rebuild de table).
-- - Si tu es sur MySQL (pas MariaDB), le support des CHECK constraints dépend de la version.
--   Le but ici est la parité MariaDB 10.6.x.
--
-- Usage:
--   1) Connecte-toi avec un compte ayant les droits ALTER (ex: root)
--   2) Exécute ce script sur ta base locale.

-- Sélection explicite de la DB (adapte si besoin)
USE `wiz_pix`;

-- 1) Aligner les defaults de la base (comme en production).
--    Note: n'affecte pas les tables existantes qui ont déjà leur charset/collation propre.
ALTER DATABASE `wiz_pix` CHARACTER SET latin1 COLLATE latin1_swedish_ci;

-- 2) S'assurer que la table RemoveBgJobs est en utf8mb4/utf8mb4_unicode_ci (comme en prod).
--    (Optionnel mais utile pour cohérence; supprime si tu veux éviter un rebuild de table.)
ALTER TABLE `RemoveBgJobs` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3) Matérialiser le "JSON MariaDB" pour reproduce prod:
--    LONGTEXT + collation binaire + CHECK(json_valid()).
--    Note: `json_valid(NULL)` retourne NULL => le CHECK ne bloque pas les valeurs NULL.
ALTER TABLE `RemoveBgJobs`
  MODIFY COLUMN `replicate_payload`
    LONGTEXT
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_bin
    NULL;

-- 4) Ajouter (ou ré-ajouter) une contrainte CHECK.
--    MariaDB exige un nom unique. Si tu as déjà une contrainte, adapte son nom ou drop-la avant.
--    En cas d'erreur "Duplicate constraint name", tu peux commenter la ligne ci-dessous.
ALTER TABLE `RemoveBgJobs`
  ADD CONSTRAINT `chk_removebgjobs_replicate_payload_json`
  CHECK (json_valid(`replicate_payload`));

-- 5) Vérifications rapides (facultatif)
-- SHOW CREATE TABLE `RemoveBgJobs`;
-- SELECT VERSION(), @@version_comment;
