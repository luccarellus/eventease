-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participantes" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "empresa" TEXT,
    "cidade" TEXT NOT NULL,
    "escola" TEXT NOT NULL,
    "gremio" TEXT,
    "codigo" TEXT NOT NULL,
    "aceitou_termos" BOOLEAN NOT NULL DEFAULT false,
    "termos_aceitos_em" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "data" TIMESTAMPTZ NOT NULL,
    "local" TEXT NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscricoes_evento" (
    "id" UUID NOT NULL,
    "evento_id" UUID NOT NULL,
    "participante_id" UUID NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT false,
    "confirmado_em" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscricoes_evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "participantes_codigo_key" ON "participantes"("codigo");

-- CreateIndex
CREATE INDEX "participantes_codigo_idx" ON "participantes"("codigo");

-- CreateIndex
CREATE INDEX "participantes_email_idx" ON "participantes"("email");

-- CreateIndex
CREATE INDEX "eventos_publicado_idx" ON "eventos"("publicado");

-- CreateIndex
CREATE INDEX "inscricoes_evento_evento_id_idx" ON "inscricoes_evento"("evento_id");

-- CreateIndex
CREATE INDEX "inscricoes_evento_participante_id_idx" ON "inscricoes_evento"("participante_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscricoes_evento_evento_id_participante_id_key" ON "inscricoes_evento"("evento_id", "participante_id");

-- AddForeignKey
ALTER TABLE "inscricoes_evento" ADD CONSTRAINT "inscricoes_evento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricoes_evento" ADD CONSTRAINT "inscricoes_evento_participante_id_fkey" FOREIGN KEY ("participante_id") REFERENCES "participantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
