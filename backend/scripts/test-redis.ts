import * as dotenv from 'dotenv';
import * as path from 'path';
import Redis from 'ioredis';

// Carrega .env do diretório pai (backend) ou da raiz do projeto
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testRedis() {
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = Number(process.env.REDIS_PORT) || 6379;
  const password = process.env.REDIS_PASSWORD || undefined;

  console.log('--------------------------------------------------');
  console.log('⚡ EventEase — Teste de Conexão com Redis');
  console.log('--------------------------------------------------');
  console.log(`📍 Alvo: ${host}:${port}`);
  console.log(`🔑 Senha configurada: ${password ? 'SIM' : 'NÃO'}`);
  console.log('--------------------------------------------------');

  const redis = new Redis({
    host,
    port,
    password,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  try {
    const pingStart = Date.now();
    const pong = await redis.ping();
    const pingLatency = Date.now() - pingStart;

    if (pong === 'PONG') {
      console.log(`✅ [1/3] PING bem-sucedido! Resposta: "${pong}" (${pingLatency}ms)`);
    } else {
      console.log(`⚠️ [1/3] Resposta inesperada ao PING: "${pong}"`);
    }

    const testKey = 'eventease:health_check_test';
    const testVal = `ok_${Date.now()}`;

    await redis.set(testKey, testVal, 'EX', 30);
    console.log(`✅ [2/3] ESCRITA (SET) executada com sucesso! Chave: "${testKey}"`);

    const readVal = await redis.get(testKey);
    if (readVal === testVal) {
      console.log(`✅ [3/3] LEITURA (GET) validada com sucesso!`);
    } else {
      console.log(`❌ [3/3] Falha na leitura! Esperado: "${testVal}", Recebido: "${readVal}"`);
    }

    await redis.del(testKey);
    console.log('🧹 Limpeza de chave temporária de teste concluída.');

    console.log('\n🎉 SUCESSO: A conexão com o Redis está 100% funcional!\n');
    await redis.quit();
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ ERRO: Não foi possível conectar ou interagir com o Redis.');
    console.error(`Detalhes: ${err.message || err}`);
    console.log('\n💡 Sugestões de Diagnóstico:');
    console.log(' 1. No Docker/VPS, confirme se o container Redis está em execução com:');
    console.log('    docker ps | grep redis');
    console.log(' 2. Verifique os logs do Redis:');
    console.log('    docker logs eventease-redis');
    console.log(' 3. Se estiver testando direto no host da VPS, altere REDIS_HOST=127.0.0.1 e REDIS_PORT=6380.');
    await redis.quit().catch(() => {});
    process.exit(1);
  }
}

testRedis();
