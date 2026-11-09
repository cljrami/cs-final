ALTER TABLE `negocios` 
ADD COLUMN IF NOT EXISTS `seo_title` varchar(255) DEFAULT NULL AFTER `descripcion`,
ADD COLUMN IF NOT EXISTS `seo_description` text DEFAULT NULL AFTER `seo_title`,
ADD COLUMN IF NOT EXISTS `seo_keywords` varchar(255) DEFAULT NULL AFTER `seo_description`;
