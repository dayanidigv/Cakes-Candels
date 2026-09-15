import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { NumberSeriesService } from './src/modules/masters/number-series/number-series.service';
import { prisma } from '@cc-erp/database';

async function testConcurrency() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const numberSeriesService = app.get(NumberSeriesService);
  
  console.log('Testing number series concurrency...');
  
  // Ensure we have a number series to test
  let series = await prisma.numberSeries.findFirst({
    where: { documentType: 'TEST_DOC' }
  });
  
  if (!series) {
    series = await prisma.numberSeries.create({
      data: {
        documentType: 'TEST_DOC',
        prefix: 'TEST-',
        currentNumber: 0,
        length: 5,
        isActive: true,
      }
    });
  } else {
    // Reset it
    series = await prisma.numberSeries.update({
      where: { id: series.id },
      data: { currentNumber: 0 }
    });
  }

  const concurrentRequests = 100;
  console.log(`Running ${concurrentRequests} concurrent generate requests...`);
  
  const promises = [];
  for (let i = 0; i < concurrentRequests; i++) {
    promises.push(numberSeriesService.generateNextNumber('TEST_DOC'));
  }
  
  const start = Date.now();
  const results = await Promise.all(promises);
  const duration = Date.now() - start;
  
  const uniqueResults = new Set(results);
  
  console.log(`Generated ${results.length} numbers in ${duration}ms`);
  console.log(`Unique numbers generated: ${uniqueResults.size}`);
  
  if (results.length !== uniqueResults.size) {
    console.error('❌ FAIL: Duplicates detected!');
    // Find duplicates
    const counts = {};
    for (const r of results) counts[r] = (counts[r] || 0) + 1;
    for (const [k, v] of Object.entries(counts)) {
      if ((v as number) > 1) console.error(`Duplicate: ${k} appeared ${v} times`);
    }
  } else {
    console.log('✅ PASS: Zero duplicates under concurrency.');
  }
  
  await app.close();
  process.exit(0);
}

testConcurrency().catch(e => {
  console.error(e);
  process.exit(1);
});
