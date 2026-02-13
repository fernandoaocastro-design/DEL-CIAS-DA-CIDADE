-- ==============================================================================
-- SCRIPT PARA PROMOVER USUÁRIO A ADMINISTRADOR (ACESSO TOTAL)
-- ==============================================================================
-- Substitua o e-mail abaixo pelo seu e-mail de login.

UPDATE "Usuarios"
SET "Cargo" = 'Administrador', "Permissoes" = NULL
WHERE "Email" = 'fernando.ao.castro@gmail.com'; -- <--- COLOQUE SEU EMAIL AQUI