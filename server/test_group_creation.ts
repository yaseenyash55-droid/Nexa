import { getGroupRepository } from './src/repositories/factory.js';

async function run() {
  try {
    const repo = getGroupRepository();
    const group = await repo.createGroup({
      name: 'Test Group',
      createdBy: 1, // Assume user 1 exists
      memberIds: [2, 3] // Assume users 2 and 3 exist
    });
    console.log('Group created:', group);
    const members = await repo.getGroupMembers(group.groupId);
    console.log('Members:', members);
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
}
run();
