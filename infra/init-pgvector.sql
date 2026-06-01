-- Habilita pgvector no banco da aplicação.
-- Roda automaticamente na primeira subida do container postgres.
-- Cobre o tipo de memória CONTEXTUAL (busca por similaridade).
CREATE EXTENSION IF NOT EXISTS vector;
