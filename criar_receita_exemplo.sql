-- ==============================================================================
-- SCRIPT: CRIAR FICHA TÉCNICA DE EXEMPLO (PARA TESTE)
-- ==============================================================================
-- Este script cria uma receita de "Feijoada" vinculando produtos do estoque.
-- Útil para testar a funcionalidade de "Prato do Dia" na Lista de Produção.

DO $$
DECLARE
    v_feijao_id UUID;
    v_carne_id UUID;
    v_arroz_id UUID;
    v_couve_id UUID;
BEGIN
    -- 1. Busca IDs de produtos existentes no estoque (pelo nome aproximado)
    SELECT "ID" INTO v_feijao_id FROM "Estoque" WHERE "Nome" ILIKE '%Feijão%' LIMIT 1;
    SELECT "ID" INTO v_carne_id FROM "Estoque" WHERE "Nome" ILIKE '%Carne%' LIMIT 1;
    SELECT "ID" INTO v_arroz_id FROM "Estoque" WHERE "Nome" ILIKE '%Arroz%' LIMIT 1;
    SELECT "ID" INTO v_couve_id FROM "Estoque" WHERE "Nome" ILIKE '%Couve%' LIMIT 1;

    -- 2. Insere a Ficha Técnica
    INSERT INTO "FichasTecnicas" (
        "Nome", "Categoria", "ModoPreparo", "Rendimento", "Status", "IngredientesJSON"
    ) VALUES (
        'Feijoada Completa',
        'Prato Principal',
        'Cozinhar o feijão com as carnes. Refogar o arroz. Preparar a couve.',
        50, -- Rendimento (porções)
        'Ativo',
        jsonb_build_array(
            jsonb_build_object('id', v_feijao_id, 'quantidade', 5),
            jsonb_build_object('id', v_carne_id, 'quantidade', 3),
            jsonb_build_object('id', v_arroz_id, 'quantidade', 4),
            jsonb_build_object('id', v_couve_id, 'quantidade', 10)
        )
    );
END $$;