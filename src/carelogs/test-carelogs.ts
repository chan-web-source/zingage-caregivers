import { knexInstance } from '../infrastructure/database/knexConnection';
import { CaregiverRepository } from './repositories/CarelogsRepository';

async function testFindAllActive() {
 const repo = new CaregiverRepository(knexInstance);

 try {
  const activeCaregiver = await repo.findAllActive();
  console.table(activeCaregiver);
 } catch (error) {
  console.error('Error:', error);
 } finally {
  await knexInstance.destroy();
 }
}

async function insertData() {
 const repo = new CaregiverRepository(knexInstance);

 try {
  const activeCaregiver = await repo.insertData();
  console.table(activeCaregiver);
 } catch (error) {
  console.error('Error:', error);
 } finally {
  await knexInstance.destroy();
 }
}

// testFindAllActive();
insertData();