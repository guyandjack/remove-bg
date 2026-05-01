-- DEV TOOL (NE PAS IMPORTER EN PRE-PROD/PROD)
-- ------------------------------------------------------------------
-- Drop une table de maniÃ¨re contrÃ´lÃ©e dans la base courante.
-- - Evite les erreurs de casse (spÃ©cifie le nom exact de table)
-- - Utilise `DATABASE()` pour ne jamais viser une autre base par accident
--
-- Usage:
-- 1) Remplace la valeur de @table_to_drop par le nom EXACT de la table (ex: 'EmailVerification')
-- 2) ExÃ©cute le fichier dans phpMyAdmin / client SQL sur une base DEV uniquement
-- ------------------------------------------------------------------

SET @table_to_drop = NULL; -- ex: 'EmailVerification'
SET @schema_name = DATABASE();

-- Garde-fou: si @table_to_drop est NULL/'' (ou si DATABASE() est NULL), @sql_drop devient NULL
-- et PREPARE Ã©chouera au lieu d'exÃ©cuter un DROP accidentel.
SET @sql_drop = IF(
  @table_to_drop IS NULL OR @table_to_drop = '' OR @schema_name IS NULL OR @schema_name = '',
  NULL,
  CONCAT('DROP TABLE IF EXISTS `', @schema_name, '`.`', @table_to_drop, '`;')
);

-- Debug utile avant exÃ©cution:
SELECT @schema_name AS current_db, @table_to_drop AS table_to_drop, @sql_drop AS sql_to_run;
PREPARE stmt_drop FROM @sql_drop;
EXECUTE stmt_drop;
DEALLOCATE PREPARE stmt_drop;
