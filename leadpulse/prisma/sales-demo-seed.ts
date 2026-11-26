import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
async function main() {
  const email = process.env.FORTIVEX_CRM_EMAIL;
  const password = process.env.FORTIVEX_CRM_PASSWORD;
  if (!email || !password || !email.endsWith('@example.test') || password.length < 12) {
    throw new Error('Set a synthetic @example.test service email and a password of at least 12 characters.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await db.$transaction(async tx => {
    const manager = await tx.user.findUnique({ where: { email } });
    if (manager && manager.name !== 'FlowDesk Demo Connector') throw new Error('Service email already belongs to a different user.');
    await tx.user.upsert({
      where: { email }, create: { email, passwordHash, name: 'FlowDesk Demo Connector', role: 'MANAGER' },
      update: { passwordHash, role: 'MANAGER', isActive: true },
    });
    if (process.argv.includes('--reset')) {
      await tx.lead.deleteMany({ where: { tags: { has: 'fortivex-round3' } } });
      await tx.salesRun.deleteMany();
      await tx.salesSlot.deleteMany();
    }
    for (const [index, offset] of [2, 3, 4].entries()) {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() + offset);
      start.setUTCHours(5 + index, 0, 0, 0);
      const id = 'demo-' + start.toISOString().slice(0, 13).replace(/[-T]/g, '');
      await tx.salesSlot.upsert({ where: { id }, update: {}, create: { id, startsAt: start, timeZone: 'Asia/Kolkata' } });
    }
  });
  console.log('FlowDesk service account and future demo slots are ready.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
