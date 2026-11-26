import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create Admin User
  const adminPassword = 'AdminPassword123!';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@leadpulse.com' },
    update: {},
    create: {
      email: 'admin@leadpulse.com',
      passwordHash: hashedPassword,
      name: 'System Administrator',
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log(`✅ Admin user created/verified: ${admin.email}`);

  // 2. Create a Manager
  const managerPassword = 'ManagerPassword123!';
  const hashedManagerPassword = await bcrypt.hash(managerPassword, 10);

  const manager = await prisma.user.upsert({
    where: { email: 'manager@leadpulse.com' },
    update: {},
    create: {
      email: 'manager@leadpulse.com',
      passwordHash: hashedManagerPassword,
      name: 'Sales Manager',
      role: Role.MANAGER,
      isActive: true,
    },
  });

  console.log(`✅ Manager user created/verified: ${manager.email}`);

  // 3. Create an Agent
  const agentPassword = 'AgentPassword123!';
  const hashedAgentPassword = await bcrypt.hash(agentPassword, 10);

  const agent = await prisma.user.upsert({
    where: { email: 'agent@leadpulse.com' },
    update: {},
    create: {
      email: 'agent@leadpulse.com',
      passwordHash: hashedAgentPassword,
      name: 'Lead Agent',
      role: Role.AGENT,
      isActive: true,
    },
  });

  console.log(`✅ Agent user created/verified: ${agent.email}`);

  console.log('🏁 Seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
